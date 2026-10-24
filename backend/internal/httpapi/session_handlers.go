package httpapi

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
	"gorm.io/gorm"
)

const (
	sessionNotFound = "Riwayat tidak ditemukan."
	previewLength   = 160
)

type sessionItem struct {
	models.AnalysisSession
	Kind          string        `json:"kind"`
	AnalysesCount int64         `json:"analyses_count"`
	MessagesCount int64         `json:"messages_count"`
	Preview       string        `json:"preview"`
	Stock         *models.Stock `json:"stock"`
}

type sessionCount struct {
	SessionID uint
	Total     int64
}

type sessionText struct {
	SessionID uint
	Text      string
}

func (s *Server) listSessions(c *gin.Context) {
	kind := c.Query("kind")
	if kind != "" && kind != "analysis" && kind != "chat" {
		validationError(c, "kind", "Jenis riwayat tidak valid. Pilih analysis atau chat.")
		return
	}

	query := s.db.Preload("Stock").Where("user_id = ?", currentUser(c).UserID)
	if stockID := queryInt(c, "stock_id", 0); stockID > 0 {
		query = query.Where("stock_id = ?", stockID)
	}

	var sessions []models.AnalysisSession
	if err := query.Order("updated_at desc").Order("session_id desc").Find(&sessions).Error; err != nil {
		serverError(c, err)
		return
	}

	items, err := s.describeSessions(sessions)
	if err != nil {
		serverError(c, err)
		return
	}

	filtered := []sessionItem{}
	for _, item := range items {
		if item.Kind != "" && (kind == "" || item.Kind == kind) {
			filtered = append(filtered, item)
		}
	}

	ok(c, filtered)
}

func (s *Server) showSession(c *gin.Context) {
	session, found := s.ownedSession(c)
	if !found {
		return
	}

	items, err := s.describeSessions([]models.AnalysisSession{*session})
	if err != nil {
		serverError(c, err)
		return
	}

	analyses := []models.AiAnalysis{}
	if err := s.db.Select("ai_analysis_id", "session_id", "model_name", "result", "created_at").
		Where("session_id = ?", session.SessionID).
		Order("created_at desc").
		Order("ai_analysis_id desc").
		Find(&analyses).Error; err != nil {
		serverError(c, err)
		return
	}

	ok(c, gin.H{"session": items[0], "analyses": analyses})
}

func (s *Server) deleteSession(c *gin.Context) {
	session, found := s.ownedSession(c)
	if !found {
		return
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("session_id = ?", session.SessionID).Delete(&models.AiMessage{}).Error; err != nil {
			return err
		}

		if err := tx.Where("session_id = ?", session.SessionID).Delete(&models.AiAnalysis{}).Error; err != nil {
			return err
		}

		return tx.Delete(session).Error
	})
	if err != nil {
		serverError(c, err)
		return
	}

	respond(c, http.StatusOK, "Riwayat berhasil dihapus.", nil)
}

func (s *Server) ownedSession(c *gin.Context) (*models.AnalysisSession, bool) {
	id, valid := idParam(c, "sessionId", sessionNotFound)
	if !valid {
		return nil, false
	}

	var session models.AnalysisSession
	err := s.db.Preload("Stock").Where("session_id = ? AND user_id = ?", id, currentUser(c).UserID).First(&session).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		fail(c, http.StatusNotFound, sessionNotFound)
		return nil, false
	}
	if err != nil {
		serverError(c, err)
		return nil, false
	}

	return &session, true
}

func (s *Server) describeSessions(sessions []models.AnalysisSession) ([]sessionItem, error) {
	if len(sessions) == 0 {
		return []sessionItem{}, nil
	}

	ids := make([]uint, len(sessions))
	for i, session := range sessions {
		ids[i] = session.SessionID
	}

	var analysisCounts, messageCounts []sessionCount
	if err := s.db.Model(&models.AiAnalysis{}).Select("session_id, COUNT(*) AS total").
		Where("session_id IN ?", ids).Group("session_id").Scan(&analysisCounts).Error; err != nil {
		return nil, err
	}
	if err := s.db.Model(&models.AiMessage{}).Select("session_id, COUNT(*) AS total").
		Where("session_id IN ?", ids).Group("session_id").Scan(&messageCounts).Error; err != nil {
		return nil, err
	}

	var analysisPreviews, messagePreviews []sessionText
	if err := s.db.Raw(`
		SELECT session_id, result AS text FROM (
			SELECT session_id, result,
				ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at DESC, ai_analysis_id DESC) AS row_num
			FROM ai_analyses WHERE session_id IN ?
		) ranked WHERE row_num = 1`, ids).Scan(&analysisPreviews).Error; err != nil {
		return nil, err
	}
	if err := s.db.Raw(`
		SELECT session_id, content AS text FROM (
			SELECT session_id, content,
				ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at DESC, message_id DESC) AS row_num
			FROM ai_messages WHERE session_id IN ?
		) ranked WHERE row_num = 1`, ids).Scan(&messagePreviews).Error; err != nil {
		return nil, err
	}

	analyses := countMap(analysisCounts)
	messages := countMap(messageCounts)
	analysisText := textMap(analysisPreviews)
	messageText := textMap(messagePreviews)

	items := make([]sessionItem, len(sessions))
	for i, session := range sessions {
		item := sessionItem{
			AnalysisSession: session,
			AnalysesCount:   analyses[session.SessionID],
			MessagesCount:   messages[session.SessionID],
			Stock:           session.Stock,
		}

		switch {
		case item.AnalysesCount > 0:
			item.Kind = "analysis"
			item.Preview = preview(analysisText[session.SessionID])
		case item.MessagesCount > 0:
			item.Kind = "chat"
			item.Preview = preview(messageText[session.SessionID])
		}

		items[i] = item
	}

	return items, nil
}

func countMap(rows []sessionCount) map[uint]int64 {
	counts := make(map[uint]int64, len(rows))
	for _, row := range rows {
		counts[row.SessionID] = row.Total
	}

	return counts
}

func textMap(rows []sessionText) map[uint]string {
	texts := make(map[uint]string, len(rows))
	for _, row := range rows {
		texts[row.SessionID] = row.Text
	}

	return texts
}

func preview(text string) string {
	text = strings.Join(strings.Fields(strings.NewReplacer("#", "", "*", "", "_", "").Replace(text)), " ")
	runes := []rune(text)

	if len(runes) <= previewLength {
		return text
	}

	return strings.TrimSpace(string(runes[:previewLength])) + "…"
}
