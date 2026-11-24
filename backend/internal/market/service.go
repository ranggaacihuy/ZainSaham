package market

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/ranggaacihuy/zainsaham/backend/internal/config"
	"github.com/ranggaacihuy/zainsaham/backend/internal/indicators"
	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
	"golang.org/x/sync/singleflight"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	indicatorWindow         = 200
	maxIntradayCacheEntries = 200
)

var ErrInvalidInterval = errors.New("interval tidak valid")

type IntradayResponse struct {
	StockID  uint             `json:"stock_id"`
	Ticker   string           `json:"ticker"`
	Interval string           `json:"interval"`
	Range    string           `json:"range"`
	Timezone string           `json:"timezone"`
	Candles  []IntradayCandle `json:"candles"`
}

type cachedIntraday struct {
	data    *IntradayResponse
	expires time.Time
}

type SyncResult struct {
	Prices     int
	Indicators int
}

type Quote struct {
	StockID    uint               `json:"stock_id"`
	Ticker     string             `json:"ticker"`
	Price      *models.StockPrice `json:"price"`
	PrevClose  *float64           `json:"prev_close"`
	Change     *float64           `json:"change"`
	ChangePct  *float64           `json:"change_pct"`
	MarketTime *string            `json:"market_time"`
	IsOpen     bool               `json:"is_open"`
	FetchedAt  string             `json:"fetched_at"`
}

type cachedQuote struct {
	quote   *Quote
	expires time.Time
}

type SyncOptions struct {
	Tickers      []string
	Range        string
	Prices       bool
	Fundamentals bool
	News         bool
}

type Service struct {
	db            *gorm.DB
	yahoo         *Yahoo
	news          *NewsFeed
	quoteTTL      time.Duration
	delay         time.Duration
	now           func() time.Time
	mu            sync.Mutex
	quotes        map[uint]cachedQuote
	intradayCache map[string]cachedIntraday
	group         singleflight.Group
	intradayGroup singleflight.Group
}

func NewService(db *gorm.DB, yahoo config.Yahoo, news config.News) *Service {
	return &Service{
		db:            db,
		yahoo:         NewYahoo(yahoo),
		news:          NewNewsFeed(news),
		quoteTTL:      max(time.Second, yahoo.QuoteTTL),
		delay:         yahoo.Delay,
		now:           time.Now,
		quotes:        map[uint]cachedQuote{},
		intradayCache: map[string]cachedIntraday{},
	}
}

func ValidRange(dataRange string) bool {
	return slices.Contains(Ranges, dataRange)
}

func (s *Service) Fetch(ctx context.Context, ticker, dataRange string) (*Chart, error) {
	return s.yahoo.FetchDaily(ctx, ticker, dataRange)
}

func (s *Service) Sync(ctx context.Context, stock *models.Stock, dataRange string) (SyncResult, error) {
	chart, err := s.yahoo.FetchDaily(ctx, stock.MarketCode(), dataRange)
	if err != nil {
		return SyncResult{}, err
	}

	return s.Store(stock, chart)
}

func (s *Service) Store(stock *models.Stock, chart *Chart) (SyncResult, error) {
	if name := chart.Meta.CompanyName(); name != "" && name != stock.CompanyName && !stock.IsIndex() {
		if err := s.db.Model(stock).Update("company_name", name).Error; err != nil {
			return SyncResult{}, err
		}
	}

	if len(chart.Candles) == 0 {
		return SyncResult{}, nil
	}

	now := time.Now().UTC()
	rows := make([]models.StockPrice, 0, len(chart.Candles))

	for _, candle := range chart.Candles {
		rows = append(rows, models.StockPrice{
			StockID:    stock.StockID,
			PriceDate:  candle.Date,
			OpenPrice:  candle.Open,
			HighPrice:  candle.High,
			LowPrice:   candle.Low,
			ClosePrice: candle.Close,
			Volume:     candle.Volume,
			CreatedAt:  now,
		})
	}

	err := s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "stock_id"}, {Name: "price_date"}},
		DoUpdates: clause.AssignmentColumns([]string{"open_price", "high_price", "low_price", "close_price", "volume"}),
	}).CreateInBatches(&rows, 500).Error
	if err != nil {
		return SyncResult{}, fmt.Errorf("gagal menyimpan harga %s: %w", stock.Ticker, err)
	}

	since := chart.Candles[0].Date
	count, err := s.RecalculateIndicators(stock.StockID, &since)
	if err != nil {
		return SyncResult{}, err
	}

	return SyncResult{Prices: len(rows), Indicators: count}, nil
}

