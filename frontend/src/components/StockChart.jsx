import { useEffect, useMemo, useRef, useState } from 'react';
import { CandlestickSeries, HistogramSeries, LineSeries, LineStyle } from 'lightweight-charts';
import { Minus, MousePointer2, RefreshCw, Square, Trash2, TrendingUp, Undo2 } from 'lucide-react';
import { Button, Tabs } from './ui';
import IntervalDropdown from './IntervalDropdown';
import useAsync from '../hooks/useAsync';
import useChart from '../hooks/useChart';
import { getIntradayPrices } from '../api/stocks';
import { aggregateByInterval, getIntervalMeta } from '../lib/market';
import { configureTimeScale, continuesSeries, priceFormat, showLatest, volumeFormat, withAlpha } from '../lib/chart';
import {
  DRAWING_PRESETS,
  DrawingPrimitive,
  loadDrawings,
  resolveDrawingColor,
  saveDrawings,
} from '../lib/chartDrawings';
import { compact, date, idr, intradayDateTime, number } from '../lib/format';

const MODES = [
  { value: 'candle', label: 'Candle' },
  { value: 'line', label: 'Garis' },
];

const TOOLS = [
  { value: 'cursor', label: 'Geser', icon: MousePointer2 },
  { value: 'hline', label: 'Garis S/R', icon: Minus },
  { value: 'trendline', label: 'Trendline', icon: TrendingUp },
  { value: 'zone', label: 'Area S/R', icon: Square },
];

const PRESET_DOT = {
  support: 'bg-up',
  resistance: 'bg-down',
  neutral: 'bg-iris',
};

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
    applyTheme(nextColors) {
      candle.applyOptions({
        upColor: nextColors.up,
        downColor: nextColors.down,
        wickUpColor: nextColors.up,
        wickDownColor: nextColors.down,
      });
      line.applyOptions({ color: nextColors.accent });
      this.volumeColors = { up: withAlpha(nextColors.up, 0.4), down: withAlpha(nextColors.down, 0.4) };
      if (this.bars) {
        volume.setData(this.bars.map((p) => volumeOf(p, this.volumeColors, this.isIntraday)));
      }
    },
  };
}

function barTime(p, isIntraday) {
  return isIntraday ? p.timestamp : p.price_date;
}

function candleOf(p, isIntraday) {
  const open = p.open_price ?? p.close_price;
  return {
    time: barTime(p, isIntraday),
    open,
    high: p.high_price ?? Math.max(open, p.close_price),
    low: p.low_price ?? Math.min(open, p.close_price),
    close: p.close_price,
  };
}

function lineOf(p, isIntraday) {
  return { time: barTime(p, isIntraday), value: p.close_price };
}

function volumeOf(p, colors, isIntraday) {
  const up = p.close_price >= (p.open_price ?? p.close_price);
  return { time: barTime(p, isIntraday), value: p.volume ?? 0, color: up ? colors.up : colors.down };
}

function timeFromParam(param, bars, isIntraday) {
  if (typeof param.time === 'number' || typeof param.time === 'string') return param.time;
  if (param.logical !== undefined && bars.length > 0) {
    const idx = Math.max(0, Math.min(bars.length - 1, Math.round(param.logical)));
    const bar = bars[idx];
    return bar ? barTime(bar, isIntraday) : null;
  }
  return null;
}

