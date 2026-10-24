package httpapi_test

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
	"github.com/ranggaacihuy/zainsaham/backend/internal/testutil"
)

func itoa(id uint) string {
	return strconv.FormatUint(uint64(id), 10)
}

func TestStockEndpointsShape(t *testing.T) {
	e := newEnv(t)
	testutil.Stock(t, e.db, "TLKM")
	stock := testutil.StockWithMarketData(t, e.db, "BBCA", 60, 3)
	base := "/api/stocks/" + itoa(stock.StockID)

	e.call(http.MethodGet, "/api/stocks", "", nil).
		assertStatus(http.StatusOK).
		assertPath("data.0.ticker", "BBCA").
		assertPath("data.1.ticker", "TLKM").
		assertMissing("data.0.created_at")

	prices := e.call(http.MethodGet, base+"/prices", "", nil).assertStatus(http.StatusOK).assertCount("data", 60)
	first := prices.get("data.0.price_date").(string)
	last := prices.get("data.59.price_date").(string)
	if len(first) != 10 || first >= last {
		t.Fatalf("price_date harus YYYY-MM-DD dan urut naik: %s .. %s", first, last)
	}
	if _, isNumber := prices.get("data.0.close_price").(float64); !isNumber {
		t.Fatalf("close_price harus angka: %s", prices.raw)
	}

	e.call(http.MethodGet, base+"/indicators", "", nil).assertStatus(http.StatusOK).assertCount("data", 60).
		assertPath("data.0.rsi_14", nil)
	e.call(http.MethodGet, base+"/fundamentals", "", nil).assertStatus(http.StatusOK).assertPath("data.0.period", "2026-Q2")
	e.call(http.MethodGet, base+"/news", "", nil).assertStatus(http.StatusOK).assertPath("data.0.title", "Berita 1 BBCA")

	e.call(http.MethodGet, "/api/stocks/999", "", nil).
		assertStatus(http.StatusNotFound).
		assertPath("message", "Saham tidak ditemukan.")
	e.call(http.MethodGet, "/api/stocks/abc", "", nil).assertStatus(http.StatusNotFound)
	e.call(http.MethodGet, "/api/tidak-ada", "", nil).assertStatus(http.StatusNotFound)
}

func TestQuoteReturnsLiveCandleAndStoresIt(t *testing.T) {
	e := newEnv(t)
	stock := testutil.Stock(t, e.db, "BBCA")

	now := time.Now().UTC()
	open := now.Add(-time.Hour)
	day := func(offset int) int64 { return now.AddDate(0, 0, offset).Unix() }

	e.yahoo.set(func(path string, w http.ResponseWriter) {
		_ = json.NewEncoder(w).Encode(map[string]any{"chart": map[string]any{
			"result": []any{map[string]any{
				"meta": map[string]any{
					"symbol":               "BBCA.JK",
					"currency":             "IDR",
					"exchangeTimezoneName": "UTC",
					"longName":             "PT Bank Central Asia Tbk",
					"regularMarketTime":    now.Unix(),
					"regularMarketPrice":   5200,
					"regularMarketDayHigh": 5350,
					"regularMarketDayLow":  5125,
					"regularMarketVolume":  319506900,
					"currentTradingPeriod": map[string]any{"regular": map[string]any{"start": open.Unix(), "end": now.Add(time.Hour).Unix()}},
				},
				"timestamp": []int64{day(-1), day(0)},
				"indicators": map[string]any{"quote": []any{map[string]any{
					"open":   []any{5100, 5300},
					"high":   []any{5150, nil},
					"low":    []any{5050, nil},
					"close":  []any{5100, nil},
					"volume": []any{100, nil},
				}}},
			}},
			"error": nil,
		}})
	})

	res := e.call(http.MethodGet, "/api/stocks/"+itoa(stock.StockID)+"/quote", "", nil).
		assertStatus(http.StatusOK).
		assertPath("data.is_open", true).
		assertPath("data.price.close_price", 5200).
		assertPath("data.price.open_price", 5300).
		assertPath("data.price.volume", 319506900).
		assertPath("data.prev_close", 5100).
		assertPath("data.change", 100).
		assertPath("data.change_pct", 1.96)

	if date := res.get("data.price.price_date").(string); date != now.Format("2006-01-02") {
		t.Fatalf("price_date = %s", date)
	}

	if !strings.Contains(e.yahoo.last().query, "range=5d") {
		t.Fatalf("query = %s", e.yahoo.last().query)
	}

	e.call(http.MethodGet, "/api/stocks/"+itoa(stock.StockID)+"/quote", "", nil).assertStatus(http.StatusOK)
	if e.yahoo.count("BBCA.JK") != 1 {
		t.Fatalf("quote harus di-cache, requests = %d", e.yahoo.count("BBCA.JK"))
	}

	var stored int64
	e.db.Model(&models.StockPrice{}).Where("stock_id = ?", stock.StockID).Count(&stored)
	if stored != 2 {
		t.Fatalf("harga tersimpan = %d, want 2", stored)
	}
}

func TestQuoteErrors(t *testing.T) {
	e := newEnv(t)
	stock := testutil.Stock(t, e.db, "BBCA")

	e.yahoo.set(func(path string, w http.ResponseWriter) { w.WriteHeader(http.StatusBadRequest) })

	e.call(http.MethodGet, "/api/stocks/"+itoa(stock.StockID)+"/quote", "", nil).
		assertStatus(http.StatusBadGateway).
		assertPath("success", false).
		assertPath("message", "Data harga realtime belum dapat diambil dari Yahoo Finance.")

	e.call(http.MethodGet, "/api/stocks/999/quote", "", nil).assertStatus(http.StatusNotFound)
}
