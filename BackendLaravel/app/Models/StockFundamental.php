<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockFundamental extends Model
{
    // Nama tabel di database
    protected $table = 'stock_fundamentals';

    // Primary key tabel
    protected $primaryKey = 'fundamental_id';

    // Tabel hanya memiliki updated_at,
    // tidak memiliki created_at
    const CREATED_AT = null;

    // Kolom yang boleh diisi
    protected $fillable = [
        'stock_id',
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
    ];

    // Konversi tipe data
    protected $casts = [
        'revenue' => 'decimal:2',
        'net_income' => 'decimal:2',
        'total_assets' => 'decimal:2',
        'total_liabilities' => 'decimal:2',
        'total_equity' => 'decimal:2',
        'eps' => 'decimal:2',
        'roe' => 'decimal:2',
        'roa' => 'decimal:2',
        'debt_to_equity' => 'decimal:2',
        'updated_at' => 'datetime',
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