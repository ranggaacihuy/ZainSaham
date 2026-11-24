import { useEffect, useMemo, useRef, useState } from 'react';

const CHART_HEIGHT = 340;
const PAD = { top: 20, right: 16, bottom: 32, left: 64 };

function toFinite(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toEpochMs(ts) {
  const n = toFinite(ts);
  if (n === null) return null;
  return n < 1e12 ? n * 1000 : n;
}

function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = String(dateStr).split('-').map(Number);
  if (!y || !m || !d) return String(dateStr);
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

function formatAxisLabel(key, intraday, multiDay) {
  if (!intraday) return formatShortDate(key);
  const dt = new Date(key);
  if (Number.isNaN(dt.getTime())) return '';
  if (!multiDay) {
    return dt.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta',
    });
  }
  return dt.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  });
}

function formatTooltipLabel(key, intraday) {
  if (!intraday) return formatShortDate(key);
  const dt = new Date(key);
  if (Number.isNaN(dt.getTime())) return '';
  const formatted = dt.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  });
  return `${formatted} WIB`;
}

function formatPriceLabel(value, currency = 'IDR') {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const prefix = currency === 'USD' ? '$' : 'Rp ';
  return `${prefix}${new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: currency === 'USD' ? 2 : 0,
  }).format(value)}`;
}

function formatCompactPrice(value, currency = 'IDR') {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: currency === 'USD' ? 2 : 0,
  }).format(value);
}

