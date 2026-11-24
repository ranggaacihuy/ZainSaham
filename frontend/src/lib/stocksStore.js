import { getStocks } from '../api/stocks';

// Daftar emiten bisa bertambah (daftar emiten diperbarui tiap Senin) dan
// ringkasan harganya berubah, jadi cache di browser diberi batas umur.
const TTL_MS = 5 * 60 * 1000;
const RECHECK_AFTER_MS = 5 * 1000;

let stocks = null;
let loadedAt = 0;
let byTicker = new Map();
let pending = null;

export function loadStocks({ force = false } = {}) {
  const fresh = stocks && Date.now() - loadedAt < TTL_MS;
  if (fresh && !force) return Promise.resolve(stocks);
  if (pending && !force) return pending;
  const request = getStocks()
    .then((list) => {
      stocks = list;
      loadedAt = Date.now();
      byTicker = new Map(list.map((s) => [s.ticker, s]));
      return list;
    })
    .finally(() => {
      if (pending === request) pending = null;
    });
  pending = request;
  return request;
}

export async function loadEquities(options) {
  const list = await loadStocks(options);
  return list.filter((s) => s.kind !== 'index');
}

export async function getByTicker(ticker) {
  const key = String(ticker || '').toUpperCase();
  await loadStocks();
  if (!byTicker.has(key) && Date.now() - loadedAt > RECHECK_AFTER_MS) {
    // Emiten baru mungkin belum ada di cache; muat ulang sekali sebelum menyerah,
    // kecuali daftar baru saja diambil.
    await loadStocks({ force: true });
  }
  return byTicker.get(key) ?? null;
}
