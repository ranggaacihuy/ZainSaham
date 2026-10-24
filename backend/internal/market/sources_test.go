package market

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
)

const timeseriesFixture = `{"timeseries":{"result":[
	{"meta":{"type":["quarterlyTotalRevenue"]},"quarterlyTotalRevenue":[
		{"asOfDate":"2026-03-31","periodType":"3M","reportedValue":{"raw":1000}},
		{"asOfDate":"2026-06-30","periodType":"3M","reportedValue":{"raw":1200}}]},
	{"meta":{"type":["quarterlyNetIncome"]},"quarterlyNetIncome":[
		{"asOfDate":"2026-06-30","periodType":"3M","reportedValue":{"raw":300}}]},
	{"meta":{"type":["quarterlyTotalAssets"]},"quarterlyTotalAssets":[
		null,
		{"asOfDate":"2026-06-30","periodType":"3M","reportedValue":{"raw":10000}}]},
	{"meta":{"type":["quarterlyTotalLiabilitiesNetMinorityInterest"]},"quarterlyTotalLiabilitiesNetMinorityInterest":[
		{"asOfDate":"2026-06-30","periodType":"3M","reportedValue":{"raw":6000}}]},
	{"meta":{"type":["quarterlyStockholdersEquity"]},"quarterlyStockholdersEquity":[
		{"asOfDate":"2026-06-30","periodType":"3M","reportedValue":{"raw":4000}}]},
	{"meta":{"type":["quarterlyBasicEPS"]},"quarterlyBasicEPS":[
		{"asOfDate":"2026-06-30","periodType":"3M","reportedValue":{"raw":12.345}}]},
	{"meta":{"type":["annualNetIncome"]},"annualNetIncome":[
		{"asOfDate":"2025-12-31","periodType":"12M","reportedValue":{"raw":1100}}]},
	{"meta":{"type":["annualTotalRevenue"]},"annualTotalRevenue":[
		{"asOfDate":"2025-12-31","periodType":"12M","reportedValue":{"raw":4400}}]},
	{"meta":{"type":["annualStockholdersEquity"]},"annualStockholdersEquity":[
		{"asOfDate":"2025-12-31","periodType":"12M","reportedValue":{"raw":4000}}]}
],"error":null}}`

const rssFixture = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
	<item>
		<title>BBCA buyback saham Rp5 triliun - Bloomberg Technoz</title>
		<link>https://news.example/bbca-buyback</link>
		<pubDate>Wed, 21 Oct 2026 07:00:00 GMT</pubDate>
		<description>&lt;a href="https://x"&gt;BBCA buyback saham Rp5 triliun&lt;/a&gt;&amp;nbsp;&amp;nbsp;&lt;font&gt;Bloomberg Technoz&lt;/font&gt;</description>
		<source url="https://bloombergtechnoz.com">Bloomberg Technoz</source>
	</item>
	<item>
		<title>Asing lepas BBCA saat IHSG menguat - Databoks</title>
		<link>https://news.example/bbca-asing</link>
		<pubDate>Fri, 23 Oct 2026 05:43:22 GMT</pubDate>
		<description>Asing lepas BBCA saat IHSG menguat. Net sell asing mencapai Rp1,6 triliun sepanjang pekan ini. Databoks</description>
		<source url="https://databoks.katadata.co.id">Databoks</source>
	</item>
	<item>
		<title>IHSG ditutup menguat - Kontan</title>
		<link>https://news.example/ihsg</link>
		<pubDate>Fri, 23 Oct 2026 09:00:00 GMT</pubDate>
		<description>IHSG ditutup menguat</description>
		<source url="https://kontan.co.id">Kontan</source>
	</item>
	<item>
		<title>BBCA buyback saham Rp5 triliun - Bloomberg Technoz</title>
		<link>https://news.example/bbca-buyback</link>
		<pubDate>Wed, 21 Oct 2026 07:00:00 GMT</pubDate>
		<description>duplikat</description>
		<source url="https://bloombergtechnoz.com">Bloomberg Technoz</source>
	</item>
