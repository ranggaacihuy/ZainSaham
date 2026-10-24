package httpapi_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
	"github.com/ranggaacihuy/zainsaham/backend/internal/testutil"
)

type chatFixture struct {
	*env
	user  *models.User
	stock *models.Stock
	token string
}

func newChatFixture(t *testing.T) *chatFixture {
	t.Helper()

	e := newEnv(t)
	user := testutil.User(t, e.db, "budi@example.test")

	return &chatFixture{
		env:   e,
		user:  user,
		stock: testutil.StockWithMarketData(t, e.db, "DMTL", 130, 5),
		token: testutil.Token(t, e.db, user),
	}
}

func (f *chatFixture) send(message string, sessionID any) *response {
	payload := map[string]any{"user_id": f.user.UserID, "stock_id": f.stock.StockID, "message": message}
	if sessionID != nil {
		payload["session_id"] = sessionID
	}

	return f.call(http.MethodPost, "/api/ai-chat", f.token, payload)
}

func TestChatRepliesAndStoresMessages(t *testing.T) {
	f := newChatFixture(t)
	f.gemini.set(func(path string, w http.ResponseWriter) {
		_ = json.NewEncoder(w).Encode(map[string]any{"candidates": []map[string]any{{
			"content": map[string]any{"parts": []map[string]any{
				{"text": "proses berpikir", "thought": true},
				{"text": "RSI DMTL "},
				{"text": "berada di zona netral."},
			}},
			"finishReason": "STOP",
		}}})
	})

	res := f.send("Bagaimana RSI saham ini?", nil).
		assertStatus(http.StatusOK).
		assertPath("data.assistant_message.content", "RSI DMTL berada di zona netral.").
		assertPath("data.assistant_message.role", "assistant").
		assertPath("data.user_message.content", "Bagaimana RSI saham ini?").
		assertPath("data.stock.ticker", "DMTL")

	sessionID := res.get("data.session_id")

	f.call(http.MethodGet, fmt.Sprintf("/api/ai-chat/%v/messages", sessionID), f.token, nil).
		assertStatus(http.StatusOK).
		assertCount("data", 2).
		assertPath("data.0.role", "user").
		assertPath("data.1.role", "assistant")

	request := f.gemini.last()
	system := systemText(request)
	if !strings.Contains(system, `"ticker":"DMTL"`) || !strings.Contains(system, `"price_summary"`) {
		t.Fatalf("instruksi sistem tidak memuat konteks saham: %.200s", system)
	}

	contents := request.body["contents"].([]any)
	if len(contents) != 1 || contents[0].(map[string]any)["role"] != "user" {
		t.Fatalf("contents = %v", contents)
	}
}

func TestChatSendsOnlyRecentHistory(t *testing.T) {
	f := newChatFixture(t)
	f.gemini.set(geminiReply("Oke."))

	session := models.AnalysisSession{UserID: f.user.UserID, StockID: f.stock.StockID, AnalysisType: "combined"}
	f.db.Create(&session)

	start := time.Now().UTC().Add(-time.Hour)
	for i := 1; i <= 30; i++ {
		role := "user"
		if i%2 == 0 {
			role = "assistant"
		}
		f.db.Create(&models.AiMessage{
			SessionID: session.SessionID, Role: role, Content: fmt.Sprintf("pesan %d", i),
			CreatedAt: start.Add(time.Duration(i) * time.Minute),
		})
	}

	f.send("pertanyaan baru", session.SessionID).assertStatus(http.StatusOK)

	contents := f.gemini.last().body["contents"].([]any)
	text := func(i int) string {
		return contents[i].(map[string]any)["parts"].([]any)[0].(map[string]any)["text"].(string)
	}

	if len(contents) != 21 || text(0) != "pesan 11" || text(19) != "pesan 30" || text(20) != "pertanyaan baru" {
		t.Fatalf("riwayat = %d pesan, awal %q, akhir %q", len(contents), text(0), text(len(contents)-1))
	}
}

func TestChatMissingKeyReturns502WithSessionID(t *testing.T) {
	f := newChatFixture(t)
	f.withGeminiKey("")

	res := f.send("Halo", nil).
		assertStatus(http.StatusBadGateway).
		assertPath("message", "Layanan AI belum dikonfigurasi. Isi GEMINI_API_KEY di file .env backend.")

	if res.get("data.session_id") == nil {
		t.Fatalf("session_id harus dikirim: %s", res.raw)
	}
}

func TestChatBlockedReplyReturnsFriendlyMessage(t *testing.T) {
	f := newChatFixture(t)
	f.gemini.set(func(path string, w http.ResponseWriter) {
		_ = json.NewEncoder(w).Encode(map[string]any{"candidates": []map[string]any{{"finishReason": "SAFETY"}}})
	})

	f.send("Halo", nil).
		assertStatus(http.StatusBadGateway).
		assertPath("message", "Jawaban AI diblokir oleh filter keamanan. Coba ubah pertanyaan.")
}

func TestChatRejectsSessionOfOtherUser(t *testing.T) {
	f := newChatFixture(t)
	other := testutil.User(t, f.db, "lain@example.test")

	session := models.AnalysisSession{UserID: other.UserID, StockID: f.stock.StockID, AnalysisType: "combined"}
	f.db.Create(&session)

	f.send("Halo", session.SessionID).
		assertStatus(http.StatusForbidden).
		assertPath("message", "Sesi chat tidak sesuai dengan pengguna atau saham.")
}

func TestChatValidation(t *testing.T) {
	f := newChatFixture(t)

	f.send("", nil).
		assertStatus(http.StatusUnprocessableEntity).
		assertPath("errors.message.0", "Pesan wajib diisi.")

	f.send(strings.Repeat("a", 5001), nil).
		assertStatus(http.StatusUnprocessableEntity).
		assertPath("errors.message.0", "Pesan maksimal 5000 karakter.")
}
