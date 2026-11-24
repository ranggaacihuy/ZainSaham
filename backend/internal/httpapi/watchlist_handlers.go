package httpapi

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/ranggaacihuy/zainsaham/backend/internal/market"
	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
	"gorm.io/gorm"
)

const sparklinePoints = 30

type watchlistRequest struct {
	UserID  uint `json:"user_id" binding:"required"`
	StockID uint `json:"stock_id" binding:"required"`
}

type watchlistItem struct {
	models.Watchlist
	Summary *market.Summary `json:"summary"`
}

func (s *Server) watchlistItems(userID uint) ([]watchlistItem, error) {
	var rows []models.Watchlist
	if err := s.db.Preload("Stock").
		Where("user_id = ?", userID).
		Order("created_at desc").
		Order("watchlist_id desc").
		Find(&rows).Error; err != nil {
		return nil, err
	}

	ids := make([]uint, len(rows))
	for i, row := range rows {
		ids[i] = row.StockID
	}

	summaries, err := s.market.Summaries(ids, market.SummaryOptions{Sparkline: sparklinePoints, RSI: true})
	if err != nil {
		return nil, err
	}

	items := make([]watchlistItem, len(rows))
	for i, row := range rows {
		items[i] = watchlistItem{Watchlist: row, Summary: summaries[row.StockID]}
	}

	return items, nil
}

func (s *Server) listWatchlist(c *gin.Context) {
	userID, valid := idParam(c, "userId", "Pengguna tidak ditemukan.")
	if !valid || !ownsUserID(c, userID) {
		return
	}

	items, err := s.watchlistItems(userID)
	if err != nil {
		serverError(c, err)
		return
	}

	ok(c, items)
}

func (s *Server) addToWatchlist(c *gin.Context) {
	var req watchlistRequest
	if !bind(c, &req) || !ownsUserID(c, req.UserID) {
		return
	}

	if _, found := s.findStock(c, req.StockID); !found {
		return
	}

	item := models.Watchlist{}
	where := models.Watchlist{UserID: req.UserID, StockID: req.StockID}
	err := s.db.Where(where).FirstOrCreate(&item).Error
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		// Permintaan lain menambahkan saham yang sama lebih dulu.
		err = s.db.Where(where).First(&item).Error
	}
	if err != nil {
		serverError(c, err)
		return
	}

	respond(c, http.StatusCreated, "Saham berhasil ditambahkan ke watchlist.", item)
}

func (s *Server) removeFromWatchlist(c *gin.Context) {
	id, valid := idParam(c, "watchlistId", "Data watchlist tidak ditemukan.")
	if !valid {
		return
	}

	var item models.Watchlist
	err := s.db.Where("watchlist_id = ? AND user_id = ?", id, currentUser(c).UserID).First(&item).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		fail(c, http.StatusNotFound, "Data watchlist tidak ditemukan.")
		return
	}
	if err != nil {
		serverError(c, err)
		return
	}

	if err := s.db.Delete(&item).Error; err != nil {
		serverError(c, err)
		return
	}

	respond(c, http.StatusOK, "Saham berhasil dihapus dari watchlist.", nil)
}
