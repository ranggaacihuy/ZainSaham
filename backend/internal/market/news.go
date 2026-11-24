package market

import (
	"context"
	"encoding/xml"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/ranggaacihuy/zainsaham/backend/internal/config"
	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
)

var (
	htmlTag    = regexp.MustCompile(`<[^>]*>`)
	whitespace = regexp.MustCompile(`\s+`)
)

type NewsFeed struct {
	baseURL string
	limit   int
	http    *http.Client
}

func NewNewsFeed(cfg config.News) *NewsFeed {
	return &NewsFeed{
		baseURL: strings.TrimRight(cfg.BaseURL, "/"),
		limit:   max(1, cfg.Limit),
		http:    &http.Client{Timeout: 20 * time.Second},
	}
}

func (n *NewsFeed) Fetch(ctx context.Context, ticker string) ([]models.News, error) {
	ticker = strings.ToUpper(strings.TrimSpace(ticker))
	endpoint := n.baseURL + "/rss/search?" + url.Values{
		"q":    {fmt.Sprintf(`"%s" saham`, ticker)},
		"hl":   {"id"},
		"gl":   {"ID"},
		"ceid": {"ID:id"},
	}.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (ZainSaham)")

	resp, err := n.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("berita %s gagal diambil: %w", ticker, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= http.StatusBadRequest {
		return nil, fmt.Errorf("berita %s gagal diambil: HTTP %d", ticker, resp.StatusCode)
	}

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 10<<20))
	if err != nil {
		return nil, fmt.Errorf("berita %s gagal diambil: %w", ticker, err)
	}

	return parseNews(ticker, raw, n.limit)
}

func parseNews(ticker string, raw []byte, limit int) ([]models.News, error) {
	var feed struct {
		Channel struct {
			Items []struct {
				Title       string `xml:"title"`
				Link        string `xml:"link"`
				PubDate     string `xml:"pubDate"`
				Description string `xml:"description"`
				Source      string `xml:"source"`
			} `xml:"item"`
		} `xml:"channel"`
	}

	if err := xml.Unmarshal(raw, &feed); err != nil {
		return nil, fmt.Errorf("berita %s gagal dibaca: %w", ticker, err)
	}

	tickerWord := regexp.MustCompile(`\b` + regexp.QuoteMeta(ticker) + `\b`)
	seen := map[string]bool{}
	var items []models.News

	for _, item := range feed.Channel.Items {
		source := truncate(strings.TrimSpace(item.Source), 100)
		title := strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(item.Title), " - "+source))
		link := strings.TrimSpace(item.Link)
		description := cleanText(item.Description)

		if title == "" || link == "" || len(link) > 500 || seen[link] {
			continue
		}

		// Kode saham ditulis kapital di berita. Pencocokan peka huruf besar dan
		// utuh per kata supaya kata biasa (misalnya "bumi" untuk BUMI) atau
		// kata yang lebih panjang tidak ikut lolos.
		if !tickerWord.MatchString(title + " " + description) {
			continue
		}

		seen[link] = true

		news := models.News{Title: truncate(title, 255), SourceURL: link}
		if source != "" {
			news.Source = new(source)
		}

		if published, err := time.Parse(time.RFC1123, strings.TrimSpace(item.PubDate)); err == nil {
			news.PublishedAt = new(published.UTC())
		}

		content := strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(description, title), source))
		if len([]rune(content)) >= 20 {
			news.Content = new(content)
		}

		items = append(items, news)
	}

	sort.SliceStable(items, func(i, j int) bool {
		if items[i].PublishedAt == nil || items[j].PublishedAt == nil {
			return items[j].PublishedAt == nil && items[i].PublishedAt != nil
		}
		return items[i].PublishedAt.After(*items[j].PublishedAt)
	})

	if len(items) > limit {
		items = items[:limit]
	}

	return items, nil
}

func cleanText(value string) string {
	text := html.UnescapeString(htmlTag.ReplaceAllString(value, " "))
	text = strings.ReplaceAll(text, " ", " ")

	return strings.TrimSpace(whitespace.ReplaceAllString(text, " "))
}

func truncate(value string, limit int) string {
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}

	return string(runes[:limit])
}
