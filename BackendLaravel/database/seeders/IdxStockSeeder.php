<?php

namespace Database\Seeders;

use App\Models\Stock;
use App\Services\MarketDataService;
use Illuminate\Database\Seeder;
use RuntimeException;
use Throwable;

class IdxStockSeeder extends Seeder
{
    public const STOCKS = [
        'BBCA' => 'Keuangan',
        'BBRI' => 'Keuangan',
        'BMRI' => 'Keuangan',
        'BBNI' => 'Keuangan',
        'BRIS' => 'Keuangan',
        'TLKM' => 'Infrastruktur',
        'JSMR' => 'Infrastruktur',
        'ASII' => 'Perindustrian',
        'UNTR' => 'Perindustrian',
        'UNVR' => 'Barang Konsumen Primer',
        'ICBP' => 'Barang Konsumen Primer',
        'INDF' => 'Barang Konsumen Primer',
        'AMRT' => 'Barang Konsumen Primer',
        'CPIN' => 'Barang Konsumen Primer',
        'KLBF' => 'Kesehatan',
        'ANTM' => 'Barang Baku',
        'INCO' => 'Barang Baku',
        'SMGR' => 'Barang Baku',
        'PGAS' => 'Energi',
        'PTBA' => 'Energi',
        'GOTO' => 'Teknologi',
    ];

    public function run(MarketDataService $market): void
    {
        $delay = max(0, (int) config('services.yahoo_finance.delay_ms', 800));

        foreach (self::STOCKS as $ticker => $sector) {
            try {
                $data = $market->fetchDaily($ticker, '5y');
                $name = $data['meta']['longName'] ?? $data['meta']['shortName'] ?? null;

                if (! is_string($name) || $name === '') {
                    throw new RuntimeException('Nama perusahaan tidak tersedia dari Yahoo Finance.');
                }

                $stock = Stock::updateOrCreate(
                    ['ticker' => $ticker],
                    [
                        'company_name' => $name,
                        'sector' => $sector,
                        'exchange' => 'IDX',
                        'currency' => $data['meta']['currency'] ?? 'IDR',
                    ]
                );

                $result = $market->store($stock, $data);
                $this->command?->line(sprintf('  %-6s %s — %d harga', $ticker, $name, $result['prices']));
            } catch (Throwable $e) {
                $this->command?->warn(sprintf('  %-6s dilewati: %s', $ticker, $e->getMessage()));
            }

            if ($delay > 0) {
                usleep($delay * 1000);
            }
        }
    }
}
