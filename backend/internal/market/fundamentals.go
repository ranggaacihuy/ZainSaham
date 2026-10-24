package market

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/ranggaacihuy/zainsaham/backend/internal/models"
)

var fundamentalFields = []string{
	"TotalRevenue",
	"NetIncome",
	"TotalAssets",
	"TotalLiabilitiesNetMinorityInterest",
	"StockholdersEquity",
	"DilutedEPS",
	"BasicEPS",
}

const ratioLimit = 99999.99

func (y *Yahoo) FetchFundamentals(ctx context.Context, ticker string, now time.Time) ([]models.StockFundamental, error) {
	symbol := y.Symbol(ticker)

	var types []string
	for _, prefix := range []string{"quarterly", "annual"} {
		for _, field := range fundamentalFields {
			types = append(types, prefix+field)
		}
	}

	endpoint := fmt.Sprintf("%s/ws/fundamentals-timeseries/v1/finance/timeseries/%s?%s", y.baseURL, url.PathEscape(symbol), url.Values{
		"symbol":  {symbol},
		"type":    {strings.Join(types, ",")},
		"period1": {strconv.FormatInt(now.AddDate(-5, 0, 0).Unix(), 10)},
		"period2": {strconv.FormatInt(now.Unix(), 10)},
	}.Encode())

	status, raw, err := y.getWithRetry(ctx, endpoint)
	if err != nil {
		return nil, fmt.Errorf("fundamental %s gagal diambil: %w", symbol, err)
	}

	if status >= http.StatusBadRequest {
		return nil, fmt.Errorf("fundamental %s gagal diambil: HTTP %d", symbol, status)
	}

	return parseFundamentals(symbol, raw)
}

func parseFundamentals(symbol string, raw []byte) ([]models.StockFundamental, error) {
	var payload struct {
		Timeseries struct {
			Result []map[string]json.RawMessage `json:"result"`
		} `json:"timeseries"`
	}

	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, fmt.Errorf("fundamental %s gagal dibaca: %w", symbol, err)
	}

	periods := map[string]map[string]float64{}

	for _, result := range payload.Timeseries.Result {
		var meta struct {
			Type []string `json:"type"`
		}
		if err := json.Unmarshal(result["meta"], &meta); err != nil || len(meta.Type) == 0 {
			continue
		}

		seriesType := meta.Type[0]
		prefix, field := splitSeriesType(seriesType)
		if prefix == "" {
			continue
		}

		var points []*struct {
			AsOfDate      string `json:"asOfDate"`
			ReportedValue struct {
				Raw *float64 `json:"raw"`
			} `json:"reportedValue"`
		}
		if err := json.Unmarshal(result[seriesType], &points); err != nil {
			continue
		}

		for _, point := range points {
			if point == nil || point.ReportedValue.Raw == nil {
				continue
			}

			period := periodLabel(prefix, point.AsOfDate)
			if period == "" {
				continue
			}

			if periods[period] == nil {
				periods[period] = map[string]float64{}
			}
			periods[period][field] = *point.ReportedValue.Raw
		}
	}

	rows := make([]models.StockFundamental, 0, len(periods))
	for period, values := range periods {
		if row, ok := buildFundamental(period, values); ok {
			rows = append(rows, row)
		}
	}

	sort.Slice(rows, func(i, j int) bool { return rows[i].Period > rows[j].Period })

	return rows, nil
}

func splitSeriesType(seriesType string) (string, string) {
	for _, prefix := range []string{"quarterly", "annual"} {
		if field, found := strings.CutPrefix(seriesType, prefix); found {
			return prefix, field
		}
	}

	return "", ""
}

func periodLabel(prefix, asOfDate string) string {
	date, err := time.Parse("2006-01-02", asOfDate)
	if err != nil {
		return ""
	}

	if prefix == "annual" {
		return fmt.Sprintf("%d-FY", date.Year())
	}

	return fmt.Sprintf("%d-Q%d", date.Year(), (int(date.Month())-1)/3+1)
}

func buildFundamental(period string, values map[string]float64) (models.StockFundamental, bool) {
	value := func(field string) *float64 {
		if v, ok := values[field]; ok {
			return new(v)
		}

		return nil
	}

	row := models.StockFundamental{
		Period:           period,
		PeriodType:       models.PeriodType(period),
		Revenue:          value("TotalRevenue"),
		NetIncome:        value("NetIncome"),
		TotalAssets:      value("TotalAssets"),
		TotalLiabilities: value("TotalLiabilitiesNetMinorityInterest"),
		TotalEquity:      value("StockholdersEquity"),
		EPS:              value("DilutedEPS"),
	}

	if row.EPS == nil {
		row.EPS = value("BasicEPS")
	}
	if row.EPS != nil {
		row.EPS = new(round2(*row.EPS))
	}

	if row.Revenue == nil && row.NetIncome == nil && row.TotalAssets == nil {
		return row, false
	}

	annualize := 1.0
	if row.PeriodType == "quarterly" {
		annualize = 4
	}

	row.ROE = ratio(row.NetIncome, row.TotalEquity, annualize*100)
	row.ROA = ratio(row.NetIncome, row.TotalAssets, annualize*100)
	row.DebtToEquity = ratio(row.TotalLiabilities, row.TotalEquity, 1)

	return row, true
}

func ratio(numerator, denominator *float64, factor float64) *float64 {
	if numerator == nil || denominator == nil || *denominator == 0 {
		return nil
	}

	value := round2(*numerator / *denominator * factor)
	if math.Abs(value) > ratioLimit {
		return nil
	}

	return new(value)
}
