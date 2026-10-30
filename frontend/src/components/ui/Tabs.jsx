import { useRef } from 'react';

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
    const layout = columns === 2 ? 'grid w-full grid-cols-2 gap-1' : 'inline-flex max-w-full gap-0.5';
    return (
      <div
        role="radiogroup"
        aria-label={label}
        className={`${layout} rounded-lg border border-border bg-surface p-1 ${className}`}
      >
        {items.map((item, index) => {
          const active = item.value === value;
          const Icon = item.icon;
          return (
            <button
              key={item.value}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={item.title}
              title={item.title}
              tabIndex={active ? 0 : -1}
              onKeyDown={(e) => handleKeyDown(e, index)}
              onClick={() => onChange(item.value)}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iris ${
                size === 'sm' ? 'h-7 text-xs' : 'h-8 text-sm'
              } ${active ? 'bg-accent text-accent-ink' : 'text-text-muted hover:bg-surface-2 hover:text-text'}`}
            >
              {Icon && <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />}
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
        const Icon = item.icon;
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
            className={`-mb-px inline-flex h-10 items-center gap-2 whitespace-nowrap border-b-2 px-3.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-iris ${
              active ? 'border-accent text-text' : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            {Icon && <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
