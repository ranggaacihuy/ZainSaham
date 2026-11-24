package httpapi

import (
	"context"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/ranggaacihuy/zainsaham/backend/internal/market"
	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
	"gorm.io/gorm"
)

const (
	stockNotFound    = "Saham tidak ditemukan."
	defaultPerPage   = 20
	maxPerPage       = 100
	defaultNewsSize  = 10
	defaultStockNews = 20
	maxNewsSize      = 50

	// Batas tunggu endpoint interaktif. Harus lebih pendek dari timeout klien
	// (15 detik) supaya pengguna mendapat pesan yang jelas. Pengambilan data ke
	// Yahoo tetap berjalan di belakang dan hasilnya masuk cache.
	liveDataTimeout = 12 * time.Second
)

var rangeMonths = map[string]int{
	"1B": 1, "3B": 3, "6B": 6, "1T": 12, "5T": 60,
	"1M": 1, "3M": 3, "6M": 6, "1Y": 12, "5Y": 60,
}

type stockItem struct {
	models.Stock
	Summary *market.Summary `json:"summary"`
}

func (s *Server) findStock(c *gin.Context, id uint) (*models.Stock, bool) {
	var stock models.Stock

	if err := s.db.First(&stock, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			fail(c, http.StatusNotFound, stockNotFound)
		} else {
			serverError(c, err)
		}

		return nil, false
	}

	return &stock, true
}

func (s *Server) listStocks(c *gin.Context) {
	query := s.db.Model(&models.Stock{})

	if q := strings.ToLower(strings.TrimSpace(c.Query("q"))); q != "" {
		pattern := escapeLike(q)
		query = query.Where(`LOWER(ticker) LIKE ? ESCAPE '!' OR LOWER(company_name) LIKE ? ESCAPE '!'`, pattern+"%", "%"+pattern+"%")
	}

	if sector := strings.TrimSpace(c.Query("sector")); sector != "" {
		query = query.Where("sector = ?", sector)
	}

	paginate := c.Query("page") != ""

	kind := c.Query("kind")
	if kind == "" && paginate {
		kind = models.KindStock
	}
	if kind != "" && kind != "all" {
		query = query.Where("kind = ?", kind)
	}
	page := max(1, queryInt(c, "page", 1))
	perPage := min(maxPerPage, max(1, queryInt(c, "per_page", defaultPerPage)))

	var total int64
	if paginate {
		if err := query.Session(&gorm.Session{}).Count(&total).Error; err != nil {
			serverError(c, err)
			return
		}
		query = query.Offset((page - 1) * perPage).Limit(perPage)
	}

	stocks := []models.Stock{}
	if err := query.Order("ticker").Find(&stocks).Error; err != nil {
		serverError(c, err)
		return
	}

	items, err := s.withSummaries(stocks)
	if err != nil {
		serverError(c, err)
		return
	}

	if !paginate {
		ok(c, items)
		return
	}

	sectors := []string{}
	if err := s.db.Model(&models.Stock{}).Where("sector <> '' AND kind = ?", models.KindStock).Distinct().Order("sector").Pluck("sector", &sectors).Error; err != nil {
		serverError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    items,
		"meta": gin.H{
			"page":      page,
			"per_page":  perPage,
			"total":     total,
			"last_page": max(1, (int(total)+perPage-1)/perPage),
			"sectors":   sectors,
		},
	})
}

func (s *Server) withSummaries(stocks []models.Stock) ([]stockItem, error) {
	ids := make([]uint, len(stocks))
	for i, stock := range stocks {
		ids[i] = stock.StockID
	}

	summaries, err := s.market.Summaries(ids, market.SummaryOptions{})
	if err != nil {
		return nil, err
	}

	items := make([]stockItem, len(stocks))
	for i, stock := range stocks {
		items[i] = stockItem{Stock: stock, Summary: summaries[stock.StockID]}
	}

	return items, nil
}

func (s *Server) showStock(c *gin.Context) {
	id, valid := idParam(c, "stockId", stockNotFound)
	if !valid {
		return
	}

	if stock, found := s.findStock(c, id); found {
		ok(c, stock)
	}
}

func (s *Server) stockPrices(c *gin.Context) {
	id, valid := idParam(c, "stockId", stockNotFound)
	if !valid {
		return
	}

	cutoff, valid := s.rangeCutoff(c, id)
	if !valid {
		return
	}

	query := s.db.Where("stock_id = ?", id)
	if cutoff != nil {
		query = query.Where("price_date >= ?", *cutoff)
	}

	prices := []models.StockPrice{}
	if err := query.Order("price_date").Find(&prices).Error; err != nil {
		serverError(c, err)
		return
	}

	ok(c, prices)
}

func (s *Server) stockIndicators(c *gin.Context) {
	id, valid := idParam(c, "stockId", stockNotFound)
	if !valid {
		return
	}

	cutoff, valid := s.rangeCutoff(c, id)
	if !valid {
		return
	}

	query := s.db.Where("stock_id = ?", id)
	if cutoff != nil {
		query = query.Where("indicator_date >= ?", *cutoff)
	}

	rows := []models.TechnicalIndicator{}
	if err := query.Order("indicator_date").Find(&rows).Error; err != nil {
		serverError(c, err)
		return
	}

	ok(c, rows)
}

