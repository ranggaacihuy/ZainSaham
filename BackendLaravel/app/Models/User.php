<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\SoftDeletes;

class User extends Authenticatable
{
    use SoftDeletes;

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