<?php

namespace App\Http\Controllers;

use App\Models\AiAnalysis;
use App\Models\AnalysisSession;
use App\Models\Stock;
use App\Services\AiAnalysisService;
use Illuminate\Http\Request;

class AiAnalysisController extends Controller
{
    protected $aiAnalysisService;

    public function __construct(AiAnalysisService $aiAnalysisService)
    {
        $this->aiAnalysisService = $aiAnalysisService;
    }

    public function index($stockId)
    {
        $analyses = AiAnalysis::whereHas('session', function ($query) use ($stockId) {
            $query->where('stock_id', $stockId);
        })
        ->with('session')
        ->latest('created_at')
        ->get();

        return response()->json([
            'success' => true,
            'data' => $analyses
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'user_id' => 'required|integer',
            'stock_id' => 'required|integer',
            'analysis_type' => 'required|string',
        ]);

        $stock = Stock::find($request->stock_id);

        if (!$stock) {
            return response()->json([
                'success' => false,
                'message' => 'Stock tidak ditemukan'
            ], 404);
        }

        // Ambil seluruh data yang dibutuhkan untuk analisis
        $contextData = $this->aiAnalysisService->analyze(
            $request->stock_id
        );

        $session = AnalysisSession::create([
            'user_id' => $request->user_id,
            'stock_id' => $request->stock_id,
            'analysis_type' => $request->analysis_type,
        ]);

        $analysis = AiAnalysis::create([
            'session_id' => $session->session_id,
            'model_name' => 'dummy-ai',
            'context_data' => $contextData,
            'result' => 'Analisis AI sementara untuk ' . $stock->ticker,
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'session' => $session,
                'analysis' => $analysis
            ]
        ], 201);
    }
}