<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Stock;
use App\Models\StockPrice;
use App\Models\TechnicalIndicator;
use App\Models\StockFundamental;
use App\Models\News;
use App\Models\Watchlist;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 1. Seed demo user
        $user = User::updateOrCreate(
            ['email' => 'investor@zainsaham.id'],
            [
                'name' => 'Investor Zain',
                'password' => Hash::make('password123'),
                'password_hash' => Hash::make('password123'),
            ]
        );

        // 2. Seed Stocks
        $stocksData = [
            [
                'stock_id' => 1,
                'ticker' => 'BBCA',
                'company_name' => 'Bank Central Asia Tbk.',
                'sector' => 'Keuangan',
                'exchange' => 'IDX',
                'currency' => 'IDR',
                'basePrice' => 9150,
            ],
            [
                'stock_id' => 2,
                'ticker' => 'BBRI',
                'company_name' => 'Bank Rakyat Indonesia (Persero) Tbk.',
                'sector' => 'Keuangan',
                'exchange' => 'IDX',
                'currency' => 'IDR',
                'basePrice' => 4320,
            ],
            [
                'stock_id' => 3,
                'ticker' => 'BMRI',
                'company_name' => 'Bank Mandiri (Persero) Tbk.',
                'sector' => 'Keuangan',
                'exchange' => 'IDX',
                'currency' => 'IDR',
                'basePrice' => 6450,
            ],
            [
                'stock_id' => 4,
                'ticker' => 'TLKM',
                'company_name' => 'Telkom Indonesia (Persero) Tbk.',
                'sector' => 'Infrastruktur',
                'exchange' => 'IDX',
                'currency' => 'IDR',
                'basePrice' => 2980,
            ],
            [
                'stock_id' => 5,
                'ticker' => 'ASII',
                'company_name' => 'Astra International Tbk.',
                'sector' => 'Perindustrian',
                'exchange' => 'IDX',
                'currency' => 'IDR',
                'basePrice' => 5075,
            ],
            [
                'stock_id' => 6,
                'ticker' => 'ANTM',
                'company_name' => 'Aneka Tambang Tbk.',
                'sector' => 'Material Dasar',
                'exchange' => 'IDX',
                'currency' => 'IDR',
                'basePrice' => 1865,
            ],
            [
                'stock_id' => 7,
                'ticker' => 'MDKA',
                'company_name' => 'Merdeka Copper Gold Tbk.',
                'sector' => 'Material Dasar',
                'exchange' => 'IDX',
                'currency' => 'IDR',
                'basePrice' => 2410,
            ],
            [
                'stock_id' => 8,
                'ticker' => 'INCO',
                'company_name' => 'Vale Indonesia Tbk.',
                'sector' => 'Material Dasar',
                'exchange' => 'IDX',
                'currency' => 'IDR',
                'basePrice' => 3920,
            ],
            [
                'stock_id' => 9,
                'ticker' => 'GOTO',
                'company_name' => 'GoTo Gojek Tokopedia Tbk.',
                'sector' => 'Teknologi',
                'exchange' => 'IDX',
                'currency' => 'IDR',
                'basePrice' => 68,
            ],
            [
                'stock_id' => 10,
                'ticker' => 'BBNI',
                'company_name' => 'Bank Negara Indonesia (Persero) Tbk.',
                'sector' => 'Keuangan',
                'exchange' => 'IDX',
                'currency' => 'IDR',
                'basePrice' => 5300,
            ],
            [
                'stock_id' => 11,
                'ticker' => 'UNVR',
                'company_name' => 'Unilever Indonesia Tbk.',
                'sector' => 'Konsumen Primer',
                'exchange' => 'IDX',
                'currency' => 'IDR',
                'basePrice' => 2180,
            ],
            [
                'stock_id' => 12,
                'ticker' => 'ICBP',
                'company_name' => 'Indofood CBP Sukses Makmur Tbk.',
                'sector' => 'Konsumen Primer',
                'exchange' => 'IDX',
                'currency' => 'IDR',
                'basePrice' => 11200,
            ],
            [
                'stock_id' => 13,
                'ticker' => 'ADRO',
                'company_name' => 'Adaro Energy Indonesia Tbk.',
                'sector' => 'Energi',
                'exchange' => 'IDX',
                'currency' => 'IDR',
                'basePrice' => 3650,
            ],
            [
                'stock_id' => 14,
                'ticker' => 'AMMN',
                'company_name' => 'Amman Mineral Internasional Tbk.',
                'sector' => 'Material Dasar',
                'exchange' => 'IDX',
                'currency' => 'IDR',
                'basePrice' => 9300,
            ],
        ];

        foreach ($stocksData as $item) {
            $base = $item['basePrice'];
            unset($item['basePrice']);

            $stock = Stock::updateOrCreate(
                ['stock_id' => $item['stock_id']],
                $item
            );

            // Seed historical prices & indicators for 30 trading days
            $currPrice = $base;
            for ($d = 30; $d >= 0; $d--) {
                $date = Carbon::now()->subDays($d);
                if ($date->isWeekend()) continue;

                $change = ($currPrice * ((rand(-20, 25)) / 1000));
                $open = round($currPrice);
                $close = round(max(50, $open + $change));
                $high = round(max($open, $close) * (1 + (rand(2, 12) / 1000)));
                $low = round(min($open, $close) * (1 - (rand(2, 12) / 1000)));
                $volume = rand(5000000, 45000000);

                StockPrice::updateOrCreate(
                    [
                        'stock_id' => $stock->stock_id,
                        'price_date' => $date->toDateString(),
                    ],
                    [
                        'open_price' => $open,
                        'high_price' => $high,
                        'low_price' => $low,
                        'close_price' => $close,
                        'volume' => $volume,
                    ]
                );

                TechnicalIndicator::updateOrCreate(
                    [
                        'stock_id' => $stock->stock_id,
                        'indicator_date' => $date->toDateString(),
                    ],
                    [
                        'rsi_14' => rand(35, 75) + (rand(0, 99) / 100),
                        'macd' => rand(-15, 25) + (rand(0, 99) / 100),
                        'macd_signal' => rand(-10, 20) + (rand(0, 99) / 100),
                        'sma_20' => round($close * 0.98),
                        'sma_50' => round($close * 0.95),
                    ]
                );

                $currPrice = $close;
            }

            // Seed fundamentals (Quarterly)
            StockFundamental::updateOrCreate(
                [
                    'stock_id' => $stock->stock_id,
                    'period' => '2026-Q2',
                ],
                [
                    'revenue' => rand(20000000, 85000000) * 1000,
                    'net_income' => rand(5000000, 25000000) * 1000,
                    'total_assets' => rand(150000000, 900000000) * 1000,
                    'total_liabilities' => rand(80000000, 500000000) * 1000,
                    'total_equity' => rand(70000000, 400000000) * 1000,
                    'eps' => rand(150, 450),
                    'roe' => 18.5,
                    'roa' => 3.2,
                    'debt_to_equity' => 0.85,
                ]
            );

            // Seed news
            News::updateOrCreate(
                [
                    'stock_id' => $stock->stock_id,
                    'title' => "Kinerja Keuangan {$stock->ticker} Menguat Seiring Ekspansi Bisnis",
                ],
                [
                    'content' => "Emiten {$stock->company_name} ({$stock->ticker}) mencatatkan pertumbuhan kinerja yang solid pada kuartal berjalan didorong oleh peningkatan volume transaksi dan ekspansi portofolio.",
                    'source' => 'Bisnis Indonesia',
                    'source_url' => 'https://market.bisnis.com',
                    'published_at' => Carbon::now()->subDays(rand(1, 5)),
                ]
            );
        }

        // 3. Seed Watchlist for default user
        Watchlist::updateOrCreate([
            'user_id' => $user->user_id,
            'stock_id' => 1,
        ]);
        Watchlist::updateOrCreate([
            'user_id' => $user->user_id,
            'stock_id' => 2,
        ]);
        Watchlist::updateOrCreate([
            'user_id' => $user->user_id,
            'stock_id' => 4,
        ]);
    }
}
