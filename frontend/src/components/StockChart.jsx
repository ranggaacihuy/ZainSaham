import { useMemo, useState } from 'react';
import { Tabs } from './ui';
import useElementWidth from '../hooks/useElementWidth';
import { RANGES } from '../lib/market';
import { axisDate, compact, date, idr, number } from '../lib/format';

const PRICE_H = 240;
const GAP = 24;
const VOL_H = 64;
const AXIS_H = 20;
const TOTAL_H = PRICE_H + GAP + VOL_H + AXIS_H;
const RIGHT_AXIS = 64;
const LEFT_PAD = 8;

const MODES = [
  { value: 'candle', label: 'Candle' },
  { value: 'line', label: 'Garis' },
];

function niceTicks(min, max, count = 4) {
  if (max === min) return [min];
  const step = (max - min) / count;
  return Array.from({ length: count + 1 }, (_, i) => min + step * i);
}

/**
 * Grafik harga OHLC + volume.
 * `prices` sudah difilter sesuai rentang (lihat filterByRange). `note` menampilkan keterangan data.
 */
export default function StockChart({ prices = [], currentRange = '3B', onRangeChange, note }) {
  const [mode, setMode] = useState('candle');
  const [hoverIndex, setHoverIndex] = useState(null);
  const [containerRef, width] = useElementWidth(720);

  const geometry = useMemo(() => {
    if (prices.length === 0) return null;
    let min = Infinity;
    let max = -Infinity;
    let maxVol = 0;
    prices.forEach((p) => {
      const low = p.low_price ?? p.close_price;
      const high = p.high_price ?? p.close_price;
      if (low < min) min = low;
      if (high > max) max = high;
      if ((p.volume ?? 0) > maxVol) maxVol = p.volume;
    });
    const pad = (max - min) * 0.08 || max * 0.02 || 1;
    return { yMin: Math.max(0, min - pad), yMax: max + pad, maxVol };
  }, [prices]);

  const plotW = Math.max(40, width - RIGHT_AXIS - LEFT_PAD);
  const count = prices.length;
  const slot = count > 0 ? plotW / count : plotW;
  const getX = (i) => LEFT_PAD + slot * i + slot / 2;
  const getY = (v) => {
    const range = geometry.yMax - geometry.yMin || 1;
    return 8 + (1 - (v - geometry.yMin) / range) * (PRICE_H - 16);
  };
  const volTop = PRICE_H + GAP;
  const getVolH = (v) => (geometry.maxVol > 0 ? ((v ?? 0) / geometry.maxVol) * VOL_H : 0);

  const active = hoverIndex !== null && prices[hoverIndex] ? prices[hoverIndex] : prices[count - 1];
  // Rentang panjang (± di atas 6 bulan data bursa) memakai label "Okt 26".
  const longSpan = count > 130;

  const xLabelEvery = Math.max(1, Math.ceil(count / Math.max(2, Math.floor(plotW / 96))));

  const handlePointer = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left - LEFT_PAD;
    const index = Math.floor(x / slot);
    setHoverIndex(index >= 0 && index < count ? index : null);
  };

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <Tabs
          variant="segmented"
          size="sm"
          label="Rentang waktu"
          items={RANGES.map((r) => ({ value: r.value, label: r.label }))}
          value={currentRange}
          onChange={(value) => onRangeChange?.(value)}
        />
        <Tabs variant="segmented" size="sm" label="Jenis grafik" items={MODES} value={mode} onChange={setMode} />
      </div>

      <div className="px-4 pb-4 pt-3">
        {active ? (
          <dl className="num mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
            <div>
              <dt className="sr-only">Tanggal</dt>
              <dd className="text-text">{date(active.price_date)}</dd>
            </div>
            {[
              ['O', active.open_price],
              ['H', active.high_price],
              ['L', active.low_price],
              ['C', active.close_price],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-1">
                <dt>{label}</dt>
                <dd className="text-text">{idr(value)}</dd>
              </div>
            ))}
            <div className="flex gap-1">
              <dt>Vol</dt>
              <dd className="text-text">{compact(active.volume)}</dd>
            </div>
          </dl>
        ) : null}

        <div ref={containerRef} className="w-full min-w-0 overflow-hidden">
          {!geometry ? (
            <div className="flex h-60 items-center justify-center text-sm text-text-muted">
              Data harga belum tersedia.
            </div>
          ) : (
            <svg
              width={width}
              height={TOTAL_H}
              viewBox={`0 0 ${width} ${TOTAL_H}`}
              className="block touch-none select-none"
              role="img"
              aria-label="Grafik harga dan volume"
              onPointerMove={handlePointer}
              onPointerLeave={() => setHoverIndex(null)}
            >
              {/* Grid & label harga */}
              {niceTicks(geometry.yMin, geometry.yMax).map((tick) => {
                const y = getY(tick);
                return (
                  <g key={tick}>
                    <line x1={LEFT_PAD} x2={LEFT_PAD + plotW} y1={y} y2={y} className="stroke-border" strokeWidth="1" />
                    <text x={LEFT_PAD + plotW + 8} y={y + 4} className="num fill-text-muted" fontSize="12">
                      {number(tick, 0)}
                    </text>
                  </g>
                );
              })}
              <line x1={LEFT_PAD} x2={LEFT_PAD + plotW} y1={volTop + VOL_H} y2={volTop + VOL_H} className="stroke-border" />
              <text x={LEFT_PAD + plotW + 8} y={volTop + 12} className="fill-text-muted" fontSize="12">
                Vol
              </text>

              {/* Seri harga */}
              {mode === 'line' ? (
                <polyline
                  fill="none"
                  className="stroke-accent"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  points={prices.map((p, i) => `${getX(i)},${getY(p.close_price)}`).join(' ')}
                />
              ) : (
                prices.map((p, i) => {
                  const open = p.open_price ?? p.close_price;
                  const high = p.high_price ?? Math.max(open, p.close_price);
                  const low = p.low_price ?? Math.min(open, p.close_price);
                  const up = p.close_price >= open;
                  const x = getX(i);
                  const w = Math.max(1, Math.min(9, slot * 0.6));
                  const top = getY(Math.max(open, p.close_price));
                  const h = Math.max(1, Math.abs(getY(open) - getY(p.close_price)));
                  const tone = up ? 'up' : 'down';
                  return (
                    <g key={p.price_date} className={tone === 'up' ? 'fill-up stroke-up' : 'fill-down stroke-down'}>
                      <line x1={x} x2={x} y1={getY(high)} y2={getY(low)} strokeWidth="1" />
                      <rect x={x - w / 2} y={top} width={w} height={h} stroke="none" />
                    </g>
                  );
                })
              )}

              {/* Volume */}
              {prices.map((p, i) => {
                const h = getVolH(p.volume);
                const up = p.close_price >= (p.open_price ?? p.close_price);
                const w = Math.max(1, Math.min(8, slot * 0.6));
                return (
                  <rect
                    key={`v-${p.price_date}`}
                    x={getX(i) - w / 2}
                    y={volTop + VOL_H - h}
                    width={w}
                    height={h}
                    className={up ? 'fill-up/40' : 'fill-down/40'}
                  />
                );
              })}

              {/* Label tanggal */}
              {prices.map((p, i) =>
                i % xLabelEvery === 0 ? (
                  <text
                    key={`x-${p.price_date}`}
                    x={getX(i)}
                    y={TOTAL_H - 4}
                    textAnchor={i === 0 ? 'start' : 'middle'}
                    className="fill-text-muted"
                    fontSize="12"
                  >
                    {axisDate(p.price_date, longSpan)}
                  </text>
                ) : null,
              )}

              {/* Crosshair */}
              {hoverIndex !== null && prices[hoverIndex] && (
                <line
                  x1={getX(hoverIndex)}
                  x2={getX(hoverIndex)}
                  y1={0}
                  y2={volTop + VOL_H}
                  className="stroke-text-muted"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
              )}
            </svg>
          )}
        </div>

        {note && <p className="mt-3 text-xs text-text-muted">{note}</p>}
      </div>
    </div>
  );
}
