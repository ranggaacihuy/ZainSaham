<?php

namespace App\Http\Controllers;

use App\Models\AiMessage;
use App\Models\AnalysisSession;
use App\Models\Stock;
use App\Services\AiAnalysisService;
use App\Services\GeminiChatService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use RuntimeException;
use Throwable;

class AiChatController extends Controller
{
    public function __construct(
        protected GeminiChatService $geminiChatService,
        protected AiAnalysisService $aiAnalysisService
    ) {}

    public function messages($sessionId)
    {
        $session = AnalysisSession::find($sessionId);

        if (!$session) {
            return response()->json([
                'success' => false,
                'message' => 'Sesi chat tidak ditemukan.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => AiMessage::where('session_id', $sessionId)
                ->orderBy('created_at')
                ->orderBy('message_id')
                ->get(),
        ]);
    }

    public function chat(Request $request)
    {
        $validated = $request->validate([
            'user_id' => [
                'required',
                'integer',
                'exists:users,user_id',
            ],
            'stock_id' => [
                'required',
                'integer',
                'exists:stocks,stock_id',
            ],
            'session_id' => [
                'nullable',
                'integer',
                'exists:analysis_sessions,session_id',
            ],
            'message' => [
                'required',
                'string',
                'max:5000',
            ],
        ]);

        $session = null;

        if (!empty($validated['session_id'])) {
            $session = AnalysisSession::where(
                'session_id',
                $validated['session_id']
            )
                ->where('user_id', $validated['user_id'])
                ->where('stock_id', $validated['stock_id'])
                ->first();

            if (!$session) {
                return response()->json([
                    'success' => false,
                    'message' =>
                        'Sesi chat tidak sesuai dengan pengguna atau saham.',
                ], 403);
            }
        }

        if (!$session) {
            $session = AnalysisSession::create([
                'user_id' => $validated['user_id'],
                'stock_id' => $validated['stock_id'],
                'analysis_type' => 'combined',
            ]);
        }

        // Ambil data saham untuk konteks jawaban AI.
        $stockContext = $this->aiAnalysisService->analyze(
            $validated['stock_id']
        );

        $history = AiMessage::where(
            'session_id',
            $session->session_id
        )
            ->orderBy('created_at')
            ->orderBy('message_id')
            ->get();

        // Simpan pesan pengguna terlebih dahulu.
        AiMessage::create([
            'session_id' => $session->session_id,
            'role' => 'user',
            'content' => $validated['message'],
            'created_at' => Carbon::now(),
        ]);

        // Susun riwayat, termasuk pesan terbaru.
        $historyData = $history->map(function ($item) {
            return [
                'role' => $item->role,
                'content' => $item->content,
            ];
        })->push([
            'role' => 'user',
            'content' => $validated['message'],
        ])->values()->all();

        try {
            $reply = $this->geminiChatService->reply(
                $historyData,
                $stockContext ?? []
            );
        } catch (Throwable $e) {
            report($e);

            return response()->json([
                'success' => false,
                'message' => 'AI belum dapat membalas. Silakan coba lagi.',
                'data' => [
                    'session_id' => $session->session_id,
                ],
            ], 502);
        }

        $assistantMessage = AiMessage::create([
            'session_id' => $session->session_id,
            'role' => 'assistant',
            'content' => $reply,
            'created_at' => Carbon::now(),
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'session_id' => $session->session_id,
                'stock' => Stock::find($validated['stock_id']),
                'user_message' => [
                    'role' => 'user',
                    'content' => $validated['message'],
                ],
                'assistant_message' => $assistantMessage,
            ],
        ]);
    }
}
