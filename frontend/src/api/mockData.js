// Indonesian Stock Exchange (IDX) Dataset according to ZainSaham SKPL & DPPL

// Helper to generate realistic daily candlestick history
function generatePrices(basePrice, count, volatility = 0.02, trend = 0.0005) {
  const prices = [];
  let currentClose = basePrice;
  const now = new Date();

  // Generate historical dates backwards, skipping weekends
  const dates = [];
  let dayOffset = 0;
  while (dates.length < count) {
    const d = new Date(now);
    d.setDate(d.getDate() - dayOffset);
    const dayOfWeek = d.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // not Sunday/Saturday
      dates.unshift(d.toISOString().split('T')[0]);
    }
    dayOffset++;
  }

  for (let i = 0; i < count; i++) {
    const dateStr = dates[i];
    const changePct = (Math.random() - 0.48) * volatility + trend;
    const open = Math.round(currentClose * (1 + (Math.random() - 0.5) * 0.008));
    const close = Math.max(50, Math.round(open * (1 + changePct)));
    const high = Math.round(Math.max(open, close) * (1 + Math.random() * 0.012));
    const low = Math.round(Math.min(open, close) * (1 - Math.random() * 0.012));
    const volume = Math.floor(Math.random() * 45000000 + 5000000);

    prices.push({
      price_id: i + 1,
      price_date: dateStr,
      open_price: open,
      high_price: high,
      low_price: low,
      close_price: close,
      volume: volume,
    });

    currentClose = close;
  }
  return prices;
}

// Generate technical indicators based on prices
function calculateIndicators(prices) {
  return prices.map((p, idx) => {
    // SMA 20
    let sma20 = null;
    if (idx >= 19) {
      const slice20 = prices.slice(idx - 19, idx + 1);
      sma20 = Math.round(slice20.reduce((acc, curr) => acc + curr.close_price, 0) / 20);
    }

    // SMA 50
    let sma50 = null;
    if (idx >= 49) {
      const slice50 = prices.slice(idx - 49, idx + 1);
      sma50 = Math.round(slice50.reduce((acc, curr) => acc + curr.close_price, 0) / 50);
    }

    // Simulated RSI between 30 and 75
    const rsi = +(45 + Math.sin(idx * 0.2) * 18 + (Math.random() * 8 - 4)).toFixed(2);
    // Simulated MACD and signal
    const macd = +(Math.sin(idx * 0.15) * 35 + 12).toFixed(2);
    const macd_signal = +(Math.sin((idx - 3) * 0.15) * 32 + 10).toFixed(2);

    return {
      indicator_id: idx + 1,
      indicator_date: p.price_date,
      rsi_14: Math.min(95, Math.max(15, rsi)),
      macd: macd,
      macd_signal: macd_signal,
      sma_20: sma20,
      sma_50: sma50,
    };
  });
}

