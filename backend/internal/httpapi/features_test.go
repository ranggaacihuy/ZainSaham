package httpapi_test

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
	"github.com/ranggaacihuy/zainsaham/backend/internal/testutil"
)

func TestStockListSearchFilterPaginationAndSummary(t *testing.T) {
	e := newEnv(t)
	bbca := testutil.StockWithMarketData(t, e.db, "BBCA", 40, 0)
	testutil.Stock(t, e.db, "BBRI")
	tlkm := testutil.Stock(t, e.db, "TLKM")
	e.db.Model(tlkm).Update("sector", "Infrastruktur")

	e.call(http.MethodGet, "/api/stocks", "", nil).
		assertStatus(http.StatusOK).
		assertCount("data", 3).
		assertPath("data.0.ticker", "BBCA").
		assertPath("data.1.summary", nil)

	all := e.call(http.MethodGet, "/api/stocks", "", nil)
	if all.get("data.0.summary.close_price") == nil || all.get("data.0.summary.change_pct") == nil {
		t.Fatalf("ringkasan harga harus ada: %s", all.raw)
	}

	e.call(http.MethodGet, "/api/stocks?q=bb&page=1&per_page=1", "", nil).
		assertStatus(http.StatusOK).
		assertCount("data", 1).
		assertPath("data.0.ticker", "BBCA").
		assertPath("meta.total", 2).
		assertPath("meta.last_page", 2).
		assertPath("meta.sectors.0", "Infrastruktur").
		assertPath("meta.sectors.1", "Keuangan")

	e.call(http.MethodGet, "/api/stocks?q=bb&page=2&per_page=1", "", nil).assertPath("data.0.ticker", "BBRI")
	e.call(http.MethodGet, "/api/stocks?q=test%20tbk&page=1", "", nil).assertPath("meta.total", 3)
	e.call(http.MethodGet, "/api/stocks?sector=Infrastruktur&page=1", "", nil).assertCount("data", 1).assertPath("data.0.ticker", "TLKM")
	e.call(http.MethodGet, "/api/stocks?q=%25&page=1", "", nil).assertPath("meta.total", 0)

	base := "/api/stocks/" + itoa(bbca.StockID)
	month := e.call(http.MethodGet, base+"/prices?range=1B", "", nil).assertStatus(http.StatusOK)
	if count := len(month.get("data").([]any)); count < 28 || count > 32 {
		t.Fatalf("harga 1B = %d baris", count)
	}
	e.call(http.MethodGet, base+"/indicators?range=5T", "", nil).assertCount("data", 40)
	e.call(http.MethodGet, base+"/prices?range=2X", "", nil).
		assertStatus(http.StatusUnprocessableEntity).
		assertPath("errors.range.0", "Rentang waktu tidak valid. Pilih 1B, 3B, 6B, 1T, atau 5T.")
}

func TestFundamentalsIncludePeriodType(t *testing.T) {
	e := newEnv(t)
	stock := testutil.StockWithMarketData(t, e.db, "BBCA", 5, 0)
	e.db.Create(&models.StockFundamental{StockID: stock.StockID, Period: "2025-FY", Revenue: new(1.0)})

	res := e.call(http.MethodGet, "/api/stocks/"+itoa(stock.StockID)+"/fundamentals", "", nil).assertStatus(http.StatusOK)
	res.assertPath("data.0.period", "2026-Q2").assertPath("data.0.period_type", "quarterly")

	for _, item := range res.get("data").([]any) {
		row := item.(map[string]any)
		if row["period"] == "2025-FY" && row["period_type"] != "annual" {
			t.Fatalf("period_type tahunan = %v", row["period_type"])
		}
	}
}

func TestNewsFeedAcrossStocks(t *testing.T) {
	e := newEnv(t)
	bbca := testutil.StockWithMarketData(t, e.db, "BBCA", 5, 3)
	tlkm := testutil.StockWithMarketData(t, e.db, "TLKM", 5, 2)

	feed := e.call(http.MethodGet, "/api/news?limit=4", "", nil).
		assertStatus(http.StatusOK).
		assertCount("data", 4)

	for i := range 3 {
		current := feed.get(fmt.Sprintf("data.%d.published_at", i)).(string)
		next := feed.get(fmt.Sprintf("data.%d.published_at", i+1)).(string)
		if current < next || feed.get(fmt.Sprintf("data.%d.stock.ticker", i)) == nil {
			t.Fatalf("feed harus urut terbaru dan memuat saham: %s", feed.raw)
		}
	}

	e.call(http.MethodGet, fmt.Sprintf("/api/news?stock_ids=%d", tlkm.StockID), "", nil).
		assertCount("data", 2).
		assertPath("data.0.stock_id", tlkm.StockID)

	e.call(http.MethodGet, fmt.Sprintf("/api/news?stock_ids=%d,abc", bbca.StockID), "", nil).
		assertStatus(http.StatusUnprocessableEntity)
}

