package market

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/ranggaacihuy/zainsaham/backend/internal/config"
	"github.com/ranggaacihuy/zainsaham/backend/internal/database"
	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
	"gorm.io/gorm"
)

type chartDay struct {
	date   string
	open   any
	high   any
	low    any
	close  any
	volume any
}

func chartJSON(meta map[string]any, days []chartDay) map[string]any {
	quote := map[string][]any{"open": {}, "high": {}, "low": {}, "close": {}, "volume": {}}
	var timestamps []int64

	for _, day := range days {
		t, _ := time.Parse(time.RFC3339, day.date+"T02:00:00Z")
		timestamps = append(timestamps, t.Unix())
		quote["open"] = append(quote["open"], day.open)
		quote["high"] = append(quote["high"], day.high)
		quote["low"] = append(quote["low"], day.low)
		quote["close"] = append(quote["close"], day.close)
		quote["volume"] = append(quote["volume"], day.volume)
	}

	base := map[string]any{
		"symbol":               "BBCA.JK",
		"currency":             "IDR",
		"exchangeTimezoneName": "Asia/Jakarta",
		"longName":             "PT Bank Central Asia Tbk",
	}
	maps.Copy(base, meta)

	return map[string]any{"chart": map[string]any{
		"result": []any{map[string]any{
			"meta":       base,
			"timestamp":  timestamps,
			"indicators": map[string]any{"quote": []any{quote}},
		}},
		"error": nil,
	}}
}

func trendDays(start string, n int) []chartDay {
	first, _ := time.Parse("2006-01-02", start)
	days := make([]chartDay, 0, n)

	for i := range n {
		closePrice := 5000.0 + float64(i*10)
		days = append(days, chartDay{
			date:   first.AddDate(0, 0, i).Format("2006-01-02"),
			open:   closePrice - 20,
			high:   closePrice + 30,
			low:    closePrice - 40,
			close:  closePrice,
			volume: 1000 * (i + 1),
		})
	}

	return days
}

type fakeYahoo struct {
	mu       sync.Mutex
	requests []string
	respond  func(symbol string, w http.ResponseWriter, r *http.Request)
}

func (f *fakeYahoo) count(symbol string) int {
	f.mu.Lock()
	defer f.mu.Unlock()

	total := 0
	for _, request := range f.requests {
		if strings.Contains(request, "/chart/"+symbol) {
			total++
		}
	}

	return total
}

func newFakeYahoo(t *testing.T, respond func(symbol string, w http.ResponseWriter, r *http.Request)) (*fakeYahoo, string) {
	t.Helper()

	fake := &fakeYahoo{respond: respond}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fake.mu.Lock()
		fake.requests = append(fake.requests, r.URL.String())
		fake.mu.Unlock()

		symbol := strings.TrimPrefix(r.URL.Path, "/v8/finance/chart/")
		w.Header().Set("Content-Type", "application/json")
		fake.respond(symbol, w, r)
	}))
	t.Cleanup(server.Close)

	return fake, server.URL
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func newTestService(t *testing.T, baseURL string) (*Service, *gorm.DB) {
	t.Helper()

	db, err := database.Open(config.Database{
		Connection: "sqlite",
		Database:   fmt.Sprintf("file:market_%d?mode=memory&cache=shared", time.Now().UnixNano()),
	})
	if err != nil {
		t.Fatal(err)
	}

	if err := database.Migrate(db); err != nil {
		t.Fatal(err)
	}

	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})

	service := NewService(db, config.Yahoo{BaseURL: baseURL, Suffix: ".JK", Timeout: 5 * time.Second, QuoteTTL: 15 * time.Second}, config.News{BaseURL: baseURL, Limit: 20})
	service.yahoo.retryDelays = []time.Duration{10 * time.Millisecond}

	return service, db
}

