package market

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
	_ "time/tzdata"

	"github.com/ranggaacihuy/zainsaham/backend/internal/config"
	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
)

var Ranges = []string{"5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "max"}

type Meta struct {
	Symbol               string   `json:"symbol"`
	Currency             string   `json:"currency"`
	LongName             string   `json:"longName"`
	ShortName            string   `json:"shortName"`
	ExchangeTimezoneName string   `json:"exchangeTimezoneName"`
	RegularMarketTime    int64    `json:"regularMarketTime"`
	RegularMarketPrice   *float64 `json:"regularMarketPrice"`
	RegularMarketDayHigh *float64 `json:"regularMarketDayHigh"`
	RegularMarketDayLow  *float64 `json:"regularMarketDayLow"`
	RegularMarketVolume  *float64 `json:"regularMarketVolume"`
	CurrentTradingPeriod struct {
		Regular struct {
			Start int64 `json:"start"`
			End   int64 `json:"end"`
		} `json:"regular"`
	} `json:"currentTradingPeriod"`
}

func (m Meta) CompanyName() string {
	if m.LongName != "" {
		return m.LongName
	}

	return m.ShortName
}

func (m Meta) Location() *time.Location {
	if m.ExchangeTimezoneName != "" {
		if location, err := time.LoadLocation(m.ExchangeTimezoneName); err == nil {
			return location
		}
	}

	location, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		return time.UTC
	}

	return location
}

type Candle struct {
	Date   models.Date
	Open   float64
	High   float64
	Low    float64
	Close  float64
	Volume int64
}

type Chart struct {
	Meta    Meta
	Candles []Candle
}

type Yahoo struct {
	baseURL     string
	suffix      string
	http        *http.Client
	retryDelays []time.Duration
}

func NewYahoo(cfg config.Yahoo) *Yahoo {
	return &Yahoo{
		baseURL:     strings.TrimRight(cfg.BaseURL, "/"),
		suffix:      cfg.Suffix,
		http:        &http.Client{Timeout: cfg.Timeout},
		retryDelays: []time.Duration{time.Second, 5 * time.Second},
	}
}

func (y *Yahoo) Symbol(code string) string {
	code = strings.ToUpper(strings.TrimSpace(code))
	if strings.HasPrefix(code, "^") {
		return code
	}

	return code + y.suffix
}

func (y *Yahoo) FetchDaily(ctx context.Context, ticker, dataRange string) (*Chart, error) {
	symbol := y.Symbol(ticker)
	endpoint := fmt.Sprintf("%s/v8/finance/chart/%s?%s", y.baseURL, url.PathEscape(symbol), url.Values{
		"range":    {dataRange},
		"interval": {"1d"},
	}.Encode())

	status, raw, err := y.getWithRetry(ctx, endpoint)
	if err != nil {
		return nil, fmt.Errorf("Yahoo Finance gagal untuk %s: %w", symbol, err)
	}

	if status == http.StatusNotFound {
		return nil, fmt.Errorf("Kode saham %s tidak dikenali Yahoo Finance.", symbol)
	}

	if status >= http.StatusBadRequest {
		return nil, fmt.Errorf("Yahoo Finance gagal untuk %s: HTTP %d", symbol, status)
	}

	return parseChart(symbol, raw)
}

func (y *Yahoo) getWithRetry(ctx context.Context, endpoint string) (int, []byte, error) {
	for attempt := 0; ; attempt++ {
		status, raw, err := y.get(ctx, endpoint)
		if err != nil {
			return 0, nil, err
		}

		retryable := status == http.StatusTooManyRequests || status == http.StatusInternalServerError ||
			status == http.StatusBadGateway || status == http.StatusServiceUnavailable
		if !retryable || attempt >= len(y.retryDelays) {
			return status, raw, nil
		}

		select {
		case <-ctx.Done():
			return 0, nil, ctx.Err()
		case <-time.After(y.retryDelays[attempt]):
		}
	}
}

func (y *Yahoo) get(ctx context.Context, endpoint string) (int, []byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return 0, nil, err
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (ZainSaham)")
	req.Header.Set("Accept", "application/json")

	resp, err := y.http.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 20<<20))

	return resp.StatusCode, raw, err
}

func parseChart(symbol string, raw []byte) (*Chart, error) {
	var payload struct {
		Chart struct {
			Result []struct {
				Meta       Meta    `json:"meta"`
				Timestamp  []int64 `json:"timestamp"`
				Indicators struct {
					Quote []struct {
						Open   []*float64 `json:"open"`
						High   []*float64 `json:"high"`
						Low    []*float64 `json:"low"`
						Close  []*float64 `json:"close"`
						Volume []*float64 `json:"volume"`
					} `json:"quote"`
				} `json:"indicators"`
			} `json:"result"`
			Error *struct {
				Description string `json:"description"`
			} `json:"error"`
		} `json:"chart"`
	}

	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, fmt.Errorf("Yahoo Finance gagal untuk %s: respons tidak dapat dibaca", symbol)
	}

	if len(payload.Chart.Result) == 0 {
		reason := "respons kosong"
		if payload.Chart.Error != nil && payload.Chart.Error.Description != "" {
			reason = payload.Chart.Error.Description
		}

		return nil, fmt.Errorf("Yahoo Finance gagal untuk %s: %s", symbol, reason)
	}

	result := payload.Chart.Result[0]
	meta := result.Meta
	location := meta.Location()

	marketDate := ""
	if meta.RegularMarketTime > 0 {
		marketDate = time.Unix(meta.RegularMarketTime, 0).In(location).Format("2006-01-02")
	}

	byDate := map[string]Candle{}

	if len(result.Indicators.Quote) > 0 {
		quote := result.Indicators.Quote[0]

		for i, timestamp := range result.Timestamp {
			date := models.NewDate(time.Unix(timestamp, 0).In(location))
			open, high, low, close, volume := at(quote.Open, i), at(quote.High, i), at(quote.Low, i), at(quote.Close, i), at(quote.Volume, i)

			if close == nil && date.String() == marketDate && meta.RegularMarketPrice != nil {
				close = meta.RegularMarketPrice
				high = first(high, meta.RegularMarketDayHigh, close)
				low = first(low, meta.RegularMarketDayLow, close)
				open = first(open, close)
				volume = first(volume, meta.RegularMarketVolume, new(0.0))
			}

			if open == nil || high == nil || low == nil || close == nil {
				continue
			}

			byDate[date.String()] = Candle{
				Date:   date,
				Open:   round2(*open),
				High:   round2(*high),
				Low:    round2(*low),
				Close:  round2(*close),
				Volume: int64(deref(volume)),
			}
		}
	}

	candles := make([]Candle, 0, len(byDate))
	for _, candle := range byDate {
		candles = append(candles, candle)
	}

	sort.Slice(candles, func(i, j int) bool { return candles[i].Date.Before(candles[j].Date.Time) })

	return &Chart{Meta: meta, Candles: candles}, nil
}

func at(values []*float64, i int) *float64 {
	if i < len(values) {
		return values[i]
	}

	return nil
}

func first(values ...*float64) *float64 {
	for _, value := range values {
		if value != nil {
			return value
		}
	}

	return nil
}

func deref(value *float64) float64 {
	if value == nil {
		return 0
	}

	return *value
}
