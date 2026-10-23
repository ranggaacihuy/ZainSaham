<?php

namespace App\Services;

use App\Exceptions\GeminiException;
use Composer\CaBundle\CaBundle;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GeminiClient
{
    private const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';

    private const COOLDOWN_KEY = 'gemini:cooldown:';

    private const COOLDOWN_MINUTES = 5;

    private const MIN_ATTEMPT_SECONDS = 5;

    private const BLOCKED_REASONS = [
        'SAFETY',
        'RECITATION',
        'BLOCKLIST',
        'PROHIBITED_CONTENT',
        'SPII',
    ];

    protected ?string $lastModel = null;

    public function model(): string
    {
        return $this->normalizeModel((string) config('services.gemini.model'));
    }

    public function lastModel(): ?string
    {
        return $this->lastModel;
    }

    public function generate(string $systemInstruction, array $messages): string
    {
        $apiKey = config('services.gemini.api_key');

        if (empty($apiKey)) {
            throw new GeminiException(
                'GEMINI_API_KEY belum dikonfigurasi.',
                'Layanan AI belum dikonfigurasi. Isi GEMINI_API_KEY di file .env backend.'
            );
        }

        $contents = $this->toContents($messages);

        if ($contents === []) {
            throw new GeminiException('Tidak ada pesan pengguna untuk dikirim ke Gemini.');
        }

        $payload = [
            'systemInstruction' => [
                'parts' => [['text' => $systemInstruction]],
            ],
            'contents' => $contents,
            'generationConfig' => [
                'temperature' => (float) config('services.gemini.temperature', 0.7),
                'maxOutputTokens' => (int) config('services.gemini.max_output_tokens', 8192),
            ],
        ];

        $timeout = max(self::MIN_ATTEMPT_SECONDS, (int) config('services.gemini.timeout', 40));
        $budget = max($timeout, (int) config('services.gemini.total_timeout', 60));
        $deadline = microtime(true) + $budget;

        if (function_exists('set_time_limit')) {
            @set_time_limit($budget + 30);
        }

        $lastError = null;

        foreach ($this->candidateModels() as $model) {
            $remaining = (int) floor($deadline - microtime(true));

            if ($remaining < self::MIN_ATTEMPT_SECONDS) {
                break;
            }

            try {
                $text = $this->request($model, $apiKey, min($timeout, $remaining), $payload);
                $this->lastModel = $model;

                return $text;
            } catch (GeminiException $e) {
                if (! $e->retryable) {
                    throw $e;
                }

                Log::warning("Gemini model {$model} gagal, mencoba model berikutnya: ".$e->getMessage());
                Cache::put(self::COOLDOWN_KEY.$model, true, now()->addMinutes(self::COOLDOWN_MINUTES));
                $lastError = $e;
            }
        }

        throw $lastError ?? new GeminiException(
            'Batas waktu total Gemini habis.',
            'Layanan AI terlalu lama merespons karena sedang sibuk. Coba lagi sebentar lagi.'
        );
    }

    protected function candidateModels(): array
    {
        $fallbacks = explode(',', (string) config('services.gemini.fallback_models', ''));

        $models = collect([$this->model(), ...$fallbacks])
            ->map(fn ($model) => $this->normalizeModel($model))
            ->filter()
            ->unique()
            ->values();

        [$cooling, $ready] = $models->partition(fn ($model) => Cache::has(self::COOLDOWN_KEY.$model));

        return [...$ready->all(), ...$cooling->all()];
    }

    protected function normalizeModel(string $model): string
    {
        $model = trim($model);

        return str_starts_with($model, 'models/') ? substr($model, 7) : $model;
    }

    protected function request(string $model, string $apiKey, int $timeout, array $payload): string
    {
        try {
            $response = Http::withOptions(['verify' => $this->caBundle()])
                ->withHeaders(['x-goog-api-key' => $apiKey])
                ->acceptJson()
                ->connectTimeout(min(10, $timeout))
                ->timeout($timeout)
                ->post(self::BASE_URL.rawurlencode($model).':generateContent', $payload);
        } catch (ConnectionException $e) {
            $timedOut = str_contains($e->getMessage(), 'cURL error 28');

            throw new GeminiException(
                "Gagal terhubung ke Gemini ({$model}): ".$e->getMessage(),
                $timedOut
                    ? 'Layanan AI terlalu lama merespons karena sedang sibuk. Coba lagi sebentar lagi.'
                    : 'Tidak dapat terhubung ke layanan AI. Periksa koneksi internet server atau coba lagi.',
                0,
                $e,
                retryable: true
            );
        }

        if ($response->failed()) {
            throw $this->failedResponse($model, $response);
        }

        return $this->extractText($response);
    }

    protected function toContents(array $messages): array
    {
        $contents = [];

        foreach ($messages as $message) {
            $text = trim((string) ($message['content'] ?? ''));

            if ($text === '') {
                continue;
            }

            $role = ($message['role'] ?? 'user') === 'assistant' ? 'model' : 'user';

            if ($contents === [] && $role === 'model') {
                continue;
            }

            $last = array_key_last($contents);

            if ($last !== null && $contents[$last]['role'] === $role) {
                $contents[$last]['parts'][0]['text'] .= "\n\n".$text;

                continue;
            }

            $contents[] = [
                'role' => $role,
                'parts' => [['text' => $text]],
            ];
        }

        return $contents;
    }

    protected function caBundle(): string
    {
        $path = config('services.gemini.ca_bundle');

        if (! empty($path)) {
            if (is_file($path)) {
                return $path;
            }

            throw new GeminiException(
                'File GEMINI_CA_BUNDLE tidak ditemukan: '.$path,
                'Sertifikat SSL untuk layanan AI tidak ditemukan. Periksa GEMINI_CA_BUNDLE di .env backend.'
            );
        }

        return CaBundle::getSystemCaRootBundlePath();
    }

    protected function failedResponse(string $model, Response $response): GeminiException
    {
        $status = $response->status();
        $apiMessage = (string) $response->json('error.message', '');

        $userMessage = match (true) {
            str_contains($apiMessage, 'API key not valid'),
            in_array($status, [401, 403], true) => 'API key Gemini tidak valid atau tidak punya akses. Periksa GEMINI_API_KEY di .env backend.',
            $status === 404 => 'Model Gemini "'.$model.'" tidak ditemukan. Periksa GEMINI_MODEL di .env backend.',
            $status === 429 => 'Kuota layanan AI sedang habis atau terlalu banyak permintaan. Coba lagi beberapa saat lagi.',
            $status >= 500 => 'Layanan AI sedang sibuk. Coba lagi sebentar lagi.',
            default => 'Permintaan ke layanan AI ditolak. Silakan coba lagi.',
        };

        $keyProblem = str_contains($apiMessage, 'API key not valid') || in_array($status, [401, 403], true);

        return new GeminiException(
            "Gemini API gagal ({$model}). HTTP {$status} - ".$response->body(),
            $userMessage,
            $status,
            null,
            retryable: ! $keyProblem && ($status === 404 || $status === 429 || $status >= 500)
        );
    }

    protected function extractText(Response $response): string
    {
        $blockReason = $response->json('promptFeedback.blockReason');

        if (! empty($blockReason)) {
            throw new GeminiException(
                'Prompt diblokir Gemini: '.$blockReason,
                'Permintaan ditolak oleh filter keamanan AI. Coba ubah pertanyaan.'
            );
        }

        $candidate = $response->json('candidates.0') ?? [];
        $finishReason = (string) ($candidate['finishReason'] ?? '');

        $text = collect($candidate['content']['parts'] ?? [])
            ->reject(fn ($part) => ! empty($part['thought']))
            ->pluck('text')
            ->filter(fn ($value) => is_string($value))
            ->implode('');

        $text = trim($text);

        if ($text === '') {
            $userMessage = match (true) {
                in_array($finishReason, self::BLOCKED_REASONS, true) => 'Jawaban AI diblokir oleh filter keamanan. Coba ubah pertanyaan.',
                $finishReason === 'MAX_TOKENS' => 'Jawaban AI terpotong sebelum selesai. Naikkan GEMINI_MAX_OUTPUT_TOKENS di .env backend.',
                default => 'AI tidak memberikan jawaban. Silakan coba lagi.',
            };

            throw new GeminiException(
                'Balasan Gemini kosong. finishReason='.($finishReason ?: 'UNKNOWN'),
                $userMessage
            );
        }

        if ($finishReason === 'MAX_TOKENS') {
            $text .= "\n\n_(Jawaban terpotong karena melebihi batas panjang.)_";
        }

        return $text;
    }
}
