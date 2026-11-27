import { useLayoutEffect, useRef, useState } from 'react';

export function Tabs({ items, value, onChange, variant = 'underline', label, className = '', size = 'md', columns }) {
  const containerRef = useRef(null);
  const refs = useRef([]);
  const isSegmented = variant === 'segmented';
  const activeIndex = items.findIndex((item) => item.value === value);

  const [indicator, setIndicator] = useState({ left: 0, width: 0, visible: false, ready: false });

  useLayoutEffect(() => {
    const containerEl = containerRef.current;
    const activeEl = refs.current[activeIndex];

    if (activeIndex === -1 || !containerEl || !activeEl) {
      setIndicator((prev) => ({ ...prev, visible: false, ready: false }));
      return;
    }

    const update = () => {
      const containerRect = containerEl.getBoundingClientRect();
      const elRect = activeEl.getBoundingClientRect();
      if (elRect.width === 0) return;

      const left = elRect.left - containerRect.left - containerEl.clientLeft + containerEl.scrollLeft;

      setIndicator((prev) => ({
        left,
        width: elRect.width,
        visible: true,
        ready: prev.ready,
      }));
    };

    update();

    let raf2;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setIndicator((prev) => (prev.visible && !prev.ready ? { ...prev, ready: true } : prev));
      });
    });

    const ro = new ResizeObserver(update);
    ro.observe(containerEl);
    ro.observe(activeEl);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      ro.disconnect();
    };
  }, [activeIndex, items.length, variant, size, columns]);

  const handleKeyDown = (event, index) => {
    let next = null;
    if (event.key === 'ArrowRight') next = (index + 1) % items.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    if (next === null) return;
    event.preventDefault();
    refs.current[next]?.focus();
    onChange(items[next].value);
  };

  const indicatorStyle = {
    width: `${indicator.width}px`,
    transform: `translate3d(${indicator.left}px, 0, 0)`,
    transition: indicator.ready
      ? 'transform 340ms cubic-bezier(0.22, 1, 0.36, 1), width 340ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease'
      : 'none',
  };

  if (isSegmented) {
    const layout = columns === 2 ? 'grid w-full grid-cols-2 gap-1' : 'inline-flex max-w-full gap-0.5';
    return (
      <div
        ref={containerRef}
        role="radiogroup"
        aria-label={label}
        className={`relative ${layout} rounded-lg border border-border bg-surface p-1 ${className}`}
      >
        {/* Sliding Segmented Pill */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-1 left-0 rounded-md bg-accent ${
            indicator.visible ? 'opacity-100' : 'opacity-0'
          }`}
          style={indicatorStyle}
        />

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
              className={`relative z-10 inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iris ${
                size === 'sm' ? 'h-7 text-xs' : 'h-8 text-sm'
              } ${active ? 'text-accent-ink' : 'text-text-muted hover:text-text'}`}
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
    <div
      ref={containerRef}
      role="tablist"
      aria-label={label}
      className={`relative flex gap-1 overflow-x-auto border-b border-border ${className}`}
    >
      {/* Sliding Underline Bar */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full bg-accent ${
          indicator.visible ? 'opacity-100' : 'opacity-0'
        }`}
        style={indicatorStyle}
      />

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
            className={`relative z-10 inline-flex h-10 items-center gap-2 whitespace-nowrap px-3.5 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-iris ${
              active ? 'text-text' : 'text-text-muted hover:text-text'
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