import api, { unwrap } from './client';
import { normalizeList, normalizeWatchlistItem } from './normalize';

export async function getWatchlist(userId) {
  const res = await api.get(`/users/${userId}/watchlist`);
  return normalizeList(unwrap(res), normalizeWatchlistItem);
}

export async function addToWatchlist(userId, stockId) {
  const res = await api.post('/watchlists', { user_id: userId, stock_id: stockId });
  return normalizeWatchlistItem(unwrap(res));
}

export async function removeFromWatchlist(watchlistId) {
  const res = await api.delete(`/watchlists/${watchlistId}`);
  unwrap(res);
  return true;
}
