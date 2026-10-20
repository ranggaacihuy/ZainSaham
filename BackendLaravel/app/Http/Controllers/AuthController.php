<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\PersonalAccessToken;
use Throwable;

class AuthController extends Controller
{
    /**
     * POST /api/register
     */
    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'string', 'email', 'max:150', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => strtolower(trim($validated['email'])),
            'password_hash' => Hash::make($validated['password']),
        ]);

        $token = $this->issueToken($user);

        return response()->json([
            'success' => true,
            'message' => 'Pendaftaran akun berhasil.',
            'data' => [
                'user' => $user,
                'token' => $token,
            ],
        ], 201);
    }

    /**
     * POST /api/login
     */
    public function login(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', strtolower(trim($validated['email'])))->first();

        if (!$user || !$this->verifyPassword($validated['password'], (string) $user->password_hash)) {
            return response()->json([
                'success' => false,
                'message' => 'Email atau kata sandi salah.',
            ], 401);
        }

        $token = $this->issueToken($user);

        return response()->json([
            'success' => true,
            'message' => 'Berhasil masuk.',
            'data' => [
                'user' => $user,
                'token' => $token,
            ],
        ]);
    }

    /**
     * GET /api/me
     */
    public function me(Request $request)
    {
        $user = $this->resolveUserFromRequest($request);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Sesi telah berakhir. Silakan masuk kembali.',
            ], 401);
        }

        return response()->json([
            'success' => true,
            'data' => $user,
        ]);
    }

    /**
     * POST /api/logout
     */
    public function logout(Request $request)
    {
        $bearer = $request->bearerToken();

        if ($bearer && $this->hasSanctumTable()) {
            $accessToken = PersonalAccessToken::findToken($bearer);
            $accessToken?->delete();
        }

        return response()->json([
            'success' => true,
            'message' => 'Berhasil keluar.',
        ]);
    }

    protected function verifyPassword(string $plain, string $storedHash): bool
    {
        if ($storedHash === '') {
            return false;
        }

        $info = password_get_info($storedHash);
        if (!empty($info['algo'])) {
            return Hash::check($plain, $storedHash);
        }

        // Fallback untuk data seed manual yang belum di-hash (mis. dummy_password).
        return hash_equals($storedHash, $plain);
    }

    protected function issueToken(User $user): string
    {
        if ($this->hasSanctumTable()) {
            return $user->createToken('auth_token')->plainTextToken;
        }

        return Crypt::encryptString(json_encode([
            'user_id' => $user->user_id,
            'iat' => now()->timestamp,
        ]));
    }

    protected function resolveUserFromRequest(Request $request): ?User
    {
        $bearer = $request->bearerToken();
        if (!$bearer) {
            return null;
        }

        if ($this->hasSanctumTable() && str_contains($bearer, '|')) {
            $accessToken = PersonalAccessToken::findToken($bearer);
            if ($accessToken && $accessToken->tokenable instanceof User) {
                return $accessToken->tokenable;
            }
        }

        try {
            $payload = json_decode(Crypt::decryptString($bearer), true);
            if (is_array($payload) && !empty($payload['user_id'])) {
                return User::find($payload['user_id']);
            }
        } catch (Throwable) {
            return null;
        }

        return null;
    }

    protected function hasSanctumTable(): bool
    {
        try {
            return Schema::hasTable('personal_access_tokens');
        } catch (Throwable) {
            return false;
        }
    }
}