func TestWatchlistAndDashboardIncludeSummaries(t *testing.T) {
	e := newEnv(t)
	user := testutil.User(t, e.db, "budi@example.test")
	token := testutil.Token(t, e.db, user)
	bbca := testutil.StockWithMarketData(t, e.db, "BBCA", 60, 3)
	tlkm := testutil.StockWithMarketData(t, e.db, "TLKM", 60, 2)
	testutil.StockWithMarketData(t, e.db, "ASII", 60, 0)

	e.db.Create(&models.Watchlist{UserID: user.UserID, StockID: bbca.StockID})
	e.db.Create(&models.Watchlist{UserID: user.UserID, StockID: tlkm.StockID})

	session := models.AnalysisSession{UserID: user.UserID, StockID: bbca.StockID, AnalysisType: "teknikal"}
	e.db.Create(&session)
	e.db.Create(&models.AiAnalysis{SessionID: session.SessionID, ModelName: "gemini-test", Result: "Hasil", ContextData: "{}"})

	watch := e.call(http.MethodGet, "/api/users/"+itoa(user.UserID)+"/watchlist", token, nil).
		assertStatus(http.StatusOK).
		assertCount("data", 2).
		assertCount("data.0.summary.sparkline", 30)
	if watch.get("data.0.summary.rsi_14") == nil || watch.get("data.0.summary.close_price") == nil {
		t.Fatalf("watchlist harus memuat harga dan RSI: %s", watch.raw)
	}

	dash := e.call(http.MethodGet, "/api/dashboard", token, nil).
		assertStatus(http.StatusOK).
		assertPath("data.stats.count", 2).
		assertCount("data.watchlist", 2).
		assertCount("data.news", 5).
		assertCount("data.analyses", 1).
		assertPath("data.analyses.0.stock.ticker", "BBCA").
		assertPath("data.analyses.0.session.analysis_type", "teknikal").
		assertMissing("data.analyses.0.context_data")

	if dash.get("data.last_price_date") == nil || dash.get("data.movers.gainers") == nil || dash.get("data.movers.losers") == nil {
		t.Fatalf("dashboard tidak lengkap: %s", dash.raw)
	}

	stranger := testutil.User(t, e.db, "lain@example.test")
	e.call(http.MethodGet, "/api/dashboard", testutil.Token(t, e.db, stranger), nil).
		assertStatus(http.StatusOK).
		assertPath("data.stats.count", 0).
		assertCount("data.watchlist", 0).
		assertCount("data.news", 0).
		assertCount("data.analyses", 0).
		assertPath("data.stats.avg_change_pct", nil)
}

func TestProfileUpdate(t *testing.T) {
	e := newEnv(t)
	user := testutil.User(t, e.db, "budi@example.test")
	testutil.User(t, e.db, "dipakai@example.test")
	token := testutil.Token(t, e.db, user)

	e.call(http.MethodPut, "/api/profile", token, map[string]any{"name": "Budi Baru", "email": "budi@example.test"}).
		assertStatus(http.StatusOK).
		assertPath("message", "Profil berhasil diperbarui.").
		assertPath("data.name", "Budi Baru")

	e.call(http.MethodPut, "/api/profile", token, map[string]any{"name": "Budi", "email": "baru@example.test"}).
		assertStatus(http.StatusUnprocessableEntity).
		assertPath("errors.current_password.0", "Kata sandi saat ini wajib diisi untuk mengubah email atau kata sandi.")

	e.call(http.MethodPut, "/api/profile", token, map[string]any{"name": "Budi", "email": "baru@example.test", "current_password": "salah"}).
		assertStatus(http.StatusUnprocessableEntity).
		assertPath("errors.current_password.0", "Kata sandi saat ini salah.")

	e.call(http.MethodPut, "/api/profile", token, map[string]any{"name": "Budi", "email": "dipakai@example.test", "current_password": "rahasia123"}).
		assertStatus(http.StatusUnprocessableEntity).
		assertPath("errors.email.0", "Email sudah terdaftar.")

	e.call(http.MethodPut, "/api/profile", token, map[string]any{
		"name": "Budi", "email": "budi@example.test", "current_password": "rahasia123",
		"password": "sandibaru1", "password_confirmation": "beda",
	}).assertStatus(http.StatusUnprocessableEntity).
		assertPath("errors.password.0", "Konfirmasi kata sandi tidak cocok.")

	e.call(http.MethodPut, "/api/profile", token, map[string]any{
		"name": "Budi", "email": "Baru@Example.test", "current_password": "rahasia123",
		"password": "sandibaru1", "password_confirmation": "sandibaru1",
	}).assertStatus(http.StatusOK).
		assertPath("data.email", "baru@example.test")

	e.call(http.MethodPost, "/api/login", "", map[string]any{"email": "baru@example.test", "password": "sandibaru1"}).
		assertStatus(http.StatusOK)
}

