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

type Listing struct {
	Ticker string
	Sector string
}

var Listings = []Listing{
	{"BBCA", "Keuangan"},
	{"BBRI", "Keuangan"},
	{"BMRI", "Keuangan"},
	{"BBNI", "Keuangan"},
	{"BRIS", "Keuangan"},
	{"TLKM", "Infrastruktur"},
	{"JSMR", "Infrastruktur"},
	{"ASII", "Perindustrian"},
	{"UNTR", "Perindustrian"},
	{"UNVR", "Barang Konsumen Primer"},
	{"ICBP", "Barang Konsumen Primer"},
	{"INDF", "Barang Konsumen Primer"},
	{"AMRT", "Barang Konsumen Primer"},
	{"CPIN", "Barang Konsumen Primer"},
	{"KLBF", "Kesehatan"},
	{"ANTM", "Barang Baku"},
	{"INCO", "Barang Baku"},
	{"SMGR", "Barang Baku"},
	{"PGAS", "Energi"},
	{"PTBA", "Energi"},
	{"GOTO", "Teknologi"},
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

func Stocks(ctx context.Context, db *gorm.DB, service *market.Service, listings []Listing, delay time.Duration, out io.Writer) (int, int) {
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

func stock(ctx context.Context, db *gorm.DB, service *market.Service, listing Listing) (string, string, error) {
	chart, err := service.Fetch(ctx, listing.Ticker, HistoryRange)
	if err != nil {
		return "", "", err
	}

	name := chart.Meta.CompanyName()
	if name == "" {
		return "", "", errors.New("nama perusahaan tidak tersedia dari Yahoo Finance")
	}

	currency := chart.Meta.Currency
	if currency == "" {
		currency = "IDR"
	}

	var record models.Stock
	err = db.Where(models.Stock{Ticker: listing.Ticker}).
		Assign(models.Stock{CompanyName: name, Sector: listing.Sector, Exchange: "IDX", Currency: currency}).
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
