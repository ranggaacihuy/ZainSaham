import api from './client';
import {
  INITIAL_STOCKS,
  STOCK_DATA,
  getStockFundamentals,
  STOCK_NEWS,
} from './mockData';

const WATCHLIST_STORAGE_KEY = 'zainsaham_watchlist_items';

// Helper for local watchlist items
function getLocalWatchlist() {
  const saved = localStorage.getItem(WATCHLIST_STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // fallback
    }
  }
  // Default items in watchlist: BBCA, BBRI, TLKM, ASII
  const defaults = [
    { watchlist_id: 1, user_id: 1, stock_id: 1, ticker: 'BBCA', created_at: '2026-09-12 10:00:00' },
    { watchlist_id: 2, user_id: 1, stock_id: 2, ticker: 'BBRI', created_at: '2026-09-12 10:15:00' },
    { watchlist_id: 3, user_id: 1, stock_id: 4, ticker: 'TLKM', created_at: '2026-09-20 14:00:00' },
    { watchlist_id: 4, user_id: 1, stock_id: 5, ticker: 'ASII', created_at: '2026-10-01 11:30:00' },
  ];
  localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(defaults));
  return defaults;
}

function saveLocalWatchlist(list) {
  localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(list));
}

export const stockApi = {
  // GET /api/dashboard
  async getDashboard() {
    try {
      const res = await api.get('/dashboard');
      if (res.data?.data) return res.data.data;
    } catch {
      // use local mock
    }

    const watchlistItems = getLocalWatchlist();
    const watchlistEnhanced = watchlistItems.map((w) => {
      const stock = STOCK_DATA[w.ticker] || STOCK_DATA['BBCA'];
      const last = stock.latestPrice;
      const prev = stock.prevPrice;
      const changePct = +(((last.close_price - prev.close_price) / prev.close_price) * 100).toFixed(2);
      const sparkline = stock.prices.slice(-20).map((p) => p.close_price);
      return {
        ...w,
        ticker: stock.ticker,
        company_name: stock.company_name,
        close_price: last.close_price,
        prev_close: prev.close_price,
        change_pct: changePct,
        sparkline,
      };
    });

    // Top Gainers & Top Losers calculation
    const allCalculated = INITIAL_STOCKS.map((s) => {
      const data = STOCK_DATA[s.ticker];
      const last = data.latestPrice;
      const prev = data.prevPrice;
      const changePct = +(((last.close_price - prev.close_price) / prev.close_price) * 100).toFixed(2);
      return {
        stock_id: s.stock_id,
        ticker: s.ticker,
        company_name: s.company_name,
        close_price: last.close_price,
        change_pct: changePct,
      };
    });

    const topGainers = [...allCalculated]
      .sort((a, b) => b.change_pct - a.change_pct)
      .slice(0, 5);

    const topLosers = [...allCalculated]
      .sort((a, b) => a.change_pct - b.change_pct)
      .slice(0, 5);

    // Latest news from watchlist or general
    const watchlistTickers = watchlistItems.map((w) => w.ticker);
    const watchlistNews = STOCK_NEWS.filter((n) => watchlistTickers.includes(n.ticker)).slice(0, 5);
    const displayNews = watchlistNews.length > 0 ? watchlistNews : STOCK_NEWS.slice(0, 5);

    return {
      watchlist: watchlistEnhanced,
      top_gainers: topGainers,
      top_losers: topLosers,
      latest_news: displayNews,
      last_market_date: STOCK_DATA['BBCA'].latestPrice.price_date,
    };
  },

  // GET /api/stocks (q, sector, page)
  async getStocks({ q = '', sector = '', page = 1, limit = 20 } = {}) {
    let rawStocks = null;
    try {
      const res = await api.get('/stocks', { params: { q, sector, page } });
      if (res.data?.data) {
        if (Array.isArray(res.data.data.items)) {
          return res.data.data;
        }
        if (Array.isArray(res.data.data)) {
          rawStocks = res.data.data;
        }
      }
    } catch {
      // offline / fallback
    }

    if (!rawStocks || rawStocks.length === 0) {
      rawStocks = INITIAL_STOCKS;
    }

    let filtered = rawStocks.map((s) => {
      const mock = STOCK_DATA[s.ticker] || STOCK_DATA['BBCA'] || {};
      const mockLast = mock.latestPrice || { close_price: 1000 };
      const mockPrev = mock.prevPrice || { close_price: 1000 };
      const mockChangePct = +(((mockLast.close_price - mockPrev.close_price) / mockPrev.close_price) * 100).toFixed(2);

      const closePrice = typeof s.close_price === 'number' && s.close_price > 0
        ? s.close_price
        : mockLast.close_price;

      const changePct = typeof s.change_pct === 'number'
        ? s.change_pct
        : mockChangePct;

      return {
        ...s,
        close_price: closePrice,
        change_pct: changePct,
        exchange: s.exchange || 'IDX',
        currency: s.currency || 'IDR',
      };
    });

    if (q && q.trim()) {
      const query = q.trim().toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.ticker?.toLowerCase().includes(query) ||
          s.company_name?.toLowerCase().includes(query)
      );
    }

    if (sector && sector !== 'Semua') {
      filtered = filtered.filter((s) => s.sector === sector);
    }

    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const items = filtered.slice(startIndex, startIndex + limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  },

  // GET /api/stocks/{ticker}
  async getStockDetail(ticker) {
    const symbol = ticker.toUpperCase();
    const mock = STOCK_DATA[symbol] || STOCK_DATA['BBCA'] || {};
    const mockLast = mock.latestPrice || { close_price: 1000, open_price: 1000, high_price: 1000, low_price: 1000, volume: 1000000 };
    const mockPrev = mock.prevPrice || { close_price: 1000 };
    const mockChangeVal = mockLast.close_price - mockPrev.close_price;
    const mockChangePct = +((mockChangeVal / mockPrev.close_price) * 100).toFixed(2);

    try {
      const res = await api.get(`/stocks/${symbol}`);
      if (res.data?.data) {
        const b = res.data.data;
        const closePrice = typeof b.close_price === 'number' ? b.close_price : mockLast.close_price;
        const prevPrice = typeof b.prev_close === 'number' ? b.prev_close : mockPrev.close_price;
        const changeVal = typeof b.change_value === 'number' ? b.change_value : (closePrice - prevPrice);
        const changePct = typeof b.change_pct === 'number' ? b.change_pct : (prevPrice > 0 ? +((changeVal / prevPrice) * 100).toFixed(2) : 0);

        return {
          ...mock,
          ...b,
          close_price: closePrice,
          open_price: typeof b.open_price === 'number' ? b.open_price : mockLast.open_price,
          high_price: typeof b.high_price === 'number' ? b.high_price : mockLast.high_price,
          low_price: typeof b.low_price === 'number' ? b.low_price : mockLast.low_price,
          volume: typeof b.volume === 'number' ? b.volume : mockLast.volume,
          change_value: changeVal,
          change_pct: changePct,
          price_date: b.price_date || mockLast.price_date || new Date().toISOString().split('T')[0],
        };
      }
    } catch {
      // fallback
    }

    if (!STOCK_DATA[symbol]) {
      throw new Error(`Saham dengan kode ${symbol} tidak ditemukan.`);
    }

    return {
      stock_id: mock.stock_id,
      ticker: mock.ticker,
      company_name: mock.company_name,
      sector: mock.sector,
      exchange: mock.exchange,
      currency: mock.currency,
      close_price: mockLast.close_price,
      open_price: mockLast.open_price,
      high_price: mockLast.high_price,
      low_price: mockLast.low_price,
      volume: mockLast.volume,
      change_value: mockChangeVal,
      change_pct: mockChangePct,
      price_date: mockLast.price_date,
    };
  },

  // GET /api/stocks/{ticker}/prices?range=1M|3M|6M|1Y|5Y
  async getStockPrices(ticker, range = '3M') {
    const symbol = ticker.toUpperCase();
    try {
      const res = await api.get(`/stocks/${symbol}/prices`, { params: { range } });
      if (res.data?.data) return res.data.data;
    } catch {
      // offline
    }

    const data = STOCK_DATA[symbol] || STOCK_DATA['BBCA'];
    const totalCount = data.prices.length;
    let sliceCount = 60; // default 3M (~60 trading days)

    if (range === '1B' || range === '1M') sliceCount = 22;
    else if (range === '3B' || range === '3M') sliceCount = 60;
    else if (range === '6B' || range === '6M') sliceCount = 100;
    else if (range === '1T' || range === '1Y') sliceCount = 120;
    else if (range === '5T' || range === '5Y') sliceCount = 120;

    return data.prices.slice(-sliceCount);
  },

  // GET /api/stocks/{ticker}/indicators?range=...
  async getStockIndicators(ticker, range = '3M') {
    const symbol = ticker.toUpperCase();
    try {
      const res = await api.get(`/stocks/${symbol}/indicators`, { params: { range } });
      if (res.data?.data) return res.data.data;
    } catch {
      // offline
    }

    const data = STOCK_DATA[symbol] || STOCK_DATA['BBCA'];
    let sliceCount = 60;
    if (range === '1B' || range === '1M') sliceCount = 22;
    else if (range === '3B' || range === '3M') sliceCount = 60;
    else if (range === '6B' || range === '6M') sliceCount = 100;

    const list = data.indicators.slice(-sliceCount);
    const latest = list[list.length - 1];

    let rsiLabel = 'Netral';
    if (latest.rsi_14 >= 70) rsiLabel = 'Jenuh Beli (Overbought)';
    else if (latest.rsi_14 <= 30) rsiLabel = 'Jenuh Jual (Oversold)';

    let macdStatus = 'MACD Netral';
    if (latest.macd > latest.macd_signal) {
      macdStatus = 'MACD di atas signal (Momentum Bullish Naik)';
    } else {
      macdStatus = 'MACD di bawah signal (Momentum Bearish Turun)';
    }

    const stockLastPrice = data.latestPrice.close_price;
    let smaStatus = 'Harga berfluktuasi dekat garis SMA';
    if (latest.sma_20 && latest.sma_50) {
      if (stockLastPrice > latest.sma_20 && stockLastPrice > latest.sma_50) {
        smaStatus = 'Harga di atas kedua SMA (Kuat)';
      } else if (stockLastPrice < latest.sma_20 && stockLastPrice < latest.sma_50) {
        smaStatus = 'Harga di bawah kedua SMA (Lemah)';
      }
    }

    return {
      history: list,
      latest: {
        ...latest,
        rsi_label: rsiLabel,
        macd_status: macdStatus,
        sma_status: smaStatus,
      },
    };
  },

  // GET /api/stocks/{ticker}/fundamentals?type=quarterly|annual
  async getStockFundamentals(ticker, type = 'quarterly') {
    const symbol = ticker.toUpperCase();
    try {
      const res = await api.get(`/stocks/${symbol}/fundamentals`, { params: { type } });
      if (res.data?.data) return res.data.data;
    } catch {
      // offline
    }

    return getStockFundamentals(symbol, type);
  },

  // GET /api/stocks/{ticker}/news
  async getStockNews(ticker) {
    const symbol = ticker.toUpperCase();
    try {
      const res = await api.get(`/stocks/${symbol}/news`);
      if (res.data?.data) return res.data.data;
    } catch {
      // offline
    }

    const filtered = STOCK_NEWS.filter((n) => n.ticker === symbol);
    if (filtered.length > 0) return filtered;
    return STOCK_NEWS.slice(0, 4);
  },

  // GET /api/news/{id}
  async getNewsDetail(id) {
    try {
      const res = await api.get(`/news/${id}`);
      if (res.data?.data) return res.data.data;
    } catch {
      // offline
    }
    const found = STOCK_NEWS.find((n) => n.news_id === Number(id));
    return found || STOCK_NEWS[0];
  },

  // GET /api/watchlists
  async getWatchlist() {
    try {
      const res = await api.get('/watchlists');
      if (res.data?.data) return res.data.data;
    } catch {
      // offline
    }

    const items = getLocalWatchlist();
    return items.map((w) => {
      const data = STOCK_DATA[w.ticker] || STOCK_DATA['BBCA'];
      const last = data.latestPrice;
      const prev = data.prevPrice;
      const changeVal = last.close_price - prev.close_price;
      const changePct = +((changeVal / prev.close_price) * 100).toFixed(2);
      const indicator = data.indicators[data.indicators.length - 1];

      return {
        watchlist_id: w.watchlist_id,
        stock_id: data.stock_id,
        ticker: data.ticker,
        company_name: data.company_name,
        close_price: last.close_price,
        change_value: changeVal,
        change_pct: changePct,
        rsi_14: indicator ? indicator.rsi_14 : 50,
        created_at: w.created_at,
      };
    });
  },

  // POST /api/watchlists
  async addToWatchlist(stockId, ticker) {
    try {
      const res = await api.post('/watchlists', { stock_id: stockId, user_id: 1 });
      if (res.data?.data) return res.data.data;
    } catch (err) {
      if (err.response?.status === 409) throw err;
    }

    const current = getLocalWatchlist();
    const exists = current.some((item) => item.ticker === ticker || item.stock_id === stockId);
    if (exists) {
      const error = new Error('Saham ini sudah ada di watchlist.');
      error.status = 409;
      throw error;
    }

    const newItem = {
      watchlist_id: Date.now(),
      user_id: 1,
      stock_id: stockId,
      ticker: ticker,
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
    current.unshift(newItem);
    saveLocalWatchlist(current);
    return newItem;
  },

  // DELETE /api/watchlists/{id}
  async removeFromWatchlist(identifier) {
    try {
      await api.delete(`/watchlists/${identifier}`);
    } catch {
      // offline
    }

    let current = getLocalWatchlist();
    // identifier could be watchlist_id or ticker
    current = current.filter(
      (item) => item.watchlist_id !== Number(identifier) && item.ticker !== identifier
    );
    saveLocalWatchlist(current);
    return { success: true };
  },
};
