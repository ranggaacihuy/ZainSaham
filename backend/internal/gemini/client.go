package gemini

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/ranggaacihuy/zainsaham/backend/internal/config"
)

const (
	cooldownDuration   = 5 * time.Minute
	defaultUserMessage = "AI belum dapat membalas. Silakan coba lagi."
	busyUserMessage    = "Layanan AI terlalu lama merespons karena sedang sibuk. Coba lagi sebentar lagi."
	offlineUserMessage = "Tidak dapat terhubung ke layanan AI. Periksa koneksi internet server atau coba lagi."
)

var blockedReasons = []string{"SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII"}

type Message struct {
	Role    string
	Content string
}

type Error struct {
	Message     string
	UserMessage string
	Status      int
	Retryable   bool
	Err         error
}

func (e *Error) Error() string { return e.Message }

func (e *Error) Unwrap() error { return e.Err }

type Client struct {
	cfg             config.Gemini
	http            *http.Client
	now             func() time.Time
	minAttempt      time.Duration
	fallbackReserve time.Duration
	mu              sync.Mutex
	cooldown        map[string]time.Time
}

func New(cfg config.Gemini) *Client {
	return &Client{
		cfg:             cfg,
		http:            &http.Client{},
		now:             time.Now,
		minAttempt:      5 * time.Second,
		fallbackReserve: 15 * time.Second,
		cooldown:        map[string]time.Time{},
	}
}

func (c *Client) Model() string {
	return normalizeModel(c.cfg.Model)
}

func (c *Client) Generate(ctx context.Context, system string, messages []Message) (string, string, error) {
	if c.cfg.APIKey == "" {
		return "", "", &Error{
			Message:     "GEMINI_API_KEY belum dikonfigurasi.",
			UserMessage: "Layanan AI belum dikonfigurasi. Isi GEMINI_API_KEY di file .env backend.",
		}
	}

	contents := toContents(messages)
	if len(contents) == 0 {
		return "", "", &Error{Message: "Tidak ada pesan pengguna untuk dikirim ke Gemini.", UserMessage: defaultUserMessage}
	}

	generationConfig := map[string]any{
		"temperature":     c.cfg.Temperature,
		"maxOutputTokens": c.cfg.MaxOutputTokens,
	}
	if c.cfg.ThinkingLevel != "" {
		generationConfig["thinkingConfig"] = map[string]string{"thinkingLevel": c.cfg.ThinkingLevel}
	}

	body, err := json.Marshal(map[string]any{
		"systemInstruction": map[string]any{"parts": []map[string]string{{"text": system}}},
		"contents":          contents,
		"generationConfig":  generationConfig,
	})
	if err != nil {
		return "", "", &Error{Message: "Gagal menyusun permintaan Gemini: " + err.Error(), UserMessage: defaultUserMessage, Err: err}
	}

	timeout := max(c.minAttempt, c.cfg.Timeout)
	deadline := time.Now().Add(max(timeout, c.cfg.TotalTimeout))
	models := c.candidateModels()

	var lastErr *Error

	for i, model := range models {
		if ctx.Err() != nil {
			break
		}

		remaining := time.Until(deadline).Truncate(time.Second)
		if remaining < c.minAttempt {
			break
		}

		reserved := time.Duration(len(models)-i-1) * c.fallbackReserve
		attemptTimeout := max(c.minAttempt, min(timeout, remaining-reserved))

		text, attemptErr := c.request(ctx, model, min(attemptTimeout, remaining), body)
		if attemptErr == nil {
			return text, model, nil
		}

		if !attemptErr.Retryable {
			return "", "", attemptErr
		}

		log.Printf("Gemini model %s gagal, mencoba model berikutnya: %s", model, attemptErr.Message)
		c.coolDown(model)
		lastErr = attemptErr
	}

	if lastErr != nil {
		return "", "", lastErr
	}

	return "", "", &Error{Message: "Batas waktu total Gemini habis.", UserMessage: busyUserMessage}
}