// Pre-generated realistic stock master data
export const INITIAL_STOCKS = [
  {
    stock_id: 1,
    ticker: 'BBCA',
    company_name: 'Bank Central Asia Tbk.',
    sector: 'Keuangan',
    exchange: 'IDX',
    currency: 'IDR',
    basePrice: 9150,
    volatility: 0.015,
    trend: 0.0006,
  },
  {
    stock_id: 2,
    ticker: 'BBRI',
    company_name: 'Bank Rakyat Indonesia (Persero) Tbk.',
    sector: 'Keuangan',
    exchange: 'IDX',
    currency: 'IDR',
    basePrice: 4320,
    volatility: 0.02,
    trend: -0.0002,
  },
  {
    stock_id: 3,
    ticker: 'BMRI',
    company_name: 'Bank Mandiri (Persero) Tbk.',
    sector: 'Keuangan',
    exchange: 'IDX',
    currency: 'IDR',
    basePrice: 6450,
    volatility: 0.018,
    trend: 0.0004,
  },
  {
    stock_id: 4,
    ticker: 'TLKM',
    company_name: 'Telkom Indonesia (Persero) Tbk.',
    sector: 'Infrastruktur',
    exchange: 'IDX',
    currency: 'IDR',
    basePrice: 2980,
    volatility: 0.022,
    trend: 0.0003,
  },
  {
    stock_id: 5,
    ticker: 'ASII',
    company_name: 'Astra International Tbk.',
    sector: 'Perindustrian',
    exchange: 'IDX',
    currency: 'IDR',
    basePrice: 5075,
    volatility: 0.019,
    trend: -0.0004,
  },
  {
    stock_id: 6,
    ticker: 'ANTM',
    company_name: 'Aneka Tambang Tbk.',
    sector: 'Material Dasar',
    exchange: 'IDX',
    currency: 'IDR',
    basePrice: 1865,
    volatility: 0.035,
    trend: 0.0012,
  },
  {
    stock_id: 7,
    ticker: 'MDKA',
    company_name: 'Merdeka Copper Gold Tbk.',
    sector: 'Material Dasar',
    exchange: 'IDX',
    currency: 'IDR',
    basePrice: 2410,
    volatility: 0.032,
    trend: 0.0009,
  },
  {
    stock_id: 8,
    ticker: 'INCO',
    company_name: 'Vale Indonesia Tbk.',
    sector: 'Material Dasar',
    exchange: 'IDX',
    currency: 'IDR',
    basePrice: 3920,
    volatility: 0.028,
    trend: 0.0007,
  },
  {
    stock_id: 9,
    ticker: 'GOTO',
    company_name: 'GoTo Gojek Tokopedia Tbk.',
    sector: 'Teknologi',
    exchange: 'IDX',
    currency: 'IDR',
    basePrice: 68,
    volatility: 0.045,
    trend: -0.001,
  },
  {
    stock_id: 10,
    ticker: 'BUKA',
    company_name: 'Bukalapak.com Tbk.',
    sector: 'Teknologi',
    exchange: 'IDX',
    currency: 'IDR',
    basePrice: 142,
    volatility: 0.04,
    trend: -0.0008,
  },
  {
    stock_id: 11,
    ticker: 'EMTK',
    company_name: 'Elang Mahkota Teknologi Tbk.',
    sector: 'Teknologi',
    exchange: 'IDX',
    currency: 'IDR',
    basePrice: 505,
    volatility: 0.03,
    trend: -0.0005,
  },
  {
    stock_id: 12,
    ticker: 'ICBP',
    company_name: 'Indofood CBP Sukses Makmur Tbk.',
    sector: 'Konsumer Primer',
    exchange: 'IDX',
    currency: 'IDR',
    basePrice: 11200,
    volatility: 0.016,
    trend: 0.0005,
  },
  {
    stock_id: 13,
    ticker: 'ADRO',
    company_name: 'Adaro Energy Indonesia Tbk.',
    sector: 'Energi',
    exchange: 'IDX',
    currency: 'IDR',
    basePrice: 3650,
    volatility: 0.025,
    trend: 0.0008,
  },
  {
    stock_id: 14,
    ticker: 'KLBF',
    company_name: 'Kalbe Farma Tbk.',
    sector: 'Kesehatan',
    exchange: 'IDX',
    currency: 'IDR',
    basePrice: 1680,
    volatility: 0.018,
    trend: 0.0002,
  },
];

// Generate prices & indicators data for each stock
export const STOCK_DATA = {};
INITIAL_STOCKS.forEach((stock) => {
  const prices = generatePrices(stock.basePrice, 120, stock.volatility, stock.trend);
  const indicators = calculateIndicators(prices);
  STOCK_DATA[stock.ticker] = {
    ...stock,
    prices,
    indicators,
    latestPrice: prices[prices.length - 1],
    prevPrice: prices[prices.length - 2],
  };
});

