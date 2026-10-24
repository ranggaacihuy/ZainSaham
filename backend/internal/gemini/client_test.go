package gemini

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/ranggaacihuy/zainsaham/backend/internal/config"
)

type fakeGemini struct {
	mu       sync.Mutex
	requests map[string]int
	bodies   []map[string]any
	headers  []http.Header
	handler  func(model string, w http.ResponseWriter)
}

func newFakeGemini(t *testing.T, handler func(model string, w http.ResponseWriter)) (*fakeGemini, *httptest.Server) {
	t.Helper()

	fake := &fakeGemini{requests: map[string]int{}, handler: handler}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		model := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/v1beta/models/"), ":generateContent")

		raw, _ := io.ReadAll(r.Body)
		var body map[string]any
		_ = json.Unmarshal(raw, &body)

		fake.mu.Lock()
		fake.requests[model]++
		fake.bodies = append(fake.bodies, body)
		fake.headers = append(fake.headers, r.Header.Clone())
		fake.mu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		handler(model, w)
	}))
	t.Cleanup(server.Close)

	return fake, server
}

func reply(w http.ResponseWriter, parts []map[string]any, finishReason string) {
	_ = json.NewEncoder(w).Encode(map[string]any{
		"candidates": []map[string]any{{
			"content":      map[string]any{"parts": parts},
			"finishReason": finishReason,
		}},
	})
}

func newClient(baseURL string) *Client {
	return New(config.Gemini{
		APIKey:          "test-key",
		BaseURL:         baseURL,
		Model:           "gemini-main",
		FallbackModels:  []string{"gemini-backup", "models/gemini-main"},
		Timeout:         10 * time.Second,
		TotalTimeout:    20 * time.Second,
		MaxOutputTokens: 1024,
		Temperature:     0.5,
	})
}

func asError(t *testing.T, err error) *Error {
	t.Helper()

	var geminiErr *Error
	if !errors.As(err, &geminiErr) {
		t.Fatalf("error bukan *gemini.Error: %v", err)
	}

	return geminiErr
}

func TestGenerateJoinsTextPartsAndSkipsThoughts(t *testing.T) {
	fake, server := newFakeGemini(t, func(model string, w http.ResponseWriter) {
		reply(w, []map[string]any{
			{"text": "proses berpikir", "thought": true},
			{"text": "RSI "},
			{"text": "netral."},
		}, "STOP")
	})

	text, model, err := newClient(server.URL).Generate(context.Background(), "sistem", []Message{
		{Role: "assistant", Content: "salam pembuka"},
		{Role: "user", Content: "pertanyaan 1"},
		{Role: "user", Content: "pertanyaan 2"},
		{Role: "assistant", Content: "jawaban"},
		{Role: "user", Content: "   "},
	})
	if err != nil {
		t.Fatal(err)
	}

	if text != "RSI netral." || model != "gemini-main" {
		t.Fatalf("hasil = %q (%s)", text, model)
	}

	if got := fake.headers[0].Get("x-goog-api-key"); got != "test-key" {
		t.Fatalf("header API key = %q", got)
	}

	contents := fake.bodies[0]["contents"].([]any)
	if len(contents) != 2 {
		t.Fatalf("contents = %d, want 2 (pesan model di awal dibuang, pesan user berurutan digabung)", len(contents))
	}

	first := contents[0].(map[string]any)
	firstText := first["parts"].([]any)[0].(map[string]any)["text"]
	if first["role"] != "user" || firstText != "pertanyaan 1\n\npertanyaan 2" {
		t.Fatalf("content pertama = %v", first)
	}
}

func TestGenerateRequiresAPIKey(t *testing.T) {
	client := newClient("http://127.0.0.1:1")
	client.cfg.APIKey = ""

	_, _, err := client.Generate(context.Background(), "s", []Message{{Role: "user", Content: "halo"}})

	if got := asError(t, err).UserMessage; got != "Layanan AI belum dikonfigurasi. Isi GEMINI_API_KEY di file .env backend." {
		t.Fatalf("pesan = %q", got)
	}
}

