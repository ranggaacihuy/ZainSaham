<?php

namespace App\Services;

use App\Models\Stock;
use App\Models\StockPrice;
use App\Models\TechnicalIndicator;
use App\Models\StockFundamental;
use App\Models\News;

class AiAnalysisService
{
    public function analyze($stockId)
    {
        $stock = Stock::find($stockId);

        if (!$stock) {
            return null;
        }

        $prices = StockPrice::where('stock_id', $stockId)
            ->orderBy('price_date', 'desc')
            ->get();

        $indicators = TechnicalIndicator::where('stock_id', $stockId)
            ->orderBy('indicator_date', 'desc')
            ->get();

        $fundamentals = StockFundamental::where('stock_id', $stockId)
            ->orderBy('period', 'desc')
            ->get();

        $news = News::where('stock_id', $stockId)
            ->orderBy('published_at', 'desc')
            ->get();

        return [
            'stock' => $stock,
            'prices' => $prices,
            'indicators' => $indicators,
            'fundamentals' => $fundamentals,
            'news' => $news,
        ];
    }
}