// Fundamentals data for stocks
export const STOCK_FUNDAMENTALS = {
  BBCA: {
    quarterly: [
      { period: '2026-Q2', revenue: 26100000000000, net_income: 14200000000000, eps: 383, roe: 22.8, roa: 3.7, debt_to_equity: 0.19, total_assets: 1450000000000000, total_liabilities: 1210000000000000, total_equity: 240000000000000 },
      { period: '2026-Q1', revenue: 25400000000000, net_income: 13800000000000, eps: 373, roe: 22.4, roa: 3.6, debt_to_equity: 0.20, total_assets: 1430000000000000, total_liabilities: 1195000000000000, total_equity: 235000000000000 },
      { period: '2025-Q4', revenue: 26900000000000, net_income: 14900000000000, eps: 402, roe: 23.1, roa: 3.8, debt_to_equity: 0.19, total_assets: 1400000000000000, total_liabilities: 1172000000000000, total_equity: 228000000000000 },
      { period: '2025-Q3', revenue: 25000000000000, net_income: 13600000000000, eps: 367, roe: 22.0, roa: 3.6, debt_to_equity: 0.21, total_assets: 1380000000000000, total_liabilities: 1157000000000000, total_equity: 223000000000000 },
      { period: '2025-Q2', revenue: 24200000000000, net_income: 13000000000000, eps: 351, roe: 21.5, roa: 3.5, debt_to_equity: 0.22, total_assets: 1350000000000000, total_liabilities: 1133000000000000, total_equity: 217000000000000 },
      { period: '2025-Q1', revenue: 23800000000000, net_income: 12800000000000, eps: 345, roe: 21.2, roa: 3.4, debt_to_equity: 0.22, total_assets: 1330000000000000, total_liabilities: 1117000000000000, total_equity: 213000000000000 },
      { period: '2024-Q4', revenue: 25100000000000, net_income: 13500000000000, eps: 364, roe: 21.9, roa: 3.5, debt_to_equity: 0.21, total_assets: 1308000000000000, total_liabilities: 1100000000000000, total_equity: 208000000000000 },
      { period: '2024-Q3', revenue: 23400000000000, net_income: 12200000000000, eps: 329, roe: 20.8, roa: 3.4, debt_to_equity: 0.23, total_assets: 1280000000000000, total_liabilities: 1078000000000000, total_equity: 202000000000000 },
    ],
    annual: [
      { period: '2025-FY', revenue: 99900000000000, net_income: 54300000000000, eps: 1465, roe: 23.8, roa: 3.8, debt_to_equity: 0.19, total_assets: 1400000000000000, total_liabilities: 1172000000000000, total_equity: 228000000000000 },
      { period: '2024-FY', revenue: 91200000000000, net_income: 48600000000000, eps: 1311, roe: 23.4, roa: 3.7, debt_to_equity: 0.21, total_assets: 1308000000000000, total_liabilities: 1100000000000000, total_equity: 208000000000000 },
      { period: '2023-FY', revenue: 83500000000000, net_income: 40700000000000, eps: 1098, roe: 21.7, roa: 3.4, debt_to_equity: 0.24, total_assets: 1220000000000000, total_liabilities: 1032000000000000, total_equity: 188000000000000 },
      { period: '2022-FY', revenue: 74200000000000, net_income: 36400000000000, eps: 982, roe: 20.1, roa: 3.2, debt_to_equity: 0.25, total_assets: 1150000000000000, total_liabilities: 974000000000000, total_equity: 176000000000000 },
    ],
  },
  BBRI: {
    quarterly: [
      { period: '2026-Q2', revenue: 48200000000000, net_income: 15400000000000, eps: 101, roe: 18.5, roa: 2.8, debt_to_equity: 0.45, total_assets: 1980000000000000, total_liabilities: 1650000000000000, total_equity: 330000000000000 },
      { period: '2026-Q1', revenue: 47100000000000, net_income: 14800000000000, eps: 97, roe: 18.1, roa: 2.7, debt_to_equity: 0.46, total_assets: 1950000000000000, total_liabilities: 1625000000000000, total_equity: 325000000000000 },
      { period: '2025-Q4', revenue: 49500000000000, net_income: 16100000000000, eps: 106, roe: 19.2, roa: 2.9, debt_to_equity: 0.44, total_assets: 1920000000000000, total_liabilities: 1600000000000000, total_equity: 320000000000000 },
      { period: '2025-Q3', revenue: 46800000000000, net_income: 14500000000000, eps: 95, roe: 17.8, roa: 2.6, debt_to_equity: 0.48, total_assets: 1890000000000000, total_liabilities: 1575000000000000, total_equity: 315000000000000 },
    ],
    annual: [
      { period: '2025-FY', revenue: 189000000000000, net_income: 60400000000000, eps: 398, roe: 19.5, roa: 2.9, debt_to_equity: 0.44, total_assets: 1920000000000000, total_liabilities: 1600000000000000, total_equity: 320000000000000 },
      { period: '2024-FY', revenue: 174000000000000, net_income: 54200000000000, eps: 357, roe: 18.9, roa: 2.8, debt_to_equity: 0.47, total_assets: 1820000000000000, total_liabilities: 1520000000000000, total_equity: 300000000000000 },
    ],
  },
  TLKM: {
    quarterly: [
      { period: '2026-Q2', revenue: 38500000000000, net_income: 6400000000000, eps: 65, roe: 16.2, roa: 8.5, debt_to_equity: 0.85, total_assets: 310000000000000, total_liabilities: 145000000000000, total_equity: 165000000000000 },
      { period: '2026-Q1', revenue: 37800000000000, net_income: 6150000000000, eps: 62, roe: 15.8, roa: 8.3, debt_to_equity: 0.87, total_assets: 305000000000000, total_liabilities: 143000000000000, total_equity: 162000000000000 },
      { period: '2025-Q4', revenue: 39100000000000, net_income: 6800000000000, eps: 69, roe: 17.1, roa: 8.9, debt_to_equity: 0.84, total_assets: 302000000000000, total_liabilities: 142000000000000, total_equity: 160000000000000 },
      { period: '2025-Q3', revenue: 37200000000000, net_income: 5900000000000, eps: 60, roe: 15.2, roa: 8.0, debt_to_equity: 0.89, total_assets: 298000000000000, total_liabilities: 140000000000000, total_equity: 158000000000000 },
    ],
    annual: [
      { period: '2025-FY', revenue: 152000000000000, net_income: 25100000000000, eps: 253, roe: 16.5, roa: 8.6, debt_to_equity: 0.84, total_assets: 302000000000000, total_liabilities: 142000000000000, total_equity: 160000000000000 },
      { period: '2024-FY', revenue: 147000000000000, net_income: 24200000000000, eps: 244, roe: 16.8, roa: 8.8, debt_to_equity: 0.82, total_assets: 290000000000000, total_liabilities: 135000000000000, total_equity: 155000000000000 },
    ],
  },
};

