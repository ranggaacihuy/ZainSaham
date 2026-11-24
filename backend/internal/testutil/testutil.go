package testutil

import (
	"fmt"
	"math"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/ranggaacihuy/zainsaham/backend/internal/auth"
	"github.com/ranggaacihuy/zainsaham/backend/internal/config"
	"github.com/ranggaacihuy/zainsaham/backend/internal/database"
	"github.com/ranggaacihuy/zainsaham/backend/internal/indicators"
	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
	"gorm.io/gorm"
)

const BcryptCost = 4

var counter atomic.Int64

func DB(t testing.TB) *gorm.DB {
	t.Helper()

	name := strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	db, err := database.Open(config.Database{
		Connection: "sqlite",
		Database:   fmt.Sprintf("file:%s_%d?mode=memory&cache=shared", name, counter.Add(1)),
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

	return db
}

func User(t testing.TB, db *gorm.DB, email string) *models.User {
	t.Helper()

	hash, err := auth.HashPassword("rahasia123", BcryptCost)
	if err != nil {
		t.Fatal(err)
	}

	user := &models.User{Name: "Pengguna " + email, Email: email, PasswordHash: hash}
	if err := db.Create(user).Error; err != nil {
		t.Fatal(err)
	}

	return user
}

func Token(t testing.TB, db *gorm.DB, user *models.User) string {
	t.Helper()

	token, err := auth.IssueToken(db, user, 24*time.Hour)
	if err != nil {
		t.Fatal(err)
	}

	return token
}

func Stock(t testing.TB, db *gorm.DB, ticker string) *models.Stock {
	t.Helper()

	stock := &models.Stock{
		Ticker:      ticker,
		CompanyName: "PT " + ticker + " Test Tbk",
		Sector:      "Keuangan",
		Exchange:    "IDX",
		Currency:    "IDR",
	}
	if err := db.Create(stock).Error; err != nil {
		t.Fatal(err)
	}

	return stock
}

func StockWithMarketData(t testing.TB, db *gorm.DB, ticker string, days, news int) *models.Stock {
	t.Helper()

	stock := Stock(t, db, ticker)
	start := time.Now().UTC().AddDate(0, 0, -days)
	closes := make([]float64, 0, days)
	prices := make([]models.StockPrice, 0, days)
	rows := make([]models.TechnicalIndicator, 0, days)

	for i := range days {
		date := models.NewDate(start.AddDate(0, 0, i))
		closePrice := math.Round(1000 + 50*math.Sin(float64(i)/7) + float64(i))
		closes = append(closes, closePrice)

		prices = append(prices, models.StockPrice{
			StockID: stock.StockID, PriceDate: date,
			OpenPrice: closePrice - 5, HighPrice: closePrice + 10, LowPrice: closePrice - 10, ClosePrice: closePrice,
			Volume: int64(1_000_000 + i),
		})

		values := indicators.Calculate(closes[max(0, len(closes)-200):])
		rows = append(rows, models.TechnicalIndicator{
			StockID: stock.StockID, IndicatorDate: date,
			RSI14: values.RSI14, MACD: values.MACD, MACDSignal: values.MACDSignal, SMA20: values.SMA20, SMA50: values.SMA50,
		})
	}

	if err := db.CreateInBatches(&prices, 200).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.CreateInBatches(&rows, 200).Error; err != nil {
		t.Fatal(err)
	}

	for n, period := range []string{"2025-Q3", "2025-Q4", "2026-Q1", "2026-Q2"} {
		fundamental := models.StockFundamental{
			StockID: stock.StockID, Period: period,
			Revenue: new(float64(1_000_000 * (n + 1))), NetIncome: new(float64(200_000 * (n + 1))),
			TotalAssets: new(10_000_000.0), TotalLiabilities: new(6_000_000.0), TotalEquity: new(4_000_000.0),
			EPS: new(float64(10 + n)), ROE: new(15.0), ROA: new(5.0), DebtToEquity: new(1.5),
		}
		if err := db.Create(&fundamental).Error; err != nil {
			t.Fatal(err)
		}
	}

	for n := 1; n <= news; n++ {
		item := models.News{
			StockID:     stock.StockID,
			Title:       fmt.Sprintf("Berita %d %s", n, ticker),
			Content:     new(strings.Repeat(fmt.Sprintf("Isi <b>berita</b> %d. ", n), 60)),
			Source:      new("Test"),
			SourceURL:   fmt.Sprintf("https://example.test/%s/%d", ticker, n),
			PublishedAt: new(time.Now().UTC().AddDate(0, 0, -n)),
		}
		if err := db.Create(&item).Error; err != nil {
			t.Fatal(err)
		}
	}

	return stock
}
