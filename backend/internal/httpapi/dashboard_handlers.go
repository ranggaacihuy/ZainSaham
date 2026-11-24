package httpapi

import (
	"errors"
	"math"
	"sort"

	"github.com/gin-gonic/gin"
	"github.com/ranggaacihuy/zainsaham/backend/internal/market"
	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
	"gorm.io/gorm"
)

const (
	dashboardNews     = 5
	dashboardAnalyses = 3
	dashboardMovers   = 5
)

type mover struct {
	Stock   models.Stock    `json:"stock"`
	Summary *market.Summary `json:"summary"`
}

type moverBoard struct {
	Date    *models.Date `json:"date"`
	Total   int          `json:"total"`
	Gainers []mover      `json:"gainers"`
	Losers  []mover      `json:"losers"`
}

type analysisItem struct {
	models.AiAnalysis
	Stock *models.Stock `json:"stock"`
}

func (s *Server) dashboard(c *gin.Context) {
	user := currentUser(c)

	watchlist, err := s.watchlistItems(user.UserID)
	if err != nil {
		serverError(c, err)
		return
	}

	stockIDs := make([]uint, len(watchlist))
	for i, item := range watchlist {
		stockIDs[i] = item.StockID
	}

	news := []models.News{}
	analyses := []analysisItem{}

	if len(stockIDs) > 0 {
		if err := s.db.Preload("Stock").
			Where("stock_id IN ?", stockIDs).
			Order("published_at desc").
			Limit(dashboardNews).
			Find(&news).Error; err != nil {
			serverError(c, err)
			return
		}

		if analyses, err = s.latestAnalyses(user.UserID, stockIDs); err != nil {
			serverError(c, err)
			return
		}
	}

	movers, lastDate, err := s.movers()
	if err != nil {
		serverError(c, err)
		return
	}

	index, err := s.marketIndex()
	if err != nil {
		serverError(c, err)
		return
	}

	stats, err := s.watchlistStats(watchlist, movers.Date)
	if err != nil {
		serverError(c, err)
		return
	}

	ok(c, gin.H{
		"last_price_date": lastDate,
		"index":           index,
		"stats":           stats,
		"watchlist":       watchlist,
		"news":            news,
		"analyses":        analyses,
		"movers":          movers,
	})
}

// watchlistStats menghitung perubahan watchlist pada tanggal acuan yang sama
// dengan top movers, supaya emiten yang harganya tertinggal tidak ikut dihitung
// sebagai perubahan "hari ini".
func (s *Server) watchlistStats(items []watchlistItem, date *models.Date) (gin.H, error) {
	stats := gin.H{"count": len(items), "date": date, "avg_change_pct": nil, "up": 0, "down": 0}
	if date == nil || len(items) == 0 {
		return stats, nil
	}

	ids := make([]uint, len(items))
	for i, item := range items {
		ids[i] = item.StockID
	}

	summaries, err := s.market.Summaries(ids, market.SummaryOptions{AsOf: date})
	if err != nil {
		return nil, err
	}

	var changes []float64
	for _, summary := range summaries {
		if summary.PriceDate != nil && summary.PriceDate.Equal(date.Time) && summary.ChangePct != nil {
			changes = append(changes, *summary.ChangePct)
		}
	}

	up, down, sum := 0, 0, 0.0
	for _, change := range changes {
		sum += change
		if change > 0 {
			up++
		} else if change < 0 {
			down++
		}
	}

	if len(changes) > 0 {
		stats["avg_change_pct"] = math.Round(sum/float64(len(changes))*100) / 100
	}
	stats["up"], stats["down"] = up, down

	return stats, nil
}

func (s *Server) latestAnalyses(userID uint, stockIDs []uint) ([]analysisItem, error) {
	sessions := s.db.Model(&models.AnalysisSession{}).
		Select("session_id").
		Where("user_id = ? AND stock_id IN ?", userID, stockIDs)

	var rows []models.AiAnalysis
	if err := s.db.Select("ai_analysis_id", "session_id", "model_name", "result", "created_at").
		Where("session_id IN (?)", sessions).
		Preload("Session.Stock").
		Order("created_at desc").
		Order("ai_analysis_id desc").
		Limit(dashboardAnalyses).
		Find(&rows).Error; err != nil {
		return nil, err
	}

	items := make([]analysisItem, len(rows))
	for i, row := range rows {
		items[i] = analysisItem{AiAnalysis: row}
		if row.Session != nil {
			items[i].Stock = row.Session.Stock
		}
	}

	return items, nil
}

