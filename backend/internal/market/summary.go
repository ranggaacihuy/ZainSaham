package market

import (
	"slices"

	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
)

type Summary struct {
	PriceDate   *models.Date `json:"price_date"`
	OpenPrice   *float64     `json:"open_price"`
	HighPrice   *float64     `json:"high_price"`
	LowPrice    *float64     `json:"low_price"`
	ClosePrice  *float64     `json:"close_price"`
	PrevClose   *float64     `json:"prev_close"`
	ChangeValue *float64     `json:"change_value"`
	ChangePct   *float64     `json:"change_pct"`
	Volume      *int64       `json:"volume"`
	RSI14       *float64     `json:"rsi_14,omitempty"`
	Sparkline   []float64    `json:"sparkline,omitempty"`
}

type SummaryOptions struct {
	Sparkline int
	RSI       bool
	AsOf      *models.Date
}

func (s *Service) Summaries(stockIDs []uint, opts SummaryOptions) (map[uint]*Summary, error) {
	summaries := map[uint]*Summary{}
	if len(stockIDs) == 0 {
		return summaries, nil
	}

	var rows []struct {
		StockID    uint
		PriceDate  models.Date
		OpenPrice  float64
		HighPrice  float64
		LowPrice   float64
		ClosePrice float64
		Volume     int64
	}

	where, args := "stock_id IN ?", []any{stockIDs}
	if opts.AsOf != nil {
		where += " AND price_date <= ?"
		args = append(args, *opts.AsOf)
	}
	args = append(args, max(2, opts.Sparkline))

	err := s.db.Raw(`
		SELECT stock_id, price_date, open_price, high_price, low_price, close_price, volume
		FROM (
			SELECT stock_id, price_date, open_price, high_price, low_price, close_price, volume,
				ROW_NUMBER() OVER (PARTITION BY stock_id ORDER BY price_date DESC) AS row_num
			FROM stock_prices
			WHERE `+where+`
		) ranked
		WHERE row_num <= ?
		ORDER BY stock_id, price_date`, args...).Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	closes := map[uint][]float64{}

	for _, row := range rows {
		closes[row.StockID] = append(closes[row.StockID], row.ClosePrice)

		summary := &Summary{
			PriceDate:  new(row.PriceDate),
			OpenPrice:  new(row.OpenPrice),
			HighPrice:  new(row.HighPrice),
			LowPrice:   new(row.LowPrice),
			ClosePrice: new(row.ClosePrice),
			Volume:     new(row.Volume),
		}

		if previous, ok := summaries[row.StockID]; ok && previous.ClosePrice != nil {
			summary.PrevClose = new(*previous.ClosePrice)
			if *previous.ClosePrice != 0 {
				summary.ChangeValue = new(round2(row.ClosePrice - *previous.ClosePrice))
				summary.ChangePct = new(round2((row.ClosePrice - *previous.ClosePrice) / *previous.ClosePrice * 100))
			}
		}

		summaries[row.StockID] = summary
	}

	if opts.Sparkline > 0 {
		for stockID, summary := range summaries {
			values := closes[stockID]
			summary.Sparkline = slices.Clone(values[max(0, len(values)-opts.Sparkline):])
		}
	}

	if opts.RSI {
		var indicators []struct {
			StockID uint
			RSI14   float64 `gorm:"column:rsi_14"`
		}

		err := s.db.Raw(`
			SELECT stock_id, rsi_14
			FROM (
				SELECT stock_id, rsi_14,
					ROW_NUMBER() OVER (PARTITION BY stock_id ORDER BY indicator_date DESC) AS row_num
				FROM technical_indicators
				WHERE stock_id IN ? AND rsi_14 IS NOT NULL
			) ranked
			WHERE row_num = 1`, stockIDs).Scan(&indicators).Error
		if err != nil {
			return nil, err
		}

		for _, indicator := range indicators {
			if summary, ok := summaries[indicator.StockID]; ok {
				summary.RSI14 = new(indicator.RSI14)
			}
		}
	}

	return summaries, nil
}
