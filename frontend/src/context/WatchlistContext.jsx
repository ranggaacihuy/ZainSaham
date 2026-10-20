import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { addToWatchlist, getWatchlist, removeFromWatchlist } from '../api/watchlist';

const WatchlistContext = createContext(null);

/**
 * State watchlist bersama untuk seluruh halaman.
 * - Tambah/hapus memakai watchlist_id dari backend.
 * - Duplikat dicegah di sini karena backend tidak mengeceknya.
 * - Setelah tambah/hapus, daftar dimuat ulang tanpa reload halaman.
 */
export function WatchlistProvider({ children }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const requestId = useRef(0);
  const pendingRef = useRef(new Set());

  const reload = useCallback(
    async ({ silent = false } = {}) => {
      const id = ++requestId.current;
      if (!silent) setLoading(true);
      try {
        const list = await getWatchlist(user.user_id);
        if (id === requestId.current) {
          setItems(list);
          setError(null);
        }
        return list;
      } catch (err) {
        if (id === requestId.current && !silent) setError(err);
        throw err;
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [user.user_id],
  );

  useEffect(() => {
    let active = true;
    getWatchlist(user.user_id)
      .then((list) => {
        if (active) {
          setItems(list);
          setError(null);
        }
      })
      .catch((err) => {
        if (active) setError(err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user.user_id]);

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
      if (!stock?.stock_id || pendingRef.current.has(stock.stock_id)) return false;
      if (byStockId.has(stock.stock_id)) {
        addToast(`${stock.ticker} sudah ada di watchlist.`, 'info');
        return false;
      }
      setPending(stock.stock_id, true);
      try {
        // Cek ulang ke server sebelum POST agar tidak membuat duplikat dari tab lain.
        const fresh = await reload({ silent: true });
        if (fresh.some((item) => item.stock_id === stock.stock_id)) {
          addToast(`${stock.ticker} sudah ada di watchlist.`, 'info');
          return false;
        }
        await addToWatchlist(user.user_id, stock.stock_id);
        await reload({ silent: true }).catch(() => {});
        addToast(`${stock.ticker} ditambahkan ke watchlist.`, 'success');
        return true;
      } catch (err) {
        addToast(err.message || 'Gagal menambahkan ke watchlist.', 'error');
        return false;
      } finally {
        setPending(stock.stock_id, false);
      }
    },
    [addToast, byStockId, reload, user.user_id],
  );

  const remove = useCallback(
    async (stockId) => {
      const item = byStockId.get(stockId);
      if (!item || pendingRef.current.has(stockId)) return false;
      setPending(stockId, true);
      try {
        await removeFromWatchlist(item.watchlist_id);
        setItems((prev) => prev.filter((i) => i.watchlist_id !== item.watchlist_id));
        await reload({ silent: true }).catch(() => {});
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

// oxlint-disable-next-line react/only-export-components
export function useWatchlist() {
  const context = useContext(WatchlistContext);
  if (!context) throw new Error('useWatchlist harus dipakai di dalam WatchlistProvider');
  return context;
}

