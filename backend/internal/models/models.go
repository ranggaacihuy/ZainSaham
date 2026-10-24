package models

import (
	"strings"
	"time"

	"gorm.io/gorm"
)

type User struct {
	UserID       uint           `gorm:"column:user_id;primaryKey" json:"user_id"`
	Name         string         `gorm:"size:100;not null" json:"name"`
	Email        string         `gorm:"size:150;not null;uniqueIndex" json:"email"`
	PasswordHash string         `gorm:"column:password_hash;size:255;not null" json:"-"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

func (User) TableName() string { return "users" }

type PersonalAccessToken struct {
	ID            uint   `gorm:"primaryKey"`
	TokenableType string `gorm:"size:255;not null;index:idx_tokenable"`
	TokenableID   uint   `gorm:"not null;index:idx_tokenable"`
	Name          string `gorm:"type:text;not null"`
	Token         string `gorm:"size:64;not null;uniqueIndex"`
	Abilities     *string
	LastUsedAt    *time.Time
	ExpiresAt     *time.Time `gorm:"index"`
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

func (PersonalAccessToken) TableName() string { return "personal_access_tokens" }

type Stock struct {
	StockID     uint      `gorm:"column:stock_id;primaryKey" json:"stock_id"`
	Ticker      string    `gorm:"size:10;not null;uniqueIndex" json:"ticker"`
	CompanyName string    `gorm:"size:150;not null" json:"company_name"`
	Sector      string    `gorm:"size:100" json:"sector"`
	Exchange    string    `gorm:"size:20;not null;default:IDX" json:"exchange"`
	Currency    string    `gorm:"size:3;not null;default:IDR" json:"currency"`
	CreatedAt   time.Time `json:"-"`
	UpdatedAt   time.Time `json:"-"`
}

func (Stock) TableName() string { return "stocks" }

type StockPrice struct {
	PriceID    uint      `gorm:"column:price_id;primaryKey" json:"-"`
	StockID    uint      `gorm:"not null;uniqueIndex:idx_stock_prices_stock_date,priority:1" json:"-"`
	PriceDate  Date      `gorm:"not null;uniqueIndex:idx_stock_prices_stock_date,priority:2" json:"price_date"`
	OpenPrice  float64   `gorm:"type:decimal(15,2);not null" json:"open_price"`
	HighPrice  float64   `gorm:"type:decimal(15,2);not null" json:"high_price"`
	LowPrice   float64   `gorm:"type:decimal(15,2);not null" json:"low_price"`
	ClosePrice float64   `gorm:"type:decimal(15,2);not null" json:"close_price"`
	Volume     int64     `gorm:"not null" json:"volume"`
	CreatedAt  time.Time `json:"-"`
	Stock      *Stock    `gorm:"constraint:OnDelete:CASCADE" json:"-"`
}

func (StockPrice) TableName() string { return "stock_prices" }

type TechnicalIndicator struct {
	IndicatorID   uint      `gorm:"column:indicator_id;primaryKey" json:"-"`
	StockID       uint      `gorm:"not null;uniqueIndex:idx_indicators_stock_date,priority:1" json:"-"`
	IndicatorDate Date      `gorm:"not null;uniqueIndex:idx_indicators_stock_date,priority:2" json:"indicator_date"`
	RSI14         *float64  `gorm:"column:rsi_14;type:decimal(6,2)" json:"rsi_14"`
	MACD          *float64  `gorm:"column:macd;type:decimal(15,4)" json:"macd"`
	MACDSignal    *float64  `gorm:"column:macd_signal;type:decimal(15,4)" json:"macd_signal"`
	SMA20         *float64  `gorm:"column:sma_20;type:decimal(15,2)" json:"sma_20"`
	SMA50         *float64  `gorm:"column:sma_50;type:decimal(15,2)" json:"sma_50"`
	CreatedAt     time.Time `json:"-"`
	Stock         *Stock    `gorm:"constraint:OnDelete:CASCADE" json:"-"`
}

func (TechnicalIndicator) TableName() string { return "technical_indicators" }

type News struct {
	NewsID      uint       `gorm:"column:news_id;primaryKey" json:"news_id"`
	StockID     uint       `gorm:"not null;uniqueIndex:idx_news_stock_url,priority:1" json:"stock_id"`
	Title       string     `gorm:"size:255;not null" json:"title"`
	Content     *string    `gorm:"type:text" json:"content"`
	Source      *string    `gorm:"size:100" json:"source"`
	SourceURL   string     `gorm:"column:source_url;size:500;not null;uniqueIndex:idx_news_stock_url,priority:2" json:"source_url"`
	PublishedAt *time.Time `json:"published_at"`
	CreatedAt   time.Time  `json:"-"`
	UpdatedAt   time.Time  `json:"-"`
	Stock       *Stock     `gorm:"constraint:OnDelete:CASCADE" json:"stock,omitempty"`
}

func (News) TableName() string { return "news" }

type StockFundamental struct {
	FundamentalID    uint      `gorm:"column:fundamental_id;primaryKey" json:"-"`
	StockID          uint      `gorm:"not null;uniqueIndex:idx_fundamentals_stock_period,priority:1" json:"-"`
	Period           string    `gorm:"size:10;not null;uniqueIndex:idx_fundamentals_stock_period,priority:2" json:"period"`
	PeriodType       string    `gorm:"-" json:"period_type"`
	Revenue          *float64  `gorm:"type:decimal(20,2)" json:"revenue"`
	NetIncome        *float64  `gorm:"type:decimal(20,2)" json:"net_income"`
	TotalAssets      *float64  `gorm:"type:decimal(20,2)" json:"total_assets"`
	TotalLiabilities *float64  `gorm:"type:decimal(20,2)" json:"total_liabilities"`
	TotalEquity      *float64  `gorm:"type:decimal(20,2)" json:"total_equity"`
	EPS              *float64  `gorm:"column:eps;type:decimal(12,2)" json:"eps"`
	ROE              *float64  `gorm:"column:roe;type:decimal(7,2)" json:"roe"`
	ROA              *float64  `gorm:"column:roa;type:decimal(7,2)" json:"roa"`
	DebtToEquity     *float64  `gorm:"type:decimal(7,2)" json:"debt_to_equity"`
	UpdatedAt        time.Time `json:"updated_at"`
	Stock            *Stock    `gorm:"constraint:OnDelete:CASCADE" json:"-"`
}

func (StockFundamental) TableName() string { return "stock_fundamentals" }

func (f *StockFundamental) AfterFind(*gorm.DB) error {
	f.PeriodType = PeriodType(f.Period)

	return nil
}

func PeriodType(period string) string {
	switch {
	case strings.HasSuffix(period, "-FY"):
		return "annual"
	case strings.Contains(period, "-Q"):
		return "quarterly"
	default:
		return ""
	}
}

type Watchlist struct {
	WatchlistID uint      `gorm:"column:watchlist_id;primaryKey" json:"watchlist_id"`
	UserID      uint      `gorm:"not null;uniqueIndex:idx_watchlists_user_stock,priority:1" json:"user_id"`
	StockID     uint      `gorm:"not null;uniqueIndex:idx_watchlists_user_stock,priority:2" json:"stock_id"`
	CreatedAt   time.Time `json:"created_at"`
	User        *User     `json:"-"`
	Stock       *Stock    `gorm:"constraint:OnDelete:CASCADE" json:"stock,omitempty"`
}

func (Watchlist) TableName() string { return "watchlists" }

type AnalysisSession struct {
	SessionID    uint      `gorm:"column:session_id;primaryKey" json:"session_id"`
	UserID       uint      `gorm:"not null;index:idx_sessions_user_stock,priority:1" json:"user_id"`
	StockID      uint      `gorm:"not null;index:idx_sessions_user_stock,priority:2" json:"stock_id"`
	AnalysisType string    `gorm:"size:20;not null" json:"analysis_type"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	User         *User     `json:"-"`
	Stock        *Stock    `gorm:"constraint:OnDelete:CASCADE" json:"-"`
}