func (s *Server) rangeCutoff(c *gin.Context, stockID uint) (*models.Date, bool) {
	value := strings.ToUpper(strings.TrimSpace(c.Query("range")))
	if value == "" {
		return nil, true
	}

	months, known := rangeMonths[value]
	if !known {
		validationError(c, "range", "Rentang waktu tidak valid. Pilih 1B, 3B, 6B, 1T, atau 5T.")
		return nil, false
	}

	var latest models.StockPrice
	err := s.db.Select("price_date").Where("stock_id = ?", stockID).Order("price_date desc").First(&latest).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, true
	}
	if err != nil {
		serverError(c, err)
		return nil, false
	}

	cutoff := models.NewDate(latest.PriceDate.AddDate(0, -months, 0))

	return &cutoff, true
}

func (s *Server) stockFundamentals(c *gin.Context) {
	id, valid := idParam(c, "stockId", stockNotFound)
	if !valid {
		return
	}

	rows := []models.StockFundamental{}
	if err := s.db.Where("stock_id = ?", id).Order("period desc").Find(&rows).Error; err != nil {
		serverError(c, err)
		return
	}

	ok(c, rows)
}

func (s *Server) stockNews(c *gin.Context) {
	id, valid := idParam(c, "stockId", stockNotFound)
	if !valid {
		return
	}

	limit := min(maxNewsSize, max(1, queryInt(c, "limit", defaultStockNews)))

	rows := []models.News{}
	if err := s.db.Where("stock_id = ?", id).Order("published_at desc").Limit(limit).Find(&rows).Error; err != nil {
		serverError(c, err)
		return
	}

	ok(c, rows)
}

func (s *Server) newsFeed(c *gin.Context) {
	limit := min(maxNewsSize, max(1, queryInt(c, "limit", defaultNewsSize)))

	query := s.db.Preload("Stock").Order("published_at desc").Limit(limit)

	if raw := strings.TrimSpace(c.Query("stock_ids")); raw != "" {
		var ids []uint
		for part := range strings.SplitSeq(raw, ",") {
			id, err := strconv.ParseUint(strings.TrimSpace(part), 10, 64)
			if err != nil || id == 0 {
				validationError(c, "stock_ids", "Daftar saham tidak valid.")
				return
			}
			ids = append(ids, uint(id))
		}
		query = query.Where("stock_id IN ?", ids)
	}

	rows := []models.News{}
	if err := query.Find(&rows).Error; err != nil {
		serverError(c, err)
		return
	}

	ok(c, rows)
}

func (s *Server) stockQuote(c *gin.Context) {
	id, valid := idParam(c, "stockId", stockNotFound)
	if !valid {
		return
	}

	stock, found := s.findStock(c, id)
	if !found {
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), liveDataTimeout)
	defer cancel()

	quote, err := s.market.Quote(ctx, stock)
	if err != nil {
		log.Printf("quote %s: %v", stock.Ticker, err)
		fail(c, http.StatusBadGateway, "Data harga realtime belum dapat diambil dari Yahoo Finance.")
		return
	}

	ok(c, quote)
}

func (s *Server) stockIntraday(c *gin.Context) {
	id, valid := idParam(c, "stockId", stockNotFound)
	if !valid {
		return
	}

	interval := strings.ToLower(strings.TrimSpace(c.DefaultQuery("interval", "5m")))
	if _, ok := market.LookupIntradaySpec(interval); !ok {
		validationError(c, "interval", "Interval tidak valid. Pilih 1m, 5m, 10m, 15m, 1h, 2h, atau 4h.")
		return
	}

	stock, found := s.findStock(c, id)
	if !found {
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), liveDataTimeout)
	defer cancel()

	data, err := s.market.Intraday(ctx, stock, interval)
	if err != nil {
		if errors.Is(err, market.ErrInvalidInterval) {
			validationError(c, "interval", "Interval tidak valid. Pilih 1m, 5m, 10m, 15m, 1h, 2h, atau 4h.")
			return
		}
		log.Printf("intraday %s (%s): %v", stock.Ticker, interval, err)
		fail(c, http.StatusBadGateway, "Data candlestick intraday belum dapat diambil dari Yahoo Finance.")
		return
	}

	ok(c, data)
}

func queryInt(c *gin.Context, key string, fallback int) int {
	value, err := strconv.Atoi(c.Query(key))
	if err != nil {
		return fallback
	}

	return value
}

// escapeLike memakai "!" sebagai karakter escape. Backslash tidak dipakai
// karena di MySQL '\' di dalam literal string ikut meng-escape tanda kutip.
func escapeLike(value string) string {
	return strings.NewReplacer(`!`, `!!`, `%`, `!%`, `_`, `!_`).Replace(value)
}
