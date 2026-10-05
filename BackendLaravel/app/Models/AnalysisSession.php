<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AnalysisSession extends Model
{
    // Nama tabel di database
    protected $table = 'analysis_sessions';

    // Primary key tabel
    protected $primaryKey = 'session_id';

    // Kolom yang boleh diisi
    protected $fillable = [
        'user_id',
        'stock_id',
        'analysis_type',
    ];

    // Konversi tipe data
    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
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
    
    public function aiAnalyses()
    {
        return $this->hasMany(
            AiAnalysis::class,
            'session_id',
            'session_id'
        );
    }
}