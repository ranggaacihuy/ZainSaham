<?php

namespace Tests\Feature;

use App\Models\AiAnalysis;
use App\Models\AnalysisSession;
use App\Models\News;
use App\Models\Stock;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesMarketData;
use Tests\TestCase;

class AiAnalysisTest extends TestCase
{
    use CreatesMarketData, RefreshDatabase;

    private User $user;

    private Stock $stock;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.gemini.api_key' => 'test-key',
            'services.gemini.model' => 'gemini-test',
        ]);

        $this->user = User::factory()->create();
        $this->stock = $this->createStockWithMarketData('DMBK');

        Sanctum::actingAs($this->user);
    }

    private function fakeGemini(string $text = '## Ringkasan\nHasil analisis.'): void
    {
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [[
                    'content' => ['role' => 'model', 'parts' => [['text' => $text]]],
                    'finishReason' => 'STOP',
                ]],
            ]),
        ]);
    }

    public function test_analysis_calls_gemini_and_stores_result(): void
    {
        $this->fakeGemini('## Ringkasan'."\n".'Tren DMBK naik.');

        $response = $this->postJson('/api/ai-analysis', [
            'user_id' => $this->user->user_id,
            'stock_id' => $this->stock->stock_id,
            'analysis_type' => 'teknikal',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.analysis.model_name', 'gemini-test')
            ->assertJsonPath('data.analysis.result', "## Ringkasan\nTren DMBK naik.")
            ->assertJsonPath('data.session.analysis_type', 'teknikal')
            ->assertJsonMissingPath('data.analysis.context_data');

        $analysis = AiAnalysis::firstOrFail();
        $this->assertCount(60, $analysis->context_data['prices']);
        $this->assertCount(30, $analysis->context_data['indicators']);
        $this->assertArrayNotHasKey('news', $analysis->context_data);
        $this->assertSame('DMBK', $analysis->context_data['stock']['ticker']);

        Http::assertSent(function (Request $request) {
            return $request->hasHeader('x-goog-api-key', 'test-key')
                && ! str_contains($request->url(), 'key=')
                && str_ends_with($request->url(), '/models/gemini-test:generateContent')
                && str_contains($request['contents'][0]['parts'][0]['text'], 'DMBK');
        });
    }

    public function test_menyeluruh_is_stored_as_combined_with_reduced_context(): void
    {
        $this->fakeGemini();

        $this->postJson('/api/ai-analysis', [
            'user_id' => $this->user->user_id,
            'stock_id' => $this->stock->stock_id,
            'analysis_type' => 'menyeluruh',
        ])->assertCreated()->assertJsonPath('data.session.analysis_type', 'combined');

        $context = AiAnalysis::firstOrFail()->context_data;
        $this->assertCount(30, $context['prices']);
        $this->assertCount(10, $context['indicators']);
        $this->assertCount(4, $context['fundamentals']);
        $this->assertCount(5, $context['news']);
    }

    public function test_gemini_failure_returns_502_without_creating_session(): void
    {
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response([
                'error' => ['code' => 400, 'message' => 'API key not valid. Please pass a valid API key.'],
            ], 400),
        ]);

        $this->postJson('/api/ai-analysis', [
            'user_id' => $this->user->user_id,
            'stock_id' => $this->stock->stock_id,
            'analysis_type' => 'fundamental',
        ])->assertStatus(502)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'API key Gemini tidak valid atau tidak punya akses. Periksa GEMINI_API_KEY di .env backend.');

        $this->assertSame(0, AnalysisSession::count());
    }

    public function test_missing_data_returns_422(): void
    {
        Http::fake();
        News::where('stock_id', $this->stock->stock_id)->delete();

        $this->postJson('/api/ai-analysis', [
            'user_id' => $this->user->user_id,
            'stock_id' => $this->stock->stock_id,
            'analysis_type' => 'sentimen',
        ])->assertStatus(422)->assertJsonPath('message', 'Belum ada berita DMBK untuk analisis sentimen.');

        Http::assertNothingSent();
    }

    public function test_invalid_analysis_type_is_rejected(): void
    {
        $this->postJson('/api/ai-analysis', [
            'user_id' => $this->user->user_id,
            'stock_id' => $this->stock->stock_id,
            'analysis_type' => 'astrologi',
        ])->assertStatus(422)->assertJsonValidationErrors('analysis_type');
    }

    public function test_reanalysis_adds_result_to_the_same_session(): void
    {
        $this->fakeGemini();

        $sessionId = $this->postJson('/api/ai-analysis', [
            'user_id' => $this->user->user_id,
            'stock_id' => $this->stock->stock_id,
            'analysis_type' => 'teknikal',
        ])->json('data.session.session_id');

        $this->postJson('/api/ai-analysis', [
            'user_id' => $this->user->user_id,
            'stock_id' => $this->stock->stock_id,
            'analysis_type' => 'teknikal',
            'session_id' => $sessionId,
        ])->assertCreated()->assertJsonPath('data.session.session_id', $sessionId);

        $this->assertSame(1, AnalysisSession::count());
        $this->assertSame(2, AiAnalysis::where('session_id', $sessionId)->count());
    }

    public function test_index_only_returns_own_analyses_without_context_data(): void
    {
        $this->fakeGemini();
        $other = User::factory()->create();

        foreach ([$this->user, $other] as $user) {
            Sanctum::actingAs($user);

            $this->postJson('/api/ai-analysis', [
                'user_id' => $user->user_id,
                'stock_id' => $this->stock->stock_id,
                'analysis_type' => 'teknikal',
            ])->assertCreated();
        }

        Sanctum::actingAs($this->user);

        $this->getJson("/api/stocks/{$this->stock->stock_id}/ai-analysis?user_id={$other->user_id}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.session.user_id', $this->user->user_id)
            ->assertJsonMissingPath('data.0.context_data');
    }
}
