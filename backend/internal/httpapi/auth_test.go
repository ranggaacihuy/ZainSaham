package httpapi_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
	"github.com/ranggaacihuy/zainsaham/backend/internal/seed"
	"github.com/ranggaacihuy/zainsaham/backend/internal/testutil"
)

func TestRegisterCreatesUserAndToken(t *testing.T) {
	e := newEnv(t)

	res := e.call(http.MethodPost, "/api/register", "", map[string]any{
		"name":                  "Budi",
		"email":                 "  Budi@Example.TEST ",
		"password":              "rahasia123",
		"password_confirmation": "rahasia123",
	}).assertStatus(http.StatusCreated).
		assertPath("success", true).
		assertPath("message", "Pendaftaran akun berhasil.").
		assertPath("data.user.email", "budi@example.test").
		assertMissing("data.user.password_hash")

	token, _ := res.get("data.token").(string)
	if !strings.Contains(token, "|") {
		t.Fatalf("token = %q", token)
	}

	e.call(http.MethodGet, "/api/me", token, nil).
		assertStatus(http.StatusOK).
		assertPath("data.name", "Budi")
}

func TestRegisterValidationMessages(t *testing.T) {
	e := newEnv(t)
	testutil.User(t, e.db, "ada@example.test")

	e.call(http.MethodPost, "/api/register", "", map[string]any{
		"name":                  "",
		"email":                 "bukan-email",
		"password":              "pendek",
		"password_confirmation": "beda",
	}).assertStatus(http.StatusUnprocessableEntity).
		assertPath("success", false).
		assertPath("message", "Data yang dikirim tidak valid.").
		assertPath("errors.name.0", "Nama wajib diisi.").
		assertPath("errors.email.0", "Format email tidak valid.").
		assertPath("errors.password.0", "Kata sandi minimal 8 karakter.").
		assertPath("errors.password.1", "Konfirmasi kata sandi tidak cocok.")

	e.call(http.MethodPost, "/api/register", "", map[string]any{
		"name":                  "Ada",
		"email":                 "ADA@example.test",
		"password":              "rahasia123",
		"password_confirmation": "rahasia123",
	}).assertStatus(http.StatusUnprocessableEntity).
		assertPath("errors.email.0", "Email sudah terdaftar.")
}

func TestLoginWithDemoAccountAndLogout(t *testing.T) {
	e := newEnv(t)

	if err := seed.DemoUser(e.db, testutil.BcryptCost); err != nil {
		t.Fatal(err)
	}
	if err := seed.DemoUser(e.db, testutil.BcryptCost); err != nil {
		t.Fatal(err)
	}

	var count int64
	e.db.Model(&models.User{}).Where("email = ?", seed.DemoEmail).Count(&count)
	if count != 1 {
		t.Fatalf("akun demo = %d, want 1", count)
	}

	res := e.call(http.MethodPost, "/api/login", "", map[string]any{
		"email":    seed.DemoEmail,
		"password": seed.DemoPassword,
	}).assertStatus(http.StatusOK).
		assertPath("message", "Berhasil masuk.").
		assertPath("data.user.name", seed.DemoName)

	token := res.get("data.token").(string)

	e.call(http.MethodGet, "/api/me", token, nil).assertStatus(http.StatusOK).assertPath("data.email", seed.DemoEmail)
	e.call(http.MethodPost, "/api/logout", token, nil).assertStatus(http.StatusOK).assertPath("message", "Berhasil keluar.")
	e.call(http.MethodGet, "/api/me", token, nil).
		assertStatus(http.StatusUnauthorized).
		assertPath("message", "Sesi telah berakhir. Silakan masuk kembali.")
}

func TestLoginRejectsWrongPassword(t *testing.T) {
	e := newEnv(t)
	testutil.User(t, e.db, "budi@example.test")

	e.call(http.MethodPost, "/api/login", "", map[string]any{
		"email":    "budi@example.test",
		"password": "salah-sandi",
	}).assertStatus(http.StatusUnauthorized).
		assertPath("message", "Email atau kata sandi salah.")
}

func TestTokenWithWrongSecretIsRejected(t *testing.T) {
	e := newEnv(t)
	user := testutil.User(t, e.db, "budi@example.test")
	token := testutil.Token(t, e.db, user)

	id, _, _ := strings.Cut(token, "|")
	e.call(http.MethodGet, "/api/me", id+"|palsu", nil).assertStatus(http.StatusUnauthorized)
	e.call(http.MethodGet, "/api/me", "bukan-token", nil).assertStatus(http.StatusUnauthorized)
}

func TestPublicEndpointsDoNotNeedLogin(t *testing.T) {
	e := newEnv(t)
	stock := testutil.Stock(t, e.db, "BBCA")
	base := "/api/stocks/" + itoa(stock.StockID)

	e.call(http.MethodGet, "/api/stocks", "", nil).assertStatus(http.StatusOK).assertCount("data", 1)
	e.call(http.MethodGet, base, "", nil).assertStatus(http.StatusOK).assertPath("data.ticker", "BBCA")
	e.call(http.MethodGet, base+"/prices", "", nil).assertStatus(http.StatusOK).assertCount("data", 0)
	e.call(http.MethodGet, base+"/indicators", "", nil).assertStatus(http.StatusOK)
	e.call(http.MethodGet, base+"/fundamentals", "", nil).assertStatus(http.StatusOK)
	e.call(http.MethodGet, base+"/news", "", nil).assertStatus(http.StatusOK)
	e.call(http.MethodGet, "/up", "", nil).assertStatus(http.StatusOK)
}

