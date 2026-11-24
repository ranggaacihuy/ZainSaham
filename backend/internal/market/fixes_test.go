package market

import (
	"context"
	"errors"
	"math"
	"testing"
	"time"

	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
	"golang.org/x/sync/singleflight"
)

func TestParseNewsMatchesTickerAsUppercaseWord(t *testing.T) {
	const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
	<item><title>Laba BUMI naik tajam - Kontan</title><link>https://news.example/bumi-laba</link>
		<description>Laba BUMI naik tajam</description><source url="https://kontan.co.id">Kontan</source></item>
	<item><title>Suhu bumi terus meningkat - Kompas</title><link>https://news.example/suhu-bumi</link>
		<description>Suhu bumi terus meningkat</description><source url="https://kompas.com">Kompas</source></item>
	<item><title>BUMIX meluncurkan produk baru - Detik</title><link>https://news.example/bumix</link>
		<description>BUMIX meluncurkan produk baru</description><source url="https://detik.com">Detik</source></item>
</channel></rss>`

	items, err := parseNews("BUMI", []byte(feed), 20)
	if err != nil {
		t.Fatal(err)
	}

	if len(items) != 1 || items[0].SourceURL != "https://news.example/bumi-laba" {
		t.Fatalf("berita = %+v, want hanya berita saham BUMI", items)
	}
}

func TestRecalculateIndicatorsWithSinceMatchesFullHistory(t *testing.T) {
	service, db := newTestService(t, "http://unused.test")
	stock := createStock(t, db, "BBCA")

	start := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	var prices []models.StockPrice
	for i := range 400 {
		closePrice := math.Round(1000 + 80*math.Sin(float64(i)/9) + float64(i))
		prices = append(prices, models.StockPrice{
			StockID: stock.StockID, PriceDate: models.NewDate(start.AddDate(0, 0, i)),
			OpenPrice: closePrice, HighPrice: closePrice, LowPrice: closePrice, ClosePrice: closePrice, Volume: 1,
		})
	}
	if err := db.CreateInBatches(&prices, 200).Error; err != nil {
		t.Fatal(err)
	}

	if _, err := service.RecalculateIndicators(stock.StockID, nil); err != nil {
		t.Fatal(err)
	}
	var full []models.TechnicalIndicator
	db.Where("stock_id = ?", stock.StockID).Order("indicator_date").Find(&full)

	db.Where("stock_id = ?", stock.StockID).Delete(&models.TechnicalIndicator{})

	since := prices[len(prices)-5].PriceDate
	count, err := service.RecalculateIndicators(stock.StockID, &since)
	if err != nil {
		t.Fatal(err)
	}
	if count != 5 {
		t.Fatalf("indikator dihitung = %d, want 5", count)
	}

	var partial []models.TechnicalIndicator
	db.Where("stock_id = ?", stock.StockID).Order("indicator_date").Find(&partial)

	want := full[len(full)-5:]
	for i, row := range partial {
		w := want[i]
		if row.IndicatorDate != w.IndicatorDate || *row.RSI14 != *w.RSI14 || *row.MACD != *w.MACD ||
			*row.MACDSignal != *w.MACDSignal || *row.SMA20 != *w.SMA20 || *row.SMA50 != *w.SMA50 {
			t.Fatalf("indikator %s berbeda dari hitungan penuh", row.IndicatorDate)
		}
	}
}

func TestSharedKeepsRunningWhenFirstCallerLeaves(t *testing.T) {
	var group singleflight.Group
	release := make(chan struct{})
	started := make(chan struct{})

	firstCtx, cancelFirst := context.WithCancel(context.Background())
	firstErr := make(chan error, 1)
	go func() {
		_, err := shared(firstCtx, &group, "BBCA", func(ctx context.Context) (any, error) {
			close(started)
			<-release
			if ctx.Err() != nil {
				return nil, ctx.Err()
			}
			return "harga", nil
		})
		firstErr <- err
	}()

	<-started
	secondResult := make(chan any, 1)
	go func() {
		value, _ := shared(context.Background(), &group, "BBCA", func(context.Context) (any, error) {
			return "tidak boleh dipanggil", nil
		})
		secondResult <- value
	}()

	cancelFirst()
	if err := <-firstErr; !errors.Is(err, context.Canceled) {
		t.Fatalf("pemanggil pertama harus berhenti menunggu, err = %v", err)
	}

	// Beri waktu pemanggil kedua bergabung ke pengambilan yang sedang berjalan.
	time.Sleep(50 * time.Millisecond)
	close(release)
	if value := <-secondResult; value != "harga" {
		t.Fatalf("pemanggil kedua = %v, want hasil pengambilan bersama", value)
	}
}
