// 1. users
const activeUser = {
  user_id: "USR-88219",
  username: "hendra_investor",
  email: "hendra.pratama@alphacapital.id",
  password_hash: "$2a$12$e8Y7r6W9d6K0m...[PROTECTED_BCRYPT]",
  created_at: "2024-01-15 08:30:00",
  update_at: "2026-03-10 14:22:15",
  deleted_at: null
};

// 2. stocks
const stocksDatabase = [
  { stock_id: 1, ticker: "BBCA", company_name: "PT Bank Central Asia Tbk", sector: "Financials / Banking", exchange: "IDX", currency: "IDR", created_at: "2022-01-01 00:00:00", updated_at: "2026-10-13 16:00:00" },
  { stock_id: 2, ticker: "BBRI", company_name: "PT Bank Rakyat Indonesia Tbk", sector: "Financials / Banking", exchange: "IDX", currency: "IDR", created_at: "2022-01-01 00:00:00", updated_at: "2026-10-13 16:00:00" },
  { stock_id: 3, ticker: "BMRI", company_name: "PT Bank Mandiri (Persero) Tbk", sector: "Financials / Banking", exchange: "IDX", currency: "IDR", created_at: "2022-01-01 00:00:00", updated_at: "2026-10-13 16:00:00" },
  { stock_id: 4, ticker: "TLKM", company_name: "PT Telkom Indonesia Tbk", sector: "Infrastructure / Telecommunication", exchange: "IDX", currency: "IDR", created_at: "2022-01-01 00:00:00", updated_at: "2026-10-13 16:00:00" },
  { stock_id: 5, ticker: "ASII", company_name: "PT Astra International Tbk", sector: "Consumer Discretionary / Conglomerate", exchange: "IDX", currency: "IDR", created_at: "2022-01-01 00:00:00", updated_at: "2026-10-13 16:00:00" }
];

// 3. watchlists
let watchlistsDatabase = [
  { watchlist_id: 101, user_id: "USR-88219", stock_id: 1, created_at: "2026-08-01 10:15:00" },
  { watchlist_id: 102, user_id: "USR-88219", stock_id: 2, created_at: "2026-08-15 14:20:00" },
  { watchlist_id: 103, user_id: "USR-88219", stock_id: 4, created_at: "2026-09-02 09:10:00" }
];

// 4. stock_prices
const stockPricesDatabase = {};

function generatePriceHistory(stockId, basePrice, volatility, trendFactor) {
  const records = [];
  let current = basePrice;
  const today = new Date("2026-10-13");

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    const change = (Math.random() - 0.48 + trendFactor) * volatility;
    const open = Math.round(current);
    const close = Math.round(current + change);
    const high = Math.round(Math.max(open, close) + Math.random() * (volatility * 0.7));
    const low = Math.round(Math.min(open, close) - Math.random() * (volatility * 0.7));
    const volume = Math.round(35000000 + Math.random() * 95000000);

    records.push({
      price_id: `${stockId}-${30 - i}`,
      stock_id: stockId,
      price_date: dateStr,
      open_price: open,
      high_price: high,
      low_price: low,
      close_price: close,
      volume: volume,
      created_at: `${dateStr} 16:15:00`
    });
    current = close;
  }
  return records;
}

stockPricesDatabase[1] = generatePriceHistory(1, 9850, 150, 0.05);
stockPricesDatabase[2] = generatePriceHistory(2, 4920, 90, -0.02);
stockPricesDatabase[3] = generatePriceHistory(3, 6750, 110, 0.03);
stockPricesDatabase[4] = generatePriceHistory(4, 2890, 50, -0.01);
stockPricesDatabase[5] = generatePriceHistory(5, 5100, 80, 0.02);

// 5. technical_indicators
const technicalIndicatorsDatabase = {
  1: { indicator_id: 501, stock_id: 1, indicator_date: "2026-10-13", rsi_14: 64.50, macd: 14.20, macd_signal: 10.85, sma_20: 10080, sma_50: 9850, created_at: "2026-10-13 16:05:00" },
  2: { indicator_id: 502, stock_id: 2, indicator_date: "2026-10-13", rsi_14: 38.20, macd: -8.40, macd_signal: -4.10, sma_20: 4890, sma_50: 5120, created_at: "2026-10-13 16:05:00" },
  3: { indicator_id: 503, stock_id: 3, indicator_date: "2026-10-13", rsi_14: 58.90, macd: 9.75, macd_signal: 7.20, sma_20: 6810, sma_50: 6640, created_at: "2026-10-13 16:05:00" },
  4: { indicator_id: 504, stock_id: 4, indicator_date: "2026-10-13", rsi_14: 42.10, macd: -3.15, macd_signal: -1.90, sma_20: 2920, sma_50: 3010, created_at: "2026-10-13 16:05:00" },
  5: { indicator_id: 505, stock_id: 5, indicator_date: "2026-10-13", rsi_14: 52.80, macd: 2.40, macd_signal: 1.80, sma_20: 5150, sma_50: 5090, created_at: "2026-10-13 16:05:00" }
};

