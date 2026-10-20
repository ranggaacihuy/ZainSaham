import { useState } from 'react';
import { Badge } from './ui';
import useElementWidth from '../hooks/useElementWidth';
import { axisDate, date, idr, number } from '../lib/format';

const CHART_H = 160;
const AXIS_H = 20;
const RIGHT_AXIS = 48;
const LEFT_PAD = 8;

/** Path SVG yang melompati nilai null (garis terputus, bukan bergeser). */
function buildPath(items, field, getX, getY) {
  let d = '';
  let penDown = false;
  items.forEach((item, i) => {
    const value = item[field];
    if (value === null || value === undefined) {
      penDown = false;
      return;
    }
    d += `${penDown ? 'L' : 'M'}${getX(i).toFixed(1)},${getY(value).toFixed(1)} `;
    penDown = true;
  });
  return d.trim();
}

function SummaryCard({ label, value, info }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-text-muted">{label}</span>
        <Badge tone={info.tone}>{info.label}</Badge>
      </div>
      <div className="num mt-2 text-xl font-semibold text-text">{value}</div>
    </div>
  );
}

function ChartFrame({ title, legend, children }) {
  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="text-sm font-medium text-text">{title}</h3>
        <div className="num flex flex-wrap items-center gap-3 text-xs text-text-muted">{legend}</div>
      </div>
      <div className="px-4 pb-3 pt-3">{children}</div>
    </div>
  );
}