func TestProfileDelete(t *testing.T) {
	e := newEnv(t)
	user := testutil.User(t, e.db, "budi@example.test")
	token := testutil.Token(t, e.db, user)

	e.call(http.MethodDelete, "/api/profile", token, map[string]any{"password": "salah"}).
		assertStatus(http.StatusUnprocessableEntity).
		assertPath("errors.password.0", "Kata sandi salah.")

	e.call(http.MethodDelete, "/api/profile", token, map[string]any{"password": "rahasia123"}).
		assertStatus(http.StatusOK).
		assertPath("message", "Akun berhasil dihapus.")

	e.call(http.MethodGet, "/api/me", token, nil).assertStatus(http.StatusUnauthorized)
	e.call(http.MethodPost, "/api/login", "", map[string]any{"email": "budi@example.test", "password": "rahasia123"}).
		assertStatus(http.StatusUnauthorized)

	e.call(http.MethodPost, "/api/register", "", map[string]any{
		"name": "Budi", "email": "budi@example.test", "password": "rahasia123", "password_confirmation": "rahasia123",
	}).assertStatus(http.StatusCreated)

	var archived int64
	e.db.Unscoped().Model(&models.User{}).Where("deleted_at IS NOT NULL").Count(&archived)
	if archived != 1 {
		t.Fatalf("akun terhapus = %d, want 1 (soft delete)", archived)
	}
}

