import api, { unwrap } from './client';
import {
  normalizeFundamental,
  normalizeIndicator,
  normalizeList,
  normalizeNews,
  normalizePrice,
  normalizeStock,
} from './normalize';
import { createCache } from '../lib/cache';

// GET /stocks — semua saham (tanpa paginasi, tanpa harga).
export async function getStocks() {
  const res = await api.get('/stocks');
  return normalizeList(unwrap(res), normalizeStock);
}

// GET /stocks/{stockId}
export async function getStock(stockId) {
  const res = await api.get(`/stocks/${stockId}`);
  return normalizeStock(unwrap(res));
}

// Harga & indikator di-cache per saham: satu kali fetch, rentang waktu difilter di frontend.
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

// GET /stocks/{stockId}/prices — urut lama → baru.
export function getPrices(stockId, options) {
  return pricesCache.get(Number(stockId), options);
}
export const peekPrices = (stockId) => pricesCache.peek(Number(stockId));

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

// GET /stocks/{stockId}/indicators — urut lama → baru, nilai bisa null.
export function getIndicators(stockId, options) {
  return indicatorsCache.get(Number(stockId), options);
}
export const peekIndicators = (stockId) => indicatorsCache.peek(Number(stockId));

// GET /stocks/{stockId}/fundamentals — urut terbaru → lama.
export function getFundamentals(stockId, options) {
  return fundamentalsCache.get(Number(stockId), options);
}

// GET /stocks/{stockId}/news — urut terbaru → lama. Tidak ada endpoint detail berita.
export function getNews(stockId, options) {
  return newsCache.get(Number(stockId), options);
}