func TestPrivateEndpointsNeedLogin(t *testing.T) {
	e := newEnv(t)

	for _, route := range []struct{ method, path string }{
		{http.MethodGet, "/api/me"},
		{http.MethodPost, "/api/logout"},
		{http.MethodGet, "/api/users/1/watchlist"},
		{http.MethodPost, "/api/watchlists"},
		{http.MethodDelete, "/api/watchlists/1"},
		{http.MethodGet, "/api/stocks/1/ai-analysis"},
		{http.MethodPost, "/api/ai-analysis"},
		{http.MethodPost, "/api/ai-chat"},
		{http.MethodGet, "/api/ai-chat/1/messages"},
	} {
		res := e.call(route.method, route.path, "", map[string]any{})
		if res.status != http.StatusUnauthorized {
			t.Fatalf("%s %s = %d, want 401", route.method, route.path, res.status)
		}
	}
}

func TestUserCannotTouchOtherUsersData(t *testing.T) {
	e := newEnv(t)
	owner := testutil.User(t, e.db, "pemilik@example.test")
	intruder := testutil.User(t, e.db, "penyusup@example.test")
	stock := testutil.Stock(t, e.db, "BBCA")

	item := models.Watchlist{UserID: owner.UserID, StockID: stock.StockID}
	session := models.AnalysisSession{UserID: owner.UserID, StockID: stock.StockID, AnalysisType: "combined"}
	e.db.Create(&item)
	e.db.Create(&session)

	token := testutil.Token(t, e.db, intruder)

	e.call(http.MethodGet, "/api/users/"+itoa(owner.UserID)+"/watchlist", token, nil).
		assertStatus(http.StatusForbidden).assertPath("message", "Akses ditolak.")
	e.call(http.MethodPost, "/api/watchlists", token, map[string]any{"user_id": owner.UserID, "stock_id": stock.StockID}).
		assertStatus(http.StatusForbidden)
	e.call(http.MethodDelete, "/api/watchlists/"+itoa(item.WatchlistID), token, nil).
		assertStatus(http.StatusNotFound)
	e.call(http.MethodGet, "/api/ai-chat/"+itoa(session.SessionID)+"/messages", token, nil).
		assertStatus(http.StatusNotFound)
	e.call(http.MethodPost, "/api/ai-analysis", token, map[string]any{"user_id": owner.UserID, "stock_id": stock.StockID, "analysis_type": "teknikal"}).
		assertStatus(http.StatusForbidden)
	e.call(http.MethodPost, "/api/ai-chat", token, map[string]any{"user_id": owner.UserID, "stock_id": stock.StockID, "message": "Halo"}).
		assertStatus(http.StatusForbidden)

	var remaining int64
	e.db.Model(&models.Watchlist{}).Count(&remaining)
	if remaining != 1 {
		t.Fatal("watchlist milik pengguna lain tidak boleh terhapus")
	}
}

func TestUserManagesOwnWatchlist(t *testing.T) {
	e := newEnv(t)
	user := testutil.User(t, e.db, "budi@example.test")
	stock := testutil.Stock(t, e.db, "BBCA")
	token := testutil.Token(t, e.db, user)
	payload := map[string]any{"user_id": user.UserID, "stock_id": stock.StockID}

	first := e.call(http.MethodPost, "/api/watchlists", token, payload).
		assertStatus(http.StatusCreated).
		assertPath("message", "Saham berhasil ditambahkan ke watchlist.")
	id := first.get("data.watchlist_id")

	e.call(http.MethodPost, "/api/watchlists", token, payload).
		assertStatus(http.StatusCreated).
		assertPath("data.watchlist_id", id)

	e.call(http.MethodGet, "/api/users/"+itoa(user.UserID)+"/watchlist", token, nil).
		assertStatus(http.StatusOK).
		assertCount("data", 1).
		assertPath("data.0.stock.ticker", "BBCA")

	e.call(http.MethodPost, "/api/watchlists", token, map[string]any{"user_id": user.UserID, "stock_id": 999}).
		assertStatus(http.StatusNotFound).
		assertPath("message", "Saham tidak ditemukan.")

	e.call(http.MethodDelete, "/api/watchlists/"+itoa(uint(id.(float64))), token, nil).
		assertStatus(http.StatusOK).
		assertPath("message", "Saham berhasil dihapus dari watchlist.")

	e.call(http.MethodGet, "/api/users/"+itoa(user.UserID)+"/watchlist", token, nil).assertCount("data", 0)
}

func TestCORSPreflight(t *testing.T) {
	e := newEnv(t)

	for origin, allowed := range map[string]bool{"http://localhost:3000": true, "http://evil.test": false} {
		req := httptest.NewRequest(http.MethodOptions, "/api/stocks", nil)
		req.Header.Set("Origin", origin)
		rec := httptest.NewRecorder()
		e.router.ServeHTTP(rec, req)

		if rec.Code != http.StatusNoContent {
			t.Fatalf("preflight %s = %d", origin, rec.Code)
		}

		if got := rec.Header().Get("Access-Control-Allow-Origin") == origin; got != allowed {
			t.Fatalf("Allow-Origin untuk %s = %q", origin, rec.Header().Get("Access-Control-Allow-Origin"))
		}
	}
}