func TestAiSessionsListDetailAndDelete(t *testing.T) {
	e := newEnv(t)
	user := testutil.User(t, e.db, "budi@example.test")
	other := testutil.User(t, e.db, "lain@example.test")
	token := testutil.Token(t, e.db, user)
	bbca := testutil.Stock(t, e.db, "BBCA")
	tlkm := testutil.Stock(t, e.db, "TLKM")

	now := time.Now().UTC()

	analysisSession := models.AnalysisSession{UserID: user.UserID, StockID: bbca.StockID, AnalysisType: "teknikal", UpdatedAt: now.Add(-time.Hour)}
	chatSession := models.AnalysisSession{UserID: user.UserID, StockID: tlkm.StockID, AnalysisType: "combined", UpdatedAt: now}
	emptySession := models.AnalysisSession{UserID: user.UserID, StockID: tlkm.StockID, AnalysisType: "combined"}
	foreign := models.AnalysisSession{UserID: other.UserID, StockID: bbca.StockID, AnalysisType: "teknikal"}
	for _, session := range []*models.AnalysisSession{&analysisSession, &chatSession, &emptySession, &foreign} {
		e.db.Create(session)
	}
	e.db.Model(&analysisSession).UpdateColumn("updated_at", now.Add(-time.Hour))
	e.db.Model(&chatSession).UpdateColumn("updated_at", now)

	e.db.Create(&models.AiAnalysis{SessionID: analysisSession.SessionID, ModelName: "m", Result: "## Versi lama", CreatedAt: now.Add(-2 * time.Hour)})
	e.db.Create(&models.AiAnalysis{SessionID: analysisSession.SessionID, ModelName: "m", Result: "## Versi **baru**", CreatedAt: now.Add(-time.Hour)})
	e.db.Create(&models.AiMessage{SessionID: chatSession.SessionID, Role: "user", Content: "Halo", CreatedAt: now.Add(-time.Minute)})
	e.db.Create(&models.AiMessage{SessionID: chatSession.SessionID, Role: "assistant", Content: "Halo juga", CreatedAt: now})

	e.call(http.MethodGet, "/api/ai-sessions", token, nil).
		assertStatus(http.StatusOK).
		assertCount("data", 2).
		assertPath("data.0.kind", "chat").
		assertPath("data.0.messages_count", 2).
		assertPath("data.0.preview", "Halo juga").
		assertPath("data.0.stock.ticker", "TLKM").
		assertPath("data.1.kind", "analysis").
		assertPath("data.1.analyses_count", 2).
		assertPath("data.1.preview", "Versi baru")

	e.call(http.MethodGet, "/api/ai-sessions?kind=analysis", token, nil).assertCount("data", 1).assertPath("data.0.kind", "analysis")
	e.call(http.MethodGet, "/api/ai-sessions?stock_id="+itoa(tlkm.StockID), token, nil).assertCount("data", 1)
	e.call(http.MethodGet, "/api/ai-sessions?kind=lain", token, nil).assertStatus(http.StatusUnprocessableEntity)

	e.call(http.MethodGet, "/api/ai-sessions/"+itoa(analysisSession.SessionID), token, nil).
		assertStatus(http.StatusOK).
		assertPath("data.session.stock.ticker", "BBCA").
		assertCount("data.analyses", 2).
		assertPath("data.analyses.0.result", "## Versi **baru**").
		assertMissing("data.analyses.0.context_data")

	e.call(http.MethodGet, "/api/ai-sessions/"+itoa(foreign.SessionID), token, nil).assertStatus(http.StatusNotFound)
	e.call(http.MethodDelete, "/api/ai-sessions/"+itoa(foreign.SessionID), token, nil).assertStatus(http.StatusNotFound)

	e.call(http.MethodDelete, "/api/ai-sessions/"+itoa(chatSession.SessionID), token, nil).
		assertStatus(http.StatusOK).
		assertPath("message", "Riwayat berhasil dihapus.")

	var messages int64
	e.db.Model(&models.AiMessage{}).Count(&messages)
	if messages != 0 {
		t.Fatalf("pesan tersisa = %d", messages)
	}

	e.call(http.MethodGet, "/api/ai-sessions", token, nil).assertCount("data", 1)
}

func TestReanalysisAndChatTouchSessionTimestamp(t *testing.T) {
	f := newAnalysisFixture(t)
	f.gemini.set(geminiReply("Analisis."))

	sessionID := f.analyze("teknikal", nil).assertStatus(http.StatusCreated).get("data.session.session_id")

	old := time.Now().UTC().Add(-24 * time.Hour)
	f.db.Model(&models.AnalysisSession{}).Where("session_id = ?", sessionID).UpdateColumn("updated_at", old)

	f.analyze("teknikal", map[string]any{"session_id": sessionID}).assertStatus(http.StatusCreated)

	var session models.AnalysisSession
	f.db.First(&session, sessionID)
	if !session.UpdatedAt.After(old.Add(time.Hour)) {
		t.Fatalf("updated_at tidak diperbarui: %v", session.UpdatedAt)
	}
}

func TestIndexIsSeparatedFromStocks(t *testing.T) {
	e := newEnv(t)
	user := testutil.User(t, e.db, "budi@example.test")
	token := testutil.Token(t, e.db, user)
	testutil.StockWithMarketData(t, e.db, "BBCA", 40, 0)
	index := testutil.StockWithMarketData(t, e.db, "IHSG", 40, 0)
	e.db.Model(index).Updates(map[string]any{"kind": models.KindIndex, "sector": "Indeks", "yahoo_symbol": "^JKSE"})

	e.call(http.MethodGet, "/api/stocks", "", nil).assertCount("data", 2)
	e.call(http.MethodGet, "/api/stocks?page=1", "", nil).
		assertPath("meta.total", 1).
		assertPath("data.0.ticker", "BBCA").
		assertPath("data.0.kind", "stock").
		assertCount("meta.sectors", 1)
	e.call(http.MethodGet, "/api/stocks?page=1&kind=index", "", nil).assertPath("data.0.ticker", "IHSG")
	e.call(http.MethodGet, "/api/stocks?page=1&kind=all", "", nil).assertPath("meta.total", 2)

	dash := e.call(http.MethodGet, "/api/dashboard", token, nil).
		assertStatus(http.StatusOK).
		assertPath("data.index.stock.ticker", "IHSG").
		assertCount("data.index.summary.sparkline", 30)

	for _, group := range []string{"gainers", "losers"} {
		for _, item := range dash.get("data.movers." + group).([]any) {
			if item.(map[string]any)["stock"].(map[string]any)["ticker"] == "IHSG" {
				t.Fatal("IHSG tidak boleh masuk top movers")
			}
		}
	}
}