func createStock(t *testing.T, db *gorm.DB, ticker string) *models.Stock {
	t.Helper()

	stock := &models.Stock{Ticker: ticker, CompanyName: ticker, Sector: "Keuangan", Exchange: "IDX", Currency: "IDR"}
	if err := db.Create(stock).Error; err != nil {
		t.Fatal(err)
	}

	return stock
}

func TestParseChartSkipsUnfinishedDaysAndSorts(t *testing.T) {
	days := []chartDay{
		{"2026-08-04", 10, 12, 9, 11, 100},
		{"2026-08-03", 9, 11, 8, 10, 90},
		{"2026-08-05", 11, 13, 10, nil, 110},
	}
	raw, _ := json.Marshal(chartJSON(nil, days))

	chart, err := parseChart("BBCA.JK", raw)
	if err != nil {
		t.Fatal(err)
	}

	if len(chart.Candles) != 2 || chart.Candles[0].Date.String() != "2026-08-03" || chart.Candles[1].Close != 11 {
		t.Fatalf("candles = %+v", chart.Candles)
	}

	if chart.Meta.CompanyName() != "PT Bank Central Asia Tbk" {
		t.Fatalf("nama = %q", chart.Meta.CompanyName())
	}
}

func TestParseChartUsesLivePriceForToday(t *testing.T) {
	days := []chartDay{
		{"2026-10-20", 5100, 5150, 5050, 5100, 100},
		{"2026-10-21", 5300, nil, nil, nil, nil},
	}
	raw, _ := json.Marshal(chartJSON(map[string]any{
		"regularMarketTime":    time.Date(2026, 10, 21, 6, 45, 0, 0, time.UTC).Unix(),
		"regularMarketPrice":   5200,
		"regularMarketDayHigh": 5350,
		"regularMarketDayLow":  5125,
		"regularMarketVolume":  319506900,
	}, days))

	chart, err := parseChart("BBCA.JK", raw)
	if err != nil {
		t.Fatal(err)
	}

	today := chart.Candles[len(chart.Candles)-1]
	if today.Date.String() != "2026-10-21" || today.Open != 5300 || today.High != 5350 || today.Low != 5125 || today.Close != 5200 || today.Volume != 319506900 {
		t.Fatalf("candle hari ini = %+v", today)
	}
}

func TestFetchDailyErrorsAndRetry(t *testing.T) {
	attempts := 0
	fake, baseURL := newFakeYahoo(t, func(symbol string, w http.ResponseWriter, r *http.Request) {
		switch symbol {
		case "XXXX.JK":
			writeJSON(w, http.StatusNotFound, map[string]any{"chart": map[string]any{"result": nil, "error": map[string]any{"description": "No data found"}}})
		default:
			attempts++
			if attempts == 1 {
				writeJSON(w, http.StatusServiceUnavailable, map[string]any{})
				return
			}
			writeJSON(w, http.StatusOK, chartJSON(nil, trendDays("2026-08-03", 3)))
		}
	})

	service, _ := newTestService(t, baseURL)

	if _, err := service.Fetch(context.Background(), "xxxx", "1mo"); err == nil || err.Error() != "Kode saham XXXX.JK tidak dikenali Yahoo Finance." {
		t.Fatalf("err = %v", err)
	}

	chart, err := service.Fetch(context.Background(), "BBCA", "3mo")
	if err != nil || len(chart.Candles) != 3 {
		t.Fatalf("chart = %+v, err %v", chart, err)
	}

	if fake.count("BBCA.JK") != 2 || !strings.Contains(fake.requests[len(fake.requests)-1], "range=3mo") {
		t.Fatalf("requests = %v", fake.requests)
	}
}

