package config

import (
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	App      App
	Database Database
	Gemini   Gemini
	Yahoo    Yahoo
	News     News
	Listings Listings
}

type App struct {
	Env              string
	Host             string
	Port             string
	CORSOrigins      []string
	BcryptCost       int
	TokenTTL         time.Duration
	SchedulerEnabled bool
}

type Database struct {
	Connection   string
	Database     string
	Host         string
	Port         string
	Username     string
	Password     string
	MaxOpenConns int
}

type Gemini struct {
	APIKey          string
	BaseURL         string
	Model           string
	FallbackModels  []string
	Timeout         time.Duration
	TotalTimeout    time.Duration
	MaxOutputTokens int
	Temperature     float64
	ThinkingLevel   string
}

type Yahoo struct {
	BaseURL  string
	Suffix   string
	Timeout  time.Duration
	Delay    time.Duration
	QuoteTTL time.Duration
}

type News struct {
	BaseURL string
	Limit   int
}

type Listings struct {
	BaseURL string
	Limit   int
}

func Load() Config {
	_ = godotenv.Load()

	return Config{
		App: App{
			Env:              str("APP_ENV", "development"),
			Host:             str("APP_HOST", "127.0.0.1"),
			Port:             str("APP_PORT", "8000"),
			CORSOrigins:      list("CORS_ALLOWED_ORIGINS", "http://localhost:3000"),
			BcryptCost:       integer("BCRYPT_COST", 12),
			TokenTTL:         time.Duration(integer("TOKEN_TTL_DAYS", 30)) * 24 * time.Hour,
			SchedulerEnabled: boolean("SCHEDULER_ENABLED", true),
		},
		Database: Database{
			Connection: str("DB_CONNECTION", "sqlite"),
			Database:   str("DB_DATABASE", "data/zainsaham.db"),
			Host:       str("DB_HOST", "127.0.0.1"),
			Port:       str("DB_PORT", "3306"),
			Username:   str("DB_USERNAME", "root"),
			Password:   str("DB_PASSWORD", ""),
		},
		Gemini: Gemini{
			APIKey:          str("GEMINI_API_KEY", ""),
			BaseURL:         str("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com"),
			Model:           str("GEMINI_MODEL", "gemini-3.6-flash"),
			FallbackModels:  list("GEMINI_FALLBACK_MODELS", "gemini-3.5-flash-lite"),
			Timeout:         seconds("GEMINI_TIMEOUT", 40),
			TotalTimeout:    seconds("GEMINI_TOTAL_TIMEOUT", 60),
			MaxOutputTokens: integer("GEMINI_MAX_OUTPUT_TOKENS", 8192),
			Temperature:     float("GEMINI_TEMPERATURE", 0.7),
			ThinkingLevel:   str("GEMINI_THINKING_LEVEL", "low"),
		},
		Yahoo: Yahoo{
			BaseURL:  str("YAHOO_FINANCE_BASE_URL", "https://query1.finance.yahoo.com"),
			Suffix:   str("YAHOO_FINANCE_SUFFIX", ".JK"),
			Timeout:  seconds("YAHOO_FINANCE_TIMEOUT", 20),
			Delay:    time.Duration(integer("YAHOO_FINANCE_DELAY_MS", 800)) * time.Millisecond,
			QuoteTTL: seconds("YAHOO_FINANCE_QUOTE_TTL", 15),
		},
		News: News{
			BaseURL: str("NEWS_BASE_URL", "https://news.google.com"),
			Limit:   integer("NEWS_LIMIT", 20),
		},
		Listings: Listings{
			BaseURL: str("LISTINGS_BASE_URL", "https://scanner.tradingview.com"),
			Limit:   integer("LISTINGS_LIMIT", 100),
		},
	}
}

func (a App) Address() string {
	return a.Host + ":" + a.Port
}

func str(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return strings.TrimSpace(value)
	}

	return fallback
}

func integer(key string, fallback int) int {
	value, err := strconv.Atoi(str(key, ""))
	if err != nil {
		return fallback
	}

	return value
}

func float(key string, fallback float64) float64 {
	value, err := strconv.ParseFloat(str(key, ""), 64)
	if err != nil {
		return fallback
	}

	return value
}

func boolean(key string, fallback bool) bool {
	value, err := strconv.ParseBool(str(key, ""))
	if err != nil {
		return fallback
	}

	return value
}

func seconds(key string, fallback int) time.Duration {
	return time.Duration(integer(key, fallback)) * time.Second
}

func list(key, fallback string) []string {
	var items []string

	for item := range strings.SplitSeq(str(key, fallback), ",") {
		if item = strings.TrimSpace(item); item != "" {
			items = append(items, item)
		}
	}

	return items
}
