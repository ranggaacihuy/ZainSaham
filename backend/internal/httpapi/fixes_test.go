package httpapi_test

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
	"github.com/ranggaacihuy/zainsaham/backend/internal/testutil"
	"gorm.io/gorm"
)

func TestLoginLocksEmailAfterRepeatedFailures(t *testing.T) {
	e := newEnv(t)
	testutil.User(t, e.db, "budi@example.test")
	login := func(password string) *response {
		return e.call(http.MethodPost, "/api/login", "", map[string]any{"email": "budi@example.test", "password": password})
	}

	for range 10 {
		login("salah").assertStatus(http.StatusUnauthorized)
	}

	login("rahasia123").
		assertStatus(http.StatusTooManyRequests).
		assertPath("message", "Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.")

	// Email lain tidak ikut terkunci.
	testutil.User(t, e.db, "sari@example.test")
	e.call(http.MethodPost, "/api/login", "", map[string]any{"email": "sari@example.test", "password": "rahasia123"}).
		assertStatus(http.StatusOK)
}

func TestLoginSuccessResetsFailureCount(t *testing.T) {
	e := newEnv(t)
	testutil.User(t, e.db, "budi@example.test")
	login := func(password string) *response {
		return e.call(http.MethodPost, "/api/login", "", map[string]any{"email": "budi@example.test", "password": password})
	}

	for range 9 {
		login("salah").assertStatus(http.StatusUnauthorized)
	}
	login("rahasia123").assertStatus(http.StatusOK)

	for range 9 {
		login("salah").assertStatus(http.StatusUnauthorized)
	}
	login("rahasia123").assertStatus(http.StatusOK)
}

func TestLoginUnknownEmailStillRejected(t *testing.T) {
	e := newEnv(t)

	e.call(http.MethodPost, "/api/login", "", map[string]any{"email": "tidakada@example.test", "password": "zainsaham-dummy-password"}).
		assertStatus(http.StatusUnauthorized).
		assertPath("message", "Email atau kata sandi salah.")
}

func TestIssuedTokensExpire(t *testing.T) {
	e := newEnv(t)
	user := testutil.User(t, e.db, "budi@example.test")
	token := testutil.Token(t, e.db, user)

	var stored models.PersonalAccessToken
	e.db.Where("tokenable_id = ?", user.UserID).First(&stored)
	if stored.ExpiresAt == nil {
		t.Fatal("token harus punya waktu kedaluwarsa")
	}

	e.db.Model(&stored).Update("expires_at", time.Now().UTC().Add(-time.Minute))
	e.call(http.MethodGet, "/api/me", token, nil).assertStatus(http.StatusUnauthorized)
}

func TestPasswordChangeRevokesOtherSessions(t *testing.T) {
	e := newEnv(t)
	user := testutil.User(t, e.db, "budi@example.test")
	current := testutil.Token(t, e.db, user)
	other := testutil.Token(t, e.db, user)

	e.call(http.MethodPut, "/api/profile", current, map[string]any{"name": "Budi Baru", "email": "budi@example.test"}).
		assertStatus(http.StatusOK)
	e.call(http.MethodGet, "/api/me", other, nil).assertStatus(http.StatusOK)

	e.call(http.MethodPut, "/api/profile", current, map[string]any{
		"name": "Budi", "email": "budi@example.test", "current_password": "rahasia123",
		"password": "sandibaru1", "password_confirmation": "sandibaru1",
	}).assertStatus(http.StatusOK)

	e.call(http.MethodGet, "/api/me", current, nil).assertStatus(http.StatusOK)
	e.call(http.MethodGet, "/api/me", other, nil).assertStatus(http.StatusUnauthorized)
}

func TestDuplicateEmailIsTranslated(t *testing.T) {
	e := newEnv(t)
	testutil.User(t, e.db, "budi@example.test")

	err := e.db.Create(&models.User{Name: "Lain", Email: "budi@example.test", PasswordHash: "x"}).Error
	if !errors.Is(err, gorm.ErrDuplicatedKey) {
		t.Fatalf("err = %v, want gorm.ErrDuplicatedKey supaya handler bisa membalas 422", err)
	}
}

