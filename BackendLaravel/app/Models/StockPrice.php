<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockPrice extends Model
{
    protected $table = 'stock_prices';

    protected $primaryKey = 'price_id';

    const UPDATED_AT = null;

    protected $fillable = [
        'stock_id',
        'price_date',
        'open_price',
        'high_price',
        'low_price',
        'close_price',
        'volume',
    ];

    protected $casts = [
        'price_date' => 'date',
        'open_price' => 'decimal:2',
        'high_price' => 'decimal:2',
        'low_price' => 'decimal:2',
        'close_price' => 'decimal:2',
        'volume' => 'integer',
    ];

    // Data harga ini dimiliki oleh satu saham
    public function stock()
    {
        return $this->belongsTo(
            Stock::class,
            'stock_id',
            'stock_id'
        );
    }
}