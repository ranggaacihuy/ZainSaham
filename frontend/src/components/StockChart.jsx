import { useEffect, useMemo, useState } from 'react';
import { CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';
import { Tabs } from './ui';
import useChart from '../hooks/useChart';
import { TIMEFRAMES, aggregatePrices } from '../lib/market';
import { continuesSeries, priceFormat, showLatest, volumeFormat, withAlpha } from '../lib/chart';
import { compact, date, idr, number } from '../lib/format';

const MODES = [
  { value: 'candle', label: 'Candle' },
  { value: 'line', label: 'Garis' },
];

function setupPriceChart(chart, colors) {
  const candle = chart.addSeries(CandlestickSeries, {
    upColor: colors.up,
    downColor: colors.down,
    wickUpColor: colors.up,
    wickDownColor: colors.down,
    borderVisible: false,
  });
  const line = chart.addSeries(LineSeries, { color: colors.accent, lineWidth: 2, visible: false });
  const volume = chart.addSeries(
    HistogramSeries,
    { priceFormat: volumeFormat, priceLineVisible: false, lastValueVisible: false },
    1,
  );

  const [pricePane, volumePane] = chart.panes();
  pricePane.setStretchFactor(4);
  volumePane.setStretchFactor(1);

  return {
    candle,
    line,
    volume,
    volumeColors: { up: withAlpha(colors.up, 0.4), down: withAlpha(colors.down, 0.4) },
  };
}

function candleOf(p) {
  const open = p.open_price ?? p.close_price;
  return {
    time: p.price_date,
    open,
    high: p.high_price ?? Math.max(open, p.close_price),
    low: p.low_price ?? Math.min(open, p.close_price),
    close: p.close_price,
  };
}

function lineOf(p) {
  return { time: p.price_date, value: p.close_price };
}

function volumeOf(p, colors) {
  const up = p.close_price >= (p.open_price ?? p.close_price);
  return { time: p.price_date, value: p.volume ?? 0, color: up ? colors.up : colors.down };
}

export default function StockChart({ prices = [], timeframe = '1H', onTimeframeChange, index = false }) {
  const [mode, setMode] = useState('candle');
  const { containerRef, apiRef, hoverIndex } = useChart(setupPriceChart);
  const bars = useMemo(() => aggregatePrices(prices, timeframe), [prices, timeframe]);

  useEffect(() => {
    const api = apiRef.current;
    api.candle.applyOptions({ visible: mode === 'candle' });
    api.line.applyOptions({ visible: mode === 'line' });
  }, [apiRef, mode]);

  useEffect(() => {
    const api = apiRef.current;
    const live = api.timeframe === timeframe && continuesSeries(api.bars, bars, 'price_date');
    api.bars = bars;
    api.timeframe = timeframe;

    if (live) {
      const last = bars[bars.length - 1];
      api.candle.update(candleOf(last));
      api.line.update(lineOf(last));
      api.volume.update(volumeOf(last, api.volumeColors));
      return;
    }

    const format = priceFormat(index ? 2 : 0);
    api.candle.applyOptions({ priceFormat: format });
    api.line.applyOptions({ priceFormat: format });
    api.candle.setData(bars.map(candleOf));
    api.line.setData(bars.map(lineOf));
    api.volume.setData(bars.map((p) => volumeOf(p, api.volumeColors)));
    showLatest(api.chart, bars.length);
  }, [apiRef, bars, timeframe, index]);

  const active = (hoverIndex !== null && bars[hoverIndex]) || bars[bars.length - 1];
  const formatPrice = index ? (value) => number(value, 2) : idr;

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <Tabs
          variant="segmented"
          size="sm"
          label="Ukuran candle"
          items={TIMEFRAMES}
          value={timeframe}
          onChange={(value) => onTimeframeChange?.(value)}
        />
        <Tabs variant="segmented" size="sm" label="Jenis grafik" items={MODES} value={mode} onChange={setMode} />
      </div>

      <div className="px-4 pb-4 pt-3">
        {active && (
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
                <dd className="text-text">{formatPrice(value)}</dd>
              </div>
            ))}
            <div className="flex gap-1">
              <dt>Vol</dt>
              <dd className="text-text">{compact(active.volume)}</dd>
            </div>
          </dl>
        )}

        <div ref={containerRef} role="figure" aria-label="Grafik harga dan volume" className="h-80 w-full sm:h-96" />

        <p className="mt-3 text-xs text-text-muted">Geser untuk menggulir, scroll atau cubit untuk zoom.</p>
      </div>
    </div>
  );
}
