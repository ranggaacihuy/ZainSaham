import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { addToWatchlist, getWatchlist, removeFromWatchlist } from '../api/watchlist';

const WatchlistContext = createContext(null);

export function WatchlistProvider({ children }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const userId = user?.user_id || null;
  const [state, setState] = useState({ userId: null, items: [], error: null, loaded: false });
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const requestId = useRef(0);
  const pendingRef = useRef(new Set());

  const current = state.userId === userId ? state : { userId, items: [], error: null, loaded: !userId };
  const { items, error } = current;
  const loading = Boolean(userId) && !current.loaded;

  const reload = useCallback(async () => {
    if (!userId) return [];
    const id = ++requestId.current;
    try {
      const list = await getWatchlist(userId);
      if (id === requestId.current) setState({ userId, items: list, error: null, loaded: true });
      return list;
    } catch (err) {
      if (id === requestId.current) {
        setState((prev) => ({ userId, items: prev.userId === userId ? prev.items : [], error: err, loaded: true }));
      }
      throw err;
    }
  }, [userId]);

  useEffect(() => {
    reload().catch(() => {});
  }, [reload]);

  const byStockId = useMemo(() => new Map(items.map((item) => [item.stock_id, item])), [items]);

  const setPending = (stockId, on) => {
    const next = new Set(pendingRef.current);
    if (on) next.add(stockId);
    else next.delete(stockId);
    pendingRef.current = next;
    setPendingIds(next);
  };

  const add = useCallback(
    async (stock) => {
      if (!userId || !stock?.stock_id || pendingRef.current.has(stock.stock_id)) return false;
      if (byStockId.has(stock.stock_id)) {
        addToast(`${stock.ticker} sudah ada di watchlist.`, 'info');
        return false;
      }
      setPending(stock.stock_id, true);
      try {
        await addToWatchlist(userId, stock.stock_id);
        await reload().catch(() => {});
        addToast(`${stock.ticker} ditambahkan ke watchlist.`, 'success');
        return true;
      } catch (err) {
        addToast(err.message || 'Gagal menambahkan ke watchlist.', 'error');
        return false;
      } finally {
        setPending(stock.stock_id, false);
      }
    },
    [addToast, byStockId, reload, userId],
  );

  const remove = useCallback(
    async (stockId) => {
      const item = byStockId.get(stockId);
      if (!item || pendingRef.current.has(stockId)) return false;
      setPending(stockId, true);
      try {
        await removeFromWatchlist(item.watchlist_id);
        setState((prev) => ({ ...prev, items: prev.items.filter((i) => i.watchlist_id !== item.watchlist_id) }));
        await reload().catch(() => {});
        addToast(`${item.stock?.ticker || 'Saham'} dihapus dari watchlist.`, 'success');
        return true;
      } catch (err) {
        addToast(err.message || 'Gagal menghapus dari watchlist.', 'error');
        return false;
      } finally {
        setPending(stockId, false);
      }
    },
    [addToast, byStockId, reload],
  );

  const value = useMemo(
    () => ({
      items,
      loading,
      error,
      reload,
      add,
      remove,
      has: (stockId) => byStockId.has(stockId),
      getItem: (stockId) => byStockId.get(stockId) || null,
      isPending: (stockId) => pendingIds.has(stockId),
    }),
    [items, loading, error, reload, add, remove, byStockId, pendingIds],
  );

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist() {
  const context = useContext(WatchlistContext);
  if (!context) throw new Error('useWatchlist harus dipakai di dalam WatchlistProvider');
  return context;
}