func (s *Service) RecalculateIndicators(stockID uint, since *models.Date) (int, error) {
	var prices []models.StockPrice

	if since == nil {
		if err := s.db.Select("price_date", "close_price").
			Where("stock_id = ?", stockID).
			Order("price_date").
			Find(&prices).Error; err != nil {
			return 0, err
		}
	} else {
		// Indikator tiap tanggal hanya butuh indicatorWindow harga terakhir,
		// jadi cukup ambil indicatorWindow-1 harga sebelum since.
		if err := s.db.Select("price_date", "close_price").
			Where("stock_id = ? AND price_date < ?", stockID, *since).
			Order("price_date desc").
			Limit(indicatorWindow - 1).
			Find(&prices).Error; err != nil {
			return 0, err
		}
		slices.Reverse(prices)

		var recent []models.StockPrice
		if err := s.db.Select("price_date", "close_price").
			Where("stock_id = ? AND price_date >= ?", stockID, *since).
			Order("price_date").
			Find(&recent).Error; err != nil {
			return 0, err
		}
		prices = append(prices, recent...)
	}

	closes := make([]float64, len(prices))
	for i, price := range prices {
		closes[i] = price.ClosePrice
	}

	now := time.Now().UTC()
	var rows []models.TechnicalIndicator

	for i, price := range prices {
		if since != nil && price.PriceDate.Before(since.Time) {
			continue
		}

		values := indicators.Calculate(closes[max(0, i-indicatorWindow+1) : i+1])
		rows = append(rows, models.TechnicalIndicator{
			StockID:       stockID,
			IndicatorDate: price.PriceDate,
			RSI14:         values.RSI14,
			MACD:          values.MACD,
			MACDSignal:    values.MACDSignal,
			SMA20:         values.SMA20,
			SMA50:         values.SMA50,
			CreatedAt:     now,
		})
	}

	if len(rows) == 0 {
		return 0, nil
	}

	err := s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "stock_id"}, {Name: "indicator_date"}},
		DoUpdates: clause.AssignmentColumns([]string{"rsi_14", "macd", "macd_signal", "sma_20", "sma_50"}),
	}).CreateInBatches(&rows, 500).Error
	if err != nil {
		return 0, fmt.Errorf("gagal menyimpan indikator: %w", err)
	}

	return len(rows), nil
}

func (s *Service) Quote(ctx context.Context, stock *models.Stock) (*Quote, error) {
	s.mu.Lock()
	cached, ok := s.quotes[stock.StockID]
	s.mu.Unlock()

	if ok && s.now().Before(cached.expires) {
		return cached.quote, nil
	}

	value, err := shared(ctx, &s.group, fmt.Sprint(stock.StockID), func(ctx context.Context) (any, error) {
		chart, err := s.yahoo.FetchDaily(ctx, stock.MarketCode(), "5d")
		if err != nil {
			return nil, err
		}

		if _, err := s.Store(stock, chart); err != nil {
			return nil, err
		}

		quote := s.buildQuote(stock, chart)

		s.mu.Lock()
		s.quotes[stock.StockID] = cachedQuote{quote: quote, expires: s.now().Add(s.quoteTTL)}
		s.mu.Unlock()

		return quote, nil
	})
	if err != nil {
		return nil, err
	}

	return value.(*Quote), nil
}

