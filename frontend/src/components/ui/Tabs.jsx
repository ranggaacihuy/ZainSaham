import { useRef } from 'react';

/**
 * Tabs bergaris bawah (navigasi konten) atau segmented control (pilihan nilai).
 * - variant="underline": role tablist
 * - variant="segmented": role radiogroup
 */
export function Tabs({ items, value, onChange, variant = 'underline', label, className = '', size = 'md', columns }) {
  const refs = useRef([]);
  const isSegmented = variant === 'segmented';

  const handleKeyDown = (event, index) => {
    let next = null;
    if (event.key === 'ArrowRight') next = (index + 1) % items.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    if (next === null) return;
    event.preventDefault();
    refs.current[next]?.focus();
    onChange(items[next].value);
  };

  if (isSegmented) {
    const layout = columns === 2 ? 'grid w-full grid-cols-2 gap-0.5' : 'inline-flex max-w-full';
    return (
      <div
        role="radiogroup"
        aria-label={label}
        className={`${layout} rounded-lg border border-border bg-bg p-0.5 ${className}`}
      >
        {items.map((item, index) => {
          const active = item.value === value;
          return (
            <button
              key={item.value}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              onKeyDown={(e) => handleKeyDown(e, index)}
              onClick={() => onChange(item.value)}
              className={`flex-1 whitespace-nowrap rounded-md px-3 font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                size === 'sm' ? 'h-7 text-xs' : 'h-8 text-sm'
              } ${active ? 'bg-surface-2 text-text' : 'text-text-muted hover:text-text'}`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div role="tablist" aria-label={label} className={`flex gap-1 overflow-x-auto border-b border-border ${className}`}>
      {items.map((item, index) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${item.value}`}
            aria-selected={active}
            aria-controls={`panel-${item.value}`}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onClick={() => onChange(item.value)}
            className={`-mb-px h-10 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
              active ? 'border-accent text-text' : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;

