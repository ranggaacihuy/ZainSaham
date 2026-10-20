// Normalisasi respons backend Laravel.
// Kolom desimal dikirim sebagai string (cast decimal:2), jadi dikonversi di sini — sekali saja.

export function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Kolom `date` Laravel diserialisasi sebagai ISO UTC ("2026-10-20T00:00:00.000000Z").
 * Backend memakai timezone UTC, jadi 10 karakter pertama adalah tanggal yang benar.
 */
export function toDateKey(value) {
  if (!value) return null;
  const str = String(value);
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function toId(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function normalizeUser(raw) {
  if (!raw) return null;
  return {
    user_id: toId(raw.user_id),
    name: raw.name ?? '',
    email: raw.email ?? '',
    created_at: raw.created_at ?? null,
  };
}

export function normalizeStock(raw) {
  if (!raw) return null;
  return {
    stock_id: toId(raw.stock_id),
    ticker: String(raw.ticker ?? '').toUpperCase(),
    company_name: raw.company_name ?? '',
    sector: raw.sector ?? '',
    exchange: raw.exchange ?? '',
    currency: raw.currency ?? '',
  };
}

export function normalizePrice(raw) {
  return {
    price_date: toDateKey(raw.price_date),
    open_price: toNumber(raw.open_price),
    high_price: toNumber(raw.high_price),
    low_price: toNumber(raw.low_price),
    close_price: toNumber(raw.close_price),
    volume: toNumber(raw.volume),
  };
}

export function normalizeIndicator(raw) {
  return {
    indicator_date: toDateKey(raw.indicator_date),
    rsi_14: toNumber(raw.rsi_14),
    macd: toNumber(raw.macd),
    macd_signal: toNumber(raw.macd_signal),
    sma_20: toNumber(raw.sma_20),
    sma_50: toNumber(raw.sma_50),
  };
}

export function normalizeFundamental(raw) {
  return {
    period: String(raw.period ?? ''),
    revenue: toNumber(raw.revenue),
    net_income: toNumber(raw.net_income),
    total_assets: toNumber(raw.total_assets),
    total_liabilities: toNumber(raw.total_liabilities),
    total_equity: toNumber(raw.total_equity),
    eps: toNumber(raw.eps),
    roe: toNumber(raw.roe),
    roa: toNumber(raw.roa),
    debt_to_equity: toNumber(raw.debt_to_equity),
    updated_at: raw.updated_at ?? null,
  };
}

export function normalizeNews(raw) {
  return {
    news_id: toId(raw.news_id),
    title: raw.title ?? '',
    content: raw.content ?? '',
    source: raw.source ?? '',
    source_url: raw.source_url || null,
    published_at: raw.published_at ?? null,
  };
}

export function normalizeWatchlistItem(raw) {
  return {
    watchlist_id: toId(raw.watchlist_id),
    user_id: toId(raw.user_id),
    stock_id: toId(raw.stock_id),
    created_at: raw.created_at ?? null,
    stock: normalizeStock(raw.stock),
  };
}

export function normalizeSession(raw) {
  if (!raw) return null;
  return {
    session_id: toId(raw.session_id),
    user_id: toId(raw.user_id),
    stock_id: toId(raw.stock_id),
    analysis_type: raw.analysis_type ?? '',
    created_at: raw.created_at ?? null,
    updated_at: raw.updated_at ?? null,
  };
}

/** `context_data` sengaja dibuang: ukurannya sangat besar dan tidak dipakai di UI. */
export function normalizeAnalysis(raw) {
  return {
    ai_analysis_id: toId(raw.ai_analysis_id),
    session_id: toId(raw.session_id),
    model_name: raw.model_name ?? '',
    result: toText(raw.result),
    created_at: raw.created_at ?? null,
    session: normalizeSession(raw.session),
  };
}

export function normalizeMessage(raw) {
  return {
    message_id: toId(raw.message_id),
    session_id: toId(raw.session_id),
    role: raw.role === 'assistant' ? 'assistant' : 'user',
    content: toText(raw.content),
    created_at: raw.created_at ?? null,
  };
}

export function normalizeList(data, normalizer) {
  return Array.isArray(data) ? data.map(normalizer) : [];
}

