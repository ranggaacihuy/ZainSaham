<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

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
        return response()->json([
            'success' => true,
            'data' => $request->user(),
        ]);
    }

    /**
     * POST /api/logout
     */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json([
            'success' => true,
            'message' => 'Berhasil keluar.',
        ]);
    }

    protected function verifyPassword(string $plain, string $storedHash): bool
    {
        if ($storedHash === '' || empty(password_get_info($storedHash)['algo'])) {
            return false;
        }

        return Hash::check($plain, $storedHash);
    }

    protected function issueToken(User $user): string
    {
        return $user->createToken('auth_token')->plainTextToken;
    }
}
