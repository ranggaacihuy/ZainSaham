import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Modal, ErrorState, Skeleton } from './ui';
import { loadStocks } from '../lib/stocksStore';
import useAsync from '../hooks/useAsync';

const MAX_RESULTS = 8;

/** Pencarian saham global (Ctrl K) dari stocksStore. */
export default function SearchModal({ open, onClose }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const { data: stocks, error, loading, reload } = useAsync((opts) => loadStocks(opts), [open], { enabled: open });

  const handleClose = () => {
    setQuery('');
    setActiveIndex(0);
    onClose?.();
  };

  const results = useMemo(() => {
    if (!stocks) return [];
    const q = query.trim().toLowerCase();
    if (!q) return stocks.slice(0, MAX_RESULTS);
    const starts = [];
    const contains = [];
    stocks.forEach((s) => {
      const ticker = s.ticker.toLowerCase();
      const name = s.company_name.toLowerCase();
      if (ticker.startsWith(q)) starts.push(s);
      else if (ticker.includes(q) || name.includes(q)) contains.push(s);
    });
    return [...starts, ...contains].slice(0, MAX_RESULTS);
  }, [stocks, query]);

  const go = (stock) => {
    handleClose();
    navigate(`/stocks/${stock.ticker}`);
  };

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault();
      go(results[activeIndex]);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Cari saham" initialFocusRef={inputRef}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Kode atau nama perusahaan"
          aria-label="Kode atau nama perusahaan"
          className="h-10 w-full rounded-lg border border-border bg-bg pl-9 pr-3 text-sm text-text placeholder:text-text-muted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="mt-3 min-h-30">
        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        )}
        {error && <ErrorState error={error} onRetry={reload} />}
        {!loading && !error && results.length === 0 && (
          <p className="py-8 text-center text-sm text-text-muted">Tidak ada saham yang cocok dengan “{query}”.</p>
        )}
        {!loading && !error && results.length > 0 && (
          <ul role="listbox" aria-label="Hasil pencarian" className="space-y-0.5">
            {results.map((stock, index) => (
              <li key={stock.stock_id} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => go(stock)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-150 ${
                    index === activeIndex ? 'bg-surface-2' : ''
                  }`}
                >
                  <span className="w-14 shrink-0 text-sm font-semibold text-text">{stock.ticker}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-text-muted">{stock.company_name}</span>
                  <span className="hidden shrink-0 text-xs text-text-muted sm:inline">{stock.sector}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
