<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class GeminiChatService
{
    public function reply(array $history, array $stockContext): string
    {
        $apiKey = config('services.gemini.api_key');
        $model = config('services.gemini.model');

        if (empty($apiKey)) {
            throw new RuntimeException(
                'GEMINI_API_KEY belum dikonfigurasi.'
            );
        }

        $contents = [];

        foreach ($history as $message) {
            $contents[] = [
                'role' => $message['role'] === 'assistant'
                    ? 'model'
                    : 'user',
                'parts' => [
                    ['text' => $message['content']]
                ],
            ];
        }

        $systemInstruction = [
            'parts' => [[
                'text' =>
                    'Kamu adalah asisten AI untuk aplikasi ZainSaham. ' .
                    'Bantu pengguna memahami saham berdasarkan data yang tersedia. ' .
                    'Jelaskan risiko, jangan menjanjikan keuntungan, dan ' .
                    'jangan mengarang data yang tidak tersedia. ' .
                    'Data saham yang tersedia: ' .
                    json_encode(
                        $stockContext,
                        JSON_UNESCAPED_UNICODE |
                        JSON_PARTIAL_OUTPUT_ON_ERROR
                    )
            ]]
        ];

        
        $response = Http::withOptions([
            'verify' => 'C:/certs/cacert.pem',
        ])
            ->timeout(60)
            ->post(
                'https://generativelanguage.googleapis.com/v1beta/models/' .
                $model . ':generateContent?key=' . $apiKey,
                [
                    'systemInstruction' => $systemInstruction,
                    'contents' => $contents,
                    'generationConfig' => [
                        'temperature' => 0.7,
                        'maxOutputTokens' => 1200,
                    ],
                ]
            );

            
        if ($response->failed()) {
            throw new RuntimeException(
                'Gemini API gagal. HTTP ' .
                $response->status() .
                ' - ' .
                $response->body()
            );
        }



        $text = $response->json(
            'candidates.0.content.parts.0.text'
        );

        if (!is_string($text) || trim($text) === '') {
            throw new RuntimeException(
                'Balasan Gemini kosong atau tidak tersedia.'
            );
        }

        return trim($text);
    }
}
