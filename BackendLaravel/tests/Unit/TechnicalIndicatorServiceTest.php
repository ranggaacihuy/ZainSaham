<?php

namespace Tests\Unit;

use App\Services\TechnicalIndicatorService;
use PHPUnit\Framework\TestCase;

class TechnicalIndicatorServiceTest extends TestCase
{
    private TechnicalIndicatorService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new TechnicalIndicatorService;
    }

    public function test_sma_uses_last_n_values(): void
    {
        $this->assertSame(4.0, $this->service->sma([1, 2, 3, 4, 5], 3));
        $this->assertNull($this->service->sma([1, 2], 3));
    }

    public function test_rsi_extremes_and_insufficient_data(): void
    {
        $this->assertSame(100.0, $this->service->rsi(range(1, 20)));
        $this->assertSame(0.0, $this->service->rsi(range(20, 1)));
        $this->assertNull($this->service->rsi(range(1, 14)));
    }

    public function test_rsi_matches_wilder_reference(): void
    {
        $closes = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28];

        $this->assertSame(70.46, $this->service->rsi($closes));
    }

    public function test_macd_needs_34_days_and_is_zero_for_flat_prices(): void
    {
        $this->assertSame([null, null], $this->service->macd(array_fill(0, 33, 100)));
        $this->assertEquals([0.0, 0.0], $this->service->macd(array_fill(0, 40, 100)));
    }

    public function test_macd_is_positive_in_uptrend(): void
    {
        [$macd, $signal] = $this->service->macd(range(100, 160));

        $this->assertGreaterThan(0, $macd);
        $this->assertGreaterThan(0, $signal);
    }
}
