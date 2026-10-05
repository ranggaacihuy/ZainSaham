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
     * Mengambil semua data saham.
     */
    public function getAllStocks()
    {
        return Stock::query()
            ->select([
                'stock_id',
                'ticker',
                'company_name',
                'sector',
                'exchange',
                'currency',
            ])
            ->orderBy('ticker')
            ->get();
    }

    /**
     * Mengambil detail satu saham berdasarkan ID.
     */
    public function getStockById($stockId)
    {
        return Stock::query()
            ->select([
                'stock_id',
                'ticker',
                'company_name',
                'sector',
                'exchange',
                'currency',
            ])
            ->findOrFail($stockId);
    }

    /**
     * Mengambil data harga saham berdasarkan ID saham.
     */
    public function getStockPricesByStockId($stockId)
    {
            return StockPrice::query()
            ->select([
                'price_date',
                'open_price',
                'high_price',
                'low_price',
                'close_price',
                'volume',
            ])
            ->where('stock_id', $stockId)
            ->orderBy('price_date', 'asc')
            ->get();
    }

    /**
     * Mengambil data technical indicators berdasarkan ID saham.
     */
    public function getTechnicalIndicatorsByStockId($stockId)
    {
        return TechnicalIndicator::query()
            ->select([
                'indicator_date',
                'rsi_14',
                'macd',
                'macd_signal',
                'sma_20',
                'sma_50',
            ])
            ->where('stock_id', $stockId)
            ->orderBy('indicator_date', 'asc')
            ->get();
    }

    /**
     * Mengambil data fundamental berdasarkan ID saham.
     */
    public function getFundamentalsByStockId($stockId)
    {
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
            ->where('stock_id', $stockId)
            ->orderBy('period', 'desc')
            ->get();
    }

    /**
     * Mengambil berita berdasarkan ID saham.
     */
    public function getNewsByStockId($stockId)
    {
        return News::query()
            ->select([
                'news_id',
                'title',
                'content',
                'source',
                'source_url',
                'published_at',
            ])
            ->where('stock_id', $stockId)
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
        return Watchlist::create([
            'user_id' => $userId,
            'stock_id' => $stockId,
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