// Default fallback generator for stocks without specific custom fundamental data
export function getStockFundamentals(ticker, type = 'quarterly') {
  if (STOCK_FUNDAMENTALS[ticker]) {
    return STOCK_FUNDAMENTALS[ticker][type] || STOCK_FUNDAMENTALS[ticker].quarterly;
  }
  // Generic fallback based on stock price
  const stock = INITIAL_STOCKS.find((s) => s.ticker === ticker) || INITIAL_STOCKS[0];
  const factor = (stock.basePrice / 1000) * 2;
  if (type === 'annual') {
    return [
      { period: '2025-FY', revenue: +(factor * 12e12).toFixed(0), net_income: +(factor * 2.2e12).toFixed(0), eps: +(factor * 120).toFixed(0), roe: 17.5, roa: 6.8, debt_to_equity: 0.65, total_assets: +(factor * 45e12).toFixed(0), total_liabilities: +(factor * 18e12).toFixed(0), total_equity: +(factor * 27e12).toFixed(0) },
      { period: '2024-FY', revenue: +(factor * 10.8e12).toFixed(0), net_income: +(factor * 1.9e12).toFixed(0), eps: +(factor * 105).toFixed(0), roe: 16.2, roa: 6.4, debt_to_equity: 0.68, total_assets: +(factor * 40e12).toFixed(0), total_liabilities: +(factor * 16e12).toFixed(0), total_equity: +(factor * 24e12).toFixed(0) },
    ];
  }
  return [
    { period: '2026-Q2', revenue: +(factor * 3.2e12).toFixed(0), net_income: +(factor * 0.62e12).toFixed(0), eps: +(factor * 32).toFixed(0), roe: 18.2, roa: 7.1, debt_to_equity: 0.62, total_assets: +(factor * 46e12).toFixed(0), total_liabilities: +(factor * 18.5e12).toFixed(0), total_equity: +(factor * 27.5e12).toFixed(0) },
    { period: '2026-Q1', revenue: +(factor * 3.0e12).toFixed(0), net_income: +(factor * 0.58e12).toFixed(0), eps: +(factor * 30).toFixed(0), roe: 17.6, roa: 6.9, debt_to_equity: 0.64, total_assets: +(factor * 45e12).toFixed(0), total_liabilities: +(factor * 18e12).toFixed(0), total_equity: +(factor * 27e12).toFixed(0) },
    { period: '2025-Q4', revenue: +(factor * 3.4e12).toFixed(0), net_income: +(factor * 0.68e12).toFixed(0), eps: +(factor * 35).toFixed(0), roe: 18.9, roa: 7.4, debt_to_equity: 0.60, total_assets: +(factor * 44e12).toFixed(0), total_liabilities: +(factor * 17.5e12).toFixed(0), total_equity: +(factor * 26.5e12).toFixed(0) },
    { period: '2025-Q3', revenue: +(factor * 2.9e12).toFixed(0), net_income: +(factor * 0.52e12).toFixed(0), eps: +(factor * 28).toFixed(0), roe: 16.5, roa: 6.5, debt_to_equity: 0.67, total_assets: +(factor * 42e12).toFixed(0), total_liabilities: +(factor * 17e12).toFixed(0), total_equity: +(factor * 25e12).toFixed(0) },
  ];
}

