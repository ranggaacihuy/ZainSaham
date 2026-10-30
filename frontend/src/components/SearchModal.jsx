import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { ErrorState, Skeleton } from './ui';
import StockLogo from './StockLogo';
import { loadStocks } from '../lib/stocksStore';
import useAsync from '../hooks/useAsync';

const MAX_RESULTS = 20;

const SearchModal = forwardRef(function SearchModal(
  {
    enableShortcut = false,
    showShortcut = true,
    placeholder = 'Cari saham',
    align = 'right',
    className = '',
  },
  ref,
) {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const { data: stocks, error, loading, reload } = useAsync((opts) => loadStocks(opts), [open], { enabled: open });

  const openAndFocus = () => {
    setOpen(true);
    inputRef.current?.focus();
  };

  const handleClose = () => {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  };

  useImperativeHandle(ref, () => ({
    focus: openAndFocus,
    close: handleClose,
  }));

  useEffect(() => {
    if (!enableShortcut) return undefined;
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enableShortcut]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        handleClose();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

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

  useEffect(() => {
    if (!open || !listRef.current) return;
    const activeItem = listRef.current.querySelector(`[data-search-index="${activeIndex}"]`);
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, open]);

  const go = (stock) => {
    handleClose();
    inputRef.current?.blur();
    navigate(`/stocks/${stock.ticker}`);
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleClose();
      inputRef.current?.blur();
      return;
    }
    if (!open) {
      setOpen(true);
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault();
      go(results[activeIndex]);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        onClick={() => inputRef.current?.focus()}
        className={`flex h-9 cursor-text items-center gap-2 rounded-badges border bg-surface-2 px-3.5 text-xs transition-colors duration-150 ${
          open
            ? 'border-[var(--color-iris-gleam)] bg-surface text-text'
            : 'border-transparent text-text-muted hover:border-border hover:text-text'
        } w-40 sm:w-56 xl:w-60`}
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-text-muted" strokeWidth={1.75} aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls="stock-search-listbox"
          aria-label="Cari saham"
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
            if (!open) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className="h-full min-w-0 flex-1 bg-transparent text-xs text-text placeholder:text-text-muted focus:outline-none focus-visible:outline-none"
        />
        {showShortcut && !query && (
          <kbd className="pointer-events-none hidden shrink-0 rounded-badges border border-border bg-surface px-2 py-0.5 font-sans text-micro text-text-muted sm:inline">
            Ctrl K
          </kbd>
        )}
      </div>

      {open && (
        <div
          style={{ top: 'calc(100% + 6px)', boxShadow: 'var(--shadow-dropdown)' }}
          className={`animate-dropdown-in absolute z-50 w-[min(400px,calc(100vw-24px))] rounded-[10px] border border-border bg-surface p-1.5 ${
            align === 'left' ? 'left-0' : 'right-0'
          }`}
        >
          {loading && (
            <div className="space-y-1.5 p-2">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-9 rounded-[6px]" />
              ))}
            </div>
          )}

          {error && (
            <div className="p-3">
              <ErrorState compact error={error} onRetry={reload} />
            </div>
          )}

          {!loading && !error && results.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-text-muted">
              Tidak ada saham yang cocok dengan “{query}”.
            </p>
          )}

          {!loading && !error && results.length > 0 && (
            <ul
              id="stock-search-listbox"
              ref={listRef}
              role="listbox"
              aria-label="Hasil pencarian saham"
              className="max-h-[320px] space-y-0.5 overflow-y-auto"
            >
              {results.map((stock, index) => {
                const isSelected = index === activeIndex;
                return (
                  <li
                    key={stock.stock_id}
                    role="option"
                    aria-selected={isSelected}
                    data-search-index={index}
                  >
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => go(stock)}
                      className={`flex w-full items-center gap-2.5 rounded-[6px] px-3 py-2 text-left transition-colors duration-100 ${
                        isSelected ? 'bg-surface-2' : 'hover:bg-surface-2'
                      }`}
                    >
                      <StockLogo ticker={stock.ticker} size={28} />
                      <span className="num w-[56px] shrink-0 text-xs font-semibold text-text">
                        {stock.ticker}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-text-muted">
                        {stock.company_name}
                      </span>
                      {stock.sector && (
                        <span className="shrink-0 rounded-[6px] border border-border bg-bg px-2 py-0.5 text-[11px] leading-tight text-text-muted">
                          {stock.sector}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
});

export default SearchModal;
