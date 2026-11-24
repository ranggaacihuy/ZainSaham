package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/ranggaacihuy/zainsaham/backend/internal/app"
	"github.com/ranggaacihuy/zainsaham/backend/internal/database"
	"github.com/ranggaacihuy/zainsaham/backend/internal/market"
	"github.com/ranggaacihuy/zainsaham/backend/internal/scheduler"
	"github.com/ranggaacihuy/zainsaham/backend/internal/seed"
)

var commands = []*command{
	{
		name:      "serve",
		usageLine: "zainsaham serve",
		short:     "jalankan REST API dan scheduler",
		long: `
Serve menjalankan REST API di alamat APP_HOST:APP_PORT (bawaan 127.0.0.1:8000).
Tabel database diperbarui otomatis sebelum server berjalan.

Selama server berjalan, scheduler memperbarui harga setiap 15 menit pada jam
bursa dan pukul 17.00 WIB, berita setiap jam, serta fundamental dan daftar
emiten setiap Senin. Scheduler bisa dimatikan dengan SCHEDULER_ENABLED=false.

Hentikan server dengan Ctrl+C.
`,
		run: runServe,
	},
	{
		name:      "migrate",
		usageLine: "zainsaham migrate",
		short:     "buat atau perbarui tabel database",
		long: `
Migrate membuat tabel database yang belum ada dan menambahkan kolom baru.
Data yang sudah ada tidak dihapus.
`,
		run: runMigrate,
	},
	{
		name:      "seed",
		usageLine: "zainsaham seed",
		short:     "isi akun demo, IHSG, dan emiten terbesar BEI",
		long: `
Seed membuat akun demo, mengambil data IHSG, lalu mengambil emiten terbesar
BEI beserta harga 5 tahun, data fundamental, dan berita terbaru.

Jumlah emiten diatur dengan LISTINGS_LIMIT (bawaan 100). Bila daftar emiten
tidak bisa diambil, seed memakai 21 emiten bawaan.
`,
		run: runSeed,
	},
	{
		name:      "setup",
		usageLine: "zainsaham setup",
		short:     "jalankan migrate lalu seed",
		long: `
Setup menjalankan migrate lalu seed. Pakai perintah ini saat instalasi
pertama.
`,
		run: runSetup,
	},
	{
		name:      "sync",
		usageLine: "zainsaham sync [-range rentang] [-only data] [kode...]",
		short:     "perbarui harga, fundamental, dan berita",
		long: `
Sync memperbarui harga, indikator teknikal, fundamental, dan berita semua
emiten. Bila kode emiten diberikan, hanya emiten itu yang diperbarui.

Flag -range mengatur rentang harga yang diambil: 5d, 1mo, 3mo, 6mo, 1y, 2y,
5y, 10y, atau max. Bawaannya 1mo.

Flag -only membatasi data yang diperbarui, dipisah koma: prices,
fundamentals, news. Bawaannya semua.

Contoh:

	zainsaham sync BBCA TLKM
	zainsaham sync -only=news
	zainsaham sync -range=5y
`,
		takesArgs: true,
		setFlags: func(fs *flag.FlagSet) {
			fs.StringVar(&syncFlags.rangeValue, "range", "1mo", "")
			fs.StringVar(&syncFlags.only, "only", "prices,fundamentals,news", "")
		},
		run: runSync,
	},
	{
		name:      "listings",
		usageLine: "zainsaham listings [-limit n]",
		short:     "tambahkan emiten baru dari daftar emiten terbesar BEI",
		long: `
Listings menambahkan IHSG dan emiten baru yang masuk daftar emiten terbesar
BEI. Emiten yang sudah ada tidak diubah, dan emiten tanpa data harga di
Yahoo Finance dilewati.

Flag -limit mengatur jumlah emiten terbesar yang diperiksa. Bawaannya
mengikuti LISTINGS_LIMIT, dan 0 berarti semua emiten BEI.

Harga diperbarui satu emiten per YAHOO_FINANCE_DELAY_MS (bawaan 800 ms).
Dengan ratusan emiten, satu putaran pembaruan bisa mendekati atau melebihi
jadwal 15 menit; putaran berikutnya dilewati sampai putaran sebelumnya selesai.
`,
		setFlags: func(fs *flag.FlagSet) {
			fs.IntVar(&listingsFlags.limit, "limit", -1, "")
		},
		run: runListings,
	},
}

var syncFlags struct {
	rangeValue string
	only       string
}

var listingsFlags struct {
	limit int
}