// putCloses menyimpan harga penutupan sebuah emiten. Kunci map adalah jumlah
// hari sebelum hari ini.
func putCloses(t *testing.T, e *env, ticker string, closes map[int]float64) {
	t.Helper()

	stock := testutil.Stock(t, e.db, ticker)
	today := time.Now().UTC()

	for daysAgo, closePrice := range closes {
		price := models.StockPrice{
			StockID: stock.StockID, PriceDate: models.NewDate(today.AddDate(0, 0, -daysAgo)),
			OpenPrice: closePrice, HighPrice: closePrice, LowPrice: closePrice, ClosePrice: closePrice, Volume: 1,
		}
		if err := e.db.Create(&price).Error; err != nil {
			t.Fatal(err)
		}
	}
}

func moverTickers(r *response, group string) []string {
	var tickers []string
	for _, item := range r.get("data.movers." + group).([]any) {
		tickers = append(tickers, item.(map[string]any)["stock"].(map[string]any)["ticker"].(string))
	}

	return tickers
}

func TestMoversSkipStocksWithOutdatedPrices(t *testing.T) {
	e := newEnv(t)
	token := testutil.Token(t, e.db, testutil.User(t, e.db, "budi@example.test"))
	today := models.NewDate(time.Now().UTC()).String()

	putCloses(t, e, "UPPP", map[int]float64{1: 1000, 0: 1030})
	putCloses(t, e, "FRSH", map[int]float64{1: 1000, 0: 1010})
	putCloses(t, e, "DOWN", map[int]float64{1: 1000, 0: 980})
	// Harga terakhir sebulan lalu (misalnya suspensi), naik 25% saat itu.
	putCloses(t, e, "STLE", map[int]float64{31: 100, 30: 125})
	// Belum tersinkron hari ini, turun 10% kemarin.
	putCloses(t, e, "LAGG", map[int]float64{2: 1000, 1: 900})

	dash := e.call(http.MethodGet, "/api/dashboard", token, nil).
		assertStatus(http.StatusOK).
		assertPath("data.last_price_date", today).
		assertPath("data.movers.date", today).
		assertPath("data.movers.total", 3)

	if got := fmt.Sprint(moverTickers(dash, "gainers")); got != "[UPPP FRSH]" {
		t.Fatalf("gainers = %s, want [UPPP FRSH]. body: %s", got, dash.raw)
	}
	if got := fmt.Sprint(moverTickers(dash, "losers")); got != "[DOWN]" {
		t.Fatalf("losers = %s, want [DOWN]. body: %s", got, dash.raw)
	}
}

func TestMoversUseDateReachedByMostStocks(t *testing.T) {
	e := newEnv(t)
	token := testutil.Token(t, e.db, testutil.User(t, e.db, "budi@example.test"))
	today := models.NewDate(time.Now().UTC()).String()
	yesterday := models.NewDate(time.Now().UTC().AddDate(0, 0, -1)).String()

	// Hanya EARL yang sudah punya harga hari ini (misalnya lewat endpoint quote).
	putCloses(t, e, "EARL", map[int]float64{2: 1000, 1: 1100, 0: 990})
	putCloses(t, e, "AAAA", map[int]float64{2: 1000, 1: 1050})
	putCloses(t, e, "BBBB", map[int]float64{2: 1000, 1: 950})

	dash := e.call(http.MethodGet, "/api/dashboard", token, nil).
		assertStatus(http.StatusOK).
		assertPath("data.last_price_date", today).
		assertPath("data.movers.date", yesterday).
		assertPath("data.movers.total", 3).
		assertPath("data.movers.gainers.0.summary.change_pct", 10.0).
		assertPath("data.movers.gainers.0.summary.price_date", yesterday)

	if got := fmt.Sprint(moverTickers(dash, "gainers")); got != "[EARL AAAA]" {
		t.Fatalf("gainers = %s, want [EARL AAAA]. body: %s", got, dash.raw)
	}
	if got := fmt.Sprint(moverTickers(dash, "losers")); got != "[BBBB]" {
		t.Fatalf("losers = %s, want [BBBB]. body: %s", got, dash.raw)
	}
}
