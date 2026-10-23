<?php

namespace Tests\Feature;

use App\Models\Stock;
use App\Models\StockPrice;
use App\Models\TechnicalIndicator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class StockQuoteTest extends TestCase
{
    use RefreshDatabase;

    private Stock $stock;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-10-21 06:55:00 UTC');

        $this->stock = Stock::create([
            'ticker' => 'BBCA',
            'company_name' => 'PT Bank Central Asia Tbk',
            'sector' => 'Keuangan',
            'exchange' => 'IDX',
            'currency' => 'IDR',
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    private function liveChart(?float $todayClose): array
    {
        $days = ['2026-10-15' => 6075, '2026-10-16' => 5175, '2026-10-19' => 4820, '2026-10-20' => 5100, '2026-10-21' => $todayClose];
        $quote = ['open' => [], 'high' => [], 'low' => [], 'close' => [], 'volume' => []];
        $timestamps = [];

        foreach ($days as $date => $close) {
            $timestamps[] = strtotime("{$date} 02:00:00 UTC");
            $quote['open'][] = $date === '2026-10-21' ? 5300 : $close;
            $quote['high'][] = $date === '2026-10-21' ? 5350 : $close + 50;
            $quote['low'][] = $date === '2026-10-21' ? 5125 : $close - 50;
            $quote['close'][] = $close;
            $quote['volume'][] = $date === '2026-10-21' ? null : 100_000_000;
        }

        return ['chart' => ['result' => [[
            'meta' => [
                'symbol' => 'BBCA.JK',
                'currency' => 'IDR',
                'exchangeTimezoneName' => 'Asia/Jakarta',
                'longName' => 'PT Bank Central Asia Tbk',
                'regularMarketTime' => strtotime('2026-10-21 06:45:07 UTC'),
                'regularMarketPrice' => 5200,
                'regularMarketDayHigh' => 5350,
                'regularMarketDayLow' => 5125,
                'regularMarketVolume' => 319_506_900,
                'currentTradingPeriod' => ['regular' => [
                    'start' => strtotime('2026-10-21 02:00:00 UTC'),
                    'end' => strtotime('2026-10-21 09:15:00 UTC'),
                ]],
            ],
            'timestamp' => $timestamps,
            'indicators' => ['quote' => [$quote]],
        ]], 'error' => null]];
    }

    public function test_quote_returns_live_candle_and_stores_it(): void
    {
        Http::fake(['*/chart/BBCA.JK*' => Http::response($this->liveChart(null))]);

        $this->getJson("/api/stocks/{$this->stock->stock_id}/quote")
            ->assertOk()
            ->assertJsonPath('data.is_open', true)
            ->assertJsonPath('data.price.price_date', '2026-10-21')
            ->assertJsonPath('data.price.close_price', 5200)
            ->assertJsonPath('data.price.open_price', 5300)
            ->assertJsonPath('data.price.volume', 319_506_900)
            ->assertJsonPath('data.prev_close', 5100)
            ->assertJsonPath('data.change', 100)
            ->assertJsonPath('data.change_pct', 1.96);

        $today = StockPrice::where('stock_id', $this->stock->stock_id)->whereDate('price_date', '2026-10-21')->first();
        $this->assertEquals(5200, $today->close_price);
        $this->assertSame(5, StockPrice::count());
        $this->assertSame(5, TechnicalIndicator::count());

        Http::assertSent(fn ($request) => str_contains($request->url(), 'range=5d'));
    }

    public function test_quote_is_cached_briefly_per_stock(): void
    {
        Http::fake(['*/chart/BBCA.JK*' => Http::response($this->liveChart(5200))]);

        $this->getJson("/api/stocks/{$this->stock->stock_id}/quote")->assertOk();
        $this->getJson("/api/stocks/{$this->stock->stock_id}/quote")->assertOk();
        Http::assertSentCount(1);

        Carbon::setTestNow(now()->addSeconds(16));
        $this->getJson("/api/stocks/{$this->stock->stock_id}/quote")->assertOk();
        Http::assertSentCount(2);
    }

    public function test_quote_reports_closed_market(): void
    {
        Carbon::setTestNow('2026-10-21 10:00:00 UTC');
        Http::fake(['*/chart/BBCA.JK*' => Http::response($this->liveChart(5200))]);

        $this->getJson("/api/stocks/{$this->stock->stock_id}/quote")
            ->assertOk()
            ->assertJsonPath('data.is_open', false)
            ->assertJsonPath('data.price.close_price', 5200);
    }

    public function test_quote_returns_502_when_yahoo_fails(): void
    {
        Http::fake(['*' => Http::response('', 400)]);

        $this->getJson("/api/stocks/{$this->stock->stock_id}/quote")
            ->assertStatus(502)
            ->assertJsonPath('success', false);
    }

    public function test_quote_for_unknown_stock_returns_404(): void
    {
        Http::fake();

        $this->getJson('/api/stocks/999/quote')->assertNotFound();
        Http::assertNothingSent();
    }
}
