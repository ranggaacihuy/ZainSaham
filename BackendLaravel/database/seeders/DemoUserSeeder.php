<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DemoUserSeeder extends Seeder
{
    public const EMAIL = 'demo@zainsaham.test';

    public const PASSWORD = 'demo12345';

    public function run(): void
    {
        User::withTrashed()->updateOrCreate(
            ['email' => self::EMAIL],
            [
                'name' => 'Demo ZainSaham',
                'password_hash' => Hash::make(self::PASSWORD),
                'deleted_at' => null,
            ]
        );
    }
}
