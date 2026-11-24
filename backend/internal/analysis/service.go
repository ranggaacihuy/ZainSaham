package analysis

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"slices"
	"strings"

	"github.com/ranggaacihuy/zainsaham/backend/internal/gemini"
	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
	"gorm.io/gorm"
)

var Types = []string{"teknikal", "fundamental", "sentimen", "combined", "menyeluruh"}

var labels = map[string]string{
	"teknikal":    "teknikal",
	"fundamental": "fundamental",
	"sentimen":    "sentimen berita",
	"combined":    "menyeluruh",
}

type limits struct {
	prices, indicators, fundamentals, news, snippet int
}

var typeLimits = map[string]limits{
	"teknikal":    {prices: 60, indicators: 30},
	"fundamental": {fundamentals: 4},
	"sentimen":    {news: 10, snippet: 500},
	"combined":    {prices: 30, indicators: 10, fundamentals: 4, news: 5, snippet: 300},
}

var (
	tagPattern   = regexp.MustCompile(`<[^>]*>`)
	spacePattern = regexp.MustCompile(`\s+`)
)

type StockInfo struct {
	Ticker      string `json:"ticker"`
	CompanyName string `json:"company_name"`
	Sector      string `json:"sector"`
	Exchange    string `json:"exchange"`
	Currency    string `json:"currency"`
}

type PriceSummary struct {
	LastDate     string   `json:"last_date"`
	LastClose    float64  `json:"last_close"`
	PrevClose    *float64 `json:"prev_close"`
	Change1DPct  *float64 `json:"change_1d_pct"`
	Change1MPct  *float64 `json:"change_1m_pct"`
	High52W      float64  `json:"high_52w"`
	Low52W       float64  `json:"low_52w"`
	AvgVolume20D int64    `json:"avg_volume_20d"`
	TradingDays  int      `json:"trading_days"`
}

type PricePoint struct {
	Date   string  `json:"date"`
	Open   float64 `json:"open"`
	High   float64 `json:"high"`
	Low    float64 `json:"low"`
	Close  float64 `json:"close"`
	Volume int64   `json:"volume"`
}

type IndicatorPoint struct {
	Date       string   `json:"date"`
	RSI14      *float64 `json:"rsi_14"`
	MACD       *float64 `json:"macd"`
	MACDSignal *float64 `json:"macd_signal"`
	SMA20      *float64 `json:"sma_20"`
	SMA50      *float64 `json:"sma_50"`
}

type FundamentalPoint struct {
	Period           string   `json:"period"`
	PeriodType       string   `json:"period_type,omitempty"`
	Revenue          *float64 `json:"revenue"`
	NetIncome        *float64 `json:"net_income"`
	TotalAssets      *float64 `json:"total_assets"`
	TotalLiabilities *float64 `json:"total_liabilities"`
	TotalEquity      *float64 `json:"total_equity"`
	EPS              *float64 `json:"eps"`
	ROEPct           *float64 `json:"roe_pct"`
	ROAPct           *float64 `json:"roa_pct"`
	DebtToEquity     *float64 `json:"debt_to_equity"`
}

type NewsPoint struct {
	Title       string  `json:"title"`
	Source      *string `json:"source"`
	PublishedAt *string `json:"published_at"`
	Snippet     string  `json:"snippet"`
}

type Context struct {
	Stock        StockInfo          `json:"stock"`
	AnalysisType string             `json:"analysis_type"`
	PriceSummary *PriceSummary      `json:"price_summary"`
	Prices       []PricePoint       `json:"prices,omitempty"`
	Indicators   []IndicatorPoint   `json:"indicators,omitempty"`
	Fundamentals []FundamentalPoint `json:"fundamentals,omitempty"`
	News         []NewsPoint        `json:"news,omitempty"`
}

func (c *Context) JSON() string {
	var buffer bytes.Buffer

	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	_ = encoder.Encode(c)

	return strings.TrimSpace(buffer.String())
}

type Service struct {
	db     *gorm.DB
	gemini *gemini.Client
}