function LegendItem({ swatch, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-0.5 w-3 ${swatch}`} aria-hidden="true" />
      {label}
    </span>
  );
}

/**
 * Indikator teknikal: ringkasan (dari describeIndicators) + grafik RSI dan MACD.
 * `history` sudah difilter sesuai rentang.
 */
export default function TechnicalChart({ history = [], description, note }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const [rsiRef, width] = useElementWidth(720);

  const count = history.length;
  const plotW = Math.max(40, width - RIGHT_AXIS - LEFT_PAD);
  const slot = count > 0 ? plotW / count : plotW;
  const getX = (i) => LEFT_PAD + slot * i + slot / 2;
  const xLabelEvery = Math.max(1, Math.ceil(count / Math.max(2, Math.floor(plotW / 96))));
  const longSpan = count > 130;

  const getRsiY = (v) => 8 + (1 - Math.max(0, Math.min(100, v)) / 100) * (CHART_H - 16);

  let macdMin = 0;
  let macdMax = 0;
  history.forEach((h) => {
    [h.macd, h.macd_signal].forEach((v) => {
      if (v !== null && v !== undefined) {
        macdMin = Math.min(macdMin, v);
        macdMax = Math.max(macdMax, v);
      }
    });
  });
  const macdPad = (macdMax - macdMin) * 0.1 || 1;
  const mMin = macdMin - macdPad;
  const mMax = macdMax + macdPad;
  const getMacdY = (v) => 8 + (1 - (v - mMin) / (mMax - mMin)) * (CHART_H - 16);

  const active = hoverIdx !== null && history[hoverIdx] ? history[hoverIdx] : history[count - 1];

  const handlePointer = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const index = Math.floor((event.clientX - rect.left - LEFT_PAD) / slot);
    setHoverIdx(index >= 0 && index < count ? index : null);
  };

  const xLabels = history.map((h, i) =>
    i % xLabelEvery === 0 ? (
      <text
        key={`x-${h.indicator_date}`}
        x={getX(i)}
        y={CHART_H + AXIS_H - 4}
        textAnchor={i === 0 ? 'start' : 'middle'}
        className="fill-text-muted"
        fontSize="12"
      >
        {axisDate(h.indicator_date, longSpan)}
      </text>
    ) : null,
  );

  const crosshair =
    hoverIdx !== null && history[hoverIdx] ? (
      <line
        x1={getX(hoverIdx)}
        x2={getX(hoverIdx)}
        y1={0}
        y2={CHART_H}
        className="stroke-text-muted"
        strokeDasharray="3 3"
      />
    ) : null;

  const svgProps = {
    width,
    height: CHART_H + AXIS_H,
    viewBox: `0 0 ${width} ${CHART_H + AXIS_H}`,
    className: 'block touch-none select-none',
    onPointerMove: handlePointer,
    onPointerLeave: () => setHoverIdx(null),
  };

  const d = description;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard label="RSI (14)" value={number(d.rsi.value)} info={d.rsi} />
        <SummaryCard
          label="MACD / Signal"
          value={`${number(d.macd.macd)} / ${number(d.macd.signal)}`}
          info={d.macd}
        />
        <SummaryCard label="SMA 20 / SMA 50" value={`${idr(d.sma.sma20)} / ${idr(d.sma.sma50)}`} info={d.sma} />
      </div>
      {d.date && <p className="text-xs text-text-muted">Indikator per {date(d.date)}.</p>}

      {count === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-4 py-10 text-center text-sm text-text-muted">
          Data indikator belum tersedia untuk rentang ini.
        </div>
      ) : (
        <>
          <ChartFrame
            title="RSI (14)"
            legend={
              <>
                <span>{date(active?.indicator_date)}</span>
                <span className="text-text">{number(active?.rsi_14)}</span>
              </>
            }
          >
            <div ref={rsiRef} className="w-full min-w-0 overflow-hidden">
              <svg {...svgProps} role="img" aria-label="Grafik RSI 14">
                {[30, 50, 70].map((level) => (
                  <g key={level}>
                    <line
                      x1={LEFT_PAD}
                      x2={LEFT_PAD + plotW}
                      y1={getRsiY(level)}
                      y2={getRsiY(level)}
                      className="stroke-border"
                      strokeDasharray={level === 50 ? undefined : '4 4'}
                    />
                    <text x={LEFT_PAD + plotW + 8} y={getRsiY(level) + 4} className="num fill-text-muted" fontSize="12">
                      {level}
                    </text>
                  </g>
                ))}
                <path d={buildPath(history, 'rsi_14', getX, getRsiY)} fill="none" className="stroke-accent" strokeWidth="1.5" strokeLinejoin="round" />
                {crosshair}
                {xLabels}
              </svg>
            </div>
          </ChartFrame>

          <ChartFrame
            title="MACD"
            legend={
              <>
                <LegendItem swatch="bg-accent" label={`MACD ${number(active?.macd)}`} />
                <LegendItem swatch="bg-text-muted" label={`Signal ${number(active?.macd_signal)}`} />
              </>
            }
          >
            <div className="w-full min-w-0 overflow-hidden">
              <svg {...svgProps} role="img" aria-label="Grafik MACD dan signal">
                {[mMax - (mMax - mMin) * 0.1, 0, mMin + (mMax - mMin) * 0.1].map((tick) => (
                  <g key={tick}>
                    <line
                      x1={LEFT_PAD}
                      x2={LEFT_PAD + plotW}
                      y1={getMacdY(tick)}
                      y2={getMacdY(tick)}
                      className="stroke-border"
                    />
                    <text x={LEFT_PAD + plotW + 8} y={getMacdY(tick) + 4} className="num fill-text-muted" fontSize="12">
                      {number(tick, Math.abs(tick) >= 100 ? 0 : 1)}
                    </text>
                  </g>
                ))}
                {history.map((h, i) => {
                  if (h.macd === null || h.macd_signal === null) return null;
                  const diff = h.macd - h.macd_signal;
                  const y0 = getMacdY(0);
                  const y1 = getMacdY(diff);
                  const w = Math.max(1, Math.min(6, slot * 0.6));
                  return (
                    <rect
                      key={`h-${h.indicator_date}`}
                      x={getX(i) - w / 2}
                      y={Math.min(y0, y1)}
                      width={w}
                      height={Math.max(1, Math.abs(y1 - y0))}
                      className={diff >= 0 ? 'fill-up/40' : 'fill-down/40'}
                    />
                  );
                })}
                <path d={buildPath(history, 'macd', getX, getMacdY)} fill="none" className="stroke-accent" strokeWidth="1.5" strokeLinejoin="round" />
                <path
                  d={buildPath(history, 'macd_signal', getX, getMacdY)}
                  fill="none"
                  className="stroke-text-muted"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                  strokeLinejoin="round"
                />
                {crosshair}
                {xLabels}
              </svg>
            </div>
          </ChartFrame>
        </>
      )}

      {note && <p className="text-xs text-text-muted">{note}</p>}
    </div>
  );
}
