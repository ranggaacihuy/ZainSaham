<?php

namespace Tests\Concerns;

use App\Models\News;
use App\Models\Stock;
use App\Models\StockFundamental;
use App\Models\StockPrice;
use App\Services\MarketDataService;

trait CreatesMarketData
{
    protected function createStockWithMarketData(string $ticker, int $days = 130, int $news = 5): Stock
    {
        $stock = Stock::create([
            'ticker' => $ticker,
            'company_name' => "PT {$ticker} Test Tbk",
            'sector' => 'Keuangan',
            'exchange' => 'IDX',
            'currency' => 'IDR',
        ]);

        $rows = [];
        $date = now()->startOfDay()->subDays($days);

        for ($i = 0; $i < $days; $i++) {
            $close = 1000 + 50 * sin($i / 7) + $i;
            $rows[] = [
                'stock_id' => $stock->stock_id,
                'price_date' => $date->copy()->addDays($i)->toDateString(),
                'open_price' => $close - 5,
                'high_price' => $close + 10,
                'low_price' => $close - 10,
                'close_price' => $close,
                'volume' => 1_000_000 + $i,
                'created_at' => now(),
            ];
        }

        StockPrice::insert($rows);
        app(MarketDataService::class)->recalculateIndicators($stock);

        foreach (['2025-Q3', '2025-Q4', '2026-Q1', '2026-Q2'] as $n => $period) {
            StockFundamental::create([
                'stock_id' => $stock->stock_id,
                'period' => $period,
                'revenue' => 1_000_000 * ($n + 1),
                'net_income' => 200_000 * ($n + 1),
                'total_assets' => 10_000_000,
                'total_liabilities' => 6_000_000,
                'total_equity' => 4_000_000,
                'eps' => 10 + $n,
                'roe' => 15,
                'roa' => 5,
                'debt_to_equity' => 1.5,
            ]);
        }

        for ($n = 1; $n <= $news; $n++) {
            News::create([
                'stock_id' => $stock->stock_id,
                'title' => "Berita {$n} {$ticker}",
                'content' => str_repeat("Isi berita {$n}. ", 60),
                'source' => 'Test',
                'source_url' => "https://example.test/{$ticker}/{$n}",
                'published_at' => now()->subDays($n),
            ]);
        }

        return $stock;
    }
}