// News dataset
export const STOCK_NEWS = [
  {
    news_id: 1,
    stock_id: 1,
    ticker: 'BBCA',
    title: 'Laba bersih BBCA tembus rekor baru pada kuartal berjalan',
    source: 'Bisnis.com',
    source_url: 'https://market.bisnis.com/read/20261010/bbca-laba-bersih-rekor',
    published_at: '2026-10-10 14:30:00',
    content: 'PT Bank Central Asia Tbk. (BBCA) mencatatkan pertumbuhan laba bersih dua digit didorong oleh pendapatan bunga bersih yang kokoh dan perbaikan efisiensi operasional. Rasio CASA terjaga kuat di level lebih dari 80%, memberikan bantalan margin bunga bersih (NIM) yang stabil di tengah dinamika suku bunga acuan BI.',
  },
  {
    news_id: 2,
    stock_id: 1,
    ticker: 'BBCA',
    title: 'BBCA umumkan rencana dividen interim tunai untuk pemegang saham',
    source: 'Kontan',
    source_url: 'https://investasi.kontan.co.id/news/bbca-dividen-interim-2026',
    published_at: '2026-10-08 09:15:00',
    content: 'Manajemen PT Bank Central Asia Tbk memutuskan untuk membagikan dividen interim tunai kepada pemegang saham yang terdaftar. Pembayaran dividen ini mencerminkan komitmen perseroan dalam memberikan imbal hasil optimal yang konsisten seiring dengan likuiditas yang melimpah.',
  },
  {
    news_id: 3,
    stock_id: 2,
    ticker: 'BBRI',
    title: 'BBRI salurkan kredit UMKM tembus Rp 1.100 Triliun dengan NPL terjaga',
    source: 'CNBC Indonesia',
    source_url: 'https://www.cnbcindonesia.com/market/bbri-kredit-umkm-tumbuh',
    published_at: '2026-10-09 11:45:00',
    content: 'PT Bank Rakyat Indonesia (Persero) Tbk (BBRI) terus memperkuat penetrasi di segmen pembiayaan mikro dan ultra mikro melalui holding UMi. Restrukturisasi kredit pascapandemi menunjukkan pemulihan signifikan dengan coverage ratio pencadangan yang memadai di atas 200%.',
  },
  {
    news_id: 4,
    stock_id: 4,
    ticker: 'TLKM',
    title: 'Telkom siapkan belanja modal Rp 28 T untuk ekspansi pusat data dan serat optik',
    source: 'Investor Daily',
    source_url: 'https://investortrust.id/tlkm-capex-data-center',
    published_at: '2026-10-07 16:20:00',
    content: 'PT Telkom Indonesia (Persero) Tbk (TLKM) menegaskan fokus bisnis pada layanan B2B dan ekspansi hyperscale data center lewat NeutraDC. Langkah konsolidasi aset infrastruktur serat optik dan menara terus dijalankan guna membuka potensi monetisasi nilai perusahaan (unlock value).',
  },
  {
    news_id: 5,
    stock_id: 5,
    ticker: 'ASII',
    title: 'Astra catat peningkatan pangsa pasar otomotif dan diversifikasi energi hijau',
    source: 'Bloomberg Technoz',
    source_url: 'https://bloombergtechnoz.com/asii-market-share-otomotif',
    published_at: '2026-10-06 13:00:00',
    content: 'PT Astra International Tbk (ASII) mempertahankan pangsa pasar roda empat domestik di level 54%. Perseroan juga gencar mempercepat diversifikasi portofolio melalui anak usahanya di bidang pertambangan mineral non-batubara serta energi terbarukan.',
  },
  {
    news_id: 6,
    stock_id: 6,
    ticker: 'ANTM',
    title: 'Penjualan emas dan bijih nikel ANTM melonjak di tengah kenaikan harga komoditas global',
    source: 'Kontan',
    source_url: 'https://industri.kontan.co.id/news/antm-kinerja-emas-nikel',
    published_at: '2026-10-09 08:30:00',
    content: 'PT Aneka Tambang Tbk (ANTM) mencatatkan volume penjualan logam mulia yang melonjak tajam seiring meningkatnya permintaan lindung nilai investasi emas. Selain itu, proyek hilirisasi ekosistem baterai kendaraan listrik perseroan menunjukkan perkembangan positif.',
  },
  {
    news_id: 7,
    stock_id: 9,
    ticker: 'GOTO',
    title: 'GoTo bukukan adjusted EBITDA positif dan optimalkan efisiensi logistik terintegrasi',
    source: 'Bisnis.com',
    source_url: 'https://market.bisnis.com/read/20261005/goto-ebitda-positif',
    published_at: '2026-10-05 17:10:00',
    content: 'PT GoTo Gojek Tokopedia Tbk (GOTO) membukukan perbaikan margin kontribusi pada segmen On-Demand Services dan Financial Technology. Kolaborasi strategis bersama mitra e-commerce mempercepat penetrasi layanan pinjaman digital GoTo Financial.',
  },
];

