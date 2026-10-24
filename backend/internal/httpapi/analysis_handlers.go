package httpapi

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/ranggaacihuy/zainsaham/backend/internal/analysis"
	"github.com/ranggaacihuy/zainsaham/backend/internal/gemini"
	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
	"gorm.io/gorm"
)

const defaultAIError = "AI belum dapat membalas. Silakan coba lagi."

type analysisRequest struct {
	UserID       uint   `json:"user_id" binding:"required"`
	StockID      uint   `json:"stock_id" binding:"required"`
	AnalysisType string `json:"analysis_type" binding:"required"`
	SessionID    *uint  `json:"session_id"`
}

func (s *Server) listAnalyses(c *gin.Context) {
	stockID, valid := idParam(c, "stockId", stockNotFound)
	if !valid {
		return
	}

	sessions := s.db.Model(&models.AnalysisSession{}).
		Select("session_id").
		Where("stock_id = ? AND user_id = ?", stockID, currentUser(c).UserID)

	items := []models.AiAnalysis{}
	if err := s.db.Select("ai_analysis_id", "session_id", "model_name", "result", "created_at").
		Where("session_id IN (?)", sessions).
		Preload("Session").
		Order("created_at desc").
		Order("ai_analysis_id desc").
		Find(&items).Error; err != nil {
		serverError(c, err)
		return
	}

	ok(c, items)
}

func (s *Server) createAnalysis(c *gin.Context) {
	var req analysisRequest
	if !bind(c, &req) || !ownsUserID(c, req.UserID) {
		return
	}

	if !analysis.ValidType(req.AnalysisType) {
		validationError(c, "analysis_type", "Jenis analisis tidak valid.")
		return
	}

	stock, found := s.findStock(c, req.StockID)
	if !found {
		return
	}

	analysisType := analysis.NormalizeType(req.AnalysisType)

	var session *models.AnalysisSession
	if req.SessionID != nil {
		session = &models.AnalysisSession{}
		err := s.db.Where("session_id = ? AND user_id = ? AND stock_id = ?", *req.SessionID, req.UserID, stock.StockID).First(session).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			fail(c, http.StatusForbidden, "Sesi analisis tidak sesuai dengan pengguna atau saham.")
			return
		}
		if err != nil {
			serverError(c, err)
			return
		}

		analysisType = analysis.NormalizeType(session.AnalysisType)
	}

	context, err := s.analysis.BuildContext(stock, analysisType)
	if err != nil {
		serverError(c, err)
		return
	}

	if message := analysis.MissingDataMessage(context); message != "" {
		fail(c, http.StatusUnprocessableEntity, message)
		return
	}

	result, modelName, err := s.analysis.Analyze(c.Request.Context(), context)
	if err != nil {
		log.Printf("analisis AI %s: %v", stock.Ticker, err)
		fail(c, http.StatusBadGateway, aiErrorMessage(err))
		return
	}

	record := models.AiAnalysis{ModelName: modelName, ContextData: context.JSON(), Result: result}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		if session == nil {
			session = &models.AnalysisSession{UserID: req.UserID, StockID: stock.StockID, AnalysisType: analysisType}
			if err := tx.Create(session).Error; err != nil {
				return err
			}
		}

		record.SessionID = session.SessionID

		if err := tx.Create(&record).Error; err != nil {
			return err
		}

		return tx.Model(session).Update("updated_at", record.CreatedAt).Error
	})
	if err != nil {
		serverError(c, err)
		return
	}

	respond(c, http.StatusCreated, "", gin.H{"session": session, "analysis": record})
}

func aiErrorMessage(err error) string {
	var geminiErr *gemini.Error
	if errors.As(err, &geminiErr) && geminiErr.UserMessage != "" {
		return geminiErr.UserMessage
	}

	return defaultAIError
}
