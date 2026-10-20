<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\SoftDeletes;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, SoftDeletes;

    protected $table = 'users';

    protected $primaryKey = 'user_id';

    protected $fillable = [
        'name',
        'email',
        'password_hash',
    ];

    protected $hidden = [
        'password_hash',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function getAuthPasswordName()
    {
        return 'password_hash';
    }

    public function watchlists()
    {
        return $this->hasMany(
            Watchlist::class,
            'user_id',
            'user_id'
        );
    }

    public function analysisSessions()
    {
        return $this->hasMany(
            AnalysisSession::class,
            'user_id',
            'user_id'
        );
    }
}