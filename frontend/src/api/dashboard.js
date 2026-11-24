import api, { unwrap } from './client';
import {
  normalizeAnalysis,
  normalizeList,
  normalizeNews,
  normalizeStock,
  normalizeSummary,
  normalizeWatchlistItem,
  toDateKey,
  toNumber,
} from './normalize';

function normalizeMover(raw) {
  return { stock: normalizeStock(raw.stock), summary: normalizeSummary(raw.summary) };
}

export async function getDashboard() {
  const res = await api.get('/dashboard');
  const data = unwrap(res) || {};
  const stats = data.stats || {};
  return {
    lastPriceDate: toDateKey(data.last_price_date),
    index: data.index ? normalizeMover(data.index) : null,
    stats: {
      count: toNumber(stats.count) ?? 0,
      date: toDateKey(stats.date),
      avgChangePct: toNumber(stats.avg_change_pct),
      up: toNumber(stats.up) ?? 0,
      down: toNumber(stats.down) ?? 0,
    },
    watchlist: normalizeList(data.watchlist, normalizeWatchlistItem),
    news: normalizeList(data.news, normalizeNews),
    analyses: normalizeList(data.analyses, normalizeAnalysis),
    moversDate: toDateKey(data.movers?.date),
    moversTotal: toNumber(data.movers?.total) ?? 0,
    gainers: normalizeList(data.movers?.gainers, normalizeMover),
    losers: normalizeList(data.movers?.losers, normalizeMover),
  };
}