func (c *Client) candidateModels() []string {
	var models []string

	for _, model := range append([]string{c.cfg.Model}, c.cfg.FallbackModels...) {
		if model = normalizeModel(model); model != "" && !slices.Contains(models, model) {
			models = append(models, model)
		}
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	now := c.now()
	var ready, cooling []string

	for _, model := range models {
		if until, ok := c.cooldown[model]; ok && now.Before(until) {
			cooling = append(cooling, model)
		} else {
			ready = append(ready, model)
		}
	}

	return append(ready, cooling...)
}

func (c *Client) coolDown(model string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.cooldown[model] = c.now().Add(cooldownDuration)
}

func (c *Client) request(ctx context.Context, model string, timeout time.Duration, body []byte) (string, *Error) {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	endpoint := strings.TrimRight(c.cfg.BaseURL, "/") + "/v1beta/models/" + url.PathEscape(model) + ":generateContent"

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", &Error{Message: "Gagal membuat permintaan Gemini: " + err.Error(), UserMessage: defaultUserMessage, Err: err}
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("x-goog-api-key", c.cfg.APIKey)

	resp, err := c.http.Do(req)
	if err != nil {
		return "", connectionError(model, err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 10<<20))
	if err != nil {
		return "", connectionError(model, err)
	}

	if resp.StatusCode >= http.StatusBadRequest {
		return "", failedResponse(model, resp.StatusCode, raw)
	}

	return extractText(raw)
}

func connectionError(model string, err error) *Error {
	userMessage := offlineUserMessage

	var netErr net.Error
	if errors.Is(err, context.DeadlineExceeded) || (errors.As(err, &netErr) && netErr.Timeout()) {
		userMessage = busyUserMessage
	}

	return &Error{
		Message:     fmt.Sprintf("Gagal terhubung ke Gemini (%s): %v", model, err),
		UserMessage: userMessage,
		Retryable:   true,
		Err:         err,
	}
}

func failedResponse(model string, status int, raw []byte) *Error {
	var parsed struct {
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	_ = json.Unmarshal(raw, &parsed)

	keyProblem := strings.Contains(parsed.Error.Message, "API key not valid") ||
		status == http.StatusUnauthorized || status == http.StatusForbidden

	var userMessage string
	switch {
	case keyProblem:
		userMessage = "API key Gemini tidak valid atau tidak punya akses. Periksa GEMINI_API_KEY di .env backend."
	case status == http.StatusNotFound:
		userMessage = fmt.Sprintf("Model Gemini %q tidak ditemukan. Periksa GEMINI_MODEL di .env backend.", model)
	case status == http.StatusTooManyRequests:
		userMessage = "Kuota layanan AI sedang habis atau terlalu banyak permintaan. Coba lagi beberapa saat lagi."
	case status >= http.StatusInternalServerError:
		userMessage = "Layanan AI sedang sibuk. Coba lagi sebentar lagi."
	default:
		userMessage = "Permintaan ke layanan AI ditolak. Silakan coba lagi."
	}

	return &Error{
		Message:     fmt.Sprintf("Gemini API gagal (%s). HTTP %d - %s", model, status, string(raw)),
		UserMessage: userMessage,
		Status:      status,
		Retryable: !keyProblem && (status == http.StatusNotFound ||
			status == http.StatusTooManyRequests ||
			status >= http.StatusInternalServerError),
	}
}

func extractText(raw []byte) (string, *Error) {
	var parsed struct {
		PromptFeedback struct {
			BlockReason string `json:"blockReason"`
		} `json:"promptFeedback"`
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text    *string `json:"text"`
					Thought bool    `json:"thought"`
				} `json:"parts"`
			} `json:"content"`
			FinishReason string `json:"finishReason"`
		} `json:"candidates"`
	}

	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", &Error{Message: "Balasan Gemini tidak dapat dibaca: " + err.Error(), UserMessage: defaultUserMessage, Err: err}
	}

	if parsed.PromptFeedback.BlockReason != "" {
		return "", &Error{
			Message:     "Prompt diblokir Gemini: " + parsed.PromptFeedback.BlockReason,
			UserMessage: "Permintaan ditolak oleh filter keamanan AI. Coba ubah pertanyaan.",
		}
	}

	var builder strings.Builder
	finishReason := ""

	if len(parsed.Candidates) > 0 {
		candidate := parsed.Candidates[0]
		finishReason = candidate.FinishReason

		for _, part := range candidate.Content.Parts {
			if !part.Thought && part.Text != nil {
				builder.WriteString(*part.Text)
			}
		}
	}

	text := strings.TrimSpace(builder.String())

	if text == "" {
		userMessage := "AI tidak memberikan jawaban. Silakan coba lagi."

		switch {
		case slices.Contains(blockedReasons, finishReason):
			userMessage = "Jawaban AI diblokir oleh filter keamanan. Coba ubah pertanyaan."
		case finishReason == "MAX_TOKENS":
			userMessage = "Jawaban AI terpotong sebelum selesai. Naikkan GEMINI_MAX_OUTPUT_TOKENS di .env backend."
		}

		if finishReason == "" {
			finishReason = "UNKNOWN"
		}

		return "", &Error{Message: "Balasan Gemini kosong. finishReason=" + finishReason, UserMessage: userMessage}
	}

	if finishReason == "MAX_TOKENS" {
		text += "\n\n_(Jawaban terpotong karena melebihi batas panjang.)_"
	}

	return text, nil
}

type content struct {
	Role  string              `json:"role"`
	Parts []map[string]string `json:"parts"`
}

func toContents(messages []Message) []content {
	var contents []content

	for _, message := range messages {
		text := strings.TrimSpace(message.Content)
		if text == "" {
			continue
		}

		role := "user"
		if message.Role == "assistant" {
			role = "model"
		}

		if len(contents) == 0 && role == "model" {
			continue
		}

		if last := len(contents) - 1; last >= 0 && contents[last].Role == role {
			contents[last].Parts[0]["text"] += "\n\n" + text
			continue
		}

		contents = append(contents, content{Role: role, Parts: []map[string]string{{"text": text}}})
	}

	return contents
}

func normalizeModel(model string) string {
	return strings.TrimPrefix(strings.TrimSpace(model), "models/")
}