function formatPctLabel(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export default function CompareChart({
  series = [],
  mode = 'pct',
  chartType = 'candle',
  intraday = false,
}) {
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

  useEffect(() => {
    setHoverIdx(null);
  }, [series, mode, chartType, intraday]);

  const chartData = useMemo(() => {
    const keySet = new Set();

    series.forEach((s) => {
      (s.prices || []).forEach((p) => {
        const close = toFinite(p.close_price);
        if (close === null || close <= 0) return;
        const key = intraday ? toEpochMs(p.timestamp) : p.price_date;
        if (key !== null && key !== undefined && key !== '') {
          keySet.add(key);
        }
      });
    });

    const keys = intraday
      ? Array.from(keySet).sort((a, b) => a - b)
      : Array.from(keySet).sort();

    if (keys.length < 2) {
      return { keys: [], lines: [], minVal: -5, maxVal: 5, multiDay: false };
    }

    let multiDay = false;
    if (intraday) {
      const firstDay = new Date(keys[0]).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
      const lastDay = new Date(keys[keys.length - 1]).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
      multiDay = firstDay !== lastDay;
    }

    const lines = series.map((s) => {
      const candleMap = new Map();

      (s.prices || []).forEach((p) => {
        const close = toFinite(p.close_price);
        if (close === null || close <= 0) return;
        const key = intraday ? toEpochMs(p.timestamp) : p.price_date;
        if (key === null || key === undefined || key === '') return;

        const rawOpen = toFinite(p.open_price);
        const open = rawOpen !== null && rawOpen > 0 ? rawOpen : close;
        const rawHigh = toFinite(p.high_price);
        const rawLow = toFinite(p.low_price);
        const high = Math.max(rawHigh !== null && rawHigh > 0 ? rawHigh : close, open, close);
        const low = Math.min(rawLow !== null && rawLow > 0 ? rawLow : close, open, close);

        candleMap.set(key, { open, high, low, close });
      });

      let basePrice = null;
      for (const k of keys) {
        const c = candleMap.get(k);
        if (c && c.close > 0) {
          basePrice = c.close;
          break;
        }
      }

      const toScale = (price) => {
        if (mode === 'pct') {
          return basePrice ? ((price - basePrice) / basePrice) * 100 : null;
        }
        return price;
      };

      const points = keys.map((k, idx) => {
        const c = candleMap.get(k);
        if (!c) {
          return {
            idx,
            key: k,
            open: null,
            high: null,
            low: null,
            close: null,
            pct: null,
            oVal: null,
            hVal: null,
            lVal: null,
            cVal: null,
            bullish: true,
          };
        }

        const pct = basePrice ? ((c.close - basePrice) / basePrice) * 100 : null;
        return {
          idx,
          key: k,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          pct,
          oVal: toScale(c.open),
          hVal: toScale(c.high),
          lVal: toScale(c.low),
          cVal: toScale(c.close),
          bullish: c.close >= c.open,
        };
      });

      const validPoints = points.filter((pt) => pt.cVal !== null);
      const lastPoint = validPoints.length > 0 ? validPoints[validPoints.length - 1] : null;

      return {
        ...s,
        points,
        lastPct: lastPoint?.pct ?? null,
        lastClose: lastPoint?.close ?? null,
      };
    });

    let minVal = Infinity;
    let maxVal = -Infinity;
    lines.forEach((line) => {
      line.points.forEach((pt) => {
        if (pt.cVal === null) return;
        if (chartType === 'candle') {
          if (pt.lVal !== null && pt.lVal < minVal) minVal = pt.lVal;
          if (pt.hVal !== null && pt.hVal > maxVal) maxVal = pt.hVal;
        } else {
          if (pt.cVal < minVal) minVal = pt.cVal;
          if (pt.cVal > maxVal) maxVal = pt.cVal;
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
      const padding = span * 0.1;
      minVal -= padding;
      maxVal += padding;
    }

    return { keys, lines, minVal, maxVal, multiDay };
  }, [series, mode, chartType, intraday]);

  const plotW = Math.max(100, width - PAD.left - PAD.right);
  const plotH = CHART_HEIGHT - PAD.top - PAD.bottom;

  const xFor = (idx) => {
    const total = chartData.keys.length;
    if (total <= 1) return PAD.left + plotW / 2;
    if (chartType === 'candle') {
      return PAD.left + ((idx + 0.5) / total) * plotW;
    }
    return PAD.left + (idx / (total - 1)) * plotW;
  };

  const yFor = (val) => {
    const span = chartData.maxVal - chartData.minVal || 1;
    const raw = PAD.top + ((chartData.maxVal - val) / span) * plotH;
    return Math.max(PAD.top, Math.min(PAD.top + plotH, raw));
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
    const total = chartData.keys.length;
    if (total < 2) return [];
    const maxLabels = width < 520 ? 3 : intraday && chartData.multiDay ? 5 : 6;
    const step = Math.max(1, Math.floor((total - 1) / (maxLabels - 1)));
    const indices = [];
    for (let i = 0; i < total; i += step) {
      indices.push(i);
    }
    if (indices[indices.length - 1] !== total - 1) {
      indices[indices.length - 1] = total - 1;
    }
    return indices;
  }, [chartData.keys.length, chartData.multiDay, intraday, width]);

  const handlePointerMove = (event) => {
    const total = chartData.keys.length;
    if (total < 2) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const relX = event.clientX - rect.left - PAD.left;
    const clamped = Math.max(0, Math.min(plotW, relX));
    const idx =
      chartType === 'candle'
        ? Math.min(total - 1, Math.max(0, Math.floor((clamped / plotW) * total)))
        : Math.round((clamped / plotW) * (total - 1));
    setHoverIdx(idx);
  };

  if (chartData.keys.length < 2) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-border bg-surface-2/40 text-sm text-text-muted">
        Data harga untuk interval ini belum cukup untuk menampilkan grafik perbandingan.
      </div>
    );
  }

  const zeroY = mode === 'pct' ? yFor(0) : null;
  const hoverX = hoverIdx !== null ? xFor(hoverIdx) : null;
  const tooltipOnLeft = hoverX !== null && hoverX > width * 0.58;

  const seriesCount = Math.max(1, chartData.lines.length);
  const slotW = plotW / chartData.keys.length;
  const groupW = Math.min(28, Math.max(4, slotW * 0.78));
  const innerGap = seriesCount > 1 ? Math.min(2, groupW * 0.08) : 0;
  const candleW = Math.max(2, (groupW - innerGap * (seriesCount - 1)) / seriesCount);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
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

        {chartType === 'candle' && seriesCount > 1 && (
          <span className="text-[11px] text-text-muted">
            Body penuh = naik · Body kosong = turun
          </span>
        )}
      </div>

      <div ref={containerRef} className="relative w-full select-none">
        <svg
          width={width}
          height={CHART_HEIGHT}
          viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
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
                    : new Intl.NumberFormat('id-ID', {
                        notation: 'compact',
                        maximumFractionDigits: 1,
                      }).format(tick)}
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
              {formatAxisLabel(chartData.keys[idx], intraday, chartData.multiDay)}
            </text>
          ))}

          {hoverIdx !== null && chartType === 'candle' && (
            <rect
              x={xFor(hoverIdx) - slotW / 2}
              y={PAD.top}
              width={slotW}
              height={plotH}
              fill="currentColor"
              className="text-text-muted"
              fillOpacity={0.07}
            />
          )}

          {chartType === 'candle'
            ? chartData.lines.map((line, lineIdx) => (
                <g key={line.ticker}>
                  {line.points.map((pt) => {
                    if (pt.cVal === null || pt.oVal === null || pt.hVal === null || pt.lVal === null) {
                      return null;
                    }
                    const cx =
                      xFor(pt.idx) -
                      groupW / 2 +
                      lineIdx * (candleW + innerGap) +
                      candleW / 2;
                    const yHigh = yFor(pt.hVal);
                    const yLow = yFor(pt.lVal);
                    const yOpen = yFor(pt.oVal);
                    const yClose = yFor(pt.cVal);
                    const bodyTop = Math.min(yOpen, yClose);
                    const bodyH = Math.max(1.5, Math.abs(yClose - yOpen));

                    const singleStock = seriesCount === 1;
                    const color = singleStock
                      ? pt.bullish
                        ? '#10b981'
                        : '#ef4444'
                      : line.color;
                    const fill =
                      singleStock || pt.bullish
                        ? color
                        : 'var(--color-surface, #ffffff)';

                    return (
                      <g key={pt.idx}>
                        <line
                          x1={cx}
                          y1={yHigh}
                          x2={cx}
                          y2={yLow}
                          stroke={color}
                          strokeWidth={1.2}
                        />
                        <rect
                          x={cx - candleW / 2}
                          y={bodyTop}
                          width={candleW}
                          height={bodyH}
                          rx={0.75}
                          fill={fill}
                          fillOpacity={singleStock ? 0.92 : pt.bullish ? 0.9 : 1}
                          stroke={color}
                          strokeWidth={1.15}
                        />
                      </g>
                    );
                  })}
                </g>
              ))
            : chartData.lines.map((line) => {
                let d = '';
                let started = false;
                line.points.forEach((pt) => {
                  if (pt.cVal === null) return;
                  const x = xFor(pt.idx).toFixed(2);
                  const y = yFor(pt.cVal).toFixed(2);
                  d += started ? ` L ${x} ${y}` : ` M ${x} ${y}`;
                  started = true;
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
              {chartType === 'line' &&
                chartData.lines.map((line) => {
                  const pt = line.points[hoverIdx];
                  if (!pt || pt.cVal === null) return null;
                  return (
                    <circle
                      key={line.ticker}
                      cx={hoverX}
                      cy={yFor(pt.cVal)}
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
              left: tooltipOnLeft ? Math.max(8, hoverX - 248) : Math.min(width - 248, hoverX + 14),
              top: 12,
            }}
            className="pointer-events-none absolute z-20 w-[236px] rounded-lg border border-border bg-surface/95 p-2.5 shadow-lg backdrop-blur-sm"
          >
            <p className="num mb-1.5 border-b border-border pb-1 text-[11px] font-medium text-text-muted">
              {formatTooltipLabel(chartData.keys[hoverIdx], intraday)}
            </p>
            <div className="space-y-2">
              {chartData.lines.map((line) => {
                const pt = line.points[hoverIdx];
                return (
                  <div key={line.ticker} className="space-y-0.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-medium text-text">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: line.color }}
                        />
                        <span className="num">{line.ticker}</span>
                      </span>
                      <span className="num flex items-center gap-1.5">
                        <span className="font-medium text-text">
                          {formatPriceLabel(pt?.close, line.currency)}
                        </span>
                        <span
                          className={`font-semibold ${
                            (pt?.pct ?? 0) > 0
                              ? 'text-emerald-500'
                              : (pt?.pct ?? 0) < 0
                                ? 'text-rose-500'
                                : 'text-text-muted'
                          }`}
                        >
                          {formatPctLabel(pt?.pct)}
                        </span>
                      </span>
                    </div>
                    {chartType === 'candle' && pt?.close !== null && (
                      <div className="num grid grid-cols-4 gap-1 pl-3.5 text-[10px] text-text-muted">
                        <span>O {formatCompactPrice(pt.open, line.currency)}</span>
                        <span>H {formatCompactPrice(pt.high, line.currency)}</span>
                        <span>L {formatCompactPrice(pt.low, line.currency)}</span>
                        <span>C {formatCompactPrice(pt.close, line.currency)}</span>
                      </div>
                    )}
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