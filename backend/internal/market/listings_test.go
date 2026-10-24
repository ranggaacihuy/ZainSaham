package market

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/ranggaacihuy/zainsaham/backend/internal/config"
	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
)

const scannerFixture = `{"totalCount":5,"data":[
	{"s":"IDX:BBCA","d":["BBCA","PT Bank Central Asia Tbk","Finance",6.19e14]},
	{"s":"IDX:BYAN","d":["BYAN","PT Bayan Resources Tbk","Energy Minerals",3.58e14]},
	{"s":"IDX:BBCA","d":["BBCA","Duplikat","Finance",1]},
	{"s":"IDX:XX1","d":["XX1","Kode tidak valid","Finance",1]},
	{"s":"IDX:ABCD","d":["ABCD","PT Sektor Asing Tbk","Miscellaneous",1e9]}
]}`

func TestParseListingsFiltersAndMapsSectors(t *testing.T) {
	listings, err := parseListings([]byte(scannerFixture))
	if err != nil {
		t.Fatal(err)
	}

	if len(listings) != 3 {
		t.Fatalf("listings = %+v", listings)
	}

	if listings[0].Ticker != "BBCA" || listings[0].Sector != "Keuangan" || listings[0].MarketCap != 6.19e14 {
		t.Fatalf("BBCA = %+v", listings[0])
	}
	if listings[1].Sector != "Energi" || listings[2].Sector != "" {
		t.Fatalf("pemetaan sektor = %q, %q", listings[1].Sector, listings[2].Sector)
	}
}

func TestListingSourceRequestsTopByMarketCap(t *testing.T) {
	var body map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/indonesia/scan" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		raw, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(raw, &body)
		_, _ = w.Write([]byte(scannerFixture))
	}))
	t.Cleanup(server.Close)

	source := NewListingSource(config.Listings{BaseURL: server.URL, Limit: 50})
	listings, err := source.Fetch(context.Background(), 2)
	if err != nil || len(listings) != 3 {
		t.Fatalf("listings = %d, err %v", len(listings), err)
	}

	rangeValues := body["range"].([]any)
	sort := body["sort"].(map[string]any)
	if rangeValues[1].(float64) != 2 || sort["sortBy"] != "market_cap_basic" || sort["sortOrder"] != "desc" {
		t.Fatalf("body = %v", body)
	}

	if _, err := source.Fetch(context.Background(), 0); err != nil {
		t.Fatal(err)
	}
	if body["range"].([]any)[1].(float64) != maxListings {
		t.Fatalf("limit 0 harus mengambil semua: %v", body["range"])
	}
}

func TestIndexUsesYahooSymbolAndSkipsCompanyData(t *testing.T) {
	_, baseURL := newFakeYahoo(t, func(symbol string, w http.ResponseWriter, r *http.Request) {
		if symbol != "^JKSE" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		writeJSON(w, http.StatusOK, chartJSON(map[string]any{"longName": "IDX COMPOSITE"}, trendDays("2026-08-03", 5)))
	})

	service, db := newTestService(t, baseURL)
	index := &models.Stock{
		Ticker: "IHSG", CompanyName: "Indeks Harga Saham Gabungan", Exchange: "IDX", Currency: "IDR",
		Kind: models.KindIndex, YahooSymbol: "^JKSE",
	}
	db.Create(index)

	if service.yahoo.Symbol("^jkse") != "^JKSE" || service.yahoo.Symbol("bbca") != "BBCA.JK" {
		t.Fatal("simbol Yahoo salah")
	}

	var out strings.Builder
	succeeded, failed, err := service.SyncAll(context.Background(), SyncOptions{Range: "1mo", Prices: true, Fundamentals: true, News: true}, &out)
	if err != nil || succeeded != 1 || failed != 0 {
		t.Fatalf("succeeded %d failed %d err %v output %s", succeeded, failed, err, out.String())
	}

	var refreshed models.Stock
	db.First(&refreshed, index.StockID)
	if refreshed.CompanyName != "Indeks Harga Saham Gabungan" {
		t.Fatalf("nama indeks tidak boleh ditimpa: %q", refreshed.CompanyName)
	}

	var prices int64
	db.Model(&models.StockPrice{}).Where("stock_id = ?", index.StockID).Count(&prices)
	if prices != 5 || !strings.Contains(out.String(), "IHSG   5 harga") {
		t.Fatalf("harga indeks = %d, output %s", prices, out.String())
	}

	service.now = func() time.Time { return time.Date(2026, 8, 7, 3, 0, 0, 0, time.UTC) }
	if _, err := service.Quote(context.Background(), index); err != nil {
		t.Fatalf("quote indeks: %v", err)
	}
}
