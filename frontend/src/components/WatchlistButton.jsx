import { Bookmark, BookmarkCheck } from 'lucide-react';
import { Button } from './ui';
import { useWatchlist } from '../context/WatchlistContext';

/** Tombol tambah/hapus watchlist. `compact` = tombol ikon untuk baris tabel. */
export default function WatchlistButton({ stock, compact = false, className = '' }) {
  const watchlist = useWatchlist();
  if (!stock) return null;
  const inList = watchlist.has(stock.stock_id);
  const pending = watchlist.isPending(stock.stock_id);
  const disabled = pending || (watchlist.loading && watchlist.items.length === 0);

  const onClick = (event) => {
    event.stopPropagation();
    if (inList) watchlist.remove(stock.stock_id);
    else watchlist.add(stock);
  };

  if (compact) {
    const label = inList ? `Hapus ${stock.ticker} dari watchlist` : `Tambah ${stock.ticker} ke watchlist`;
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={inList}
        title={label}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 ${
          inList ? 'text-text' : 'text-text-muted hover:text-text'
        } ${className}`}
      >
        {inList ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
      </button>
    );
  }

  return (
    <Button variant="secondary" icon={inList ? BookmarkCheck : Bookmark} onClick={onClick} disabled={disabled} className={className}>
      {pending ? 'Memproses…' : inList ? 'Hapus dari watchlist' : 'Tambah ke watchlist'}
    </Button>
  );
}

