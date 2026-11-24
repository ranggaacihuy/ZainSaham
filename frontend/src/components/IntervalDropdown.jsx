import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { INTERVAL_GROUPS, getIntervalMeta } from '../lib/market';

export default function IntervalDropdown({ value = '1d', onChange, disabled = false }) {
  const containerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState({});

  const current = getIntervalMeta(value);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggleGroup = (id) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Interval candle"
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex h-8 items-center gap-1.5 rounded-buttons border px-2.5 text-xs font-medium transition-colors duration-150 focus:outline-none disabled:opacity-50 ${
          open
            ? 'border-[var(--color-iris-gleam)] bg-surface text-text'
            : current.intraday
              ? 'border-iris/40 bg-iris/10 text-text hover:border-iris'
              : 'border-border bg-surface text-text hover:border-border-strong hover:bg-surface-2'
        }`}
      >
        <Clock className="h-3.5 w-3.5 text-text-muted" strokeWidth={1.75} aria-hidden="true" />
        <span className="num">{current.label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-text-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Pilih interval candle"
          style={{ top: 'calc(100% + 6px)', boxShadow: 'var(--shadow-dropdown)' }}
          className="animate-dropdown-in absolute left-0 z-40 w-48 overflow-hidden rounded-[10px] border border-border bg-surface py-1.5"
        >
          {INTERVAL_GROUPS.map((group, groupIndex) => {
            const isCollapsed = Boolean(collapsed[group.id]);
            return (
              <div key={group.id} className={groupIndex > 0 ? 'mt-1 border-t border-border pt-1' : ''}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-[10px] font-semibold tracking-wider text-text-muted transition-colors hover:text-text"
                >
                  <span>{group.label}</span>
                  {isCollapsed ? (
                    <ChevronDown className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <ChevronUp className="h-3 w-3" aria-hidden="true" />
                  )}
                </button>

                {!isCollapsed && (
                  <div className="space-y-0.5 px-1.5 pb-1">
                    {group.items.map((item) => {
                      const active = item.value === value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => {
                            onChange?.(item.value);
                            setOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-[6px] px-2.5 py-1.5 text-left text-xs transition-colors duration-100 ${
                            active
                              ? 'bg-accent font-medium text-accent-ink'
                              : 'text-text hover:bg-surface-2'
                          }`}
                        >
                          <span>{item.label}</span>
                          <span
                            className={`num text-[11px] ${
                              active ? 'text-accent-ink/75' : 'text-text-muted'
                            }`}
                          >
                            {item.short}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
