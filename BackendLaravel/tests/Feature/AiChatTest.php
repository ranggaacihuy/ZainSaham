<?php

namespace Tests\Feature;

use App\Models\AiMessage;
use App\Models\AnalysisSession;
use App\Models\Stock;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesMarketData;
use Tests\TestCase;

class AiChatTest extends TestCase
{
    use CreatesMarketData, RefreshDatabase;

    private User $user;

    private Stock $stock;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.gemini.api_key' => 'test-key']);

        $this->user = User::factory()->create();
        $this->stock = $this->createStockWithMarketData('DMTL');

        Sanctum::actingAs($this->user);
    }

    private function fakeGeminiParts(array $parts, string $finishReason = 'STOP'): void
    {
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [[
                    'content' => ['role' => 'model', 'parts' => $parts],
                    'finishReason' => $finishReason,
                ]],
            ]),
        ]);
    }

    public function test_chat_replies_and_stores_messages(): void
    {
        $this->fakeGeminiParts([
            ['text' => 'proses berpikir', 'thought' => true],
            ['text' => 'RSI DMTL '],
            ['text' => 'berada di zona netral.'],
        ]);

        $response = $this->postJson('/api/ai-chat', [
            'user_id' => $this->user->user_id,
            'stock_id' => $this->stock->stock_id,
            'message' => 'Bagaimana RSI saham ini?',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.assistant_message.content', 'RSI DMTL berada di zona netral.')
            ->assertJsonPath('data.stock.ticker', 'DMTL');

        $sessionId = $response->json('data.session_id');
        $this->assertSame(['user', 'assistant'], AiMessage::where('session_id', $sessionId)->orderBy('message_id')->pluck('role')->all());

        Http::assertSent(function (Request $request) {
            $system = $request['systemInstruction']['parts'][0]['text'];

            return $request->hasHeader('x-goog-api-key', 'test-key')
                && str_contains($system, '"ticker":"DMTL"')
                && str_contains($system, '"price_summary"')
                && count($request['contents']) === 1
                && $request['contents'][0]['role'] === 'user';
        });
    }

    public function test_chat_sends_only_recent_history(): void
    {
        $this->fakeGeminiParts([['text' => 'Oke.']]);

        $session = AnalysisSession::create([
            'user_id' => $this->user->user_id,
            'stock_id' => $this->stock->stock_id,
            'analysis_type' => 'combined',
        ]);

        for ($i = 1; $i <= 30; $i++) {
            AiMessage::create([
                'session_id' => $session->session_id,
                'role' => $i % 2 ? 'user' : 'assistant',
                'content' => "pesan {$i}",
                'created_at' => Carbon::now()->subMinutes(60 - $i),
            ]);
        }

        $this->postJson('/api/ai-chat', [
            'user_id' => $this->user->user_id,
            'stock_id' => $this->stock->stock_id,
            'session_id' => $session->session_id,
            'message' => 'pertanyaan baru',
        ])->assertOk();

        Http::assertSent(function (Request $request) {
            $contents = $request['contents'];
            $texts = array_map(fn ($c) => $c['parts'][0]['text'], $contents);

            return count($contents) === 21
                && $contents[0]['role'] === 'user'
                && $texts[0] === 'pesan 11'
                && $texts[19] === 'pesan 30'
                && $texts[20] === 'pertanyaan baru';
        });
    }

    public function test_missing_api_key_returns_502_with_session_id(): void
    {
        config(['services.gemini.api_key' => null]);
        Http::fake();

        $response = $this->postJson('/api/ai-chat', [
            'user_id' => $this->user->user_id,
            'stock_id' => $this->stock->stock_id,
            'message' => 'Halo',
        ]);

        $response->assertStatus(502)
            ->assertJsonPath('message', 'Layanan AI belum dikonfigurasi. Isi GEMINI_API_KEY di file .env backend.');
        $this->assertNotNull($response->json('data.session_id'));
        Http::assertNothingSent();
    }

    public function test_blocked_reply_returns_friendly_message(): void
    {
        $this->fakeGeminiParts([], 'SAFETY');

        $this->postJson('/api/ai-chat', [
            'user_id' => $this->user->user_id,
            'stock_id' => $this->stock->stock_id,
            'message' => 'Halo',
        ])->assertStatus(502)
            ->assertJsonPath('message', 'Jawaban AI diblokir oleh filter keamanan. Coba ubah pertanyaan.');
    }

    public function test_session_of_other_user_is_rejected(): void
    {
        $session = AnalysisSession::create([
            'user_id' => User::factory()->create()->user_id,
            'stock_id' => $this->stock->stock_id,
            'analysis_type' => 'combined',
        ]);

        $this->postJson('/api/ai-chat', [
            'user_id' => $this->user->user_id,
            'stock_id' => $this->stock->stock_id,
            'session_id' => $session->session_id,
            'message' => 'Halo',
        ])->assertStatus(403);
    }
}
