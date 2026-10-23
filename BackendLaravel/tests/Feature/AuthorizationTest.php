<?php

namespace Tests\Feature;

use App\Models\AnalysisSession;
use App\Models\Stock;
use App\Models\User;
use App\Models\Watchlist;
use Database\Seeders\DemoUserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuthorizationTest extends TestCase
{
    use RefreshDatabase;

    private Stock $stock;

    protected function setUp(): void
    {
        parent::setUp();

        $this->stock = Stock::create([
            'ticker' => 'BBCA',
            'company_name' => 'PT Bank Central Asia Tbk',
            'sector' => 'Keuangan',
            'exchange' => 'IDX',
            'currency' => 'IDR',
        ]);
    }

    public function test_demo_user_can_log_in_and_use_token(): void
    {
        $this->seed(DemoUserSeeder::class);

        $token = $this->postJson('/api/login', [
            'email' => DemoUserSeeder::EMAIL,
            'password' => DemoUserSeeder::PASSWORD,
        ])->assertOk()->json('data.token');

        $this->withToken($token)
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('data.email', DemoUserSeeder::EMAIL)
            ->assertJsonMissingPath('data.password_hash');
    }

    public function test_demo_seeder_is_idempotent(): void
    {
        $this->seed(DemoUserSeeder::class);
        $this->seed(DemoUserSeeder::class);

        $this->assertSame(1, User::where('email', DemoUserSeeder::EMAIL)->count());
    }

    public function test_logout_revokes_token(): void
    {
        $this->seed(DemoUserSeeder::class);

        $token = $this->postJson('/api/login', [
            'email' => DemoUserSeeder::EMAIL,
            'password' => DemoUserSeeder::PASSWORD,
        ])->json('data.token');

        $this->withToken($token)->postJson('/api/logout')->assertOk();
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->getJson('/api/me')->assertUnauthorized();
    }

    public function test_wrong_password_is_rejected(): void
    {
        $this->seed(DemoUserSeeder::class);

        $this->postJson('/api/login', [
            'email' => DemoUserSeeder::EMAIL,
            'password' => 'salah-sandi',
        ])->assertUnauthorized()->assertJsonPath('message', 'Email atau kata sandi salah.');
    }

    public function test_public_market_endpoints_do_not_need_login(): void
    {
        $this->getJson('/api/stocks')->assertOk();
        $this->getJson("/api/stocks/{$this->stock->stock_id}/prices")->assertOk();
        $this->getJson("/api/stocks/{$this->stock->stock_id}/indicators")->assertOk();
    }

    public function test_private_endpoints_need_login(): void
    {
        $user = User::factory()->create();

        $this->getJson('/api/me')->assertUnauthorized();
        $this->getJson("/api/users/{$user->user_id}/watchlist")->assertUnauthorized();
        $this->postJson('/api/watchlists', ['user_id' => $user->user_id, 'stock_id' => $this->stock->stock_id])->assertUnauthorized();
        $this->getJson("/api/stocks/{$this->stock->stock_id}/ai-analysis")->assertUnauthorized();
        $this->postJson('/api/ai-analysis', [])->assertUnauthorized();
        $this->postJson('/api/ai-chat', [])->assertUnauthorized();
        $this->getJson('/api/ai-chat/1/messages')->assertUnauthorized();
    }

    public function test_user_cannot_touch_other_users_data(): void
    {
        $owner = User::factory()->create();
        $intruder = User::factory()->create();

        $watchlist = Watchlist::create(['user_id' => $owner->user_id, 'stock_id' => $this->stock->stock_id]);
        $session = AnalysisSession::create([
            'user_id' => $owner->user_id,
            'stock_id' => $this->stock->stock_id,
            'analysis_type' => 'combined',
        ]);

        Sanctum::actingAs($intruder);

        $this->getJson("/api/users/{$owner->user_id}/watchlist")->assertForbidden();
        $this->postJson('/api/watchlists', ['user_id' => $owner->user_id, 'stock_id' => $this->stock->stock_id])->assertForbidden();
        $this->deleteJson("/api/watchlists/{$watchlist->watchlist_id}")->assertNotFound();
        $this->getJson("/api/ai-chat/{$session->session_id}/messages")->assertNotFound();
        $this->postJson('/api/ai-analysis', [
            'user_id' => $owner->user_id,
            'stock_id' => $this->stock->stock_id,
            'analysis_type' => 'teknikal',
        ])->assertForbidden();
        $this->postJson('/api/ai-chat', [
            'user_id' => $owner->user_id,
            'stock_id' => $this->stock->stock_id,
            'message' => 'Halo',
        ])->assertForbidden();

        $this->assertDatabaseHas('watchlists', ['watchlist_id' => $watchlist->watchlist_id]);
    }

    public function test_user_manages_own_watchlist(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $payload = ['user_id' => $user->user_id, 'stock_id' => $this->stock->stock_id];
        $id = $this->postJson('/api/watchlists', $payload)->assertCreated()->json('data.watchlist_id');
        $this->postJson('/api/watchlists', $payload)->assertCreated()->assertJsonPath('data.watchlist_id', $id);

        $this->getJson("/api/users/{$user->user_id}/watchlist")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.stock.ticker', 'BBCA');

        $this->deleteJson("/api/watchlists/{$id}")->assertOk();
        $this->assertDatabaseCount('watchlists', 0);
    }
}