func NewService(db *gorm.DB, client *gemini.Client) *Service {
	return &Service{db: db, gemini: client}
}

func ValidType(analysisType string) bool {
	return slices.Contains(Types, strings.ToLower(strings.TrimSpace(analysisType)))
}

func NormalizeType(analysisType string) string {
	analysisType = strings.ToLower(strings.TrimSpace(analysisType))
	if analysisType == "menyeluruh" {
		return "combined"
	}

	return analysisType
}

func (s *Service) BuildContext(stock *models.Stock, analysisType string) (*Context, error) {
	analysisType = NormalizeType(analysisType)

	limit, ok := typeLimits[analysisType]
	if !ok {
		limit = typeLimits["combined"]
	}

	summary, err := s.priceSummary(stock.StockID)
	if err != nil {
		return nil, err
	}

	context := &Context{
		Stock: StockInfo{
			Ticker:      stock.Ticker,
			CompanyName: stock.CompanyName,
			Sector:      stock.Sector,
			Exchange:    stock.Exchange,
			Currency:    stock.Currency,
		},
		AnalysisType: analysisType,
		PriceSummary: summary,
	}

	if limit.prices > 0 {
		var prices []models.StockPrice
		if err := s.db.Where("stock_id = ?", stock.StockID).Order("price_date desc").Limit(limit.prices).Find(&prices).Error; err != nil {
			return nil, err
		}

		slices.Reverse(prices)
		for _, p := range prices {
			context.Prices = append(context.Prices, PricePoint{
				Date: p.PriceDate.String(), Open: p.OpenPrice, High: p.HighPrice, Low: p.LowPrice, Close: p.ClosePrice, Volume: p.Volume,
			})
		}
	}

	if limit.indicators > 0 {
		var rows []models.TechnicalIndicator
		if err := s.db.Where("stock_id = ?", stock.StockID).Order("indicator_date desc").Limit(limit.indicators).Find(&rows).Error; err != nil {
			return nil, err
		}

		slices.Reverse(rows)
		for _, i := range rows {
			context.Indicators = append(context.Indicators, IndicatorPoint{
				Date: i.IndicatorDate.String(), RSI14: i.RSI14, MACD: i.MACD, MACDSignal: i.MACDSignal, SMA20: i.SMA20, SMA50: i.SMA50,
			})
		}
	}

	if limit.fundamentals > 0 {
		var rows []models.StockFundamental
		if err := s.db.Where("stock_id = ?", stock.StockID).Order("period desc").Find(&rows).Error; err != nil {
			return nil, err
		}

		// Ambil periode terbaru per jenis (kuartalan dan tahunan) secara terpisah.
		// Urutan string menaruh "2025-Q4" sebelum "2025-FY", jadi batas gabungan
		// bisa mencampur angka kuartal dengan angka setahun penuh.
		perType := map[string]int{}
		for _, f := range rows {
			if perType[f.PeriodType] >= limit.fundamentals {
				continue
			}
			perType[f.PeriodType]++

			context.Fundamentals = append(context.Fundamentals, FundamentalPoint{
				Period: f.Period, PeriodType: f.PeriodType, Revenue: f.Revenue, NetIncome: f.NetIncome, TotalAssets: f.TotalAssets,
				TotalLiabilities: f.TotalLiabilities, TotalEquity: f.TotalEquity, EPS: f.EPS,
				ROEPct: f.ROE, ROAPct: f.ROA, DebtToEquity: f.DebtToEquity,
			})
		}
	}

	if limit.news > 0 {
		var rows []models.News
		if err := s.db.Where("stock_id = ?", stock.StockID).Order("published_at desc").Limit(limit.news).Find(&rows).Error; err != nil {
			return nil, err
		}

		for _, n := range rows {
			point := NewsPoint{Title: n.Title, Source: n.Source, Snippet: snippet(n.Content, limit.snippet)}
			if n.PublishedAt != nil {
				point.PublishedAt = new(n.PublishedAt.Format("2006-01-02"))
			}
			context.News = append(context.News, point)
		}
	}

	return context, nil
}

