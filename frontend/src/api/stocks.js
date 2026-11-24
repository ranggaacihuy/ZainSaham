import api, { unwrap } from './client';
import {
  normalizeFundamental,
  normalizeIndicator,
  normalizeIntradayCandle,
  normalizeList,
  normalizeNews,
  normalizePrice,
  normalizeStock,
} from './normalize';
import { createCache } from '../lib/cache';

export async function getStocks() {
  const res = await api.get('/stocks');
  return normalizeList(unwrap(res), normalizeStock);
}

export async function searchStocks({ q = '', sector = '', page = 1, perPage = 20 } = {}) {
  const res = await api.get('/stocks', {
    params: { q: q || undefined, sector: sector || undefined, page, per_page: perPage },
  });
  const items = normalizeList(unwrap(res), normalizeStock);
  const meta = res.data?.meta || {};
  return {
    items,
    page: Number(meta.page) || page,
    lastPage: Number(meta.last_page) || 1,
    total: Number(meta.total) || 0,
    sectors: Array.isArray(meta.sectors) ? meta.sectors : [],
  };
}

const hourlyPricesCache = createCache(async (stockId) => {
  const res = await api.get(`/stocks/${stockId}/prices`, { params: { interval: '1h' } });
  const list = unwrap(res);
  if (!Array.isArray(list)) return [];
  return list
    .map((raw) => ({
      timestamp: Number(raw.timestamp),
      price_date: raw.price_date ?? null,
      open_price: Number(raw.open_price),
      high_price: Number(raw.high_price),
      low_price: Number(raw.low_price),
      close_price: Number(raw.close_price),
      volume: Number(raw.volume) || 0,
    }))
    .filter((p) => Number.isFinite(p.timestamp) && Number.isFinite(p.close_price));
});

export function getHourlyPrices(stockId, options) {
  return hourlyPricesCache.get(Number(stockId), options);
}

const pricesCache = createCache(async (stockId) => {
  const res = await api.get(`/stocks/${stockId}/prices`);
  return normalizeList(unwrap(res), normalizePrice).filter((p) => p.price_date && p.close_price !== null);
});

const indicatorsCache = createCache(async (stockId) => {
  const res = await api.get(`/stocks/${stockId}/indicators`);
  return normalizeList(unwrap(res), normalizeIndicator).filter((i) => i.indicator_date);
});

const fundamentalsCache = createCache(async (stockId) => {
  const res = await api.get(`/stocks/${stockId}/fundamentals`);
  return normalizeList(unwrap(res), normalizeFundamental);
});

const newsCache = createCache(async (stockId) => {
  const res = await api.get(`/stocks/${stockId}/news`);
  return normalizeList(unwrap(res), normalizeNews);
});

export function getPrices(stockId, options) {
  return pricesCache.get(Number(stockId), options);
}

const intradayCache = new Map();
const INTRADAY_TTL_MS = {
  '1m': 30 * 1000,
  '5m': 60 * 1000,
  '10m': 60 * 1000,
  '15m': 60 * 1000,
  '1h': 5 * 60 * 1000,
  '2h': 5 * 60 * 1000,
  '4h': 5 * 60 * 1000,
};

export async function getIntradayPrices(stockId, interval, { force = false } = {}) {
  const key = `${Number(stockId)}:${interval}`;
  const now = Date.now();
  const cached = intradayCache.get(key);
  if (!force && cached && now < cached.expires) {
    return cached.data;
  }

  const res = await api.get(`/stocks/${Number(stockId)}/intraday`, { params: { interval } });
  const raw = unwrap(res);
  const data = {
    interval: raw?.interval || interval,
    range: raw?.range || '',
    timezone: raw?.timezone || 'Asia/Jakarta',
    candles: normalizeList(raw?.candles, normalizeIntradayCandle).filter(
      (c) => c.timestamp !== null && c.close_price !== null,
    ),
  };

  const ttl = INTRADAY_TTL_MS[interval] || 60 * 1000;
  intradayCache.set(key, { data, expires: now + ttl });
  return data;
}

export async function getQuote(stockId) {
  const res = await api.get(`/stocks/${stockId}/quote`);
  const data = unwrap(res);
  return {
    price: data?.price ? normalizePrice(data.price) : null,
    is_open: Boolean(data?.is_open),
    market_time: data?.market_time ?? null,
    fetched_at: data?.fetched_at ?? null,
  };
}

export function getIndicators(stockId, options) {
  return indicatorsCache.get(Number(stockId), options);
}

export function getFundamentals(stockId, options) {
  return fundamentalsCache.get(Number(stockId), options);
}

export function getNews(stockId, options) {
  return newsCache.get(Number(stockId), options);
}
