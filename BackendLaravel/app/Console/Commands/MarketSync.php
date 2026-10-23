<?php

namespace App\Console\Commands;

use App\Models\Stock;
use App\Services\MarketDataService;
use Illuminate\Console\Command;
use Throwable;

class MarketSync extends Command
{
    protected $signature = 'market:sync
        {tickers?* : Kode saham (mis. BBCA TLKM). Kosongkan untuk semua saham}
        {--range=1mo : Rentang data Yahoo: 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, max}';

    protected $description = 'Ambil harga harian (OHLCV) dari Yahoo Finance lalu hitung ulang indikator teknikal';

    public function handle(MarketDataService $market): int
    {
        $range = (string) $this->option('range');

        if (! in_array($range, MarketDataService::RANGES, true)) {
            $this->error('Range tidak valid. Pilih: '.implode(', ', MarketDataService::RANGES));

            return self::INVALID;
        }

        $tickers = array_map('strtoupper', $this->argument('tickers'));

        $stocks = Stock::query()
            ->when($tickers, fn ($q) => $q->whereIn('ticker', $tickers))
            ->orderBy('ticker')
            ->get();

        if ($stocks->isEmpty()) {
            $this->warn('Tidak ada saham untuk disinkronkan. Jalankan: php artisan db:seed --class=IdxStockSeeder');

            return self::FAILURE;
        }

        $failed = 0;
        $delay = max(0, (int) config('services.yahoo_finance.delay_ms', 800));

        foreach ($stocks as $index => $stock) {
            if ($index > 0 && $delay > 0) {
                usleep($delay * 1000);
            }

            try {
                $result = $market->sync($stock, $range);
                $this->line(sprintf('  %-6s %4d harga, %4d indikator', $stock->ticker, $result['prices'], $result['indicators']));
            } catch (Throwable $e) {
                $failed++;
                report($e);
                $this->error(sprintf('  %-6s gagal: %s', $stock->ticker, $e->getMessage()));
            }
        }

        $this->info(sprintf('Selesai: %d berhasil, %d gagal.', $stocks->count() - $failed, $failed));

        return $failed === $stocks->count() ? self::FAILURE : self::SUCCESS;
    }
}