func MissingDataMessage(c *Context) string {
	ticker := c.Stock.Ticker

	switch c.AnalysisType {
	case "teknikal":
		if len(c.Prices) == 0 {
			return fmt.Sprintf("Data harga %s belum tersedia untuk analisis teknikal.", ticker)
		}
	case "fundamental":
		if len(c.Fundamentals) == 0 {
			return fmt.Sprintf("Data fundamental %s belum tersedia.", ticker)
		}
	case "sentimen":
		if len(c.News) == 0 {
			return fmt.Sprintf("Belum ada berita %s untuk analisis sentimen.", ticker)
		}
	default:
		if len(c.Prices) == 0 && len(c.Fundamentals) == 0 && len(c.News) == 0 {
			return fmt.Sprintf("Data %s belum tersedia untuk dianalisis.", ticker)
		}
	}

	return ""
}

func (s *Service) Analyze(ctx context.Context, c *Context) (string, string, error) {
	system := strings.Join([]string{
		"Kamu adalah analis saham Bursa Efek Indonesia untuk aplikasi ZainSaham.",
		"Tulis analisis dalam Bahasa Indonesia memakai markdown (judul ## dan daftar), padat dan mudah dipahami investor pemula.",
		"Aturan:",
		"- Gunakan hanya data JSON yang diberikan. Jangan mengarang angka atau peristiwa; bila data kurang, sebutkan keterbatasannya.",
		"- Sebutkan angka dan tanggal penting dari data untuk mendukung setiap poin.",
		"- Jangan memberi rekomendasi beli, jual, atau tahan, dan jangan menjanjikan keuntungan. Sampaikan skenario dan hal yang perlu dipantau.",
		"- Selalu bahas risiko.",
		"- Data fundamental bertanda period_type: quarterly berisi angka satu kuartal, annual berisi angka setahun penuh. Jangan membandingkan keduanya secara langsung. ROE dan ROA kuartalan sudah disetahunkan.",
	}, "\n")

	label, ok := labels[c.AnalysisType]
	if !ok {
		label = labels["combined"]
	}

	currency := c.Stock.Currency
	if currency == "" {
		currency = "IDR"
	}

	prompt := strings.Join([]string{
		fmt.Sprintf("Buat analisis %s untuk saham %s (%s).", label, c.Stock.Ticker, c.Stock.CompanyName),
		"",
		instructions(c.AnalysisType),
		"",
		fmt.Sprintf("Data (JSON, nilai uang dalam %s):", currency),
		c.JSON(),
	}, "\n")

	return s.gemini.Generate(ctx, system, []gemini.Message{{Role: "user", Content: prompt}})
}

func (s *Service) Chat(ctx context.Context, history []gemini.Message, c *Context) (string, string, error) {
	system := strings.Join([]string{
		"Kamu adalah asisten AI untuk aplikasi ZainSaham, aplikasi analisis saham Bursa Efek Indonesia.",
		"Bantu pengguna memahami saham berdasarkan data yang tersedia di bawah.",
		"Aturan:",
		"- Jawab dalam Bahasa Indonesia yang jelas dan ringkas. Boleh memakai markdown sederhana (judul, daftar, tebal).",
		"- Gunakan hanya data yang tersedia. Bila data yang ditanyakan tidak ada, katakan terus terang; jangan mengarang angka.",
		"- Sebutkan tanggal data bila menyebut harga atau indikator.",
		"- Jelaskan risiko. Jangan menjanjikan keuntungan dan jangan memberi perintah beli/jual; ini bukan saran investasi.",
		"- Tolak dengan sopan pertanyaan yang tidak berhubungan dengan saham, pasar modal, atau keuangan.",
		"- Fundamental quarterly berisi angka satu kuartal, annual berisi angka setahun penuh; jangan membandingkan keduanya secara langsung.",
		"",
		"Data saham (JSON, harga dalam rupiah):",
		c.JSON(),
	}, "\n")

	return s.gemini.Generate(ctx, system, history)
}

