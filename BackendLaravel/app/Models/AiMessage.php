<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AiMessage extends Model
{
    protected $table = 'ai_messages';

    protected $primaryKey = 'message_id';

    // Tabel hanya memiliki created_at, tanpa updated_at.
    public $timestamps = false;

    protected $fillable = [
        'session_id',
        'role',
        'content',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function session()
    {
        return $this->belongsTo(
            AnalysisSession::class,
            'session_id',
            'session_id'
        );
    }
}
