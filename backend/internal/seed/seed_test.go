package seed

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/ranggaacihuy/zainsaham/backend/internal/config"
	"github.com/ranggaacihuy/zainsaham/backend/internal/market"
	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
	"github.com/ranggaacihuy/zainsaham/backend/internal/testutil"
)

func chart(symbol, name string) map[string]any {
	start := time.Date(2026, 8, 3, 2, 0, 0, 0, time.UTC)
	var timestamps []int64
	quote := map[string][]any{"open": {}, "high": {}, "low": {}, "close": {}, "volume": {}}

	for i := range 3 {
		timestamps = append(timestamps, start.AddDate(0, 0, i).Unix())
		quote["open"] = append(quote["open"], 100)
		quote["high"] = append(quote["high"], 110)
		quote["low"] = append(quote["low"], 90)
		quote["close"] = append(quote["close"], 105)
		quote["volume"] = append(quote["volume"], 1000)
	}

	return map[string]any{"chart": map[string]any{
		"result": []any{map[string]any{
			"meta":       map[string]any{"symbol": symbol, "currency": "IDR", "exchangeTimezoneName": "Asia/Jakarta", "longName": name},
			"timestamp":  timestamps,
			"indicators": map[string]any{"quote": []any{quote}},
		}},
	}}
}

func fakeMarket(t *testing.T) string {
	t.Helper()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch {
		case r.URL.Path == "/indonesia/scan":
			_, _ = w.Write([]byte(`{"data":[
				{"s":"IDX:BBCA","d":["BBCA","PT Bank Central Asia Tbk","Finance",3e14]},
				{"s":"IDX:NEWS","d":["NEWS","PT Emiten Baru Tbk","Technology Services",2e14]},
				{"s":"IDX:GONE","d":["GONE","PT Tanpa Data Tbk","Finance",1e14]}
			]}`))
		case strings.HasPrefix(r.URL.Path, "/v8/finance/chart/"):
			symbol := strings.TrimPrefix(r.URL.Path, "/v8/finance/chart/")
			if symbol == "GONE.JK" {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			_ = json.NewEncoder(w).Encode(chart(symbol, "Nama Yahoo "+symbol))
		case strings.HasPrefix(r.URL.Path, "/ws/fundamentals-timeseries/"):
			_, _ = w.Write([]byte(`{"timeseries":{"result":[]}}`))
		case r.URL.Path == "/rss/search":
			w.Header().Set("Content-Type", "application/rss+xml")
			_, _ = w.Write([]byte(`<rss><channel></channel></rss>`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(server.Close)

	return server.URL
}

func TestRefreshListingsAddsOnlyNewStocksWithData(t *testing.T) {
	baseURL := fakeMarket(t)
	db := testutil.DB(t)
	service := market.NewService(db, config.Yahoo{BaseURL: baseURL, Suffix: ".JK", Timeout: 5 * time.Second}, config.News{BaseURL: baseURL, Limit: 5})
	source := market.NewListingSource(config.Listings{BaseURL: baseURL, Limit: 10})

	db.Create(&models.Stock{Ticker: "BBCA", CompanyName: "Lama", Exchange: "IDX", Currency: "IDR", Kind: models.KindStock})

	var out bytes.Buffer
	added, failed, err := RefreshListings(context.Background(), db, service, source, 10, 0, &out)
	if err != nil || added != 1 || failed != 1 {
		t.Fatalf("added %d failed %d err %v\n%s", added, failed, err, out.String())
	}

	var stock models.Stock
	if err := db.Where("ticker = ?", "NEWS").First(&stock).Error; err != nil {
		t.Fatal(err)
	}
	if stock.CompanyName != "Nama Yahoo NEWS.JK" || stock.Sector != "Teknologi" || stock.Kind != models.KindStock {
		t.Fatalf("emiten baru = %+v", stock)
	}

	var prices int64
	db.Model(&models.StockPrice{}).Where("stock_id = ?", stock.StockID).Count(&prices)
	if prices != 3 {
		t.Fatalf("harga emiten baru = %d", prices)
	}

	var old models.Stock
	db.Where("ticker = ?", "BBCA").First(&old)
	if old.CompanyName != "Lama" {
		t.Fatal("emiten lama tidak boleh disentuh")
	}

	var gone int64
	db.Model(&models.Stock{}).Where("ticker = ?", "GONE").Count(&gone)
	if gone != 0 || !strings.Contains(out.String(), "GONE   dilewati") {
		t.Fatalf("emiten tanpa data tidak boleh dibuat:\n%s", out.String())
	}
}

func TestIndexDataAndListingFallback(t *testing.T) {
	baseURL := fakeMarket(t)
	db := testutil.DB(t)
	service := market.NewService(db, config.Yahoo{BaseURL: baseURL, Suffix: ".JK", Timeout: 5 * time.Second}, config.News{BaseURL: baseURL})

	var out bytes.Buffer
	if err := IndexData(context.Background(), db, service, &out); err != nil {
		t.Fatal(err)
	}

	var index models.Stock
	if err := db.Where("ticker = ?", "IHSG").First(&index).Error; err != nil {
		t.Fatal(err)
	}
	if !index.IsIndex() || index.MarketCode() != "^JKSE" || index.CompanyName != "Indeks Harga Saham Gabungan" {
		t.Fatalf("indeks = %+v", index)
	}

	offline := market.NewListingSource(config.Listings{BaseURL: "http://127.0.0.1:1"})
	listings := ResolveListings(context.Background(), offline, 10, &out)
	if len(listings) != len(DefaultListings) || !strings.Contains(out.String(), "memakai 21 emiten bawaan") {
		t.Fatalf("fallback = %d\n%s", len(listings), out.String())
	}
}