func (s *Service) Intraday(ctx context.Context, stock *models.Stock, interval string) (*IntradayResponse, error) {
	spec, ok := LookupIntradaySpec(interval)
	if !ok {
		return nil, ErrInvalidInterval
	}

	key := fmt.Sprintf("%d:%s", stock.StockID, spec.Interval)
	now := s.now()

	s.mu.Lock()
	cached, found := s.intradayCache[key]
	s.mu.Unlock()

	if found && now.Before(cached.expires) {
		return cached.data, nil
	}

	value, err := shared(ctx, &s.intradayGroup, key, func(ctx context.Context) (any, error) {
		chart, err := s.yahoo.FetchIntraday(ctx, stock.MarketCode(), spec)
		if err != nil {
			return nil, err
		}

		tz := chart.Meta.ExchangeTimezoneName
		if tz == "" {
			tz = "Asia/Jakarta"
		}

		res := &IntradayResponse{
			StockID:  stock.StockID,
			Ticker:   stock.Ticker,
			Interval: spec.Interval,
			Range:    spec.YahooRange,
			Timezone: tz,
			Candles:  chart.Candles,
		}

		now := s.now()
		s.mu.Lock()
		if len(s.intradayCache) >= maxIntradayCacheEntries {
			for k, entry := range s.intradayCache {
				if !now.Before(entry.expires) {
					delete(s.intradayCache, k)
				}
			}
			if len(s.intradayCache) >= maxIntradayCacheEntries {
				var oldestKey string
				var oldestExp time.Time
				for k, entry := range s.intradayCache {
					if oldestKey == "" || entry.expires.Before(oldestExp) {
						oldestKey = k
						oldestExp = entry.expires
					}
				}
				if oldestKey != "" {
					delete(s.intradayCache, oldestKey)
				}
			}
		}
		s.intradayCache[key] = cachedIntraday{data: res, expires: now.Add(spec.CacheTTL)}
		s.mu.Unlock()

		return res, nil
	})
	if err != nil {
		return nil, err
	}

	return value.(*IntradayResponse), nil
}

func (s *Service) buildQuote(stock *models.Stock, chart *Chart) *Quote {
	quote := &Quote{
		StockID:   stock.StockID,
		Ticker:    stock.Ticker,
		IsOpen:    s.IsOpen(chart.Meta),
		FetchedAt: s.now().UTC().Format(time.RFC3339),
	}

	if chart.Meta.RegularMarketTime > 0 {
		quote.MarketTime = new(time.Unix(chart.Meta.RegularMarketTime, 0).In(chart.Meta.Location()).Format(time.RFC3339))
	}

	candles := chart.Candles
	if len(candles) == 0 {
		return quote
	}

	last := candles[len(candles)-1]
	quote.Price = &models.StockPrice{
		PriceDate:  last.Date,
		OpenPrice:  last.Open,
		HighPrice:  last.High,
		LowPrice:   last.Low,
		ClosePrice: last.Close,
		Volume:     last.Volume,
	}

	if len(candles) > 1 {
		prev := candles[len(candles)-2].Close
		quote.PrevClose = new(prev)

		if prev != 0 {
			quote.Change = new(round2(last.Close - prev))
			quote.ChangePct = new(round2((last.Close - prev) / prev * 100))
		}
	}

	return quote
}

func (s *Service) IsOpen(meta Meta) bool {
	start := meta.CurrentTradingPeriod.Regular.Start
	end := meta.CurrentTradingPeriod.Regular.End

	if start == 0 || end == 0 {
		return false
	}

	now := s.now().Unix()

	return now >= start && now < end
}

func (s *Service) SyncFundamentals(ctx context.Context, stock *models.Stock) (int, error) {
	rows, err := s.yahoo.FetchFundamentals(ctx, stock.Ticker, s.now())
	if err != nil || len(rows) == 0 {
		return 0, err
	}

	now := time.Now().UTC()
	for i := range rows {
		rows[i].StockID = stock.StockID
		rows[i].UpdatedAt = now
	}

	err = s.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "stock_id"}, {Name: "period"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"revenue", "net_income", "total_assets", "total_liabilities", "total_equity",
			"eps", "roe", "roa", "debt_to_equity", "updated_at",
		}),
	}).Create(&rows).Error
	if err != nil {
		return 0, fmt.Errorf("gagal menyimpan fundamental %s: %w", stock.Ticker, err)
	}

	return len(rows), nil
}