</channel></rss>`

func TestParseFundamentalsBuildsPeriodsAndRatios(t *testing.T) {
	rows, err := parseFundamentals("BBCA.JK", []byte(timeseriesFixture))
	if err != nil {
		t.Fatal(err)
	}

	if len(rows) != 3 || rows[0].Period != "2026-Q2" || rows[1].Period != "2026-Q1" || rows[2].Period != "2025-FY" {
		t.Fatalf("periode = %v", periods(rows))
	}

	q2 := rows[0]
	if q2.PeriodType != "quarterly" || *q2.Revenue != 1200 || *q2.EPS != 12.35 {
		t.Fatalf("Q2 = %+v", q2)
	}
	if *q2.ROE != 30 || *q2.ROA != 12 || *q2.DebtToEquity != 1.5 {
		t.Fatalf("rasio Q2 (disetahunkan) = ROE %v ROA %v DER %v", *q2.ROE, *q2.ROA, *q2.DebtToEquity)
	}

	annual := rows[2]
	if annual.PeriodType != "annual" || *annual.ROE != 27.5 || annual.ROA != nil {
		t.Fatalf("tahunan = %+v", annual)
	}
}

func periods(rows []models.StockFundamental) []string {
	var labels []string
	for _, row := range rows {
		labels = append(labels, row.Period)
	}

	return labels
}

func TestParseNewsFiltersCleansAndSorts(t *testing.T) {
	items, err := parseNews("BBCA", []byte(rssFixture), 20)
	if err != nil {
		t.Fatal(err)
	}

	if len(items) != 2 {
		t.Fatalf("berita = %d, want 2 (tanpa berita tidak relevan dan duplikat)", len(items))
	}

	latest := items[0]
	if latest.Title != "Asing lepas BBCA saat IHSG menguat" || *latest.Source != "Databoks" {
		t.Fatalf("berita terbaru = %+v", latest)
	}
	if latest.Content == nil || !strings.HasPrefix(*latest.Content, ". Net sell asing") && !strings.HasPrefix(*latest.Content, "Net sell asing") {
		t.Fatalf("isi = %v", latest.Content)
	}
	if latest.PublishedAt == nil || latest.PublishedAt.Format(time.RFC3339) != "2026-10-23T05:43:22Z" {
		t.Fatalf("tanggal = %v", latest.PublishedAt)
	}

	if items[1].Content != nil {
		t.Fatalf("isi yang hanya mengulang judul harus kosong: %q", *items[1].Content)
	}

	limited, _ := parseNews("BBCA", []byte(rssFixture), 1)
	if len(limited) != 1 {
		t.Fatalf("limit = %d", len(limited))
	}
}

func TestSyncFundamentalsAndNewsAreIdempotent(t *testing.T) {
	_, baseURL := newFakeYahoo(t, func(symbol string, w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasPrefix(r.URL.Path, "/ws/fundamentals-timeseries/"):
			_, _ = w.Write([]byte(timeseriesFixture))
		case strings.HasPrefix(r.URL.Path, "/rss/search"):
			w.Header().Set("Content-Type", "application/rss+xml")
			_, _ = w.Write([]byte(rssFixture))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	})

	service, db := newTestService(t, baseURL)
	stock := createStock(t, db, "BBCA")

	for range 2 {
		if count, err := service.SyncFundamentals(context.Background(), stock); err != nil || count != 3 {
			t.Fatalf("fundamental = %d, err %v", count, err)
		}
		if count, err := service.SyncNews(context.Background(), stock); err != nil || count != 2 {
			t.Fatalf("berita = %d, err %v", count, err)
		}
	}

	var fundamentals, news int64
	db.Model(&models.StockFundamental{}).Count(&fundamentals)
	db.Model(&models.News{}).Count(&news)
	if fundamentals != 3 || news != 2 {
		t.Fatalf("tersimpan: %d fundamental, %d berita", fundamentals, news)
	}

	var stored models.StockFundamental
	db.Where("period = ?", "2025-FY").First(&stored)
	if stored.PeriodType != "annual" {
		t.Fatalf("period_type = %q", stored.PeriodType)
	}
}

func TestSummariesComputeChangeSparklineAndRSI(t *testing.T) {
	_, baseURL := newFakeYahoo(t, func(symbol string, w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, chartJSON(nil, trendDays("2026-08-03", 40)))
	})

	service, db := newTestService(t, baseURL)
	stock := createStock(t, db, "BBCA")
	empty := createStock(t, db, "XXXX")

	if _, err := service.Sync(context.Background(), stock, "3mo"); err != nil {
		t.Fatal(err)
	}

	summaries, err := service.Summaries([]uint{stock.StockID, empty.StockID}, SummaryOptions{Sparkline: 5, RSI: true})
	if err != nil {
		t.Fatal(err)
	}

	summary := summaries[stock.StockID]
	if summary == nil || *summary.ClosePrice != 5390 || *summary.PrevClose != 5380 || *summary.ChangeValue != 10 || *summary.ChangePct != 0.19 {
		t.Fatalf("ringkasan = %+v", summary)
	}
	if summary.PriceDate.String() != "2026-09-11" || len(summary.Sparkline) != 5 || summary.Sparkline[4] != 5390 || summary.RSI14 == nil {
		t.Fatalf("tanggal %v sparkline %v rsi %v", summary.PriceDate, summary.Sparkline, summary.RSI14)
	}

	if _, exists := summaries[empty.StockID]; exists {
		t.Fatal("saham tanpa harga tidak boleh punya ringkasan")
	}
}