func (AnalysisSession) TableName() string { return "analysis_sessions" }

type AiAnalysis struct {
	AiAnalysisID uint             `gorm:"column:ai_analysis_id;primaryKey" json:"ai_analysis_id"`
	SessionID    uint             `gorm:"not null;index" json:"session_id"`
	ModelName    string           `gorm:"size:100;not null" json:"model_name"`
	ContextData  string           `gorm:"type:text" json:"-"`
	Result       string           `gorm:"type:text;not null" json:"result"`
	CreatedAt    time.Time        `json:"created_at"`
	Session      *AnalysisSession `gorm:"constraint:OnDelete:CASCADE" json:"session,omitempty"`
}

func (AiAnalysis) TableName() string { return "ai_analyses" }

type AiMessage struct {
	MessageID uint             `gorm:"column:message_id;primaryKey" json:"message_id"`
	SessionID uint             `gorm:"not null;index:idx_messages_session_created,priority:1" json:"session_id"`
	Role      string           `gorm:"size:20;not null" json:"role"`
	Content   string           `gorm:"type:text;not null" json:"content"`
	CreatedAt time.Time        `gorm:"index:idx_messages_session_created,priority:2" json:"created_at"`
	Session   *AnalysisSession `gorm:"constraint:OnDelete:CASCADE" json:"-"`
}

func (AiMessage) TableName() string { return "ai_messages" }

func All() []any {
	return []any{
		&User{},
		&PersonalAccessToken{},
		&Stock{},
		&StockPrice{},
		&TechnicalIndicator{},
		&News{},
		&StockFundamental{},
		&Watchlist{},
		&AnalysisSession{},
		&AiAnalysis{},
		&AiMessage{},
	}
}
