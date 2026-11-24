import { useEffect, useMemo, useRef, useState } from 'react';

const CHART_HEIGHT = 320;
const PAD = { top: 20, right: 16, bottom: 32, left: 64 };

function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

function formatPriceLabel(value, currency = 'IDR') {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const prefix = currency === 'USD' ? '$' : 'Rp ';
  return `${prefix}${new Intl.NumberFormat('id-ID', { maximumFractionDigits: currency === 'USD' ? 2 : 0 }).format(value)}`;
}

function formatPctLabel(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export default function CompareChart({ series = [], mode = 'pct' }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(720);
  const [hoverIdx, setHoverIdx] = useState(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const update = () => setWidth(Math.max(320, Math.floor(el.clientWidth)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const chartData = useMemo(() => {
    const dateSet = new Set();
    series.forEach((s) => {
      s.prices.forEach((p) => {
        if (p.price_date && p.close_price !== null) dateSet.add(p.price_date);
      });
    });

    const dates = Array.from(dateSet).sort();
    if (dates.length < 2) {
      return { dates: [], lines: [], minVal: -5, maxVal: 5 };
    }

    const lines = series.map((s) => {
      const priceMap = new Map();
      let basePrice = null;

      s.prices.forEach((p) => {
        if (p.price_date && p.close_price !== null) {
          priceMap.set(p.price_date, p.close_price);
          if (basePrice === null && p.close_price > 0) {
            basePrice = p.close_price;
          }
        }
      });

      const points = dates.map((d, idx) => {
        const close = priceMap.has(d) ? priceMap.get(d) : null;
        if (close === null) return { idx, date: d, close: null, value: null };
        const pct = basePrice ? ((close - basePrice) / basePrice) * 100 : null;
        return {
          idx,
          date: d,
          close,
          pct,
          value: mode === 'pct' ? pct : close,
        };
      });

      const validPoints = points.filter((pt) => pt.value !== null);
      const lastPoint = validPoints.length > 0 ? validPoints[validPoints.length - 1] : null;

      return {
        ...s,
        points,
        lastValue: lastPoint?.value ?? null,
        lastPct: lastPoint?.pct ?? null,
        lastClose: lastPoint?.close ?? null,
      };
    });

    let minVal = Infinity;
    let maxVal = -Infinity;
    lines.forEach((line) => {
      line.points.forEach((pt) => {
        if (pt.value !== null) {
          if (pt.value < minVal) minVal = pt.value;
          if (pt.value > maxVal) maxVal = pt.value;
        }
      });
    });

    if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
      minVal = -5;
      maxVal = 5;
    } else {
      if (mode === 'pct') {
        minVal = Math.min(minVal, 0);
        maxVal = Math.max(maxVal, 0);
      }
      const span = maxVal - minVal || Math.abs(maxVal) * 0.1 || 1;
      const padding = span * 0.12;
      minVal -= padding;
      maxVal += padding;
    }

    return { dates, lines, minVal, maxVal };
  }, [series, mode]);

  const plotW = Math.max(100, width - PAD.left - PAD.right);
  const plotH = CHART_HEIGHT - PAD.top - PAD.bottom;

  const xFor = (idx) => {
    if (chartData.dates.length <= 1) return PAD.left;
    return PAD.left + (idx / (chartData.dates.length - 1)) * plotW;
  };

  const yFor = (val) => {
    const span = chartData.maxVal - chartData.minVal || 1;
    return PAD.top + ((chartData.maxVal - val) / span) * plotH;
  };

  const yTicks = useMemo(() => {
    const count = 5;
    const ticks = [];
    for (let i = 0; i < count; i += 1) {
      const ratio = i / (count - 1);
      ticks.push(chartData.maxVal - ratio * (chartData.maxVal - chartData.minVal));
    }
    return ticks;
  }, [chartData.maxVal, chartData.minVal]);

  const xTicks = useMemo(() => {
    const total = chartData.dates.length;
    if (total < 2) return [];
    const maxLabels = width < 520 ? 4 : 6;
    const step = Math.max(1, Math.floor((total - 1) / (maxLabels - 1)));
    const indices = [];
    for (let i = 0; i < total; i += step) {
      indices.push(i);
    }
    if (indices[indices.length - 1] !== total - 1) {
      indices[indices.length - 1] = total - 1;
    }
    return indices;
  }, [chartData.dates.length, width]);

  const handlePointerMove = (event) => {
    if (chartData.dates.length < 2) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const relX = event.clientX - rect.left - PAD.left;
    const clamped = Math.max(0, Math.min(plotW, relX));
    const idx = Math.round((clamped / plotW) * (chartData.dates.length - 1));
    setHoverIdx(idx);
  };

  if (chartData.dates.length < 2) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-border bg-surface-2/40 text-sm text-text-muted">
        Data historis harga belum cukup untuk menampilkan grafik perbandingan.
      </div>
    );
  }

  const zeroY = mode === 'pct' ? yFor(0) : null;
  const hoverX = hoverIdx !== null ? xFor(hoverIdx) : null;
  const tooltipOnLeft = hoverX !== null && hoverX > width * 0.62;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        {chartData.lines.map((line) => (
          <div key={line.ticker} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: line.color }}
              aria-hidden="true"
            />
            <span className="num font-semibold text-text">{line.ticker}</span>
            <span
              className={`num font-medium ${
                (line.lastPct ?? 0) > 0
                  ? 'text-emerald-500'
                  : (line.lastPct ?? 0) < 0
                    ? 'text-rose-500'
                    : 'text-text-muted'
              }`}
            >
              {formatPctLabel(line.lastPct)}
            </span>
          </div>
        ))}
      </div>

      <div ref={containerRef} className="relative w-full select-none">
        <svg
          width={width}
          height={CHART_HEIGHT}
          className="block overflow-visible"
          onMouseMove={handlePointerMove}
          onMouseLeave={() => setHoverIdx(null)}
          role="img"
          aria-label="Grafik perbandingan performa saham"
        >
          {yTicks.map((tick, i) => {
            const y = yFor(tick);
            return (
              <g key={i}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={width - PAD.right}
                  y2={y}
                  stroke="currentColor"
                  className="text-border"
                  strokeOpacity={0.65}
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="num fill-current text-[11px] text-text-muted"
                >
                  {mode === 'pct'
                    ? `${tick > 0 ? '+' : ''}${tick.toFixed(1)}%`
                    : new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(tick)}
                </text>
              </g>
            );
          })}

          {zeroY !== null && zeroY >= PAD.top && zeroY <= PAD.top + plotH && (
            <line
              x1={PAD.left}
              y1={zeroY}
              x2={width - PAD.right}
              y2={zeroY}
              stroke="currentColor"
              className="text-text-muted"
              strokeDasharray="4 4"
              strokeOpacity={0.7}
              strokeWidth={1}
            />
          )}

          {xTicks.map((idx) => (
            <text
              key={idx}
              x={xFor(idx)}
              y={CHART_HEIGHT - 8}
              textAnchor="middle"
              className="num fill-current text-[11px] text-text-muted"
            >
              {formatShortDate(chartData.dates[idx])}
            </text>
          ))}

          {chartData.lines.map((line) => {
            let d = '';
            let drawing = false;
            line.points.forEach((pt) => {
              if (pt.value === null) {
                drawing = false;
                return;
              }
              const x = xFor(pt.idx).toFixed(2);
              const y = yFor(pt.value).toFixed(2);
              d += drawing ? ` L ${x} ${y}` : ` M ${x} ${y}`;
              drawing = true;
            });

            return (
              <path
                key={line.ticker}
                d={d.trim()}
                fill="none"
                stroke={line.color}
                strokeWidth={2.25}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}

          {hoverIdx !== null && (
            <g>
              <line
                x1={hoverX}
                y1={PAD.top}
                x2={hoverX}
                y2={PAD.top + plotH}
                stroke="currentColor"
                className="text-text-muted"
                strokeDasharray="3 3"
                strokeOpacity={0.8}
                strokeWidth={1}
              />
              {chartData.lines.map((line) => {
                const pt = line.points[hoverIdx];
                if (!pt || pt.value === null) return null;
                return (
                  <circle
                    key={line.ticker}
                    cx={hoverX}
                    cy={yFor(pt.value)}
                    r={4.5}
                    fill={line.color}
                    stroke="var(--color-surface, #ffffff)"
                    strokeWidth={2}
                  />
                );
              })}
            </g>
          )}
        </svg>

        {hoverIdx !== null && (
          <div
            style={{
              left: tooltipOnLeft ? Math.max(8, hoverX - 210) : Math.min(width - 210, hoverX + 14),
              top: 12,
            }}
            className="pointer-events-none absolute z-20 w-[196px] rounded-lg border border-border bg-surface/95 p-2.5 shadow-lg backdrop-blur-sm"
          >
            <p className="num mb-1.5 border-b border-border pb-1 text-[11px] font-medium text-text-muted">
              {formatShortDate(chartData.dates[hoverIdx])}
            </p>
            <div className="space-y-1.5">
              {chartData.lines.map((line) => {
                const pt = line.points[hoverIdx];
                return (
                  <div key={line.ticker} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-text">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: line.color }}
                      />
                      <span className="num">{line.ticker}</span>
                    </span>
                    <span className="num text-right">
                      <span
                        className={`block font-semibold ${
                          (pt?.pct ?? 0) > 0
                            ? 'text-emerald-500'
                            : (pt?.pct ?? 0) < 0
                              ? 'text-rose-500'
                              : 'text-text'
                        }`}
                      >
                        {formatPctLabel(pt?.pct)}
                      </span>
                      <span className="block text-[10px] text-text-muted">
                        {formatPriceLabel(pt?.close, line.currency)}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}