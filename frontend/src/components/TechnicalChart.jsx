import { useEffect, useMemo } from 'react';
import { HistogramSeries, LineSeries, LineStyle, createTextWatermark } from 'lightweight-charts';
import { Badge, Tabs } from './ui';
import useChart from '../hooks/useChart';
import { TIMEFRAMES, aggregatePrices } from '../lib/market';
import { indicatorSeries } from '../lib/indicators';
import { continuesSeries, priceFormat, showLatest, withAlpha } from '../lib/chart';
import { date, idr, number } from '../lib/format';

const indicatorFormat = priceFormat(2);

function paneLabel(pane, text, colors) {
  return createTextWatermark(pane, {
    horzAlign: 'left',
    vertAlign: 'top',
    lines: [{ text, color: colors.muted, fontSize: 12 }],
  });
}

function setupIndicatorChart(chart, colors) {
  const line = { lineWidth: 2, priceLineVisible: false, priceFormat: indicatorFormat };

  const rsi = chart.addSeries(LineSeries, {
    ...line,
    color: colors.accent,
    autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
  });
  rsi.priceScale().applyOptions({ scaleMargins: { top: 0.1, bottom: 0.1 } });
  const rsiLines = [70, 30].map((price) =>
    rsi.createPriceLine({ price, color: colors.muted, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true }),
  );

  const histogram = chart.addSeries(
    HistogramSeries,
    { priceFormat: indicatorFormat, priceLineVisible: false, lastValueVisible: false },
    1,
  );
  const macd = chart.addSeries(LineSeries, { ...line, color: colors.accent }, 1);
  const signal = chart.addSeries(LineSeries, { ...line, color: colors.muted, lineStyle: LineStyle.Dashed }, 1);

  const [rsiPane, macdPane] = chart.panes();
  rsiPane.setStretchFactor(1);
  macdPane.setStretchFactor(1);
  const rsiWatermark = paneLabel(rsiPane, 'RSI (14)', colors);
  const macdWatermark = paneLabel(macdPane, 'MACD (12, 26, 9)', colors);

  return {
    rsi,
    histogram,
    macd,
    signal,
    histogramColors: { up: withAlpha(colors.up, 0.5), down: withAlpha(colors.down, 0.5) },
    applyTheme(nextColors) {
      rsi.applyOptions({ color: nextColors.accent });
      macd.applyOptions({ color: nextColors.accent });
      signal.applyOptions({ color: nextColors.muted });
      rsiLines.forEach((pl) => pl.applyOptions({ color: nextColors.muted }));
      rsiWatermark?.applyOptions?.({ lines: [{ text: 'RSI (14)', color: nextColors.muted, fontSize: 12 }] });
      macdWatermark?.applyOptions?.({ lines: [{ text: 'MACD (12, 26, 9)', color: nextColors.muted, fontSize: 12 }] });
      this.histogramColors = { up: withAlpha(nextColors.up, 0.5), down: withAlpha(nextColors.down, 0.5) };
      if (this.history) {
        histogram.setData(this.history.map((h) => histogramOf(h, this.histogramColors)));
      }
    },
  };
}

function point(time, value) {
  return value === null || value === undefined ? { time } : { time, value };
}

function histogramOf(h, colors) {
  if (h.macd === null || h.macd_signal === null) return { time: h.indicator_date };
  const value = h.macd - h.macd_signal;
  return { time: h.indicator_date, value, color: value >= 0 ? colors.up : colors.down };
}

function SummaryCard({ label, value, info }) {
  return (
    <div className="rounded-cards bg-surface p-4 shadow-subtle">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-text-muted">{label}</span>
        <Badge tone={info.tone}>{info.label}</Badge>
      </div>
      <div className="num mt-2 text-xl font-medium text-text">{value}</div>
    </div>
  );
}

function LegendItem({ swatch, label, value }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block h-0.5 w-3 ${swatch}`} aria-hidden="true" />
      <dt>{label}</dt>
      <dd className="text-text">{value}</dd>
    </div>
  );
}

export default function TechnicalChart({ prices = [], description, timeframe = '1H', onTimeframeChange, index = false }) {
  const { containerRef, apiRef, hoverIndex } = useChart(setupIndicatorChart);
  const history = useMemo(() => indicatorSeries(aggregatePrices(prices, timeframe)), [prices, timeframe]);

  useEffect(() => {
    const api = apiRef.current;
    const live = api.timeframe === timeframe && continuesSeries(api.history, history, 'indicator_date');
    api.history = history;
    api.timeframe = timeframe;

    const series = [
      [api.rsi, (h) => point(h.indicator_date, h.rsi_14)],
      [api.macd, (h) => point(h.indicator_date, h.macd)],
      [api.signal, (h) => point(h.indicator_date, h.macd_signal)],
      [api.histogram, (h) => histogramOf(h, api.histogramColors)],
    ];

    if (live) {
      const last = history[history.length - 1];
      series.forEach(([target, toPoint]) => target.update(toPoint(last)));
      return;
    }

    series.forEach(([target, toPoint]) => target.setData(history.map(toPoint)));
    showLatest(api.chart, history.length);
  }, [apiRef, history, timeframe]);

  const d = description;
  const active = (hoverIndex !== null && history[hoverIndex]) || history[history.length - 1];
  const histogram = active && active.macd !== null && active.macd_signal !== null ? active.macd - active.macd_signal : null;
  const formatPrice = index ? (value) => number(value, 2) : idr;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard label="RSI (14)" value={number(d.rsi.value)} info={d.rsi} />
        <SummaryCard
          label="MACD / Signal"
          value={`${number(d.macd.macd)} / ${number(d.macd.signal)}`}
          info={d.macd}
        />
        <SummaryCard
          label="SMA 20 / SMA 50"
          value={`${formatPrice(d.sma.sma20)} / ${formatPrice(d.sma.sma50)}`}
          info={d.sma}
        />
      </div>
      {d.date && <p className="text-xs text-text-muted">Indikator harian per {date(d.date)}.</p>}

      <div className="rounded-cards bg-surface shadow-subtle">
        <div className="border-b border-border px-4 py-3">
          <Tabs
            variant="segmented"
            size="sm"
            label="Ukuran candle"
            items={TIMEFRAMES}
            value={timeframe}
            onChange={(value) => onTimeframeChange?.(value)}
          />
        </div>

        <div className="px-4 pb-4 pt-3">
          {active && (
            <dl className="num mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
              <div>
                <dt className="sr-only">Tanggal</dt>
                <dd className="text-text">{date(active.indicator_date)}</dd>
              </div>
              <LegendItem swatch="bg-accent" label="RSI" value={number(active.rsi_14)} />
              <LegendItem swatch="bg-accent" label="MACD" value={number(active.macd)} />
              <LegendItem swatch="bg-text-muted" label="Signal" value={number(active.macd_signal)} />
              <LegendItem swatch={histogram < 0 ? 'bg-down' : 'bg-up'} label="Histogram" value={number(histogram)} />
            </dl>
          )}

          <div ref={containerRef} role="figure" aria-label="Grafik RSI dan MACD" className="h-90 w-full sm:h-105" />
        </div>
      </div>
    </div>
  );
}
