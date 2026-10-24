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

	gainers, losers, lastDate, err := s.movers()
	if err != nil {
		serverError(c, err)
		return
	}

	index, err := s.marketIndex()
	if err != nil {
		serverError(c, err)
		return
	}

	ok(c, gin.H{
		"last_price_date": lastDate,
		"index":           index,
		"stats":           watchlistStats(watchlist),
		"watchlist":       watchlist,
		"news":            news,
		"analyses":        analyses,
		"movers":          gin.H{"gainers": gainers, "losers": losers},
	})
}

func watchlistStats(items []watchlistItem) gin.H {
	var changes []float64
	for _, item := range items {
		if item.Summary != nil && item.Summary.ChangePct != nil {
			changes = append(changes, *item.Summary.ChangePct)
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

	var average *float64
	if len(changes) > 0 {
		average = new(math.Round(sum/float64(len(changes))*100) / 100)
	}

	return gin.H{"count": len(items), "avg_change_pct": average, "up": up, "down": down}
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

func (s *Server) movers() ([]mover, []mover, *models.Date, error) {
	var stocks []models.Stock
	if err := s.db.Where("kind = ?", models.KindStock).Order("ticker").Find(&stocks).Error; err != nil {
		return nil, nil, nil, err
	}

	ids := make([]uint, len(stocks))
	for i, stock := range stocks {
		ids[i] = stock.StockID
	}

	summaries, err := s.market.Summaries(ids, market.SummaryOptions{})
	if err != nil {
		return nil, nil, nil, err
	}

	var lastDate *models.Date
	ranked := make([]mover, 0, len(stocks))

	for _, stock := range stocks {
		summary := summaries[stock.StockID]
		if summary == nil {
			continue
		}

		if summary.PriceDate != nil && (lastDate == nil || summary.PriceDate.After(lastDate.Time)) {
			lastDate = summary.PriceDate
		}

		if summary.ChangePct != nil {
			ranked = append(ranked, mover{Stock: stock, Summary: summary})
		}
	}

	sort.SliceStable(ranked, func(i, j int) bool { return *ranked[i].Summary.ChangePct > *ranked[j].Summary.ChangePct })

	gainers := []mover{}
	for _, item := range ranked {
		if *item.Summary.ChangePct > 0 && len(gainers) < dashboardMovers {
			gainers = append(gainers, item)
		}
	}

	losers := []mover{}
	for i := len(ranked) - 1; i >= 0; i-- {
		if *ranked[i].Summary.ChangePct < 0 && len(losers) < dashboardMovers {
			losers = append(losers, ranked[i])
		}
	}

	return gainers, losers, lastDate, nil
}
