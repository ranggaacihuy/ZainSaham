package market

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/ranggaacihuy/zainsaham/backend/internal/config"
)

const maxListings = 2000

var (
	tickerPattern = regexp.MustCompile(`^[A-Z]{4}$`)
	sectorNames   = map[string]string{
		"Finance":                "Keuangan",
		"Energy Minerals":        "Energi",
		"Utilities":              "Infrastruktur",
		"Communications":         "Infrastruktur",
		"Industrial Services":    "Perindustrian",
		"Producer Manufacturing": "Perindustrian",
		"Non-Energy Minerals":    "Barang Baku",
		"Process Industries":     "Barang Baku",
		"Consumer Non-Durables":  "Barang Konsumen Primer",
		"Retail Trade":           "Barang Konsumen Primer",
		"Distribution Services":  "Barang Konsumen Primer",
		"Consumer Durables":      "Barang Konsumen Non-Primer",
		"Consumer Services":      "Barang Konsumen Non-Primer",
		"Commercial Services":    "Barang Konsumen Non-Primer",
		"Health Technology":      "Kesehatan",
		"Health Services":        "Kesehatan",
		"Technology Services":    "Teknologi",
		"Electronic Technology":  "Teknologi",
		"Transportation":         "Transportasi & Logistik",
	}
)

type Listing struct {
	Ticker    string
	Name      string
	Sector    string
	MarketCap float64
}

type ListingSource struct {
	baseURL string
	limit   int
	http    *http.Client
}

func NewListingSource(cfg config.Listings) *ListingSource {
	return &ListingSource{
		baseURL: strings.TrimRight(cfg.BaseURL, "/"),
		limit:   cfg.Limit,
		http:    &http.Client{Timeout: 30 * time.Second},
	}
}

func (l *ListingSource) Limit() int {
	return l.limit
}

func (l *ListingSource) Fetch(ctx context.Context, limit int) ([]Listing, error) {
	if limit <= 0 || limit > maxListings {
		limit = maxListings
	}

	body, err := json.Marshal(map[string]any{
		"filter": []map[string]any{
			{"left": "type", "operation": "equal", "right": "stock"},
			{"left": "exchange", "operation": "equal", "right": "IDX"},
		},
		"columns": []string{"name", "description", "sector", "market_cap_basic"},
		"sort":    map[string]string{"sortBy": "market_cap_basic", "sortOrder": "desc"},
		"range":   []int{0, limit},
	})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, l.baseURL+"/indonesia/scan", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Mozilla/5.0 (ZainSaham)")

	resp, err := l.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("daftar emiten gagal diambil: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= http.StatusBadRequest {
		return nil, fmt.Errorf("daftar emiten gagal diambil: HTTP %d", resp.StatusCode)
	}

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 20<<20))
	if err != nil {
		return nil, fmt.Errorf("daftar emiten gagal diambil: %w", err)
	}

	return parseListings(raw)
}

func parseListings(raw []byte) ([]Listing, error) {
	var payload struct {
		Data []struct {
			D []any `json:"d"`
		} `json:"data"`
	}

	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, fmt.Errorf("daftar emiten gagal dibaca: %w", err)
	}

	seen := map[string]bool{}
	var listings []Listing

	for _, row := range payload.Data {
		if len(row.D) < 4 {
			continue
		}

		ticker := strings.ToUpper(strings.TrimSpace(text(row.D[0])))
		if !tickerPattern.MatchString(ticker) || seen[ticker] {
			continue
		}
		seen[ticker] = true

		marketCap, _ := row.D[3].(float64)

		listings = append(listings, Listing{
			Ticker:    ticker,
			Name:      truncate(strings.TrimSpace(text(row.D[1])), 150),
			Sector:    sectorNames[text(row.D[2])],
			MarketCap: marketCap,
		})
	}

	return listings, nil
}

func text(value any) string {
	if s, ok := value.(string); ok {
		return s
	}

	return ""
}
