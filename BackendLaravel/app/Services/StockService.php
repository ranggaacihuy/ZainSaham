<?php

namespace App\Services;

use App\Models\StockPrice;
use App\Models\Stock;
use App\Models\TechnicalIndicator;
use App\Models\StockFundamental;
use App\Models\News;
use App\Models\Watchlist;

class StockService
{
    /**
     * Mengubah ticker (cth: 'BBCA') menjadi stock_id jika parameter bukan numeric.
     */
    public function resolveStockId($stockId): int
    {
        if (is_numeric($stockId)) {
            return (int) $stockId;
        }

        $stock = Stock::where('ticker', strtoupper((string) $stockId))->first();
        return $stock ? (int) $stock->stock_id : 0;
    }

    /**
     * Mengambil semua data saham dengan harga terakhir & persentase perubahan.
     */
    public function getAllStocks(?string $search = null, ?string $sector = null)
    {
        $query = Stock::query()
            ->select([
                'stock_id',
                'ticker',
                'company_name',
                'sector',
                'exchange',
                'currency',
            ])
            ->with(['prices' => function ($q) {
                $q->orderBy('price_date', 'desc')->limit(2);
            }]);

        if (!empty($search)) {
            $s = trim($search);
            $query->where(function ($q) use ($s) {
                $q->where('ticker', 'like', "%{$s}%")
                  ->orWhere('company_name', 'like', "%{$s}%");
            });
        }

        if (!empty($sector) && $sector !== 'Semua') {
            $query->where('sector', $sector);
        }

        $stocks = $query->orderBy('ticker')->get();

        return $stocks->map(function ($stock) {
            $latest = $stock->prices->get(0);
            $prev = $stock->prices->get(1);

            $close = $latest ? (float) $latest->close_price : 0;
            $prevClose = $prev ? (float) $prev->close_price : $close;
            $changePct = $prevClose > 0 ? round((($close - $prevClose) / $prevClose) * 100, 2) : 0;

            unset($stock->prices);
            $stock->close_price = $close;
            $stock->prev_close = $prevClose;
            $stock->change_pct = $changePct;
            $stock->volume = $latest ? (int) $latest->volume : 0;
            $stock->price_date = $latest ? $latest->price_date?->format('Y-m-d') : null;

            return $stock;
        });
    }

    /**
     * Mengambil detail satu saham berdasarkan ID atau Ticker.
     */
    public function getStockById($stockId)
    {
        $query = Stock::query()
            ->select([
                'stock_id',
                'ticker',
                'company_name',
                'sector',
                'exchange',
                'currency',
            ])
            ->with(['prices' => function ($q) {
                $q->orderBy('price_date', 'desc')->limit(2);
            }]);

        $stock = is_numeric($stockId)
            ? $query->findOrFail($stockId)
            : $query->where('ticker', strtoupper((string) $stockId))->firstOrFail();

        $latest = $stock->prices->get(0);
        $prev = $stock->prices->get(1);

        $close = $latest ? (float) $latest->close_price : 0;
        $prevClose = $prev ? (float) $prev->close_price : $close;
        $changeVal = $latest ? ($close - $prevClose) : 0;
        $changePct = $prevClose > 0 ? round(($changeVal / $prevClose) * 100, 2) : 0;

        unset($stock->prices);
        $stock->close_price = $close;
        $stock->open_price = $latest ? (float) $latest->open_price : $close;
        $stock->high_price = $latest ? (float) $latest->high_price : $close;
        $stock->low_price = $latest ? (float) $latest->low_price : $close;
        $stock->volume = $latest ? (int) $latest->volume : 0;
        $stock->prev_close = $prevClose;
        $stock->change_value = $changeVal;
        $stock->change_pct = $changePct;
        $stock->price_date = $latest ? $latest->price_date?->format('Y-m-d') : null;

        return $stock;
    }

    /**
     * Mengambil data harga saham berdasarkan ID saham atau Ticker.
     */
    public function getStockPricesByStockId($stockId)
    {
        $id = $this->resolveStockId($stockId);

        return StockPrice::query()
            ->select([
                'price_date',
                'open_price',
                'high_price',
                'low_price',
                'close_price',
                'volume',
            ])
            ->where('stock_id', $id)
            ->orderBy('price_date', 'asc')
            ->get();
    }

    /**
     * Mengambil data technical indicators berdasarkan ID saham atau Ticker.
     */
    public function getTechnicalIndicatorsByStockId($stockId)
    {
        $id = $this->resolveStockId($stockId);

        return TechnicalIndicator::query()
            ->select([
                'indicator_date',
                'rsi_14',
                'macd',
                'macd_signal',
                'sma_20',
                'sma_50',
            ])
            ->where('stock_id', $id)
            ->orderBy('indicator_date', 'asc')
            ->get();
    }

    /**
     * Mengambil data fundamental berdasarkan ID saham atau Ticker.
     */
    public function getFundamentalsByStockId($stockId)
    {
        $id = $this->resolveStockId($stockId);

        return StockFundamental::query()
            ->select([
                'period',
                'revenue',
                'net_income',
                'total_assets',
                'total_liabilities',
                'total_equity',
                'eps',
                'roe',
                'roa',
                'debt_to_equity',
                'updated_at',
            ])
            ->where('stock_id', $id)
            ->orderBy('period', 'desc')
            ->get();
    }

    /**
     * Mengambil berita berdasarkan ID saham atau Ticker.
     */
    public function getNewsByStockId($stockId)
    {
        $id = $this->resolveStockId($stockId);

        return News::query()
            ->select([
                'news_id',
                'title',
                'content',
                'source',
                'source_url',
                'published_at',
            ])
            ->where('stock_id', $id)
            ->orderBy('published_at', 'desc')
            ->get();
    }

    /**
     * Mengambil watchlist berdasarkan ID user.
     */
    public function getWatchlistByUserId($userId)
    {
        return Watchlist::query()
            ->select([
                'watchlist_id',
                'user_id',
                'stock_id',
                'created_at',
            ])
            ->with([
                'stock:stock_id,ticker,company_name,sector,exchange,currency'
            ])
            ->where('user_id', $userId)
            ->orderBy('created_at', 'desc')
            ->get();
    }

    /**
     * Menambahkan saham ke watchlist user.
     */
    public function addToWatchlist($userId, $stockId)
    {
        $id = $this->resolveStockId($stockId);

        return Watchlist::firstOrCreate([
            'user_id' => $userId,
            'stock_id' => $id,
        ]);
    }

    /**
     * Menghapus saham dari watchlist.
     */
    public function removeFromWatchlist($watchlistId)
    {
        $watchlist = Watchlist::findOrFail($watchlistId);
        $watchlist->delete();

        return true;
    }
}