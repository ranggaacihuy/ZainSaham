<?php

namespace App\Services;

use App\Models\News;
use App\Models\Stock;
use App\Models\StockFundamental;
use App\Models\StockPrice;
use App\Models\TechnicalIndicator;
use Illuminate\Support\Str;

class AiAnalysisService
{
    public const TYPES = ['teknikal', 'fundamental', 'sentimen', 'combined', 'menyeluruh'];

    private const LABELS = [
        'teknikal' => 'teknikal',
        'fundamental' => 'fundamental',
        'sentimen' => 'sentimen berita',
        'combined' => 'menyeluruh',
    ];

    private const LIMITS = [
        'teknikal' => ['prices' => 60, 'indicators' => 30, 'fundamentals' => 0, 'news' => 0, 'snippet' => 0],
        'fundamental' => ['prices' => 0, 'indicators' => 0, 'fundamentals' => 4, 'news' => 0, 'snippet' => 0],
        'sentimen' => ['prices' => 0, 'indicators' => 0, 'fundamentals' => 0, 'news' => 10, 'snippet' => 500],
        'combined' => ['prices' => 30, 'indicators' => 10, 'fundamentals' => 4, 'news' => 5, 'snippet' => 300],
    ];

    public function __construct(
        protected GeminiClient $gemini
    ) {}

    public static function normalizeType(string $type): string
    {
        $type = strtolower(trim($type));

        return $type === 'menyeluruh' ? 'combined' : $type;
    }

    public function modelName(): string
    {
        return $this->gemini->lastModel() ?? $this->gemini->model();
    }

    public function buildContext(int $stockId, string $type = 'combined'): ?array
    {
        $stock = Stock::find($stockId);

        if (! $stock) {
            return null;
        }

        $type = self::normalizeType($type);
        $limits = self::LIMITS[$type] ?? self::LIMITS['combined'];

        $context = [
            'stock' => [
                'ticker' => $stock->ticker,
                'company_name' => $stock->company_name,
                'sector' => $stock->sector,
                'exchange' => $stock->exchange,
                'currency' => $stock->currency,
            ],
            'analysis_type' => $type,
            'price_summary' => $this->priceSummary($stockId),
        ];

        if ($limits['prices'] > 0) {
            $context['prices'] = StockPrice::where('stock_id', $stockId)
                ->orderByDesc('price_date')
                ->limit($limits['prices'])
                ->get()
                ->reverse()
                ->map(fn (StockPrice $p) => [
                    'date' => $p->price_date?->toDateString(),
                    'open' => $this->num($p->open_price),
                    'high' => $this->num($p->high_price),
                    'low' => $this->num($p->low_price),
                    'close' => $this->num($p->close_price),
                    'volume' => (int) $p->volume,
                ])
                ->values()
                ->all();
        }

        if ($limits['indicators'] > 0) {
            $context['indicators'] = TechnicalIndicator::where('stock_id', $stockId)
                ->orderByDesc('indicator_date')
                ->limit($limits['indicators'])
                ->get()
                ->reverse()
                ->map(fn (TechnicalIndicator $i) => [
                    'date' => $i->indicator_date?->toDateString(),
                    'rsi_14' => $this->num($i->rsi_14),
                    'macd' => $this->num($i->macd),
                    'macd_signal' => $this->num($i->macd_signal),
                    'sma_20' => $this->num($i->sma_20),
                    'sma_50' => $this->num($i->sma_50),
                ])
                ->values()
                ->all();
        }

        if ($limits['fundamentals'] > 0) {
            $context['fundamentals'] = StockFundamental::where('stock_id', $stockId)
                ->orderByDesc('period')
                ->limit($limits['fundamentals'])
                ->get()
                ->map(fn (StockFundamental $f) => [
                    'period' => $f->period,
                    'revenue' => $this->num($f->revenue),
                    'net_income' => $this->num($f->net_income),
                    'total_assets' => $this->num($f->total_assets),
                    'total_liabilities' => $this->num($f->total_liabilities),
                    'total_equity' => $this->num($f->total_equity),
                    'eps' => $this->num($f->eps),
                    'roe_pct' => $this->num($f->roe),
                    'roa_pct' => $this->num($f->roa),
                    'debt_to_equity' => $this->num($f->debt_to_equity),
                ])
                ->all();
        }

        if ($limits['news'] > 0) {
            $context['news'] = News::where('stock_id', $stockId)
                ->orderByDesc('published_at')
                ->limit($limits['news'])
                ->get()
                ->map(fn (News $n) => [
                    'title' => $n->title,
                    'source' => $n->source,
                    'published_at' => $n->published_at?->toDateString(),
                    'snippet' => Str::limit(
                        trim(preg_replace('/\s+/u', ' ', strip_tags((string) $n->content))),
                        $limits['snippet']
                    ),
                ])
                ->all();
        }

        return $context;
    }

    public function missingDataMessage(array $context, string $type): ?string
    {
        $type = self::normalizeType($type);
        $ticker = $context['stock']['ticker'] ?? 'saham ini';

        return match ($type) {
            'teknikal' => empty($context['prices'])
                ? "Data harga {$ticker} belum tersedia untuk analisis teknikal."
                : null,
            'fundamental' => empty($context['fundamentals'])
                ? "Data fundamental {$ticker} belum tersedia."
                : null,
            'sentimen' => empty($context['news'])
                ? "Belum ada berita {$ticker} untuk analisis sentimen."
                : null,
            default => empty($context['prices']) && empty($context['fundamentals']) && empty($context['news'])
                ? "Data {$ticker} belum tersedia untuk dianalisis."
                : null,
        };
    }

