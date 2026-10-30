import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import StockLogo from './StockLogo';

export default function StockSelectDropdown({
  id,
  stocks = [],
  value = '',
  onChange,
  placeholder = 'Pilih saham',
  allowEmpty = false,
  emptyLabel = 'Semua saham',
  disabled = false,
  className = '',
}) {
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedStock = useMemo(
    () => stocks.find((s) => s.ticker === value) || null,
    [stocks, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stocks;
    const starts = [];
    const contains = [];
    stocks.forEach((s) => {
      const ticker = s.ticker.toLowerCase();
      const name = (s.company_name || '').toLowerCase();
      if (ticker.startsWith(q)) starts.push(s);
      else if (ticker.includes(q) || name.includes(q)) contains.push(s);
    });
    return [...starts, ...contains];
  }, [stocks, query]);

  const handleClose = () => {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  };

  const toggleOpen = () => {
    if (disabled) return;
    if (open) {
      handleClose();
    } else {
      setOpen(true);
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  };

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

  useEffect(() => {
    if (!open || !listRef.current) return;
    const activeItem = listRef.current.querySelector(`[data-option-index="${activeIndex}"]`);
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, open]);

  const selectValue = (nextTicker) => {
    onChange?.(nextTicker);
    handleClose();
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleClose();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter' && filtered[activeIndex]) {
      event.preventDefault();
      selectValue(filtered[activeIndex].ticker);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggleOpen}
        className={`flex h-10 w-full items-center justify-between gap-2.5 rounded-inputs border bg-input px-3 text-left text-sm transition-colors duration-150 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
          open
            ? 'border-[var(--color-iris-gleam)]'
            : 'border-border hover:border-border-strong'
        }`}
      >
        {selectedStock ? (
          <span className="flex min-w-0 flex-1 items-center gap-2.5">
            <StockLogo ticker={selectedStock.ticker} size="sm" />
            <span className="num shrink-0 font-semibold text-text">{selectedStock.ticker}</span>
            <span className="truncate text-xs text-text-muted">— {selectedStock.company_name}</span>
          </span>
        ) : (
          <span className="truncate text-sm text-text-muted">
            {allowEmpty && value === '' ? emptyLabel : placeholder}
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-text-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          style={{ top: 'calc(100% + 6px)', boxShadow: 'var(--shadow-dropdown)' }}
          className="animate-dropdown-in absolute left-0 z-50 w-full min-w-[280px] rounded-[10px] border border-border bg-surface p-1.5"
        >
          <div className="mb-1.5 flex h-8 items-center gap-2 rounded-[6px] border border-border bg-bg px-2.5 focus-within:border-[var(--color-iris-gleam)]">
            <Search className="h-3.5 w-3.5 shrink-0 text-text-muted" strokeWidth={1.75} aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Cari kode atau nama emiten…"
              aria-label="Filter daftar saham"
              className="h-full min-w-0 flex-1 bg-transparent text-xs text-text placeholder:text-text-muted focus:outline-none focus-visible:outline-none"
            />
          </div>

          <ul
            ref={listRef}
            role="listbox"
            aria-label="Daftar saham"
            className="max-h-[260px] space-y-0.5 overflow-y-auto"
          >
            {allowEmpty && !query.trim() && (
              <li role="option" aria-selected={value === ''}>
                <button
                  type="button"
                  onClick={() => selectValue('')}
                  className={`flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-left text-xs transition-colors duration-100 ${
                    value === '' ? 'bg-surface-2 font-medium text-text' : 'text-text-muted hover:bg-surface-2 hover:text-text'
                  }`}
                >
                  {emptyLabel}
                </button>
              </li>
            )}

            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-text-muted">
                Tidak ada saham yang cocok dengan “{query}”.
              </li>
            ) : (
              filtered.map((s, index) => {
                const isSelected = index === activeIndex || s.ticker === value;
                return (
                  <li
                    key={s.stock_id}
                    role="option"
                    aria-selected={s.ticker === value}
                    data-option-index={index}
                  >
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectValue(s.ticker)}
                      className={`flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-left transition-colors duration-100 ${
                        isSelected ? 'bg-surface-2' : 'hover:bg-surface-2'
                      }`}
                    >
                      <StockLogo ticker={s.ticker} size={28} />
                      <span className="num w-[48px] shrink-0 text-xs font-semibold text-text">{s.ticker}</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-text-muted">{s.company_name}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