func TestSyncUpsertsPricesIndicatorsAndName(t *testing.T) {
	_, baseURL := newFakeYahoo(t, func(symbol string, w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, chartJSON(nil, trendDays("2026-08-03", 40)))
	})

	service, db := newTestService(t, baseURL)
	stock := createStock(t, db, "BBCA")

	for range 2 {
		result, err := service.Sync(context.Background(), stock, "3mo")
		if err != nil || result.Prices != 40 || result.Indicators != 40 {
			t.Fatalf("result = %+v, err %v", result, err)
		}
	}

	var prices, indicatorRows int64
	db.Model(&models.StockPrice{}).Count(&prices)
	db.Model(&models.TechnicalIndicator{}).Count(&indicatorRows)

	if prices != 40 || indicatorRows != 40 {
		t.Fatalf("prices = %d, indicators = %d", prices, indicatorRows)
	}

	var refreshed models.Stock
	db.First(&refreshed, stock.StockID)
	if refreshed.CompanyName != "PT Bank Central Asia Tbk" {
		t.Fatalf("nama = %q", refreshed.CompanyName)
	}

	var last models.TechnicalIndicator
	db.Order("indicator_date desc").First(&last)
	if last.SMA20 == nil || last.MACD == nil || last.SMA50 != nil {
		t.Fatalf("indikator terakhir = %+v", last)
	}

	var firstPrice models.StockPrice
	db.Order("price_date").First(&firstPrice)
	if firstPrice.PriceDate.String() != "2026-08-03" || firstPrice.OpenPrice != 4980 || firstPrice.Volume != 1000 {
		t.Fatalf("harga pertama = %+v", firstPrice)
	}
}

func TestQuoteIsCachedAndReportsMarketState(t *testing.T) {
	open := time.Date(2026, 10, 21, 2, 0, 0, 0, time.UTC)
	days := []chartDay{
		{"2026-10-20", 5100, 5150, 5050, 5100, 100},
		{"2026-10-21", 5300, 5350, 5125, 5200, 319506900},
	}

	fake, baseURL := newFakeYahoo(t, func(symbol string, w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, chartJSON(map[string]any{
			"regularMarketTime": open.Add(4 * time.Hour).Unix(),
			"currentTradingPeriod": map[string]any{"regular": map[string]any{
				"start": open.Unix(),
				"end":   open.Add(7*time.Hour + 15*time.Minute).Unix(),
			}},
		}, days))
	})

	service, db := newTestService(t, baseURL)
	stock := createStock(t, db, "BBCA")

	clock := open.Add(5 * time.Hour)
	service.now = func() time.Time { return clock }

	quote, err := service.Quote(context.Background(), stock)
	if err != nil {
		t.Fatal(err)
	}

	if !quote.IsOpen || quote.Price.ClosePrice != 5200 || *quote.PrevClose != 5100 || *quote.Change != 100 || *quote.ChangePct != 1.96 {
		t.Fatalf("quote = %+v", quote)
	}

	if *quote.MarketTime != "2026-10-21T13:00:00+07:00" {
		t.Fatalf("market_time = %s", *quote.MarketTime)
	}

	_, _ = service.Quote(context.Background(), stock)
	if fake.count("BBCA.JK") != 1 {
		t.Fatalf("quote harus di-cache, requests = %d", fake.count("BBCA.JK"))
	}

	clock = clock.Add(16 * time.Second)
	_, _ = service.Quote(context.Background(), stock)
	if fake.count("BBCA.JK") != 2 {
		t.Fatalf("cache harus kedaluwarsa, requests = %d", fake.count("BBCA.JK"))
	}

	clock = open.Add(8 * time.Hour)
	service.quotes = map[uint]cachedQuote{}
	closed, _ := service.Quote(context.Background(), stock)
	if closed.IsOpen {
		t.Fatal("pasar seharusnya tutup")
	}

	var stored int64
	db.Model(&models.StockPrice{}).Where("stock_id = ?", stock.StockID).Count(&stored)
	if stored != 2 {
		t.Fatalf("harga tersimpan = %d", stored)
	}
}