// Pre-seeded AI Analysis Sessions & Analyses according to DPPL
export const INITIAL_AI_SESSIONS = [
  {
    session_id: 1,
    user_id: 1,
    stock_id: 1,
    ticker: 'BBCA',
    analysis_type: 'menyeluruh',
    created_at: '2026-10-06 19:20:00',
    analyses: [
      {
        ai_analysis_id: 1,
        session_id: 1,
        version: 1,
        model_name: 'gemini-1.5-pro (Laravel AI SDK)',
        created_at: '2026-10-06 19:20:00',
        result: {
          ringkasan: 'BBCA menunjukkan tren penguatan solid jangka menengah dengan konsolidasi sehat di area support Rp 9.000. Fundamental perbankan tetap menjadi yang terkuat di industri dengan ROE konsisten di atas 22% dan rasio CASA dominan.',
          poin_positif: [
            'Rasio ROE stabil di kisaran 22-23% dalam 4 kuartal berturut-turut, menunjukkan efisiensi modal istimewa.',
            'MACD berada di atas garis signal yang mengindikasikan momentum bullish masih terjaga.',
            'Kualitas aset unggul dengan NPL gross di bawah 2%, jauh di bawah rata-rata industri perbankan.',
            'Katalis positif pembagian dividen interim memperkuat minat beli investor institusi maupun ritel.',
          ],
          risiko: [
            'Valuasi PBV saat ini berada di atas rata-rata historis 5 tahun (menuntut pertumbuhan laba tetap tinggi).',
            'Volume transaksi harian cenderung menyempit di sekitar level all-time high, membutuhkan konfirmasi breakout.',
            'Dinamika suku bunga global yang berpotensi memengaruhi likuiditas aliran modal asing.',
          ],
          kesimpulan: 'Secara menyeluruh, BBCA berada dalam kondisi prima dengan profil defensif tinggi. Cocok dipantau pada area pengujian resistance berikutnya tanpa mengabaikan batas toleransi risiko.',
        },
      },
    ],
  },
  {
    session_id: 2,
    user_id: 1,
    stock_id: 4,
    ticker: 'TLKM',
    analysis_type: 'teknikal',
    created_at: '2026-10-04 09:02:00',
    analyses: [
      {
        ai_analysis_id: 2,
        session_id: 2,
        version: 1,
        model_name: 'gpt-4o (Laravel AI SDK)',
        created_at: '2026-10-04 09:02:00',
        result: {
          ringkasan: 'TLKM sedang menguji level resistance psikologis Rp 3.000 setelah berhasil bertahan di atas garis Simple Moving Average (SMA 20). Indikator RSI 14 berada di posisi netral-bullish.',
          poin_positif: [
            'Harga penutupan berhasil menembus ke atas SMA 20 dan mulai mendekati SMA 50.',
            'RSI 14 mencetak angka 51.2, keluar dari zona jenuh jual (oversold) beberapa pekan lalu.',
            'Terbentuk formasi candle reversal double bottom di rentang harga Rp 2.850 - Rp 2.900.',
          ],
          risiko: [
            'Tekanan jual asing masih terlihat sesekali pada pasar reguler.',
            'Resistensi kuat di level Rp 3.050 - Rp 3.100 berpotensi memicu aksi ambil untung cepat.',
          ],
          kesimpulan: 'Secara teknikal sinyal pembalikan arah mulai terbentuk, konfirmasi penutupan harian di atas Rp 3.000 akan memperkuat kelanjutan tren naik.',
        },
      },
    ],
  },
  {
    session_id: 3,
    user_id: 1,
    stock_id: 5,
    ticker: 'ASII',
    analysis_type: 'fundamental',
    created_at: '2026-10-01 19:40:00',
    analyses: [
      {
        ai_analysis_id: 3,
        session_id: 3,
        version: 1,
        model_name: 'claude-3-5-sonnet (Laravel AI SDK)',
        created_at: '2026-10-01 19:40:00',
        result: {
          ringkasan: 'ASII mencatat pemulihan bertahap pada pendapatan konsolidasi dengan dukungan divisi alat berat dan jasa keuangan. Neraca keuangan sangat sehat dengan kas internal yang melimpah.',
          poin_positif: [
            'Debt-to-Equity Ratio (DER) sangat terkendali, memberikan fleksibilitas ekspansi bisnis tinggi.',
            'Valuasi PER berada di bawah 8x, menawarkan margin of safety yang menarik bagi investor jangka panjang.',
            'Diversifikasi agresif ke sektor nikel dan energi baru terbarukan mengurangi ketergantungan pada otomotif konvensional.',
          ],
          risiko: [
            'Kompetisi kendaraan listrik impor dengan harga agresif berpotensi menekan margin pangsa pasar.',
            'Daya beli kelas menengah domestik yang masih dalam fase pemulihan bertahap.',
          ],
          kesimpulan: 'Fundamental ASII solid dengan neraca kuat dan dividen yield tinggi, menarik bagi strategi value investing jangka panjang.',
        },
      },
    ],
  },
];
