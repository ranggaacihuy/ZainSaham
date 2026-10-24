package httpapi_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/ranggaacihuy/zainsaham/backend/internal/analysis"
	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
	"github.com/ranggaacihuy/zainsaham/backend/internal/testutil"
)

type analysisFixture struct {
	*env
	user  *models.User
	stock *models.Stock
	token string
}

func newAnalysisFixture(t *testing.T) *analysisFixture {
	t.Helper()

	e := newEnv(t)
	user := testutil.User(t, e.db, "budi@example.test")

	return &analysisFixture{
		env:   e,
		user:  user,
		stock: testutil.StockWithMarketData(t, e.db, "DMBK", 130, 5),
		token: testutil.Token(t, e.db, user),
	}
}

func (f *analysisFixture) analyze(analysisType string, extra map[string]any) *response {
	payload := map[string]any{"user_id": f.user.UserID, "stock_id": f.stock.StockID, "analysis_type": analysisType}
	for key, value := range extra {
		payload[key] = value
	}

	return f.call(http.MethodPost, "/api/ai-analysis", f.token, payload)
}

func storedContext(t *testing.T, f *analysisFixture) analysis.Context {
	t.Helper()

	var record models.AiAnalysis
	if err := f.db.Order("ai_analysis_id desc").First(&record).Error; err != nil {
		t.Fatal(err)
	}

	var context analysis.Context
	if err := json.Unmarshal([]byte(record.ContextData), &context); err != nil {
		t.Fatal(err)
	}

	return context
}

func TestAnalysisCallsGeminiAndStoresResult(t *testing.T) {
	f := newAnalysisFixture(t)
	f.gemini.set(geminiReply("## Ringkasan\nTren DMBK naik."))

	f.analyze("teknikal", nil).
		assertStatus(http.StatusCreated).
		assertPath("data.analysis.model_name", "gemini-test").
		assertPath("data.analysis.result", "## Ringkasan\nTren DMBK naik.").
		assertPath("data.session.analysis_type", "teknikal").
		assertMissing("data.analysis.context_data")

	context := storedContext(t, f)
	if len(context.Prices) != 60 || len(context.Indicators) != 30 || context.News != nil || context.Stock.Ticker != "DMBK" {
		t.Fatalf("konteks teknikal = %d harga, %d indikator, berita %v", len(context.Prices), len(context.Indicators), context.News)
	}

	request := f.gemini.last()
	if request.header.Get("x-goog-api-key") != "test-key" || strings.Contains(request.query, "key=") {
		t.Fatal("API key harus dikirim lewat header, bukan query string")
	}
	if !strings.HasSuffix(request.path, "/models/gemini-test:generateContent") || !strings.Contains(promptText(request), "DMBK") {
		t.Fatalf("request = %s", request.path)
	}
}

func TestMenyeluruhIsStoredAsCombinedWithReducedContext(t *testing.T) {
	f := newAnalysisFixture(t)
	f.gemini.set(geminiReply("Analisis menyeluruh."))

	f.analyze("menyeluruh", nil).
		assertStatus(http.StatusCreated).
		assertPath("data.session.analysis_type", "combined")

	context := storedContext(t, f)
	if len(context.Prices) != 30 || len(context.Indicators) != 10 || len(context.Fundamentals) != 4 || len(context.News) != 5 {
		t.Fatalf("konteks menyeluruh = %d/%d/%d/%d", len(context.Prices), len(context.Indicators), len(context.Fundamentals), len(context.News))
	}

	if snippet := context.News[0].Snippet; strings.Contains(snippet, "<b>") || len([]rune(snippet)) > 303 {
		t.Fatalf("cuplikan berita = %q", snippet)
	}
}

func TestAnalysisGeminiFailureReturns502WithoutSession(t *testing.T) {
	f := newAnalysisFixture(t)
	f.gemini.set(func(path string, w http.ResponseWriter) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":{"message":"API key not valid. Please pass a valid API key."}}`))
	})

	f.analyze("fundamental", nil).
		assertStatus(http.StatusBadGateway).
		assertPath("success", false).
		assertPath("message", "API key Gemini tidak valid atau tidak punya akses. Periksa GEMINI_API_KEY di .env backend.")

	var sessions int64
	f.db.Model(&models.AnalysisSession{}).Count(&sessions)
	if sessions != 0 {
		t.Fatalf("sesi = %d, want 0", sessions)
	}
}

func TestAnalysisMissingDataReturns422(t *testing.T) {
	f := newAnalysisFixture(t)
	f.db.Where("stock_id = ?", f.stock.StockID).Delete(&models.News{})

	f.analyze("sentimen", nil).
		assertStatus(http.StatusUnprocessableEntity).
		assertPath("message", "Belum ada berita DMBK untuk analisis sentimen.")

	if f.gemini.count("generateContent") != 0 {
		t.Fatal("Gemini tidak boleh dipanggil bila data kosong")
	}
}

func TestAnalysisRejectsInvalidType(t *testing.T) {
	f := newAnalysisFixture(t)

	f.analyze("astrologi", nil).
		assertStatus(http.StatusUnprocessableEntity).
		assertPath("errors.analysis_type.0", "Jenis analisis tidak valid.")

	f.call(http.MethodPost, "/api/ai-analysis", f.token, map[string]any{"user_id": f.user.UserID}).
		assertStatus(http.StatusUnprocessableEntity).
		assertPath("errors.stock_id.0", "Saham wajib diisi.").
		assertPath("errors.analysis_type.0", "Jenis analisis wajib diisi.")
}

func TestReanalysisAddsResultToSameSession(t *testing.T) {
	f := newAnalysisFixture(t)
	f.gemini.set(geminiReply("Analisis."))

	sessionID := f.analyze("teknikal", nil).assertStatus(http.StatusCreated).get("data.session.session_id")

	f.analyze("teknikal", map[string]any{"session_id": sessionID}).
		assertStatus(http.StatusCreated).
		assertPath("data.session.session_id", sessionID)

	var sessions, analyses int64
	f.db.Model(&models.AnalysisSession{}).Count(&sessions)
	f.db.Model(&models.AiAnalysis{}).Count(&analyses)
	if sessions != 1 || analyses != 2 {
		t.Fatalf("sesi = %d, analisis = %d", sessions, analyses)
	}
}

func TestAnalysisIndexOnlyReturnsOwnAnalyses(t *testing.T) {
	f := newAnalysisFixture(t)
	f.gemini.set(geminiReply("Analisis."))

	other := testutil.User(t, f.db, "lain@example.test")
	otherToken := testutil.Token(t, f.db, other)

	f.analyze("teknikal", nil).assertStatus(http.StatusCreated)
	f.call(http.MethodPost, "/api/ai-analysis", otherToken, map[string]any{
		"user_id": other.UserID, "stock_id": f.stock.StockID, "analysis_type": "teknikal",
	}).assertStatus(http.StatusCreated)

	f.call(http.MethodGet, "/api/stocks/"+itoa(f.stock.StockID)+"/ai-analysis", f.token, nil).
		assertStatus(http.StatusOK).
		assertCount("data", 1).
		assertPath("data.0.session.user_id", f.user.UserID).
		assertPath("data.0.model_name", "gemini-test").
		assertMissing("data.0.context_data")
}