    public function generateAnalysis(array $context, string $type): string
    {
        $type = self::normalizeType($type);
        $stock = $context['stock'] ?? [];

        $systemInstruction = implode("\n", [
            'Kamu adalah analis saham Bursa Efek Indonesia untuk aplikasi ZainSaham.',
            'Tulis analisis dalam Bahasa Indonesia memakai markdown (judul ## dan daftar), padat dan mudah dipahami investor pemula.',
            'Aturan:',
            '- Gunakan hanya data JSON yang diberikan. Jangan mengarang angka atau peristiwa; bila data kurang, sebutkan keterbatasannya.',
            '- Sebutkan angka dan tanggal penting dari data untuk mendukung setiap poin.',
            '- Jangan memberi rekomendasi beli, jual, atau tahan, dan jangan menjanjikan keuntungan. Sampaikan skenario dan hal yang perlu dipantau.',
            '- Selalu bahas risiko.',
        ]);

        $prompt = implode("\n", [
            'Buat analisis '.(self::LABELS[$type] ?? 'menyeluruh').' untuk saham '
                .($stock['ticker'] ?? '').' ('.($stock['company_name'] ?? '').').',
            '',
            $this->instructionsFor($type),
            '',
            'Data (JSON, nilai uang dalam '.($stock['currency'] ?? 'IDR').'):',
            json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR),
        ]);

        return $this->gemini->generate($systemInstruction, [
            ['role' => 'user', 'content' => $prompt],
        ]);
    }

    protected function instructionsFor(string $type): string
    {
        return match ($type) {
            'teknikal' => implode("\n", [
                'Bahas dengan bagian berikut:',
                '## Ringkasan',
                '## Tren & Moving Average (posisi harga terhadap SMA 20 dan SMA 50, golden/death cross bila ada)',
                '## Momentum (RSI 14: >70 jenuh beli, <30 jenuh jual; posisi MACD terhadap signal dan crossover terbaru)',
                '## Volume',
                '## Support & Resistance (dari harga tertinggi/terendah terbaru)',
                '## Risiko',
                '## Kesimpulan',
            ]),
            'fundamental' => implode("\n", [
                'Bahas dengan bagian berikut:',
                '## Ringkasan',
                '## Pertumbuhan (pendapatan dan laba bersih antar periode)',
                '## Profitabilitas (ROE, ROA, margin laba bersih = laba bersih / pendapatan)',
                '## Struktur Modal (debt to equity, liabilitas terhadap aset)',
                '## EPS',
                '## Risiko',
                '## Kesimpulan',
            ]),
            'sentimen' => implode("\n", [
                'Bahas dengan bagian berikut:',
                '## Ringkasan Sentimen (positif, netral, atau negatif secara keseluruhan)',
                '## Sentimen per Berita (daftar: judul singkat — positif/netral/negatif — alasan satu kalimat)',
                '## Tema Utama',
                '## Potensi Dampak ke Saham',
                '## Risiko',
                '## Kesimpulan',
            ]),
            default => implode("\n", [
                'Bahas dengan bagian berikut:',
                '## Ringkasan',
                '## Teknikal (tren, SMA, RSI, MACD)',
                '## Fundamental (pertumbuhan, profitabilitas, struktur modal)',
                '## Sentimen Berita',
                '## Kekuatan & Kelemahan',
                '## Risiko',
                '## Kesimpulan',
            ]),
        };
    }

    protected function priceSummary(int $stockId): ?array
    {
        $rows = StockPrice::where('stock_id', $stockId)
            ->orderByDesc('price_date')
            ->limit(250)
            ->get(['price_date', 'high_price', 'low_price', 'close_price', 'volume']);

        if ($rows->isEmpty()) {
            return null;
        }

        $latest = $rows->first();
        $close = $this->num($latest->close_price);
        $prev = $rows->get(1);
        $monthAgo = $rows->get(min(21, $rows->count() - 1));

        return [
            'last_date' => $latest->price_date?->toDateString(),
            'last_close' => $close,
            'prev_close' => $prev ? $this->num($prev->close_price) : null,
            'change_1d_pct' => $prev ? $this->pct($close, $this->num($prev->close_price)) : null,
            'change_1m_pct' => $monthAgo && $monthAgo !== $latest
                ? $this->pct($close, $this->num($monthAgo->close_price))
                : null,
            'high_52w' => $this->num($rows->max(fn ($r) => (float) $r->high_price)),
            'low_52w' => $this->num($rows->min(fn ($r) => (float) $r->low_price)),
            'avg_volume_20d' => (int) round($rows->take(20)->avg(fn ($r) => (int) $r->volume)),
            'trading_days' => $rows->count(),
        ];
    }

    protected function num($value): ?float
    {
        return $value === null || $value === '' ? null : round((float) $value, 4);
    }

    protected function pct(?float $current, ?float $base): ?float
    {
        if ($current === null || ! $base) {
            return null;
        }

        return round(($current - $base) / $base * 100, 2);
    }
}
