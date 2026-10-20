import { getStocks } from '../api/stocks';

/**
 * Cache in-memory daftar saham untuk menerjemahkan ticker (URL) <-> stock_id (backend).
 * `/stocks` hanya di-fetch sekali per sesi halaman, kecuali dipaksa dengan `force`.
 */
let stocks = null;
let byTicker = new Map();
let byId = new Map();
let pending = null;

function index(list) {
  stocks = list;
  byTicker = new Map(list.map((s) => [s.ticker, s]));
  byId = new Map(list.map((s) => [s.stock_id, s]));
}

export function loadStocks({ force = false } = {}) {
  if (stocks && !force) return Promise.resolve(stocks);
  if (pending && !force) return pending;
  pending = getStocks()
    .then((list) => {
      index(list);
      return list;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

export function getCachedStocks() {
  return stocks;
}

export async function getByTicker(ticker) {
  await loadStocks();
  return byTicker.get(String(ticker || '').toUpperCase()) ?? null;
}

export async function getById(stockId) {
  await loadStocks();
  return byId.get(Number(stockId)) ?? null;
}

/** Versi sinkron, hanya valid setelah loadStocks selesai. */
export function findByTicker(ticker) {
  return byTicker.get(String(ticker || '').toUpperCase()) ?? null;
}

export function findById(stockId) {
  return byId.get(Number(stockId)) ?? null;
}

export const stocksStore = { loadStocks, getCachedStocks, getByTicker, getById, findByTicker, findById };
export default stocksStore;