func TestBusyModelFallsBackAndCoolsDown(t *testing.T) {
	fake, server := newFakeGemini(t, func(model string, w http.ResponseWriter) {
		if model == "gemini-main" {
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte(`{"error":{"message":"high demand"}}`))
			return
		}
		reply(w, []map[string]any{{"text": "dari cadangan"}}, "STOP")
	})

	client := newClient(server.URL)

	for range 2 {
		text, model, err := client.Generate(context.Background(), "s", []Message{{Role: "user", Content: "halo"}})
		if err != nil || text != "dari cadangan" || model != "gemini-backup" {
			t.Fatalf("hasil = %q (%s), err %v", text, model, err)
		}
	}

	if fake.requests["gemini-main"] != 1 || fake.requests["gemini-backup"] != 2 {
		t.Fatalf("requests = %v", fake.requests)
	}
}

func TestInvalidKeyDoesNotTryFallback(t *testing.T) {
	fake, server := newFakeGemini(t, func(model string, w http.ResponseWriter) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":{"message":"API key not valid. Please pass a valid API key."}}`))
	})

	_, _, err := newClient(server.URL).Generate(context.Background(), "s", []Message{{Role: "user", Content: "halo"}})

	if got := asError(t, err).UserMessage; got != "API key Gemini tidak valid atau tidak punya akses. Periksa GEMINI_API_KEY di .env backend." {
		t.Fatalf("pesan = %q", got)
	}

	if fake.requests["gemini-backup"] != 0 {
		t.Fatal("model cadangan tidak boleh dicoba saat API key salah")
	}
}

func TestAllModelsFailingReturnsLastError(t *testing.T) {
	fake, server := newFakeGemini(t, func(model string, w http.ResponseWriter) {
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = w.Write([]byte(`{"error":{"message":"quota"}}`))
	})

	_, _, err := newClient(server.URL).Generate(context.Background(), "s", []Message{{Role: "user", Content: "halo"}})

	if got := asError(t, err).UserMessage; got != "Kuota layanan AI sedang habis atau terlalu banyak permintaan. Coba lagi beberapa saat lagi." {
		t.Fatalf("pesan = %q", got)
	}

	if fake.requests["gemini-main"] != 1 || fake.requests["gemini-backup"] != 1 {
		t.Fatalf("requests = %v", fake.requests)
	}
}

func TestBlockedAndTruncatedReplies(t *testing.T) {
	_, blocked := newFakeGemini(t, func(model string, w http.ResponseWriter) {
		reply(w, nil, "SAFETY")
	})

	_, _, err := newClient(blocked.URL).Generate(context.Background(), "s", []Message{{Role: "user", Content: "halo"}})
	if got := asError(t, err).UserMessage; got != "Jawaban AI diblokir oleh filter keamanan. Coba ubah pertanyaan." {
		t.Fatalf("pesan = %q", got)
	}

	_, truncated := newFakeGemini(t, func(model string, w http.ResponseWriter) {
		reply(w, []map[string]any{{"text": "sebagian"}}, "MAX_TOKENS")
	})

	text, _, err := newClient(truncated.URL).Generate(context.Background(), "s", []Message{{Role: "user", Content: "halo"}})
	if err != nil || !strings.HasPrefix(text, "sebagian") || !strings.Contains(text, "terpotong") {
		t.Fatalf("hasil = %q, err %v", text, err)
	}
}

func TestTimeoutIsRetryable(t *testing.T) {
	fake, server := newFakeGemini(t, func(model string, w http.ResponseWriter) {
		if model == "gemini-main" {
			time.Sleep(1500 * time.Millisecond)
		}
		reply(w, []map[string]any{{"text": "ok"}}, "STOP")
	})

	client := newClient(server.URL)
	client.minAttempt = 100 * time.Millisecond
	client.cfg.Timeout = 500 * time.Millisecond

	text, model, err := client.Generate(context.Background(), "s", []Message{{Role: "user", Content: "halo"}})

	if err != nil || text != "ok" || model != "gemini-backup" {
		t.Fatalf("hasil = %q (%s), err %v, requests %v", text, model, err, fake.requests)
	}
}
