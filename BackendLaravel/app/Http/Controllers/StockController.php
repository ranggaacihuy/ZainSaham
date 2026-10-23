<?php

namespace App\Http\Controllers;

use App\Models\Stock;
use App\Services\MarketDataService;
use App\Services\StockService;
use Illuminate\Http\Request;
use Throwable;

class StockController extends Controller
{
    protected StockService $stockService;

    public function __construct(StockService $stockService)
    {
        $this->stockService = $stockService;
    }

    // GET /api/stocks
    public function index()
    {
        $stocks = $this->stockService->getAllStocks();

        return response()->json([
            'success' => true,
            'data' => $stocks,
        ]);
    }

    // GET /api/stocks/{stockId}
    public function show($stockId)
    {
        $stock = $this->stockService->getStockById($stockId);

        return response()->json([
            'success' => true,
            'data' => $stock,
        ]);
    }

    // GET /api/stocks/{stockId}/prices
    public function prices($stockId)
    {
        $prices = $this->stockService->getStockPricesByStockId($stockId);

        return response()->json([
            'success' => true,
            'data' => $prices,
        ]);
    }

    public function quote(MarketDataService $market, $stockId)
    {
        $stock = Stock::findOrFail($stockId);

        try {
            $quote = $market->quote($stock);
        } catch (Throwable $e) {
            report($e);

            return response()->json([
                'success' => false,
                'message' => 'Data harga realtime belum dapat diambil dari Yahoo Finance.',
            ], 502);
        }

        return response()->json([
            'success' => true,
            'data' => $quote,
        ]);
    }

    // GET /api/stocks/{stockId}/indicators
    public function indicators($stockId)
    {
        $indicators = $this->stockService
            ->getTechnicalIndicatorsByStockId($stockId);

        return response()->json([
            'success' => true,
            'data' => $indicators,
        ]);
    }

    // GET /api/stocks/{stockId}/fundamentals
    public function fundamentals($stockId)
    {
        $fundamentals = $this->stockService
            ->getFundamentalsByStockId($stockId);

        return response()->json([
            'success' => true,
            'data' => $fundamentals,
        ]);
    }
    
    // GET /api/stocks/{stockId}/news
    public function news($stockId)
    {
        $news = $this->stockService->getNewsByStockId($stockId);

        return response()->json([
            'success' => true,
            'data' => $news,
        ]);
    }

    // GET /api/users/{userId}/watchlist
    public function watchlist(Request $request, $userId)
    {
        abort_unless((int) $userId === $request->user()->user_id, 403, 'Akses ditolak.');

        $watchlists = $this->stockService
            ->getWatchlistByUserId($userId);

        return response()->json([
            'success' => true,
            'data' => $watchlists,
        ]);
    }

    /**
     * POST /api/watchlists
     */
    public function addToWatchlist(Request $request)
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,user_id',
            'stock_id' => 'required|integer|exists:stocks,stock_id',
        ]);

        abort_unless((int) $validated['user_id'] === $request->user()->user_id, 403, 'Akses ditolak.');

        $watchlist = $this->stockService->addToWatchlist(
            $validated['user_id'],
            $validated['stock_id']
        );

        return response()->json([
            'success' => true,
            'message' => 'Stock berhasil ditambahkan ke watchlist.',
            'data' => $watchlist,
        ], 201);
    }

    /**
     * DELETE /api/watchlists/{watchlistId}
     */
    public function removeFromWatchlist(Request $request, $watchlistId)
    {
        $this->stockService->removeFromWatchlist($watchlistId, $request->user()->user_id);

        return response()->json([
            'success' => true,
            'message' => 'Stock berhasil dihapus dari watchlist.',
        ]);
    }
}