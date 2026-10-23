<?php

namespace App\Http\Controllers;

use App\Exceptions\GeminiException;
use App\Models\AiAnalysis;
use App\Models\AnalysisSession;
use App\Models\Stock;
use App\Services\AiAnalysisService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AiAnalysisController extends Controller
{
    protected $aiAnalysisService;

    public function __construct(AiAnalysisService $aiAnalysisService)
    {
        $this->aiAnalysisService = $aiAnalysisService;
    }

    public function index(Request $request, $stockId)
    {
        $userId = $request->user()->user_id;

        $analyses = AiAnalysis::query()
            ->select(['ai_analysis_id', 'session_id', 'model_name', 'result', 'created_at'])
            ->whereHas('session', function ($query) use ($stockId, $userId) {
                $query->where('stock_id', $stockId)
                    ->where('user_id', $userId);
            })
            ->with('session')
            ->latest('created_at')
            ->latest('ai_analysis_id')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $analyses
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,user_id'],
            'stock_id' => ['required', 'integer'],
            'analysis_type' => ['required', 'string', Rule::in(AiAnalysisService::TYPES)],
            'session_id' => ['nullable', 'integer'],
        ]);

        abort_unless((int) $validated['user_id'] === $request->user()->user_id, 403, 'Akses ditolak.');

        $stock = Stock::find($validated['stock_id']);

        if (!$stock) {
            return response()->json([
                'success' => false,
                'message' => 'Stock tidak ditemukan'
            ], 404);
        }

        $analysisType = AiAnalysisService::normalizeType($validated['analysis_type']);
        $session = null;

        if (!empty($validated['session_id'])) {
            $session = AnalysisSession::where('session_id', $validated['session_id'])
                ->where('user_id', $validated['user_id'])
                ->where('stock_id', $stock->stock_id)
                ->first();

            if (!$session) {
                return response()->json([
                    'success' => false,
                    'message' => 'Sesi analisis tidak sesuai dengan pengguna atau saham.',
                ], 403);
            }

            $analysisType = AiAnalysisService::normalizeType($session->analysis_type);
        }

        // Ambil seluruh data yang dibutuhkan untuk analisis
        $contextData = $this->aiAnalysisService->buildContext($stock->stock_id, $analysisType);
        $missing = $this->aiAnalysisService->missingDataMessage($contextData, $analysisType);

        if ($missing) {
            return response()->json([
                'success' => false,
                'message' => $missing,
            ], 422);
        }

        try {
            $result = $this->aiAnalysisService->generateAnalysis($contextData, $analysisType);
        } catch (GeminiException $e) {
            report($e);

            return response()->json([
                'success' => false,
                'message' => $e->userMessage,
            ], 502);
        }

        [$session, $analysis] = DB::transaction(function () use ($session, $validated, $stock, $analysisType, $contextData, $result) {
            $session ??= AnalysisSession::create([
                'user_id' => $validated['user_id'],
                'stock_id' => $stock->stock_id,
                'analysis_type' => $analysisType,
            ]);

            $analysis = AiAnalysis::create([
                'session_id' => $session->session_id,
                'model_name' => $this->aiAnalysisService->modelName(),
                'context_data' => $contextData,
                'result' => $result,
            ]);

            return [$session, $analysis];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'session' => $session,
                'analysis' => $analysis->makeHidden('context_data'),
            ]
        ], 201);
    }
}
