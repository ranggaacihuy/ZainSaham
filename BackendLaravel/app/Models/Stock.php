<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Stock extends Model
{
    protected $table = 'stocks';

    protected $primaryKey = 'stock_id';

    protected $fillable = [
        'ticker',
        'company_name',
        'sector',
        'exchange',
        'currency',
    ];

    // Satu saham memiliki banyak data harga
    public function prices()
    {
        return $this->hasMany(StockPrice::class, 'stock_id', 'stock_id');
    }

    // Satu saham memiliki banyak data indikator teknikal
    public function technicalIndicators()
    {
        return $this->hasMany(
            TechnicalIndicator::class,
            'stock_id',
            'stock_id'
        );
    }

    // Satu saham memiliki banyak data fundamental
    public function fundamentals()
    {
        return $this->hasMany(
            StockFundamental::class,
            'stock_id',
            'stock_id'
        );
    }

    // Satu saham memiliki banyak berita
    public function news()
    {
        return $this->hasMany(
            News::class,
            'stock_id',
            'stock_id'
        );
    }

    // Satu saham dapat masuk ke banyak watchlist
    public function watchlists()
    {
        return $this->hasMany(
            Watchlist::class,
            'stock_id',
            'stock_id'
        );
    }

    // Satu saham dapat memiliki banyak sesi analisis
    public function analysisSessions()
    {
        return $this->hasMany(
            AnalysisSession::class,
            'stock_id',
            'stock_id'
        );
    }
}