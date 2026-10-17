<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('stocks', function (Blueprint $table) {
            $table->id('stock_id');
            $table->string('ticker', 10)->unique();
            $table->string('company_name');
            $table->string('sector');
            $table->string('exchange', 20)->default('IDX');
            $table->string('currency', 10)->default('IDR');
            $table->timestamps();
        });

        Schema::create('stock_prices', function (Blueprint $table) {
            $table->id('price_id');
            $table->foreignId('stock_id')->constrained('stocks', 'stock_id')->cascadeOnDelete();
            $table->date('price_date');
            $table->decimal('open_price', 15, 2);
            $table->decimal('high_price', 15, 2);
            $table->decimal('low_price', 15, 2);
            $table->decimal('close_price', 15, 2);
            $table->unsignedBigInteger('volume');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('technical_indicators', function (Blueprint $table) {
            $table->id('indicator_id');
            $table->foreignId('stock_id')->constrained('stocks', 'stock_id')->cascadeOnDelete();
            $table->date('indicator_date');
            $table->decimal('rsi_14', 8, 2)->nullable();
            $table->decimal('macd', 8, 2)->nullable();
            $table->decimal('macd_signal', 8, 2)->nullable();
            $table->decimal('sma_20', 12, 2)->nullable();
            $table->decimal('sma_50', 12, 2)->nullable();
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('stock_fundamentals', function (Blueprint $table) {
            $table->id('fundamental_id');
            $table->foreignId('stock_id')->constrained('stocks', 'stock_id')->cascadeOnDelete();
            $table->string('period', 20);
            $table->decimal('revenue', 20, 2)->nullable();
            $table->decimal('net_income', 20, 2)->nullable();
            $table->decimal('total_assets', 20, 2)->nullable();
            $table->decimal('total_liabilities', 20, 2)->nullable();
            $table->decimal('total_equity', 20, 2)->nullable();
            $table->decimal('eps', 12, 2)->nullable();
            $table->decimal('roe', 8, 2)->nullable();
            $table->decimal('roa', 8, 2)->nullable();
            $table->decimal('debt_to_equity', 8, 2)->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('news', function (Blueprint $table) {
            $table->id('news_id');
            $table->foreignId('stock_id')->constrained('stocks', 'stock_id')->cascadeOnDelete();
            $table->string('title');
            $table->text('content');
            $table->string('source');
            $table->string('source_url')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });

        Schema::create('watchlists', function (Blueprint $table) {
            $table->id('watchlist_id');
            $table->foreignId('user_id')->constrained('users', 'user_id')->cascadeOnDelete();
            $table->foreignId('stock_id')->constrained('stocks', 'stock_id')->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('analysis_sessions', function (Blueprint $table) {
            $table->id('session_id');
            $table->foreignId('user_id')->constrained('users', 'user_id')->cascadeOnDelete();
            $table->foreignId('stock_id')->constrained('stocks', 'stock_id')->cascadeOnDelete();
            $table->string('analysis_type');
            $table->timestamps();
        });

        Schema::create('ai_analyses', function (Blueprint $table) {
            $table->id('ai_analysis_id');
            $table->foreignId('session_id')->constrained('analysis_sessions', 'session_id')->cascadeOnDelete();
            $table->string('model_name')->default('gpt-4');
            $table->json('context_data')->nullable();
            $table->longText('result')->nullable();
            $table->timestamp('created_at')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ai_analyses');
        Schema::dropIfExists('analysis_sessions');
        Schema::dropIfExists('watchlists');
        Schema::dropIfExists('news');
        Schema::dropIfExists('stock_fundamentals');
        Schema::dropIfExists('technical_indicators');
        Schema::dropIfExists('stock_prices');
        Schema::dropIfExists('stocks');
    }
};
