package scheduler

import (
	"context"
	"log"
	"sync/atomic"
	"time"

	"github.com/ranggaacihuy/zainsaham/backend/internal/market"
	"github.com/robfig/cron/v3"
)

const timezone = "Asia/Jakarta"

type job struct {
	name    string
	spec    string
	options market.SyncOptions
	skip    func(time.Time) bool
	running atomic.Bool
}

func Start(service *market.Service) (*cron.Cron, error) {
	location, err := time.LoadLocation(timezone)
	if err != nil {
		return nil, err
	}

	jobs := []*job{
		{
			name:    "harga intraday",
			spec:    "*/15 9-16 * * 1-5",
			options: market.SyncOptions{Range: "5d", Prices: true},
			skip:    func(now time.Time) bool { return now.Hour() == 16 && now.Minute() > 30 },
		},
		{
			name:    "harga penutupan",
			spec:    "0 17 * * 1-5",
			options: market.SyncOptions{Range: "1mo", Prices: true},
		},
		{
			name:    "berita",
			spec:    "7 * * * *",
			options: market.SyncOptions{News: true},
		},
		{
			name:    "fundamental",
			spec:    "0 6 * * 1",
			options: market.SyncOptions{Fundamentals: true},
		},
	}

	scheduler := cron.New(cron.WithLocation(location))

	for _, j := range jobs {
		if _, err := scheduler.AddFunc(j.spec, func() { j.run(service, location) }); err != nil {
			return nil, err
		}
	}

	scheduler.Start()

	return scheduler, nil
}

func (j *job) run(service *market.Service, location *time.Location) {
	if j.skip != nil && j.skip(time.Now().In(location)) {
		return
	}

	if !j.running.CompareAndSwap(false, true) {
		log.Printf("sinkronisasi %s dilewati: proses sebelumnya masih berjalan", j.name)
		return
	}
	defer j.running.Store(false)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()

	succeeded, failed, err := service.SyncAll(ctx, j.options, log.Writer())
	if err != nil {
		log.Printf("sinkronisasi %s gagal: %v", j.name, err)
		return
	}

	log.Printf("sinkronisasi %s selesai: %d berhasil, %d gagal", j.name, succeeded, failed)
}
