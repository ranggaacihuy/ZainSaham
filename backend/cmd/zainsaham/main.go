package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/ranggaacihuy/zainsaham/backend/internal/app"
	"github.com/ranggaacihuy/zainsaham/backend/internal/config"
	"github.com/ranggaacihuy/zainsaham/backend/internal/database"
	"github.com/ranggaacihuy/zainsaham/backend/internal/market"
	"github.com/ranggaacihuy/zainsaham/backend/internal/scheduler"
	"github.com/ranggaacihuy/zainsaham/backend/internal/seed"
)

const usage = `ZainSaham backend

Pemakaian:
  zainsaham <perintah> [opsi]

Perintah:
  serve      Menjalankan REST API beserta scheduler sinkronisasi data
  migrate    Membuat atau memperbarui tabel database
  seed       Membuat akun demo dan mengambil 21 emiten (harga 5 tahun, fundamental, berita)
  setup      migrate lalu seed (untuk instalasi pertama)
  sync       Memperbarui data pasar

Opsi sync:
  --range=1mo                      Rentang harga: 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, max
  --only=prices,fundamentals,news  Bagian yang diperbarui (bawaan: semua)
  KODE…                            Kode saham tertentu, mis. BBCA TLKM (bawaan: semua)
`

func main() {
	if len(os.Args) < 2 || isHelp(os.Args[1]) {
		fmt.Print(usage)
		return
	}

	cfg := config.Load()

	application, err := app.New(cfg)
	if err != nil {
		exit(err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)

	err = run(ctx, application, os.Args[1], os.Args[2:])

	stop()
	application.Close()

	if err != nil {
		exit(err)
	}
}

func run(ctx context.Context, application *app.App, command string, args []string) error {
	switch command {
	case "serve":
		return serve(ctx, application)
	case "migrate":
		return migrate(application)
	case "seed":
		return seedData(ctx, application)
	case "setup":
		if err := migrate(application); err != nil {
			return err
		}
		return seedData(ctx, application)
	case "sync":
		return syncMarket(ctx, application, args)
	default:
		fmt.Print(usage)
		return fmt.Errorf("perintah tidak dikenal: %s", command)
	}
}

func serve(ctx context.Context, application *app.App) error {
	if err := database.Migrate(application.DB); err != nil {
		return err
	}

	if application.Config.App.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	if application.Config.App.SchedulerEnabled {
		jobs, err := scheduler.Start(application.Market)
		if err != nil {
			return err
		}
		defer jobs.Stop()
		log.Print("scheduler sinkronisasi harga aktif (setiap 15 menit saat jam bursa, 17.00 WIB setelah tutup)")
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

func migrate(application *app.App) error {
	if err := database.Migrate(application.DB); err != nil {
		return err
	}

	fmt.Println("Migrasi database selesai.")

	return nil
}

func seedData(ctx context.Context, application *app.App) error {
	if err := seed.DemoUser(application.DB, application.Config.App.BcryptCost); err != nil {
		return fmt.Errorf("gagal membuat akun demo: %w", err)
	}

	fmt.Printf("Akun demo siap: %s\n", seed.DemoEmail)
	fmt.Println("Mengambil emiten, harga 5 tahun, fundamental, dan berita…")

	succeeded, failed := seed.Stocks(ctx, application.DB, application.Market, seed.Listings, application.Config.Yahoo.Delay, os.Stdout)
	fmt.Printf("Seed selesai: %d emiten berhasil, %d dilewati.\n", succeeded, failed)

	if succeeded == 0 {
		return errors.New("tidak ada emiten yang berhasil diambil, periksa koneksi internet")
	}

	return nil
}

func syncMarket(ctx context.Context, application *app.App, args []string) error {
	opts := market.SyncOptions{Range: "1mo", Prices: true, Fundamentals: true, News: true}

	for _, arg := range args {
		if value, found := strings.CutPrefix(arg, "--range="); found {
			opts.Range = value
			continue
		}

		if value, found := strings.CutPrefix(arg, "--only="); found {
			opts.Prices, opts.Fundamentals, opts.News = false, false, false

			for part := range strings.SplitSeq(value, ",") {
				switch strings.TrimSpace(part) {
				case "prices":
					opts.Prices = true
				case "fundamentals":
					opts.Fundamentals = true
				case "news":
					opts.News = true
				default:
					return fmt.Errorf("bagian tidak dikenal: %s (pilih: prices, fundamentals, news)", part)
				}
			}

			continue
		}

		opts.Tickers = append(opts.Tickers, arg)
	}

	if !market.ValidRange(opts.Range) {
		return fmt.Errorf("range tidak valid: %s (pilih: %s)", opts.Range, strings.Join(market.Ranges, ", "))
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

func isHelp(arg string) bool {
	return arg == "help" || arg == "-h" || arg == "--help"
}

func exit(err error) {
	fmt.Fprintln(os.Stderr, "Error:", err)
	os.Exit(1)
}
