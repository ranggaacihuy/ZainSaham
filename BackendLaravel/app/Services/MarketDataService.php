<?php

namespace App\Services;

use App\Models\Stock;
use App\Models\StockPrice;
use App\Models\TechnicalIndicator;
use Composer\CaBundle\CaBundle;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class MarketDataService
{
    public const RANGES = ['5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'max'];

    private const QUOTE_KEY = 'market:quote:';

    public function __construct(
        protected TechnicalIndicatorService $indicators
    ) {}

    public function symbol(Stock|string $stock): string
    {
        $ticker = $stock instanceof Stock ? $stock->ticker : $stock;

        return strtoupper($ticker).config('services.yahoo_finance.suffix', '.JK');
    }

    public function fetchDaily(Stock|string $stock, string $range = '1y'): array
    {
        $symbol = $this->symbol($stock);

        $response = Http::baseUrl(rtrim((string) config('services.yahoo_finance.base_url'), '/'))
            ->withOptions(['verify' => CaBundle::getSystemCaRootBundlePath()])
            ->withHeaders(['User-Agent' => 'Mozilla/5.0 (ZainSaham)'])
            ->acceptJson()
            ->timeout((int) config('services.yahoo_finance.timeout', 20))
            ->retry([1000, 5000], when: fn ($e) => $e instanceof RequestException
                && in_array($e->response->status(), [429, 500, 502, 503], true), throw: false)
            ->get('/v8/finance/chart/'.rawurlencode($symbol), [
                'range' => $range,
                'interval' => '1d',
            ]);

        if ($response->status() === 404) {
            throw new RuntimeException("Kode saham {$symbol} tidak dikenali Yahoo Finance.");
        }

        if ($response->failed()) {
            throw new RuntimeException("Yahoo Finance gagal untuk {$symbol}: HTTP {$response->status()}");
        }

        $result = $response->json('chart.result.0');

        if (! is_array($result)) {
            $error = $response->json('chart.error.description') ?? 'respons kosong';
            throw new RuntimeException("Yahoo Finance gagal untuk {$symbol}: {$error}");
        }

        $meta = $result['meta'] ?? [];
        $timezone = $meta['exchangeTimezoneName'] ?? 'Asia/Jakarta';
        $marketDate = isset($meta['regularMarketTime'])
            ? Carbon::createFromTimestamp($meta['regularMarketTime'], $timezone)->toDateString()
            : null;
        $quote = $result['indicators']['quote'][0] ?? [];
        $rows = [];

        foreach ($result['timestamp'] ?? [] as $i => $timestamp) {
            $date = Carbon::createFromTimestamp($timestamp, $timezone)->toDateString();
            $open = $quote['open'][$i] ?? null;
            $high = $quote['high'][$i] ?? null;
            $low = $quote['low'][$i] ?? null;
            $close = $quote['close'][$i] ?? null;
            $volume = $quote['volume'][$i] ?? null;

            if ($close === null && $date === $marketDate && isset($meta['regularMarketPrice'])) {
                $close = $meta['regularMarketPrice'];
                $high ??= $meta['regularMarketDayHigh'] ?? $close;
                $low ??= $meta['regularMarketDayLow'] ?? $close;
                $open ??= $close;
                $volume ??= $meta['regularMarketVolume'] ?? 0;
            }

            if ($open === null || $high === null || $low === null || $close === null) {
                continue;
            }

            $rows[$date] = [
                'price_date' => $date,
                'open_price' => round((float) $open, 2),
                'high_price' => round((float) $high, 2),
                'low_price' => round((float) $low, 2),
                'close_price' => round((float) $close, 2),
                'volume' => (int) ($volume ?? 0),
            ];
        }

        return [
            'meta' => $meta,
            'rows' => array_values($rows),
        ];
    }

    public function sync(Stock $stock, string $range = '1y'): array
    {
        return $this->store($stock, $this->fetchDaily($stock, $range));
    }

    public function store(Stock $stock, array $data): array
    {
        $name = $data['meta']['longName'] ?? $data['meta']['shortName'] ?? null;

        if (is_string($name) && $name !== '' && $stock->company_name !== $name) {
            $stock->update(['company_name' => $name]);
        }

        $now = now();
        $rows = array_map(fn ($row) => $row + ['stock_id' => $stock->stock_id, 'created_at' => $now], $data['rows']);

        foreach (array_chunk($rows, 500) as $chunk) {
            StockPrice::upsert(
                $chunk,
                ['stock_id', 'price_date'],
                ['open_price', 'high_price', 'low_price', 'close_price', 'volume']
            );
        }

        return [
            'prices' => count($rows),
            'indicators' => $rows === [] ? 0 : $this->recalculateIndicators($stock, $rows[0]['price_date']),
        ];
    }

    public function quote(Stock $stock): array
    {
        $ttl = max(1, (int) config('services.yahoo_finance.quote_ttl', 15));

        return Cache::remember(self::QUOTE_KEY.$stock->stock_id, now()->addSeconds($ttl), function () use ($stock) {
            $data = $this->fetchDaily($stock, '5d');
            $this->store($stock, $data);

            $rows = $data['rows'];
            $last = $rows === [] ? null : $rows[count($rows) - 1];
            $prevClose = count($rows) > 1 ? $rows[count($rows) - 2]['close_price'] : null;
            $close = $last['close_price'] ?? null;
            $meta = $data['meta'];
            $timezone = $meta['exchangeTimezoneName'] ?? 'Asia/Jakarta';

            return [
                'stock_id' => $stock->stock_id,
                'ticker' => $stock->ticker,
                'price' => $last,
                'prev_close' => $prevClose,
                'change' => $close !== null && $prevClose ? round($close - $prevClose, 2) : null,
                'change_pct' => $close !== null && $prevClose ? round(($close - $prevClose) / $prevClose * 100, 2) : null,
                'market_time' => isset($meta['regularMarketTime'])
                    ? Carbon::createFromTimestamp($meta['regularMarketTime'], $timezone)->toIso8601String()
                    : null,
                'is_open' => $this->isOpen($meta),
                'fetched_at' => now()->toIso8601String(),
            ];
        });
    }

    public function isOpen(array $meta): bool
    {
        $start = $meta['currentTradingPeriod']['regular']['start'] ?? null;
        $end = $meta['currentTradingPeriod']['regular']['end'] ?? null;

        if (! $start || ! $end) {
            return false;
        }

        $now = now()->getTimestamp();

        return $now >= $start && $now < $end;
    }

    public function recalculateIndicators(Stock $stock, ?string $since = null): int
    {
        $prices = StockPrice::where('stock_id', $stock->stock_id)
            ->orderBy('price_date')
            ->get(['price_date', 'close_price']);

        $closes = $prices->map(fn ($p) => (float) $p->close_price)->all();
        $now = now();
        $rows = [];

        foreach ($prices as $i => $price) {
            $date = $price->price_date->toDateString();

            if ($since !== null && $date < $since) {
                continue;
            }

            $window = array_slice($closes, max(0, $i - 199), min($i + 1, 200));

            $rows[] = [
                'stock_id' => $stock->stock_id,
                'indicator_date' => $date,
                ...$this->indicators->calculate($window),
                'created_at' => $now,
            ];
        }

        foreach (array_chunk($rows, 500) as $chunk) {
            TechnicalIndicator::upsert(
                $chunk,
                ['stock_id', 'indicator_date'],
                ['rsi_14', 'macd', 'macd_signal', 'sma_20', 'sma_50']
            );
        }

        return count($rows);
    }
}
