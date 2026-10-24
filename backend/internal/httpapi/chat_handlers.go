package httpapi

import (
	"errors"
	"log"
	"net/http"
	"slices"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/ranggaacihuy/zainsaham/backend/internal/gemini"
	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
	"gorm.io/gorm"
)

const chatHistoryLimit = 20

type chatRequest struct {
	UserID    uint   `json:"user_id" binding:"required"`
	StockID   uint   `json:"stock_id" binding:"required"`
	SessionID *uint  `json:"session_id"`
	Message   string `json:"message" binding:"required,max=5000"`
}

func (s *Server) chatMessages(c *gin.Context) {
	sessionID, valid := idParam(c, "sessionId", "Sesi chat tidak ditemukan.")
	if !valid {
		return
	}

	var session models.AnalysisSession
	err := s.db.Where("session_id = ? AND user_id = ?", sessionID, currentUser(c).UserID).First(&session).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		fail(c, http.StatusNotFound, "Sesi chat tidak ditemukan.")
		return
	}
	if err != nil {
		serverError(c, err)
		return
	}

	messages := []models.AiMessage{}
	if err := s.db.Where("session_id = ?", session.SessionID).
		Order("created_at").
		Order("message_id").
		Find(&messages).Error; err != nil {
		serverError(c, err)
		return
	}

	ok(c, messages)
}

func (s *Server) chat(c *gin.Context) {
	var req chatRequest
	if !bind(c, &req) || !ownsUserID(c, req.UserID) {
		return
	}

	stock, found := s.findStock(c, req.StockID)
	if !found {
		return
	}

	session, ready := s.chatSession(c, req, stock)
	if !ready {
		return
	}

	context, err := s.analysis.BuildContext(stock, "combined")
	if err != nil {
		serverError(c, err)
		return
	}

	var recent []models.AiMessage
	if err := s.db.Where("session_id = ?", session.SessionID).
		Order("created_at desc").
		Order("message_id desc").
		Limit(chatHistoryLimit).
		Find(&recent).Error; err != nil {
		serverError(c, err)
		return
	}
	slices.Reverse(recent)

	userMessage := models.AiMessage{SessionID: session.SessionID, Role: "user", Content: req.Message, CreatedAt: time.Now().UTC()}
	if err := s.db.Create(&userMessage).Error; err != nil {
		serverError(c, err)
		return
	}

	if err := s.db.Model(session).Update("updated_at", userMessage.CreatedAt).Error; err != nil {
		serverError(c, err)
		return
	}

	history := make([]gemini.Message, 0, len(recent)+1)
	for _, message := range recent {
		history = append(history, gemini.Message{Role: message.Role, Content: message.Content})
	}
	history = append(history, gemini.Message{Role: "user", Content: req.Message})

	reply, _, err := s.analysis.Chat(c.Request.Context(), history, context)
	if err != nil {
		log.Printf("chat AI %s: %v", stock.Ticker, err)
		failWithData(c, http.StatusBadGateway, aiErrorMessage(err), gin.H{"session_id": session.SessionID})
		return
	}

	assistant := models.AiMessage{SessionID: session.SessionID, Role: "assistant", Content: reply, CreatedAt: time.Now().UTC()}
	if err := s.db.Create(&assistant).Error; err != nil {
		serverError(c, err)
		return
	}

	ok(c, gin.H{
		"session_id":        session.SessionID,
		"stock":             stock,
		"user_message":      gin.H{"role": "user", "content": req.Message},
		"assistant_message": assistant,
	})
}

func (s *Server) chatSession(c *gin.Context, req chatRequest, stock *models.Stock) (*models.AnalysisSession, bool) {
	session := &models.AnalysisSession{}

	if req.SessionID != nil {
		err := s.db.Where("session_id = ? AND user_id = ? AND stock_id = ?", *req.SessionID, req.UserID, stock.StockID).First(session).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			fail(c, http.StatusForbidden, "Sesi chat tidak sesuai dengan pengguna atau saham.")
			return nil, false
		}
		if err != nil {
			serverError(c, err)
			return nil, false
		}

		return session, true
	}

	session.UserID = req.UserID
	session.StockID = stock.StockID
	session.AnalysisType = "combined"

	if err := s.db.Create(session).Error; err != nil {
		serverError(c, err)
		return nil, false
	}

	return session, true
}
