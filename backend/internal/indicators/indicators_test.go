package indicators

import "testing"

func seq(from, to float64) []float64 {
	var values []float64
	step := 1.0
	if to < from {
		step = -1
	}

	for v := from; ; v += step {
		values = append(values, v)
		if v == to {
			break
		}
	}

	return values
}

func filled(n int, value float64) []float64 {
	values := make([]float64, n)
	for i := range values {
		values[i] = value
	}

	return values
}

func TestSMAUsesLastNValues(t *testing.T) {
	if got := SMA([]float64{1, 2, 3, 4, 5}, 3); got == nil || *got != 4 {
		t.Fatalf("SMA = %v, want 4", got)
	}

	if got := SMA([]float64{1, 2}, 3); got != nil {
		t.Fatalf("SMA = %v, want nil", *got)
	}
}

func TestRSIExtremesAndInsufficientData(t *testing.T) {
	if got := RSI(seq(1, 20), 14); got == nil || *got != 100 {
		t.Fatalf("RSI naik terus = %v, want 100", got)
	}

	if got := RSI(seq(20, 1), 14); got == nil || *got != 0 {
		t.Fatalf("RSI turun terus = %v, want 0", got)
	}

	if got := RSI(seq(1, 14), 14); got != nil {
		t.Fatalf("RSI = %v, want nil", *got)
	}
}

func TestRSIMatchesWilderReference(t *testing.T) {
	closes := []float64{44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28}

	if got := RSI(closes, 14); got == nil || *got != 70.46 {
		t.Fatalf("RSI = %v, want 70.46", got)
	}
}

func TestMACDNeedsThirtyFourDays(t *testing.T) {
	if macd, signal := MACD(filled(33, 100)); macd != nil || signal != nil {
		t.Fatal("MACD harus nil untuk data < 34 hari")
	}

	macd, signal := MACD(filled(40, 100))
	if macd == nil || signal == nil || *macd != 0 || *signal != 0 {
		t.Fatalf("MACD harga datar = %v / %v, want 0 / 0", macd, signal)
	}
}

func TestMACDIsPositiveInUptrend(t *testing.T) {
	macd, signal := MACD(seq(100, 160))

	if macd == nil || signal == nil || *macd <= 0 || *signal <= 0 {
		t.Fatalf("MACD tren naik = %v / %v, want > 0", macd, signal)
	}
}

func TestCalculate(t *testing.T) {
	values := Calculate(seq(1, 60))

	if values.SMA20 == nil || values.SMA50 == nil || values.RSI14 == nil || values.MACD == nil {
		t.Fatalf("Calculate harus mengisi semua indikator: %+v", values)
	}

	if *values.SMA20 != 50.5 || *values.SMA50 != 35.5 {
		t.Fatalf("SMA = %v / %v, want 50.5 / 35.5", *values.SMA20, *values.SMA50)
	}
}
