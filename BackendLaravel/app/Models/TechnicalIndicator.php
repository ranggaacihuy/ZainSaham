<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TechnicalIndicator extends Model
{
    // Nama tabel di database
    protected $table = 'technical_indicators';

    // Primary key tabel
    protected $primaryKey = 'indicator_id';

    // Tabel hanya memiliki created_at,
    // tidak memiliki updated_at
    const UPDATED_AT = null;

    // Kolom yang boleh diisi
    protected $fillable = [
        'stock_id',
        'indicator_date',
        'rsi_14',
        'macd',
        'macd_signal',
        'sma_20',
        'sma_50',
    ];

    // Konversi tipe data
    protected $casts = [
        'indicator_date' => 'date',
        'rsi_14' => 'decimal:2',
        'macd' => 'decimal:2',
        'macd_signal' => 'decimal:2',
        'sma_20' => 'decimal:2',
        'sma_50' => 'decimal:2',
    ];

    public function stock()
    {
        return $this->belongsTo(
            Stock::class,
            'stock_id',
            'stock_id'
        );
    }
}