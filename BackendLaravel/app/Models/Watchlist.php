<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Watchlist extends Model
{
    // Nama tabel di database
    protected $table = 'watchlists';

    // Primary key tabel
    protected $primaryKey = 'watchlist_id';

    // Tabel hanya memiliki created_at
    const UPDATED_AT = null;

    // Kolom yang boleh diisi
    protected $fillable = [
        'user_id',
        'stock_id',
    ];

    public function user()
    {
        return $this->belongsTo(
            User::class,
            'user_id',
            'user_id'
        );
    }

    public function stock()
    {
        return $this->belongsTo(
            Stock::class,
            'stock_id',
            'stock_id'
        );
    }
}