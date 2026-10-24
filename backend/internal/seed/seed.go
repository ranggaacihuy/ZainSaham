package seed

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/ranggaacihuy/zainsaham/backend/internal/auth"
	"github.com/ranggaacihuy/zainsaham/backend/internal/market"
	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
	"gorm.io/gorm"
)

const (
	DemoName     = "Demo ZainSaham"
	DemoEmail    = "demo@zainsaham.test"
	DemoPassword = "demo12345"
	HistoryRange = "5y"
)

type Index struct {
	Ticker string
	Name   string
	Symbol string
}

var Indexes = []Index{
	{Ticker: "IHSG", Name: "Indeks Harga Saham Gabungan", Symbol: "^JKSE"},
}

var DefaultListings = []market.Listing{
	{Ticker: "BBCA", Sector: "Keuangan"},
	{Ticker: "BBRI", Sector: "Keuangan"},
	{Ticker: "BMRI", Sector: "Keuangan"},
	{Ticker: "BBNI", Sector: "Keuangan"},
	{Ticker: "BRIS", Sector: "Keuangan"},
	{Ticker: "TLKM", Sector: "Infrastruktur"},
	{Ticker: "JSMR", Sector: "Infrastruktur"},
	{Ticker: "ASII", Sector: "Perindustrian"},
	{Ticker: "UNTR", Sector: "Perindustrian"},
	{Ticker: "UNVR", Sector: "Barang Konsumen Primer"},
	{Ticker: "ICBP", Sector: "Barang Konsumen Primer"},
	{Ticker: "INDF", Sector: "Barang Konsumen Primer"},
	{Ticker: "AMRT", Sector: "Barang Konsumen Primer"},
	{Ticker: "CPIN", Sector: "Barang Konsumen Primer"},
	{Ticker: "KLBF", Sector: "Kesehatan"},
	{Ticker: "ANTM", Sector: "Barang Baku"},
	{Ticker: "INCO", Sector: "Barang Baku"},
	{Ticker: "SMGR", Sector: "Barang Baku"},
	{Ticker: "PGAS", Sector: "Energi"},
	{Ticker: "PTBA", Sector: "Energi"},
	{Ticker: "GOTO", Sector: "Teknologi"},
}

func DemoUser(db *gorm.DB, bcryptCost int) error {
	hash, err := auth.HashPassword(DemoPassword, bcryptCost)
	if err != nil {
		return err
	}

	var user models.User
	err = db.Unscoped().Where("email = ?", DemoEmail).First(&user).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		return db.Create(&models.User{Name: DemoName, Email: DemoEmail, PasswordHash: hash}).Error
	}
	if err != nil {
		return err
	}

	return db.Unscoped().Model(&user).Updates(map[string]any{
		"name":          DemoName,
		"password_hash": hash,
		"deleted_at":    nil,
	}).Error
}

func ResolveListings(ctx context.Context, source *market.ListingSource, limit int, out io.Writer) []market.Listing {
	listings, err := source.Fetch(ctx, limit)
	if err != nil || len(listings) == 0 {
		if err == nil {
			err = errors.New("daftar kosong")
		}
		fmt.Fprintf(out, "Daftar emiten otomatis tidak tersedia (%v), memakai %d emiten bawaan.\n", err, len(DefaultListings))

		return DefaultListings
	}

	return listings
}

func IndexData(ctx context.Context, db *gorm.DB, service *market.Service, out io.Writer) error {
	for _, index := range Indexes {
		var record models.Stock
		err := db.Where(models.Stock{Ticker: index.Ticker}).
			Assign(models.Stock{
				CompanyName: index.Name,
				Sector:      "Indeks",
				Exchange:    "IDX",
				Currency:    "IDR",
				Kind:        models.KindIndex,
				YahooSymbol: index.Symbol,
			}).
			FirstOrCreate(&record).Error
		if err != nil {
			return err
		}

		result, err := service.Sync(ctx, &record, HistoryRange)
		if err != nil {
			fmt.Fprintf(out, "  %-6s gagal: %v\n", index.Ticker, err)
			continue
		}

		fmt.Fprintf(out, "  %-6s %s — %d data harian\n", index.Ticker, index.Name, result.Prices)
	}

	return nil
}

func Stocks(ctx context.Context, db *gorm.DB, service *market.Service, listings []market.Listing, delay time.Duration, out io.Writer) (int, int) {
	succeeded, failed := 0, 0

	for i, listing := range listings {
		if i > 0 && delay > 0 {
			select {
			case <-ctx.Done():
				return succeeded, failed + len(listings) - i
			case <-time.After(delay):
			}
		}

		name, report, err := stock(ctx, db, service, listing)
		if err != nil {
			failed++
			fmt.Fprintf(out, "  %-6s dilewati: %v\n", listing.Ticker, err)
			continue
		}

		succeeded++
		fmt.Fprintf(out, "  %-6s %s — %s\n", listing.Ticker, name, report)
	}

	return succeeded, failed
}

func RefreshListings(ctx context.Context, db *gorm.DB, service *market.Service, source *market.ListingSource, limit int, delay time.Duration, out io.Writer) (int, int, error) {
	listings, err := source.Fetch(ctx, limit)
	if err != nil {
		return 0, 0, err
	}

	var existing []string
	if err := db.Model(&models.Stock{}).Pluck("ticker", &existing).Error; err != nil {
		return 0, 0, err
	}

	known := make(map[string]bool, len(existing))
	for _, ticker := range existing {
		known[ticker] = true
	}

	var fresh []market.Listing
	for _, listing := range listings {
		if !known[listing.Ticker] {
			fresh = append(fresh, listing)
		}
	}

	fmt.Fprintf(out, "%d emiten teratas diperiksa, %d emiten baru.\n", len(listings), len(fresh))

	added, failed := Stocks(ctx, db, service, fresh, delay, out)

	return added, failed, nil
}

func stock(ctx context.Context, db *gorm.DB, service *market.Service, listing market.Listing) (string, string, error) {
	chart, err := service.Fetch(ctx, listing.Ticker, HistoryRange)
	if err != nil {
		return "", "", err
	}

	if len(chart.Candles) == 0 {
		return "", "", errors.New("tidak ada data harga di Yahoo Finance")
	}

	name := chart.Meta.CompanyName()
	if name == "" {
		name = listing.Name
	}
	if name == "" {
		return "", "", errors.New("nama perusahaan tidak tersedia")
	}

	currency := chart.Meta.Currency
	if currency == "" {
		currency = "IDR"
	}

	var record models.Stock
	err = db.Where(models.Stock{Ticker: listing.Ticker}).
		Assign(models.Stock{CompanyName: name, Sector: listing.Sector, Exchange: "IDX", Currency: currency, Kind: models.KindStock}).
		FirstOrCreate(&record).Error
	if err != nil {
		return "", "", err
	}

	result, err := service.Store(&record, chart)
	if err != nil {
		return "", "", err
	}

	parts := []string{fmt.Sprintf("%d harga", result.Prices)}

	if count, err := service.SyncFundamentals(ctx, &record); err != nil {
		parts = append(parts, "fundamental gagal: "+err.Error())
	} else {
		parts = append(parts, fmt.Sprintf("%d periode fundamental", count))
	}

	if count, err := service.SyncNews(ctx, &record); err != nil {
		parts = append(parts, "berita gagal: "+err.Error())
	} else {
		parts = append(parts, fmt.Sprintf("%d berita", count))
	}

	return name, strings.Join(parts, ", "), nil
}
