import { useEffect, useRef, useState } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { Button } from './ui';
import { useWatchlist } from '../context/WatchlistContext';

export default function WatchlistButton({ stock, compact = false, className = '' }) {
  const watchlist = useWatchlist();
  const stockId = stock?.stock_id;
  const inList = stockId ? watchlist.has(stockId) : false;
  const pending = stockId ? watchlist.isPending(stockId) : false;

  const clickedRef = useRef(false);
  const [anim, setAnim] = useState(null); // 'in' | 'out' | null

  useEffect(() => {
    if (!clickedRef.current) return;
    clickedRef.current = false;

    setAnim(inList ? 'in' : 'out');
    const timer = setTimeout(() => setAnim(null), 440);
    return () => clearTimeout(timer);
  }, [inList]);

  useEffect(() => {
    if (!pending) clickedRef.current = false;
  }, [pending]);

  if (!stock) return null;

  const disabled = pending || (watchlist.loading && watchlist.items.length === 0);

  const onClick = (event) => {
    event.stopPropagation();
    clickedRef.current = true;
    if (inList) watchlist.remove(stock.stock_id);
    else watchlist.add(stock);
  };

  if (compact) {
    const label = inList ? `Hapus ${stock.ticker} dari watchlist` : `Tambah ${stock.ticker} ke watchlist`;
    const iconAnim =
      anim === 'in'
        ? 'animate-pop-in'
        : anim === 'out'
          ? 'animate-pop-out'
          : pending
            ? 'animate-pulse'
            : '';

    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={inList}
        title={label}
        className={`relative inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-150 hover:bg-surface-2 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iris disabled:opacity-50 ${
          inList ? 'bg-surface-2 text-text' : 'text-text-muted hover:text-text'
        } ${className}`}
      >
        {anim === 'in' && (
          <span
            aria-hidden="true"
            className="animate-ring-burst pointer-events-none absolute inset-0 rounded-lg border border-iris"
          />
        )}
        {inList ? (
          <BookmarkCheck className={`h-4 w-4 ${iconAnim}`} strokeWidth={1.75} />
        ) : (
          <Bookmark className={`h-4 w-4 ${iconAnim}`} strokeWidth={1.75} />
        )}
      </button>
    );
  }

  return (
    <Button
      variant="secondary"
      icon={inList ? BookmarkCheck : Bookmark}
      onClick={onClick}
      disabled={disabled}
      className={`transition-transform duration-150 active:scale-[0.98] ${
        anim === 'in' ? 'ring-2 ring-iris/35' : ''
      } ${className}`}
    >
      {pending ? 'Memproses…' : inList ? 'Hapus dari watchlist' : 'Tambah ke watchlist'}
    </Button>
  );
}