func TestSyncAllContinuesWhenOneStockFails(t *testing.T) {
	_, baseURL := newFakeYahoo(t, func(symbol string, w http.ResponseWriter, r *http.Request) {
		if symbol == "XXXX.JK" {
			writeJSON(w, http.StatusNotFound, map[string]any{})
			return
		}
		writeJSON(w, http.StatusOK, chartJSON(nil, trendDays("2026-08-03", 5)))
	})

	service, db := newTestService(t, baseURL)
	createStock(t, db, "BBCA")
	createStock(t, db, "XXXX")

	var out bytes.Buffer
	succeeded, failed, err := service.SyncAll(context.Background(), SyncOptions{Range: "1mo", Prices: true}, &out)
	if err != nil || succeeded != 1 || failed != 1 {
		t.Fatalf("succeeded %d failed %d err %v", succeeded, failed, err)
	}

	if !strings.Contains(out.String(), "XXXX   gagal: harga: Kode saham XXXX.JK tidak dikenali Yahoo Finance.") {
		t.Fatalf("output = %s", out.String())
	}
}

func TestIntradayFetchesAggregatesAndCaches(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Jakarta")
	base := time.Date(2026, 11, 20, 9, 0, 0, 0, loc)
	timestamps := []int64{
		base.Unix(),
		base.Add(5 * time.Minute).Unix(),
		base.Add(10 * time.Minute).Unix(),
		base.Add(15 * time.Minute).Unix(),
	}

	fake, baseURL := newFakeYahoo(t, func(symbol string, w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"chart": map[string]any{
			"result": []any{map[string]any{
				"meta": map[string]any{
					"symbol":               "BBCA.JK",
					"currency":             "IDR",
					"exchangeTimezoneName": "Asia/Jakarta",
				},
				"timestamp": timestamps,
				"indicators": map[string]any{"quote": []any{map[string]any{
					"open":   []any{9000.0, 9025.0, 9050.0, 9075.0},
					"high":   []any{9050.0, 9075.0, 9100.0, 9125.0},
					"low":    []any{8975.0, 9000.0, 9025.0, 9050.0},
					"close":  []any{9025.0, 9050.0, 9075.0, 9100.0},
					"volume": []any{1000.0, 2000.0, 1500.0, 2500.0},
				}}},
			}},
			"error": nil,
		}})
	})

	service, db := newTestService(t, baseURL)
	stock := createStock(t, db, "BBCA")

	clock := base.Add(time.Hour)
	service.now = func() time.Time { return clock }

	if _, err := service.Intraday(context.Background(), stock, "7m"); err == nil {
		t.Fatal("interval tidak valid seharusnya error")
	}

	res, err := service.Intraday(context.Background(), stock, "10m")
	if err != nil {
		t.Fatal(err)
	}

	if res.Interval != "10m" || len(res.Candles) != 2 {
		t.Fatalf("intraday 10m = %+v", res)
	}
	if res.Candles[0].OpenPrice != 9000 || res.Candles[0].HighPrice != 9075 || res.Candles[0].LowPrice != 8975 || res.Candles[0].ClosePrice != 9050 || res.Candles[0].Volume != 3000 {
		t.Fatalf("candle pertama 10m = %+v", res.Candles[0])
	}
	if res.Candles[1].OpenPrice != 9050 || res.Candles[1].HighPrice != 9125 || res.Candles[1].LowPrice != 9025 || res.Candles[1].ClosePrice != 9100 || res.Candles[1].Volume != 4000 {
		t.Fatalf("candle kedua 10m = %+v", res.Candles[1])
	}

	_, _ = service.Intraday(context.Background(), stock, "10m")
	if fake.count("BBCA.JK") != 1 {
		t.Fatalf("intraday harus di-cache, requests = %d", fake.count("BBCA.JK"))
	}

	clock = clock.Add(61 * time.Second)
	_, _ = service.Intraday(context.Background(), stock, "10m")
	if fake.count("BBCA.JK") != 2 {
		t.Fatalf("cache intraday harus kedaluwarsa, requests = %d", fake.count("BBCA.JK"))
	}
}
