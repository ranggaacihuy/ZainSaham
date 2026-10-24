package indicators

import "math"

type Values struct {
	RSI14      *float64
	MACD       *float64
	MACDSignal *float64
	SMA20      *float64
	SMA50      *float64
}

func SMA(closes []float64, n int) *float64 {
	if n <= 0 || len(closes) < n {
		return nil
	}

	sum := 0.0
	for _, value := range closes[len(closes)-n:] {
		sum += value
	}

	return new(Round(sum/float64(n), 2))
}

func RSI(closes []float64, n int) *float64 {
	if n <= 0 || len(closes) < n+1 {
		return nil
	}

	gains := make([]float64, 0, len(closes)-1)
	losses := make([]float64, 0, len(closes)-1)

	for i := 1; i < len(closes); i++ {
		diff := closes[i] - closes[i-1]
		gains = append(gains, math.Max(diff, 0))
		losses = append(losses, math.Max(-diff, 0))
	}

	avgGain := mean(gains[:n])
	avgLoss := mean(losses[:n])

	for i := n; i < len(gains); i++ {
		avgGain = (avgGain*float64(n-1) + gains[i]) / float64(n)
		avgLoss = (avgLoss*float64(n-1) + losses[i]) / float64(n)
	}

	if avgLoss == 0 {
		return new(100.0)
	}

	rs := avgGain / avgLoss

	return new(Round(100-(100/(1+rs)), 2))
}

func EMA(values []float64, n int) []float64 {
	if n <= 0 || len(values) < n {
		return nil
	}

	k := 2 / float64(n+1)
	ema := []float64{mean(values[:n])}

	for i := n; i < len(values); i++ {
		ema = append(ema, values[i]*k+ema[len(ema)-1]*(1-k))
	}

	return ema
}

func MACD(closes []float64) (*float64, *float64) {
	if len(closes) < 34 {
		return nil, nil
	}

	ema12 := EMA(closes, 12)
	ema26 := EMA(closes, 26)
	macd := make([]float64, 0, len(closes)-25)

	for i := 25; i < len(closes); i++ {
		macd = append(macd, ema12[i-11]-ema26[i-25])
	}

	signal := EMA(macd, 9)

	return new(Round(macd[len(macd)-1], 4)), new(Round(signal[len(signal)-1], 4))
}

func Calculate(closes []float64) Values {
	macd, signal := MACD(closes)

	return Values{
		RSI14:      RSI(closes, 14),
		MACD:       macd,
		MACDSignal: signal,
		SMA20:      SMA(closes, 20),
		SMA50:      SMA(closes, 50),
	}
}

func Round(value float64, places int) float64 {
	factor := math.Pow(10, float64(places))

	return math.Round(value*factor) / factor
}

func mean(values []float64) float64 {
	sum := 0.0
	for _, value := range values {
		sum += value
	}

	return sum / float64(len(values))
}