func (s *Server) marketIndex() (*mover, error) {
	var index models.Stock
	err := s.db.Where("kind = ?", models.KindIndex).Order("stock_id").First(&index).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	summaries, err := s.market.Summaries([]uint{index.StockID}, market.SummaryOptions{Sparkline: sparklinePoints})
	if err != nil {
		return nil, err
	}

	return &mover{Stock: index, Summary: summaries[index.StockID]}, nil
}

// movers membandingkan semua emiten pada satu tanggal acuan yang sama. Emiten
// yang harganya tertinggal (suspensi, sinkronisasi gagal, atau belum terambil
// pada putaran sinkronisasi saat ini) tidak ikut diperingkat.
func (s *Server) movers() (moverBoard, *models.Date, error) {
	board := moverBoard{Gainers: []mover{}, Losers: []mover{}}

	var stocks []models.Stock
	if err := s.db.Where("kind = ?", models.KindStock).Order("ticker").Find(&stocks).Error; err != nil {
		return board, nil, err
	}

	ids := make([]uint, len(stocks))
	for i, stock := range stocks {
		ids[i] = stock.StockID
	}

	summaries, err := s.market.Summaries(ids, market.SummaryOptions{})
	if err != nil {
		return board, nil, err
	}

	var lastDate *models.Date
	for _, summary := range summaries {
		if summary.PriceDate != nil && (lastDate == nil || summary.PriceDate.After(lastDate.Time)) {
			lastDate = summary.PriceDate
		}
	}

	date := referenceDate(summaries)
	if date == nil {
		return board, lastDate, nil
	}
	board.Date = date

	// Emiten yang sudah punya harga setelah tanggal acuan dihitung ulang
	// perubahannya per tanggal acuan, supaya tetap sebanding dengan yang lain.
	if date.Before(lastDate.Time) {
		if summaries, err = s.market.Summaries(ids, market.SummaryOptions{AsOf: date}); err != nil {
			return board, nil, err
		}
	}

	ranked := make([]mover, 0, len(stocks))

	for _, stock := range stocks {
		summary := summaries[stock.StockID]
		if summary == nil || summary.PriceDate == nil || !summary.PriceDate.Equal(date.Time) || summary.ChangePct == nil {
			continue
		}

		ranked = append(ranked, mover{Stock: stock, Summary: summary})
	}

	board.Total = len(ranked)

	sort.SliceStable(ranked, func(i, j int) bool { return *ranked[i].Summary.ChangePct > *ranked[j].Summary.ChangePct })

	for _, item := range ranked {
		if *item.Summary.ChangePct > 0 && len(board.Gainers) < dashboardMovers {
			board.Gainers = append(board.Gainers, item)
		}
	}

	for i := len(ranked) - 1; i >= 0; i-- {
		if *ranked[i].Summary.ChangePct < 0 && len(board.Losers) < dashboardMovers {
			board.Losers = append(board.Losers, ranked[i])
		}
	}

	return board, lastDate, nil
}

// referenceDate memilih tanggal harga terbaru yang sudah dicapai setidaknya
// separuh emiten. Dengan begitu satu emiten yang lebih dulu diperbarui (misalnya
// lewat endpoint quote) tidak menggeser tanggal pembanding, dan emiten yang
// tertinggal tidak menariknya mundur.
func referenceDate(summaries map[uint]*market.Summary) *models.Date {
	dates := make([]models.Date, 0, len(summaries))
	for _, summary := range summaries {
		if summary != nil && summary.PriceDate != nil {
			dates = append(dates, *summary.PriceDate)
		}
	}

	if len(dates) == 0 {
		return nil
	}

	sort.Slice(dates, func(i, j int) bool { return dates[i].After(dates[j].Time) })

	return new(dates[(len(dates)-1)/2])
}