// 6. stock_fundamentals
const stockFundamentalsDatabase = {
  1: { fundamental_id: 301, stock_id: 1, period: "FY 2025", revenue: 102500000000000, net_income: 48600000000000, total_assets: 1408000000000000, total_liabilities: 1164000000000000, total_equity: 244000000000000, eps: 394, roe: 21.80, roa: 3.45, debt_to_equity: 4.77, updated_at: "2026-09-30 20:00:00" },
  2: { fundamental_id: 302, stock_id: 2, period: "FY 2025", revenue: 182300000000000, net_income: 60400000000000, total_assets: 1965000000000000, total_liabilities: 1650000000000000, total_equity: 315000000000000, eps: 398, roe: 19.17, roa: 3.07, debt_to_equity: 5.23, updated_at: "2026-09-30 20:00:00" },
  3: { fundamental_id: 303, stock_id: 3, period: "FY 2025", revenue: 145000000000000, net_income: 55000000000000, total_assets: 2174000000000000, total_liabilities: 1880000000000000, total_equity: 294000000000000, eps: 589, roe: 18.70, roa: 2.53, debt_to_equity: 6.39, updated_at: "2026-09-30 20:00:00" },
  4: { fundamental_id: 304, stock_id: 4, period: "FY 2025", revenue: 149200000000000, net_income: 24500000000000, total_assets: 287000000000000, total_liabilities: 130000000000000, total_equity: 157000000000000, eps: 247, roe: 15.60, roa: 8.53, debt_to_equity: 0.83, updated_at: "2026-09-30 20:00:00" },
  5: { fundamental_id: 305, stock_id: 5, period: "FY 2025", revenue: 316500000000000, net_income: 33800000000000, total_assets: 443000000000000, total_liabilities: 204000000000000, total_equity: 239000000000000, eps: 835, roe: 14.14, roa: 7.63, debt_to_equity: 0.85, updated_at: "2026-09-30 20:00:00" }
};

// 7. news
const newsDatabase = [
  { news_id: 701, stock_id: 1, title: "Pertumbuhan Kredit BBCA Ditopang Segmen Korporasi & Konsumer", content: "BCA membukukan ekspansi penyaluran kredit konsisten dengan rasio kredit macet (NPL) terkendali di 1.8%. Portofolio dana murah CASA terjaga kuat.", source: "Bisnis Indonesia", source_url: "https://example.com/news/bbca-kredit", published_at: "2026-10-12 14:30:00", created_at: "2026-10-12 14:35:00", updated_at: "2026-10-12 14:35:00" },
  { news_id: 702, stock_id: 1, title: "Transformasi Digital myBCA Pacu Transaksi Harian Ritel", content: "Pertumbuhan transaksi digital perseroan melonjak 27% secara tahunan, menjaga efisiensi rasio beban operasional terhadap pendapatan (BOPO).", source: "Kontan Finansial", source_url: "https://example.com/news/bbca-digital", published_at: "2026-10-10 09:15:00", created_at: "2026-10-10 09:20:00", updated_at: "2026-10-10 09:20:00" },
  { news_id: 703, stock_id: 2, title: "Penyaluran Kredit Mikro Kupedes BRI Tembus Target Semester II", content: "PT Bank Rakyat Indonesia Tbk terus memperkuat mitigasi risiko dan provisi cadangan pencadangan segmen UMKM.", source: "CNBC Indonesia", source_url: "https://example.com/news/bbri-kupedes", published_at: "2026-10-11 11:00:00", created_at: "2026-10-11 11:05:00", updated_at: "2026-10-11 11:05:00" },
  { news_id: 704, stock_id: 3, title: "Bank Mandiri Raih Lonjakan Dana Pihak Ketiga Melalui Livin'", content: "Ekosistem Livin' by Mandiri berkontribusi signifikan pada serapan CASA hingga menyentuh 79% dari total likuiditas perseroan.", source: "Investor Daily", source_url: "https://example.com/news/bmri-livin", published_at: "2026-10-13 08:20:00", created_at: "2026-10-13 08:25:00", updated_at: "2026-10-13 08:25:00" },
  { news_id: 705, stock_id: 4, title: "Telkom Akselerasi Ekspansi Data Center Hyperscale Regional", content: "TLKM memacu pengembangan fiber optic dan pusat data untuk melayani lonjakan kebutuhan cloud enterprise di Asia Tenggara.", source: "Tech Review ID", source_url: "https://example.com/news/tlkm-datacenter", published_at: "2026-10-09 16:45:00", created_at: "2026-10-09 17:00:00", updated_at: "2026-10-09 17:00:00" },
  { news_id: 706, stock_id: 5, title: "Astra (ASII) Bukukan Kenaikan Penjualan Mobil Hybrid di Kuartal III", content: "Permintaan kendaraan ramah lingkungan serta kontribusi United Tractors mendukung stabilitas pendapatan grup konglomerasi.", source: "Oto Market ID", source_url: "https://example.com/news/asii-hybrid", published_at: "2026-10-08 13:10:00", created_at: "2026-10-08 13:15:00", updated_at: "2026-10-08 13:15:00" }
];

// 8 & 9. analysis_sessions & ai_analyses
let analysisSessionsDatabase = [
  { session_id: "SES-9001", user_id: "USR-88219", stock_id: 1, analysis_type: "Comprehensive", created_at: "2026-10-13 14:00:00", updated_at: "2026-10-13 14:01:10" }
];

let aiAnalysesDatabase = [
  {
    ai_analysis_id: "AI-1001",
    session_id: "SES-9001",
    model_name: "FinBERT-v2",
    context_data: JSON.stringify({ ticker: "BBCA", price: 10250, rsi_14: 64.50, macd: 14.20, sma_20: 10080, sma_50: 9850, roe: 21.80, der: 4.77, net_income: "48.60 T" }, null, 2),
    result: "Emiten memperlihatkan struktur tren bullish yang stabil. RSI (64.50) mencerminkan dominasi tekanan beli yang sehat tanpa kondisi overbought ekstrem. Secara fundamental, ROE 21.8% dan marjin profitabilitas mengukuhkan kualitas neraca perbankan tier-1.",
    created_at: "2026-10-13 14:01:10"
  }
];