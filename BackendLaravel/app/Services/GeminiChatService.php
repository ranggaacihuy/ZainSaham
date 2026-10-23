<?php

namespace App\Services;

class GeminiChatService
{
    public function __construct(
        protected GeminiClient $gemini
    ) {}

    public function modelName(): string
    {
        return $this->gemini->lastModel() ?? $this->gemini->model();
    }

    public function reply(array $history, array $stockContext): string
    {
        $systemInstruction = implode("\n", [
            'Kamu adalah asisten AI untuk aplikasi ZainSaham, aplikasi analisis saham Bursa Efek Indonesia.',
            'Bantu pengguna memahami saham berdasarkan data yang tersedia di bawah.',
            'Aturan:',
            '- Jawab dalam Bahasa Indonesia yang jelas dan ringkas. Boleh memakai markdown sederhana (judul, daftar, tebal).',
            '- Gunakan hanya data yang tersedia. Bila data yang ditanyakan tidak ada, katakan terus terang; jangan mengarang angka.',
            '- Sebutkan tanggal data bila menyebut harga atau indikator.',
            '- Jelaskan risiko. Jangan menjanjikan keuntungan dan jangan memberi perintah beli/jual; ini bukan saran investasi.',
            '- Tolak dengan sopan pertanyaan yang tidak berhubungan dengan saham, pasar modal, atau keuangan.',
            '',
            'Data saham (JSON, harga dalam rupiah):',
            json_encode(
                $stockContext,
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR
            ),
        ]);

        return $this->gemini->generate($systemInstruction, $history);
    }
}