func (s *Service) SyncNews(ctx context.Context, stock *models.Stock) (int, error) {
	items, err := s.news.Fetch(ctx, stock.Ticker)
	if err != nil || len(items) == 0 {
		return 0, err
	}

	for i := range items {
		items[i].StockID = stock.StockID
	}

	err = s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "stock_id"}, {Name: "source_url"}},
		DoUpdates: clause.AssignmentColumns([]string{"title", "content", "source", "published_at", "updated_at"}),
	}).Create(&items).Error
	if err != nil {
		return 0, fmt.Errorf("gagal menyimpan berita %s: %w", stock.Ticker, err)
	}

	return len(items), nil
}

func (s *Service) SyncAll(ctx context.Context, opts SyncOptions, out io.Writer) (int, int, error) {
	query := s.db.Order("ticker")
	if len(opts.Tickers) > 0 {
		upper := make([]string, len(opts.Tickers))
		for i, ticker := range opts.Tickers {
			upper[i] = strings.ToUpper(ticker)
		}
		query = query.Where("ticker IN ?", upper)
	}

	var stocks []models.Stock
	if err := query.Find(&stocks).Error; err != nil {
		return 0, 0, err
	}

	if len(stocks) == 0 {
		return 0, 0, fmt.Errorf("tidak ada saham untuk disinkronkan, jalankan perintah seed terlebih dahulu")
	}

	failed := 0
	var started time.Time

	for i := range stocks {
		// Jeda dihitung dari awal permintaan sebelumnya, supaya waktu
		// permintaan tidak menambah durasi satu putaran sinkronisasi.
		if wait := s.delay - time.Since(started); i > 0 && wait > 0 {
			select {
			case <-ctx.Done():
				return i - failed, failed, ctx.Err()
			case <-time.After(wait):
			}
		}
		started = time.Now()

		text, ok := s.syncStock(ctx, &stocks[i], opts)
		if !ok {
			failed++
		}

		fmt.Fprintf(out, "  %-6s %s\n", stocks[i].Ticker, text)
	}

	return len(stocks) - failed, failed, nil
}

func (s *Service) syncStock(ctx context.Context, stock *models.Stock, opts SyncOptions) (string, bool) {
	var done, errs []string

	if opts.Prices {
		if result, err := s.Sync(ctx, stock, opts.Range); err != nil {
			errs = append(errs, "harga: "+err.Error())
		} else {
			done = append(done, fmt.Sprintf("%d harga", result.Prices))
		}
	}

	if opts.Fundamentals && !stock.IsIndex() {
		if count, err := s.SyncFundamentals(ctx, stock); err != nil {
			errs = append(errs, "fundamental: "+err.Error())
		} else {
			done = append(done, fmt.Sprintf("%d periode fundamental", count))
		}
	}

	if opts.News && !stock.IsIndex() {
		if count, err := s.SyncNews(ctx, stock); err != nil {
			errs = append(errs, "berita: "+err.Error())
		} else {
			done = append(done, fmt.Sprintf("%d berita", count))
		}
	}

	text := strings.Join(done, ", ")
	if text == "" && len(errs) == 0 {
		text = "tidak ada data yang perlu diperbarui"
	}
	if len(errs) > 0 {
		if text != "" {
			text += " | "
		}
		text += "gagal: " + strings.Join(errs, "; ")
	}

	return text, len(errs) == 0
}

// shared menjalankan fn sekali untuk semua pemanggil dengan key yang sama.
// fn memakai context yang tidak ikut batal saat pemanggil pertama pergi,
// sedangkan tiap pemanggil tetap berhenti menunggu saat context-nya sendiri
// berakhir. Hasilnya tetap disimpan ke cache oleh fn.
func shared(ctx context.Context, group *singleflight.Group, key string, fn func(context.Context) (any, error)) (any, error) {
	result := group.DoChan(key, func() (any, error) {
		return fn(context.WithoutCancel(ctx))
	})

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case res := <-result:
		return res.Val, res.Err
	}
}

func round2(value float64) float64 {
	return math.Round(value*100) / 100
}
