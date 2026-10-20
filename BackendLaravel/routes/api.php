<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\StockController;
use App\Http\Controllers\AiAnalysisController;
use App\Http\Controllers\AiChatController;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::get('/me', [AuthController::class, 'me']);
Route::post('/logout', [AuthController::class, 'logout']);

Route::get('/stocks', [StockController::class, 'index']);
Route::get('/stocks/{stockId}/prices', [StockController::class, 'prices']);
Route::get('/stocks/{stockId}', [StockController::class, 'show']);
Route::get('/stocks/{stockId}/indicators', [StockController::class, 'indicators']);
Route::get('/stocks/{stockId}/fundamentals', [StockController::class, 'fundamentals']);
Route::get('/stocks/{stockId}/news', [StockController::class, 'news']);
Route::get('/users/{userId}/watchlist', [StockController::class, 'watchlist']);
Route::post('/watchlists', [StockController::class, 'addToWatchlist']);
Route::delete('/watchlists/{watchlistId}', [StockController::class, 'removeFromWatchlist']);
Route::get('/stocks/{stockId}/ai-analysis', [AiAnalysisController::class, 'index']);
Route::post('/ai-analysis', [AiAnalysisController::class, 'store']);

Route::post('/ai-chat', [AiChatController::class, 'chat']);
Route::get('/ai-chat/{sessionId}/messages', [
    AiChatController::class,
    'messages'
]);