func runServe(ctx context.Context, application *app.App, _ []string) error {
	if err := database.Migrate(application.DB); err != nil {
		return err
	}

	if application.Config.App.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	if application.Config.App.SchedulerEnabled {
		jobs, err := scheduler.Start(application.Market, func(ctx context.Context) (string, error) {
			if err := seed.IndexData(ctx, application.DB, application.Market, log.Writer()); err != nil {
				return "", err
			}
			added, failed, err := seed.RefreshListings(ctx, application.DB, application.Market, application.Listings,
				application.Listings.Limit(), application.Config.Yahoo.Delay, log.Writer())
			return fmt.Sprintf("%d emiten baru, %d gagal", added, failed), err
		})
		if err != nil {
			return err
		}
		defer jobs.Stop()
		log.Print("scheduler aktif: harga setiap 15 menit saat jam bursa dan 17.00 WIB, berita setiap jam, fundamental dan daftar emiten setiap Senin")
	}

	server := &http.Server{
		Addr:              application.Config.App.Address(),
		Handler:           application.Server().Router(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	errs := make(chan error, 1)
	go func() {
		log.Printf("ZainSaham API berjalan di http://%s", server.Addr)
		errs <- server.ListenAndServe()
	}()

	select {
	case err := <-errs:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
		log.Print("menghentikan server…")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return server.Shutdown(shutdownCtx)
	}
}

func runMigrate(_ context.Context, application *app.App, _ []string) error {
	if err := database.Migrate(application.DB); err != nil {
		return err
	}

	fmt.Println("Migrasi database selesai.")

	return nil
}

func runSeed(ctx context.Context, application *app.App, _ []string) error {
	if err := seed.DemoUser(application.DB, application.Config.App.BcryptCost); err != nil {
		return fmt.Errorf("gagal membuat akun demo: %w", err)
	}

	fmt.Printf("Akun demo siap: %s\n", seed.DemoEmail)

	fmt.Println("Mengambil data indeks…")
	if err := seed.IndexData(ctx, application.DB, application.Market, os.Stdout); err != nil {
		return fmt.Errorf("gagal menyiapkan indeks: %w", err)
	}

	listings := seed.ResolveListings(ctx, application.Listings, application.Listings.Limit(), os.Stdout)
	fmt.Printf("Mengambil %d emiten beserta harga 5 tahun, fundamental, dan berita…\n", len(listings))

	succeeded, failed := seed.Stocks(ctx, application.DB, application.Market, listings, application.Config.Yahoo.Delay, os.Stdout)
	fmt.Printf("Seed selesai: %d emiten berhasil, %d dilewati.\n", succeeded, failed)

	if succeeded == 0 {
		return errors.New("tidak ada emiten yang berhasil diambil, periksa koneksi internet")
	}

	return nil
}

func runSetup(ctx context.Context, application *app.App, args []string) error {
	if err := runMigrate(ctx, application, args); err != nil {
		return err
	}

	return runSeed(ctx, application, args)
}

func runSync(ctx context.Context, application *app.App, args []string) error {
	opts := market.SyncOptions{Range: syncFlags.rangeValue, Tickers: args}

	for part := range strings.SplitSeq(syncFlags.only, ",") {
		switch strings.TrimSpace(part) {
		case "prices":
			opts.Prices = true
		case "fundamentals":
			opts.Fundamentals = true
		case "news":
			opts.News = true
		default:
			return fmt.Errorf("data tidak dikenal: %s (pilih prices, fundamentals, atau news)", part)
		}
	}

	if !market.ValidRange(opts.Range) {
		return fmt.Errorf("rentang tidak valid: %s (pilih %s)", opts.Range, strings.Join(market.Ranges, ", "))
	}

	succeeded, failed, err := application.Market.SyncAll(ctx, opts, os.Stdout)
	if err != nil {
		return err
	}

	fmt.Printf("Selesai: %d berhasil, %d gagal.\n", succeeded, failed)

	if succeeded == 0 {
		return errors.New("semua saham gagal disinkronkan")
	}

	return nil
}

func runListings(ctx context.Context, application *app.App, _ []string) error {
	limit := listingsFlags.limit
	if limit < 0 {
		limit = application.Listings.Limit()
	}

	if err := seed.IndexData(ctx, application.DB, application.Market, os.Stdout); err != nil {
		return err
	}

	added, failed, err := seed.RefreshListings(ctx, application.DB, application.Market, application.Listings, limit,
		application.Config.Yahoo.Delay, os.Stdout)
	if err != nil {
		return err
	}

	fmt.Printf("Selesai: %d emiten baru ditambahkan, %d dilewati.\n", added, failed)

	return nil
}
