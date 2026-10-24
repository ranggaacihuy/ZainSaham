import { getStocks } from '../api/stocks';

let stocks = null;
let byTicker = new Map();
let pending = null;

export function loadStocks({ force = false } = {}) {
  if (stocks && !force) return Promise.resolve(stocks);
  if (pending && !force) return pending;
  pending = getStocks()
    .then((list) => {
      stocks = list;
      byTicker = new Map(list.map((s) => [s.ticker, s]));
      return list;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

export async function loadEquities(options) {
  const list = await loadStocks(options);
  return list.filter((s) => s.kind !== 'index');
}

export async function getByTicker(ticker) {
  await loadStocks();
  return byTicker.get(String(ticker || '').toUpperCase()) ?? null;
}
