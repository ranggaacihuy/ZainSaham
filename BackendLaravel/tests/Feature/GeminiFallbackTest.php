<?php

namespace Tests\Feature;

use App\Models\AiAnalysis;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesMarketData;
use Tests\TestCase;

class GeminiFallbackTest extends TestCase
{
    use CreatesMarketData, RefreshDatabase;

    private array $payload;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.gemini.api_key' => 'test-key',
            'services.gemini.model' => 'gemini-main',
            'services.gemini.fallback_models' => 'gemini-backup, gemini-main',
        ]);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->payload = [
            'user_id' => $user->user_id,
            'stock_id' => $this->createStockWithMarketData('DMKN')->stock_id,
            'analysis_type' => 'fundamental',
        ];
    }

    private function ok(string $text): array
    {
        return ['candidates' => [['content' => ['parts' => [['text' => $text]]], 'finishReason' => 'STOP']]];
    }

    private function sentTo(string $model): int
    {
        return Http::recorded(fn (Request $r) => str_contains($r->url(), "/models/{$model}:"))->count();
    }

    public function test_busy_primary_model_falls_back_and_cools_down(): void
    {
        Http::fake([
            '*/models/gemini-main:generateContent' => Http::response(['error' => ['message' => 'high demand']], 503),
            '*/models/gemini-backup:generateContent' => Http::response($this->ok('Analisis dari model cadangan.')),
        ]);

        $this->postJson('/api/ai-analysis', $this->payload)
            ->assertCreated()
            ->assertJsonPath('data.analysis.model_name', 'gemini-backup')
            ->assertJsonPath('data.analysis.result', 'Analisis dari model cadangan.');

        $this->postJson('/api/ai-analysis', $this->payload)->assertCreated();

        $this->assertSame(1, $this->sentTo('gemini-main'));
        $this->assertSame(2, $this->sentTo('gemini-backup'));
        $this->assertSame(['gemini-backup', 'gemini-backup'], AiAnalysis::pluck('model_name')->all());
    }

    public function test_invalid_api_key_does_not_try_fallback(): void
    {
        Http::fake([
            '*' => Http::response(['error' => ['message' => 'API key not valid. Please pass a valid API key.']], 400),
        ]);

        $this->postJson('/api/ai-analysis', $this->payload)->assertStatus(502);

        $this->assertSame(1, $this->sentTo('gemini-main'));
        $this->assertSame(0, $this->sentTo('gemini-backup'));
    }

    public function test_all_models_failing_returns_last_error(): void
    {
        Http::fake([
            '*' => Http::response(['error' => ['message' => 'quota']], 429),
        ]);

        $this->postJson('/api/ai-analysis', $this->payload)
            ->assertStatus(502)
            ->assertJsonPath('message', 'Kuota layanan AI sedang habis atau terlalu banyak permintaan. Coba lagi beberapa saat lagi.');

        $this->assertSame(1, $this->sentTo('gemini-main'));
        $this->assertSame(1, $this->sentTo('gemini-backup'));
        $this->assertSame(0, AiAnalysis::count());
    }
}
