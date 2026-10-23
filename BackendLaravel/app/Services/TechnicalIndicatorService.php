<?php

namespace App\Services;

class TechnicalIndicatorService
{
    public function sma(array $closes, int $n): ?float
    {
        if (count($closes) < $n) {
            return null;
        }

        return round(array_sum(array_slice($closes, -$n)) / $n, 2);
    }

    public function rsi(array $closes, int $n = 14): ?float
    {
        $closes = array_values($closes);

        if (count($closes) < $n + 1) {
            return null;
        }

        $gains = [];
        $losses = [];

        for ($i = 1; $i < count($closes); $i++) {
            $diff = $closes[$i] - $closes[$i - 1];
            $gains[] = max($diff, 0);
            $losses[] = max(-$diff, 0);
        }

        $avgGain = array_sum(array_slice($gains, 0, $n)) / $n;
        $avgLoss = array_sum(array_slice($losses, 0, $n)) / $n;

        for ($i = $n; $i < count($gains); $i++) {
            $avgGain = ($avgGain * ($n - 1) + $gains[$i]) / $n;
            $avgLoss = ($avgLoss * ($n - 1) + $losses[$i]) / $n;
        }

        if ($avgLoss == 0) {
            return 100.0;
        }

        $rs = $avgGain / $avgLoss;

        return round(100 - (100 / (1 + $rs)), 2);
    }

    public function ema(array $values, int $n): array
    {
        $values = array_values($values);

        if (count($values) < $n) {
            return [];
        }

        $k = 2 / ($n + 1);
        $ema = [array_sum(array_slice($values, 0, $n)) / $n];

        for ($i = $n; $i < count($values); $i++) {
            $ema[] = $values[$i] * $k + end($ema) * (1 - $k);
        }

        return $ema;
    }

    public function macd(array $closes): array
    {
        $closes = array_values($closes);

        if (count($closes) < 34) {
            return [null, null];
        }

        $ema12 = $this->ema($closes, 12);
        $ema26 = $this->ema($closes, 26);
        $macd = [];

        for ($i = 25; $i < count($closes); $i++) {
            $macd[] = $ema12[$i - 11] - $ema26[$i - 25];
        }

        $signal = $this->ema($macd, 9);

        return [round(end($macd), 4), round(end($signal), 4)];
    }

    public function calculate(array $closes): array
    {
        [$macd, $signal] = $this->macd($closes);

        return [
            'rsi_14' => $this->rsi($closes, 14),
            'macd' => $macd,
            'macd_signal' => $signal,
            'sma_20' => $this->sma($closes, 20),
            'sma_50' => $this->sma($closes, 50),
        ];
    }
}
