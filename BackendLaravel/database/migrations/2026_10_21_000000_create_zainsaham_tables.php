<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('stocks')) {
            Schema::create('stocks', function (Blueprint $table) {
                $table->id('stock_id');
                $table->string('ticker', 10)->unique();
                $table->string('company_name', 150);
                $table->string('sector', 100)->nullable();
                $table->string('exchange', 20)->default('IDX');
                $table->char('currency', 3)->default('IDR');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('stock_prices')) {
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

                $table->unique(['stock_id', 'price_date']);
            });
        }

        if (! Schema::hasTable('technical_indicators')) {
            Schema::create('technical_indicators', function (Blueprint $table) {
                $table->id('indicator_id');
                $table->foreignId('stock_id')->constrained('stocks', 'stock_id')->cascadeOnDelete();
                $table->date('indicator_date');
                $table->decimal('rsi_14', 6, 2)->nullable();
                $table->decimal('macd', 15, 4)->nullable();
                $table->decimal('macd_signal', 15, 4)->nullable();
                $table->decimal('sma_20', 15, 2)->nullable();
                $table->decimal('sma_50', 15, 2)->nullable();
                $table->timestamp('created_at')->nullable();

                $table->unique(['stock_id', 'indicator_date']);
            });
        }

        if (! Schema::hasTable('news')) {
            Schema::create('news', function (Blueprint $table) {
                $table->id('news_id');
                $table->foreignId('stock_id')->constrained('stocks', 'stock_id')->cascadeOnDelete();
                $table->string('title');
                $table->text('content')->nullable();
                $table->string('source', 100)->nullable();
                $table->string('source_url', 500);
                $table->dateTime('published_at')->nullable();
                $table->timestamps();

                $table->unique(['stock_id', 'source_url']);
            });
        }

        if (! Schema::hasTable('stock_fundamentals')) {
            Schema::create('stock_fundamentals', function (Blueprint $table) {
                $table->id('fundamental_id');
                $table->foreignId('stock_id')->constrained('stocks', 'stock_id')->cascadeOnDelete();
                $table->string('period', 10);
                $table->decimal('revenue', 20, 2)->nullable();
                $table->decimal('net_income', 20, 2)->nullable();
                $table->decimal('total_assets', 20, 2)->nullable();
                $table->decimal('total_liabilities', 20, 2)->nullable();
                $table->decimal('total_equity', 20, 2)->nullable();
                $table->decimal('eps', 12, 2)->nullable();
                $table->decimal('roe', 7, 2)->nullable();
                $table->decimal('roa', 7, 2)->nullable();
                $table->decimal('debt_to_equity', 7, 2)->nullable();
                $table->timestamp('updated_at')->nullable();

                $table->unique(['stock_id', 'period']);
            });
        }

        if (! Schema::hasTable('watchlists')) {
            Schema::create('watchlists', function (Blueprint $table) {
                $table->id('watchlist_id');
                $table->foreignId('user_id')->constrained('users', 'user_id');
                $table->foreignId('stock_id')->constrained('stocks', 'stock_id')->cascadeOnDelete();
                $table->timestamp('created_at')->nullable();

                $table->unique(['user_id', 'stock_id']);
            });
        }

        if (! Schema::hasTable('analysis_sessions')) {
            Schema::create('analysis_sessions', function (Blueprint $table) {
                $table->id('session_id');
                $table->foreignId('user_id')->constrained('users', 'user_id');
                $table->foreignId('stock_id')->constrained('stocks', 'stock_id')->cascadeOnDelete();
                $table->string('analysis_type', 20);
                $table->timestamps();

                $table->index(['user_id', 'stock_id']);
            });
        }

        if (! Schema::hasTable('ai_analyses')) {
            Schema::create('ai_analyses', function (Blueprint $table) {
                $table->id('ai_analysis_id');
                $table->foreignId('session_id')->constrained('analysis_sessions', 'session_id')->cascadeOnDelete();
                $table->string('model_name', 100);
                $table->json('context_data')->nullable();
                $table->text('result');
                $table->timestamp('created_at')->nullable();
            });
        }

        if (! Schema::hasTable('ai_messages')) {
            Schema::create('ai_messages', function (Blueprint $table) {
                $table->id('message_id');
                $table->foreignId('session_id')->constrained('analysis_sessions', 'session_id')->cascadeOnDelete();
                $table->string('role', 20);
                $table->text('content');
                $table->timestamp('created_at')->nullable();

                $table->index(['session_id', 'created_at']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_messages');
        Schema::dropIfExists('ai_analyses');
        Schema::dropIfExists('analysis_sessions');
        Schema::dropIfExists('watchlists');
        Schema::dropIfExists('stock_fundamentals');
        Schema::dropIfExists('news');
        Schema::dropIfExists('technical_indicators');
        Schema::dropIfExists('stock_prices');
        Schema::dropIfExists('stocks');
    }
};
