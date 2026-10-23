<?php

namespace Tests\Feature;

use App\Models\Stock;
use App\Models\StockPrice;
use App\Models\TechnicalIndicator;
use Database\Seeders\IdxStockSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class MarketSyncTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.yahoo_finance.delay_ms' => 0]);
    }

    private function yahooChart(string $symbol, int $days = 40): array
    {
        $start = strtotime('2026-08-03 02:00:00 UTC');
        $timestamps = [];
        $quote = ['open' => [], 'high' => [], 'low' => [], 'close' => [], 'volume' => []];

        for ($i = 0; $i < $days; $i++) {
            $timestamps[] = $start + $i * 86400;
            $close = 5000 + $i * 10;
            $quote['open'][] = $close - 20;
            $quote['high'][] = $close + 30;
            $quote['low'][] = $close - 40;
            $quote['close'][] = $i === $days - 1 ? null : $close;
            $quote['volume'][] = 1000 * ($i + 1);
        }

        return ['chart' => ['result' => [[
            'meta' => [
                'symbol' => $symbol,
                'currency' => 'IDR',
                'exchangeName' => 'JKT',
                'exchangeTimezoneName' => 'Asia/Jakarta',
                'longName' => 'PT Bank Central Asia Tbk',
            ],
            'timestamp' => $timestamps,
            'indicators' => ['quote' => [$quote]],
        ]], 'error' => null]];
    }

    public function test_sync_upserts_prices_indicators_and_company_name(): void
    {
        $stock = Stock::create(['ticker' => 'BBCA', 'company_name' => 'BBCA', 'sector' => 'Keuangan', 'exchange' => 'IDX', 'currency' => 'IDR']);

        Http::fake([
            'query1.finance.yahoo.com/v8/finance/chart/BBCA.JK*' => Http::response($this->yahooChart('BBCA.JK')),
        ]);

        $this->artisan('market:sync', ['tickers' => ['bbca'], '--range' => '3mo'])
            ->expectsOutputToContain('Selesai: 1 berhasil, 0 gagal.')
            ->assertSuccessful();

        $this->assertSame(39, StockPrice::where('stock_id', $stock->stock_id)->count());
        $this->assertSame(39, TechnicalIndicator::where('stock_id', $stock->stock_id)->count());
        $this->assertSame('PT Bank Central Asia Tbk', $stock->fresh()->company_name);

        $first = StockPrice::where('stock_id', $stock->stock_id)->orderBy('price_date')->first();
        $this->assertSame('2026-08-03', $first->price_date->toDateString());
        $this->assertEquals(4980, $first->open_price);
        $this->assertSame(1000, $first->volume);

        $last = TechnicalIndicator::where('stock_id', $stock->stock_id)->orderByDesc('indicator_date')->first();
        $this->assertNotNull($last->sma_20);
        $this->assertNotNull($last->macd);
        $this->assertNull($last->sma_50);

        Http::assertSent(fn (Request $r) => str_contains($r->url(), 'range=3mo') && str_contains($r->url(), 'interval=1d'));

        $this->artisan('market:sync', ['tickers' => ['BBCA']])->assertSuccessful();
        $this->assertSame(39, StockPrice::where('stock_id', $stock->stock_id)->count());
    }

    public function test_one_failing_stock_does_not_stop_others(): void
    {
        foreach (['BBCA', 'XXXX'] as $ticker) {
            Stock::create(['ticker' => $ticker, 'company_name' => $ticker, 'exchange' => 'IDX', 'currency' => 'IDR']);
        }

        Http::fake([
            '*/chart/BBCA.JK*' => Http::response($this->yahooChart('BBCA.JK')),
            '*/chart/XXXX.JK*' => Http::response(['chart' => ['result' => null, 'error' => ['code' => 'Not Found', 'description' => 'No data found, symbol may be delisted']]], 404),
        ]);

        $this->artisan('market:sync')
            ->expectsOutputToContain('XXXX   gagal: Kode saham XXXX.JK tidak dikenali Yahoo Finance.')
            ->expectsOutputToContain('Selesai: 1 berhasil, 1 gagal.')
            ->assertSuccessful();

        $this->assertSame(39, StockPrice::count());
    }

    public function test_invalid_range_is_rejected(): void
    {
        $this->artisan('market:sync', ['--range' => '3d'])->assertFailed();
    }

    public function test_seeder_creates_only_stocks_found_on_yahoo(): void
    {
        Http::fake([
            '*/chart/BBCA.JK*' => Http::response($this->yahooChart('BBCA.JK')),
            '*' => Http::response(['chart' => ['result' => null, 'error' => ['description' => 'No data found']]], 404),
        ]);

        $this->seed(IdxStockSeeder::class);

        $this->assertSame(['BBCA'], Stock::pluck('ticker')->all());
        $this->assertSame('PT Bank Central Asia Tbk', Stock::first()->company_name);
        $this->assertSame('Keuangan', Stock::first()->sector);
        $this->assertSame(39, StockPrice::count());
        Http::assertSentCount(count(IdxStockSeeder::STOCKS));
    }
}
