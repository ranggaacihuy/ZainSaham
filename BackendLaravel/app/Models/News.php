<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class News extends Model
{
    // Nama tabel di database
    protected $table = 'news';

    // Primary key tabel
    protected $primaryKey = 'news_id';

    // Kolom yang boleh diisi
    protected $fillable = [
        'stock_id',
        'title',
        'content',
        'source',
        'source_url',
        'published_at',
    ];

    // Konversi tipe data
    protected $casts = [
        'published_at' => 'datetime',
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