export default function StockChart({ stockId, ticker = '', prices = [], index = false }) {
  const [mode, setMode] = useState('candle');
  const [interval, setInterval] = useState('1d');
  const [tool, setTool] = useState('cursor');
  const [preset, setPreset] = useState('support');
  const [drawings, setDrawings] = useState(() => loadDrawings(ticker));
  const [pendingPoint, setPendingPoint] = useState(null);
  const [themeTick, setThemeTick] = useState(0);

  const { containerRef, apiRef, hoverIndex } = useChart(setupPriceChart);
  const intervalMeta = getIntervalMeta(interval);
  const isIntraday = Boolean(intervalMeta.intraday);

  const intraday = useAsync(
    (opts) => getIntradayPrices(stockId, interval, opts),
    [stockId, interval],
    { enabled: Boolean(stockId) && isIntraday },
  );

  const bars = useMemo(() => {
    if (isIntraday) return intraday.data?.candles || [];
    if (interval === '1w' || interval === '1mo') return aggregateByInterval(prices, interval);
    return prices;
  }, [isIntraday, intraday.data, interval, prices]);

  const precision = index ? 2 : 0;

  const primitiveRef = useRef(null);
  const attachedSeriesRef = useRef(null);
  const priceLinesRef = useRef([]);
  const toolRef = useRef(tool);
  const presetRef = useRef(preset);
  const modeRef = useRef(mode);
  const pendingRef = useRef(pendingPoint);
  const barsRef = useRef(bars);
  const isIntradayRef = useRef(isIntraday);

  useEffect(() => {
    toolRef.current = tool;
    presetRef.current = preset;
    modeRef.current = mode;
    pendingRef.current = pendingPoint;
    barsRef.current = bars;
    isIntradayRef.current = isIntraday;
  });

  // Simpan otomatis ke localStorage setiap daftar coretan berubah
  useEffect(() => {
    saveDrawings(ticker, drawings);
  }, [ticker, drawings]);

  // Ikuti perubahan tema agar warna garis/zone ikut ter-update
  useEffect(() => {
    const onTheme = () => setThemeTick((n) => n + 1);
    window.addEventListener('zainsaham:theme-change', onTheme);
    return () => window.removeEventListener('zainsaham:theme-change', onTheme);
  }, []);

  // Tekan Escape untuk batal menggambar / kembali ke mode Geser
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (pendingRef.current) {
        setPendingPoint(null);
        primitiveRef.current?.setState({ preview: null });
      } else if (toolRef.current !== 'cursor') {
        setTool('cursor');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    api.candle.applyOptions({ visible: mode === 'candle' });
    api.line.applyOptions({ visible: mode === 'line' });
  }, [apiRef, mode]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    const live = !isIntraday && api.interval === interval && continuesSeries(api.bars, bars, 'price_date');
    api.bars = bars;
    api.interval = interval;
    api.isIntraday = isIntraday;

    if (live) {
      const last = bars[bars.length - 1];
      api.candle.update(candleOf(last, false));
      api.line.update(lineOf(last, false));
      api.volume.update(volumeOf(last, api.volumeColors, false));
      return;
    }

    configureTimeScale(api.chart, isIntraday);
    const format = priceFormat(precision);
    api.candle.applyOptions({ priceFormat: format });
    api.line.applyOptions({ priceFormat: format, pointMarkersVisible: bars.length <= 1 });
    api.candle.setData(bars.map((p) => candleOf(p, isIntraday)));
    api.line.setData(bars.map((p) => lineOf(p, isIntraday)));
    api.volume.setData(bars.map((p) => volumeOf(p, api.volumeColors, isIntraday)));
    if (bars.length > 0) {
      showLatest(api.chart, bars.length);
    }
  }, [apiRef, bars, interval, precision, isIntraday]);

  // Sinkronisasi PriceLine (Garis S/R) dan DrawingPrimitive (Trendline & Area)
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    const activeSeries = mode === 'candle' ? api.candle : api.line;

    if (attachedSeriesRef.current && attachedSeriesRef.current !== activeSeries) {
      if (primitiveRef.current) {
        try {
          attachedSeriesRef.current.detachPrimitive(primitiveRef.current);
        } catch {
          // Abaikan jika chart sudah dibersihkan
        }
      }
      priceLinesRef.current.forEach((pl) => {
        try {
          attachedSeriesRef.current.removePriceLine(pl);
        } catch {}
      });
      priceLinesRef.current = [];
      attachedSeriesRef.current = null;
    }

    if (!primitiveRef.current) {
      primitiveRef.current = new DrawingPrimitive();
    }

    if (attachedSeriesRef.current !== activeSeries) {
      activeSeries.attachPrimitive(primitiveRef.current);
      attachedSeriesRef.current = activeSeries;
    }

    priceLinesRef.current.forEach((pl) => {
      try {
        activeSeries.removePriceLine(pl);
      } catch {}
    });
    priceLinesRef.current = drawings
      .filter((d) => d.type === 'hline')
      .map((d) => {
        const meta = DRAWING_PRESETS.find((p) => p.id === d.preset) || DRAWING_PRESETS[0];
        return activeSeries.createPriceLine({
          price: d.price,
          color: resolveDrawingColor(d.preset, api.colors),
          lineWidth: 1.5,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: meta.short,
        });
      });

    primitiveRef.current.setState({
      drawings,
      bars,
      colors: api.colors,
      precision,
    });
  }, [apiRef, drawings, bars, mode, precision, themeTick]);

  // Listener klik & gerak kursor untuk menggambar
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return undefined;

    const handleClick = (param) => {
      const activeTool = toolRef.current;
      if (activeTool === 'cursor' || !param.point) return;

      const activeSeries = modeRef.current === 'candle' ? api.candle : api.line;
      const rawPrice = activeSeries.coordinateToPrice(param.point.y);
      if (rawPrice === null || rawPrice === undefined || Number.isNaN(rawPrice)) return;

      const snappedPrice = index ? Number(rawPrice.toFixed(2)) : Math.round(rawPrice);

      if (activeTool === 'hline') {
        setDrawings((prev) => [
          ...prev,
          { id: `${Date.now()}-${Math.random()}`, type: 'hline', price: snappedPrice, preset: presetRef.current },
        ]);
        return;
      }

      const timeVal = timeFromParam(param, barsRef.current, isIntradayRef.current);
      if (timeVal === null || timeVal === undefined) return;

      const first = pendingRef.current;
      if (!first) {
        setPendingPoint({ time: timeVal, price: snappedPrice });
      } else {
        setDrawings((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}`,
            type: activeTool,
            t1: first.time,
            p1: first.price,
            t2: timeVal,
            p2: snappedPrice,
            preset: presetRef.current,
          },
        ]);
        setPendingPoint(null);
        primitiveRef.current?.setState({ preview: null });
      }
    };

    const handleMove = (param) => {
      const first = pendingRef.current;
      const activeTool = toolRef.current;
      if (!first || (activeTool !== 'trendline' && activeTool !== 'zone')) return;
      if (!param.point) {
        primitiveRef.current?.setState({ preview: null });
        return;
      }

      const activeSeries = modeRef.current === 'candle' ? api.candle : api.line;
      const rawPrice = activeSeries.coordinateToPrice(param.point.y);
      const timeVal = timeFromParam(param, barsRef.current, isIntradayRef.current);
      if (rawPrice === null || rawPrice === undefined || timeVal === null || timeVal === undefined) return;

      const snappedPrice = index ? Number(rawPrice.toFixed(2)) : Math.round(rawPrice);
      primitiveRef.current?.setState({
        preview: {
          type: activeTool,
          t1: first.time,
          p1: first.price,
          t2: timeVal,
          p2: snappedPrice,
          preset: presetRef.current,
        },
      });
    };

    api.chart.subscribeClick(handleClick);
    api.chart.subscribeCrosshairMove(handleMove);

    return () => {
      api.chart.unsubscribeClick(handleClick);
      api.chart.unsubscribeCrosshairMove(handleMove);
    };
  }, [apiRef, index]);

  const handleSelectInterval = (nextInterval) => {
    setPendingPoint(null);
    primitiveRef.current?.setState({ preview: null });
    setInterval(nextInterval);
  };

  const handleSelectTool = (nextTool) => {
    setTool(nextTool);
    setPendingPoint(null);
    primitiveRef.current?.setState({ preview: null });
  };

  const handleUndo = () => {
    setPendingPoint(null);
    primitiveRef.current?.setState({ preview: null });
    setDrawings((prev) => prev.slice(0, -1));
  };

  const handleClearAll = () => {
    setPendingPoint(null);
    primitiveRef.current?.setState({ preview: null });
    setDrawings([]);
  };

  const active = (hoverIndex !== null && bars[hoverIndex]) || bars[bars.length - 1];
  const formatPrice = index ? (value) => number(value, 2) : idr;

  const hintText =
    tool === 'hline'
      ? 'Klik level harga pada grafik untuk menaruh garis Support/Resistance. Tekan Esc untuk selesai.'
      : tool === 'trendline' || tool === 'zone'
        ? pendingPoint
          ? 'Klik titik kedua untuk menyelesaikan coretan. Tekan Esc untuk batal.'
          : 'Klik titik pertama pada grafik, lalu klik titik kedua. Tekan Esc untuk selesai.'
        : isIntraday
          ? `Candle interval ${intervalMeta.label} (${intervalMeta.rangeNote}, zona waktu WIB). Geser untuk menggulir, scroll atau cubit untuk zoom.`
          : 'Geser untuk menggulir, scroll atau cubit untuk zoom.';

  return (
    <div className="rounded-cards bg-surface shadow-subtle">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <IntervalDropdown value={interval} onChange={handleSelectInterval} />

          {isIntraday && (
            <div className="flex items-center gap-1.5">
              <span className="num hidden rounded-md border border-border bg-bg px-2 py-1 text-[11px] text-text-muted sm:inline-block">
                {intervalMeta.rangeNote} · WIB
              </span>
              <button
                type="button"
                onClick={intraday.reload}
                disabled={intraday.loading}
                title="Muat ulang data intraday"
                aria-label="Muat ulang data intraday"
                className="inline-flex h-8 w-8 items-center justify-center rounded-buttons border border-border bg-surface text-text-muted transition-colors duration-150 hover:border-border-strong hover:bg-surface-2 hover:text-text disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${intraday.loading ? 'animate-spin' : ''}`} strokeWidth={1.75} />
              </button>
            </div>
          )}
        </div>

        <Tabs variant="segmented" size="sm" label="Jenis grafik" items={MODES} value={mode} onChange={setMode} />
      </div>

      {/* Toolbar Coretan Support / Resistance */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-bg/40 px-4 py-2">
        <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Alat coret grafik">
          {TOOLS.map(({ value, label, icon: Icon }) => {
            const selected = tool === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => handleSelectTool(value)}
                aria-pressed={selected}
                className={`inline-flex items-center gap-1.5 rounded-buttons px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${
                  selected
                    ? 'bg-accent text-accent-ink'
                    : 'text-text-muted hover:bg-surface-2 hover:text-text'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}

          {tool !== 'cursor' && (
            <div className="ml-1 flex items-center gap-1 border-l border-border pl-2">
              {DRAWING_PRESETS.map((p) => {
                const selected = preset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPreset(p.id)}
                    aria-pressed={selected}
                    className={`inline-flex items-center gap-1.5 rounded-buttons px-2 py-1 text-xs transition-colors duration-150 ${
                      selected
                        ? 'bg-surface font-medium text-text shadow-subtle'
                        : 'text-text-muted hover:bg-surface-2 hover:text-text'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${PRESET_DOT[p.id]}`} aria-hidden="true" />
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {drawings.length > 0 && (
            <span className="num mr-1 text-xs text-text-muted">{drawings.length} coretan</span>
          )}
          <button
            type="button"
            onClick={handleUndo}
            disabled={drawings.length === 0}
            title="Hapus coretan terakhir"
            className="inline-flex items-center gap-1 rounded-buttons px-2 py-1 text-xs text-text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Undo</span>
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            disabled={drawings.length === 0}
            title="Hapus semua coretan"
            className="inline-flex items-center gap-1 rounded-buttons px-2 py-1 text-xs text-text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-down disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Hapus</span>
          </button>
        </div>
      </div>

      <div className="px-4 pb-4 pt-3">
        {isIntraday && intraday.error && (
          <div
            role="alert"
            className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-down/30 bg-down/[0.04] px-3.5 py-2.5 text-xs text-down"
          >
            <span>{intraday.error.message || 'Data intraday belum tersedia saat ini.'}</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={intraday.reload}>
                Coba lagi
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleSelectInterval('1d')}>
                Kembali ke 1 hari
              </Button>
            </div>
          </div>
        )}

        {active && (
          <dl className="num mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
            <div>
              <dt className="sr-only">Waktu</dt>
              <dd className="text-text">{isIntraday ? intradayDateTime(active.timestamp) : date(active.price_date)}</dd>
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

        <div className="relative">
          <div
            ref={containerRef}
            role="figure"
            aria-label="Grafik harga dan volume"
            className={`h-80 w-full sm:h-96 ${tool !== 'cursor' ? 'cursor-crosshair' : ''}`}
          />

          {isIntraday && intraday.loading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-surface/75">
              <div className="flex items-center gap-2 rounded-buttons border border-border bg-surface px-3.5 py-2 text-xs text-text-muted shadow-subtle">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border-strong border-t-text" aria-hidden="true" />
                <span>Memuat candle {intervalMeta.label}…</span>
              </div>
            </div>
          )}

          {isIntraday && !intraday.loading && !intraday.error && bars.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-surface/90 p-4 text-center">
              <p className="text-sm text-text-muted">Data candle {intervalMeta.label} belum tersedia untuk emiten ini.</p>
              <Button size="sm" variant="secondary" onClick={() => handleSelectInterval('1d')}>
                Lihat grafik harian
              </Button>
            </div>
          )}
        </div>

        <p className="mt-3 text-xs text-text-muted">{hintText}</p>
      </div>
    </div>
  );
}