func instructions(analysisType string) string {
	switch analysisType {
	case "teknikal":
		return strings.Join([]string{
			"Bahas dengan bagian berikut:",
			"## Ringkasan",
			"## Tren & Moving Average (posisi harga terhadap SMA 20 dan SMA 50, golden/death cross bila ada)",
			"## Momentum (RSI 14: >70 jenuh beli, <30 jenuh jual; posisi MACD terhadap signal dan crossover terbaru)",
			"## Volume",
			"## Support & Resistance (dari harga tertinggi/terendah terbaru)",
			"## Risiko",
			"## Kesimpulan",
		}, "\n")
	case "fundamental":
		return strings.Join([]string{
			"Bahas dengan bagian berikut:",
			"## Ringkasan",
			"## Pertumbuhan (pendapatan dan laba bersih antar periode; bandingkan kuartal dengan kuartal dan tahunan dengan tahunan)",
			"## Profitabilitas (ROE, ROA, margin laba bersih = laba bersih / pendapatan)",
			"## Struktur Modal (debt to equity, liabilitas terhadap aset)",
			"## EPS",
			"## Risiko",
			"## Kesimpulan",
		}, "\n")
	case "sentimen":
		return strings.Join([]string{
			"Bahas dengan bagian berikut:",
			"## Ringkasan Sentimen (positif, netral, atau negatif secara keseluruhan)",
			"## Sentimen per Berita (daftar: judul singkat — positif/netral/negatif — alasan satu kalimat)",
			"## Tema Utama",
			"## Potensi Dampak ke Saham",
			"## Risiko",
			"## Kesimpulan",
		}, "\n")
	default:
		return strings.Join([]string{
			"Bahas dengan bagian berikut:",
			"## Ringkasan",
			"## Teknikal (tren, SMA, RSI, MACD)",
			"## Fundamental (pertumbuhan, profitabilitas, struktur modal)",
			"## Sentimen Berita",
			"## Kekuatan & Kelemahan",
			"## Risiko",
			"## Kesimpulan",
		}, "\n")
	}
}

func (s *Service) priceSummary(stockID uint) (*PriceSummary, error) {
	var rows []models.StockPrice
	if err := s.db.Select("price_date", "high_price", "low_price", "close_price", "volume").
		Where("stock_id = ?", stockID).
		Order("price_date desc").
		Limit(250).
		Find(&rows).Error; err != nil {
		return nil, err
	}

	if len(rows) == 0 {
		return nil, nil
	}

	latest := rows[0]
	summary := &PriceSummary{
		LastDate:    latest.PriceDate.String(),
		LastClose:   latest.ClosePrice,
		High52W:     latest.HighPrice,
		Low52W:      latest.LowPrice,
		TradingDays: len(rows),
	}

	if len(rows) > 1 {
		summary.PrevClose = new(rows[1].ClosePrice)
		summary.Change1DPct = pct(latest.ClosePrice, rows[1].ClosePrice)
		summary.Change1MPct = pct(latest.ClosePrice, rows[min(21, len(rows)-1)].ClosePrice)
	}

	var volume int64
	for i, row := range rows {
		summary.High52W = math.Max(summary.High52W, row.HighPrice)
		summary.Low52W = math.Min(summary.Low52W, row.LowPrice)

		if i < 20 {
			volume += row.Volume
		}
	}

	summary.AvgVolume20D = int64(math.Round(float64(volume) / float64(min(20, len(rows)))))

	return summary, nil
}

func pct(current, base float64) *float64 {
	if base == 0 {
		return nil
	}

	return new(math.Round((current-base)/base*100*100) / 100)
}

func snippet(content *string, limit int) string {
	if content == nil {
		return ""
	}

	text := strings.TrimSpace(spacePattern.ReplaceAllString(tagPattern.ReplaceAllString(*content, ""), " "))
	runes := []rune(text)

	if limit <= 0 || len(runes) <= limit {
		return text
	}

	return strings.TrimRight(string(runes[:limit]), " ") + "..."
}
