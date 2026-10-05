<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AiAnalysis extends Model
{
    protected $table = 'ai_analyses';

    protected $primaryKey = 'ai_analysis_id';

    const UPDATED_AT = null;

    protected $fillable = [
        'session_id',
        'model_name',
        'context_data',
        'result',
    ];

    protected $casts = [
        'context_data' => 'array',
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