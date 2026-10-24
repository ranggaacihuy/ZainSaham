package httpapi_test

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/ranggaacihuy/zainsaham/backend/internal/analysis"
	"github.com/ranggaacihuy/zainsaham/backend/internal/config"
	"github.com/ranggaacihuy/zainsaham/backend/internal/gemini"
	"github.com/ranggaacihuy/zainsaham/backend/internal/httpapi"
	"github.com/ranggaacihuy/zainsaham/backend/internal/market"
	"github.com/ranggaacihuy/zainsaham/backend/internal/testutil"
	"gorm.io/gorm"
)

func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)
	os.Exit(m.Run())
}

type upstream struct {
	mu       sync.Mutex
	requests []*recordedRequest
	handler  func(path string, w http.ResponseWriter)
}

type recordedRequest struct {
	path   string
	query  string
	header http.Header
	body   map[string]any
}

func newUpstream(t *testing.T, handler func(path string, w http.ResponseWriter)) (*upstream, string) {
	t.Helper()

	up := &upstream{handler: handler}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		var body map[string]any
		_ = json.Unmarshal(raw, &body)

		up.mu.Lock()
		up.requests = append(up.requests, &recordedRequest{path: r.URL.Path, query: r.URL.RawQuery, header: r.Header.Clone(), body: body})
		handler := up.handler
		up.mu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		if handler == nil {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		handler(r.URL.Path, w)
	}))
	t.Cleanup(server.Close)

	return up, server.URL
}

func (u *upstream) set(handler func(path string, w http.ResponseWriter)) {
	u.mu.Lock()
	defer u.mu.Unlock()
	u.handler = handler
}

func (u *upstream) count(substr string) int {
	u.mu.Lock()
	defer u.mu.Unlock()

	total := 0
	for _, request := range u.requests {
		if strings.Contains(request.path, substr) {
			total++
		}
	}

	return total
}

func (u *upstream) last() *recordedRequest {
	u.mu.Lock()
	defer u.mu.Unlock()

	if len(u.requests) == 0 {
		return nil
	}

	return u.requests[len(u.requests)-1]
}

type env struct {
	t      *testing.T
	db     *gorm.DB
	router http.Handler
	gemini *upstream
	yahoo  *upstream
}

func newEnv(t *testing.T) *env {
	t.Helper()

	db := testutil.DB(t)
	geminiUp, geminiURL := newUpstream(t, nil)
	yahooUp, yahooURL := newUpstream(t, nil)

	client := gemini.New(config.Gemini{
		APIKey:          "test-key",
		BaseURL:         geminiURL,
		Model:           "gemini-test",
		Timeout:         10 * time.Second,
		TotalTimeout:    20 * time.Second,
		MaxOutputTokens: 1024,
		Temperature:     0.7,
	})

	marketService := market.NewService(db, config.Yahoo{BaseURL: yahooURL, Suffix: ".JK", Timeout: 5 * time.Second, QuoteTTL: 15 * time.Second}, config.News{BaseURL: yahooURL, Limit: 20})
	server := httpapi.NewServer(db, config.App{BcryptCost: testutil.BcryptCost, CORSOrigins: []string{"http://localhost:3000"}}, marketService, analysis.NewService(db, client))

	return &env{t: t, db: db, router: server.Router(), gemini: geminiUp, yahoo: yahooUp}
}

func (e *env) withGeminiKey(key string) *env {
	e.t.Helper()

	client := gemini.New(config.Gemini{APIKey: key, BaseURL: "http://127.0.0.1:1", Model: "gemini-test", Timeout: time.Second, TotalTimeout: time.Second})
	marketService := market.NewService(e.db, config.Yahoo{BaseURL: "http://127.0.0.1:1", Suffix: ".JK"}, config.News{BaseURL: "http://127.0.0.1:1"})
	e.router = httpapi.NewServer(e.db, config.App{BcryptCost: testutil.BcryptCost}, marketService, analysis.NewService(e.db, client)).Router()

	return e
}

type response struct {
	t      *testing.T
	status int
	body   map[string]any
	raw    string
}

func (e *env) call(method, path, token string, payload any) *response {
	e.t.Helper()

	var body io.Reader
	if payload != nil {
		raw, err := json.Marshal(payload)
		if err != nil {
			e.t.Fatal(err)
		}
		body = bytes.NewReader(raw)
	}

	req := httptest.NewRequest(method, path, body)
	req.Header.Set("Accept", "application/json")
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	rec := httptest.NewRecorder()
	e.router.ServeHTTP(rec, req)

	res := &response{t: e.t, status: rec.Code, raw: rec.Body.String()}
	_ = json.Unmarshal(rec.Body.Bytes(), &res.body)

	return res
}

func (r *response) assertStatus(status int) *response {
	r.t.Helper()

	if r.status != status {
		r.t.Fatalf("status = %d, want %d. body: %s", r.status, status, r.raw)
	}

	return r
}

func (r *response) get(path string) any {
	r.t.Helper()

	var current any = r.body
	for key := range strings.SplitSeq(path, ".") {
		switch node := current.(type) {
		case map[string]any:
			value, exists := node[key]
			if !exists {
				return nil
			}
			current = value
		case []any:
			index, err := strconv.Atoi(key)
			if err != nil || index >= len(node) {
				return nil
			}
			current = node[index]
		default:
			return nil
		}
	}

	return current
}

func (r *response) has(path string) bool {
	r.t.Helper()

	parent, key := "", path
	if i := strings.LastIndex(path, "."); i >= 0 {
		parent, key = path[:i], path[i+1:]
	}

	node := any(r.body)
	if parent != "" {
		node = r.get(parent)
	}

	object, isMap := node.(map[string]any)
	if !isMap {
		return false
	}

	_, exists := object[key]

	return exists
}

func (r *response) assertPath(path string, want any) *response {
	r.t.Helper()

	got := r.get(path)
	if !equalJSON(got, want) {
		r.t.Fatalf("%s = %#v, want %#v. body: %s", path, got, want, r.raw)
	}

	return r
}

func (r *response) assertCount(path string, want int) *response {
	r.t.Helper()

	list, isList := r.get(path).([]any)
	if !isList || len(list) != want {
		r.t.Fatalf("len(%s) = %d, want %d. body: %s", path, len(list), want, r.raw)
	}

	return r
}

func (r *response) assertMissing(path string) *response {
	r.t.Helper()

	if r.has(path) {
		r.t.Fatalf("%s seharusnya tidak ada. body: %s", path, r.raw)
	}

	return r
}

func equalJSON(got, want any) bool {
	switch w := want.(type) {
	case int:
		return got == float64(w)
	case uint:
		return got == float64(w)
	case float64:
		return got == w
	default:
		return got == want
	}
}

func geminiReply(text string) func(path string, w http.ResponseWriter) {
	return func(path string, w http.ResponseWriter) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"candidates": []map[string]any{{
				"content":      map[string]any{"parts": []map[string]any{{"text": text}}},
				"finishReason": "STOP",
			}},
		})
	}
}

func promptText(request *recordedRequest) string {
	contents, _ := request.body["contents"].([]any)
	if len(contents) == 0 {
		return ""
	}

	parts, _ := contents[0].(map[string]any)["parts"].([]any)
	if len(parts) == 0 {
		return ""
	}

	text, _ := parts[0].(map[string]any)["text"].(string)

	return text
}

func systemText(request *recordedRequest) string {
	instruction, _ := request.body["systemInstruction"].(map[string]any)
	parts, _ := instruction["parts"].([]any)
	if len(parts) == 0 {
		return ""
	}

	text, _ := parts[0].(map[string]any)["text"].(string)

	return text
}