func TestStockSearchEscapesLikeWildcards(t *testing.T) {
	e := newEnv(t)
	percent := testutil.Stock(t, e.db, "AAAA")
	e.db.Model(percent).Update("company_name", "PT Untung 100% Tbk")
	under := testutil.Stock(t, e.db, "BBBB")
	e.db.Model(under).Update("company_name", "PT Kode_A Tbk")
	bang := testutil.Stock(t, e.db, "CCCC")
	e.db.Model(bang).Update("company_name", "PT Hore! Tbk")
	testutil.Stock(t, e.db, "DDDD")

	for query, ticker := range map[string]string{"100%": "AAAA", "kode_a": "BBBB", "hore!": "CCCC"} {
		e.call(http.MethodGet, "/api/stocks?page=1&q="+url.QueryEscape(query), "", nil).
			assertStatus(http.StatusOK).
			assertPath("meta.total", 1).
			assertPath("data.0.ticker", ticker)
	}

	// "%" dan "_" harus dicocokkan apa adanya, bukan sebagai wildcard.
	e.call(http.MethodGet, "/api/stocks?page=1&q=%25", "", nil).assertPath("meta.total", 1)
	e.call(http.MethodGet, "/api/stocks?page=1&q=_", "", nil).assertPath("meta.total", 1)
}

func TestStockNewsIsLimited(t *testing.T) {
	e := newEnv(t)
	stock := testutil.StockWithMarketData(t, e.db, "BBCA", 5, 30)
	base := "/api/stocks/" + itoa(stock.StockID) + "/news"

	e.call(http.MethodGet, base, "", nil).assertStatus(http.StatusOK).assertCount("data", 20)
	e.call(http.MethodGet, base+"?limit=5", "", nil).assertCount("data", 5)
	e.call(http.MethodGet, base+"?limit=500", "", nil).assertCount("data", 30)
}

func TestWatchlistStatsUseMoversReferenceDate(t *testing.T) {
	e := newEnv(t)
	user := testutil.User(t, e.db, "budi@example.test")
	token := testutil.Token(t, e.db, user)
	today := models.NewDate(time.Now().UTC()).String()

	putCloses(t, e, "FRSH", map[int]float64{1: 1000, 0: 1010})
	putCloses(t, e, "DOWN", map[int]float64{1: 1000, 0: 970})
	putCloses(t, e, "UPPP", map[int]float64{1: 1000, 0: 1050})
	putCloses(t, e, "STLE", map[int]float64{31: 100, 30: 125})

	for _, ticker := range []string{"FRSH", "DOWN", "STLE"} {
		var stock models.Stock
		e.db.Where("ticker = ?", ticker).First(&stock)
		e.db.Create(&models.Watchlist{UserID: user.UserID, StockID: stock.StockID})
	}

	e.call(http.MethodGet, "/api/dashboard", token, nil).
		assertStatus(http.StatusOK).
		assertPath("data.stats.count", 3).
		assertPath("data.stats.date", today).
		assertPath("data.stats.avg_change_pct", -1.0).
		assertPath("data.stats.up", 1).
		assertPath("data.stats.down", 1)
}

func TestAnalysisContextKeepsQuarterlyAndAnnualApart(t *testing.T) {
	f := newAnalysisFixture(t)
	for _, period := range []string{"2025-FY", "2024-FY", "2023-FY", "2022-FY", "2021-FY"} {
		f.db.Create(&models.StockFundamental{StockID: f.stock.StockID, Period: period, Revenue: new(4_000_000.0)})
	}
	f.gemini.set(geminiReply("Analisis fundamental."))

	f.analyze("fundamental", nil).assertStatus(http.StatusCreated)

	context := storedContext(t, f)
	counts := map[string]int{}
	var periods []string
	for _, point := range context.Fundamentals {
		counts[point.PeriodType]++
		periods = append(periods, point.Period)
	}

	if counts["quarterly"] != 4 || counts["annual"] != 4 {
		t.Fatalf("periode = %v, want 4 kuartalan dan 4 tahunan terbaru", periods)
	}
	if got := fmt.Sprint(periods); got != "[2026-Q2 2026-Q1 2025-Q4 2025-Q3 2025-FY 2024-FY 2023-FY 2022-FY]" {
		t.Fatalf("urutan periode = %s", got)
	}
	if !strings.Contains(systemText(f.gemini.last()), "period_type") {
		t.Fatal("instruksi sistem harus menjelaskan period_type")
	}
}
