import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Building2,
  RotateCcw,
  Scale,
  Trophy,
  X,
} from 'lucide-react';
import { compareStocks, getStocks } from '../api/stocks';
import CompareChart from '../components/CompareChart';
import StockLogo from '../components/StockLogo';
import StockSelectDropdown from '../components/StockSelectDropdown';

const MAX_SLOTS = 3;
const SERIES_COLORS = ['#6366f1', '#10b981', '#f59e0b'];
const RANGE_OPTIONS = [
  { value: '1B', label: '1B' },
  { value: '3B', label: '3B' },
  { value: '6B', label: '6B' },
  { value: '1T', label: '1T' },
  { value: '5T', label: '5T' },
];

const DEFAULT_PRESETS = [
  { label: 'Bank Big Caps', tickers: ['BBCA', 'BBRI', 'BMRI'] },
  { label: 'Telko', tickers: ['TLKM', 'ISAT', 'EXCL'] },
  { label: 'Energi & Batu Bara', tickers: ['ADRO', 'PTBA', 'ITMG'] },
  { label: 'Konsumer', tickers: ['ICBP', 'INDF', 'UNVR'] },
];

function formatCurrency(value, currency = 'IDR') {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const prefix = currency === 'USD' ? '$' : 'Rp ';
  const maxFrac = currency === 'USD' ? 2 : 0;
  return `${prefix}${new Intl.NumberFormat('id-ID', { maximumFractionDigits: maxFrac }).format(value)}`;
}

function formatCompactMoney(value, currency = 'IDR') {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const prefix = currency === 'USD' ? '$' : 'Rp ';

  if (abs >= 1e12) return `${sign}${prefix}${(abs / 1e12).toFixed(2)} T`;
  if (abs >= 1e9) return `${sign}${prefix}${(abs / 1e9).toFixed(2)} M`;
  if (abs >= 1e6) return `${sign}${prefix}${(abs / 1e6).toFixed(2)} Jt`;
  return `${sign}${prefix}${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(abs)}`;
}

function formatVolume(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)} M`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)} Jt`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)} Rb`;
  return new Intl.NumberFormat('id-ID').format(Math.round(value));
}

function formatSignedPct(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function formatPct(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(2)}%`;
}

function formatDecimal(value, suffix = '') {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(2)}${suffix}`;
}

function computeMetrics(item) {
  const prices = item.prices || [];
  const summary = item.stock?.summary || null;
  const indicator = item.indicator || null;
  const latestFund = item.fundamentals?.[0] || null;

  const closes = prices.map((p) => p.close_price).filter((v) => v !== null && v > 0);
  const highs = prices.map((p) => p.high_price ?? p.close_price).filter((v) => v !== null);
  const lows = prices.map((p) => p.low_price ?? p.close_price).filter((v) => v !== null);
  const volumes = prices.map((p) => p.volume).filter((v) => v !== null && v >= 0);

  const firstClose = closes.length > 0 ? closes[0] : null;
  const lastClose = summary?.close ?? (closes.length > 0 ? closes[closes.length - 1] : null);
  const periodReturn =
    firstClose && closes.length >= 2 ? ((closes[closes.length - 1] - firstClose) / firstClose) * 100 : null;

  const periodHigh = highs.length > 0 ? Math.max(...highs) : null;
  const periodLow = lows.length > 0 ? Math.min(...lows) : null;
  const avgVolume = volumes.length > 0 ? volumes.reduce((acc, v) => acc + v, 0) / volumes.length : null;

  let volatility = null;
  let maxDrawdown = null;
  if (closes.length >= 3) {
    const dailyReturns = [];
    let peak = closes[0];
    let worstDd = 0;

    for (let i = 1; i < closes.length; i += 1) {
      if (closes[i - 1] > 0) {
        dailyReturns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
      }
      if (closes[i] > peak) peak = closes[i];
      if (peak > 0) {
        const dd = ((closes[i] - peak) / peak) * 100;
        if (dd < worstDd) worstDd = dd;
      }
    }

    if (dailyReturns.length >= 2) {
      const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
      const variance =
        dailyReturns.reduce((acc, r) => acc + (r - mean) ** 2, 0) / (dailyReturns.length - 1);
      volatility = Math.sqrt(variance) * Math.sqrt(252) * 100;
    }
    maxDrawdown = worstDd;
  }

  const netProfitMargin =
    latestFund?.revenue && latestFund.revenue !== 0 && latestFund?.net_income !== null
      ? (latestFund.net_income / latestFund.revenue) * 100
      : null;

  const estimatedPer =
    lastClose !== null && latestFund?.eps !== null && latestFund.eps > 0
      ? lastClose / latestFund.eps
      : null;

  const vsSma20 =
    lastClose !== null && indicator?.sma_20 ? ((lastClose - indicator.sma_20) / indicator.sma_20) * 100 : null;
  const vsSma50 =
    lastClose !== null && indicator?.sma_50 ? ((lastClose - indicator.sma_50) / indicator.sma_50) * 100 : null;

  return {
    lastClose,
    changePct: summary?.change_pct ?? null,
    changeValue: summary?.change_value ?? null,
    volume: summary?.volume ?? (volumes.length > 0 ? volumes[volumes.length - 1] : null),
    avgVolume,
    periodReturn,
    periodHigh,
    periodLow,
    volatility,
    maxDrawdown,
    indicator,
    vsSma20,
    vsSma50,
    latestFund,
    netProfitMargin,
    estimatedPer,
  };
}

function getBestIndices(values, mode, { positiveOnly = false, nonNegativeOnly = false } = {}) {
  if (!mode || values.length < 2) return new Set();
  const valid = values
    .map((val, idx) => ({ val, idx }))
    .filter(({ val }) => {
      if (val === null || val === undefined || !Number.isFinite(val)) return false;
      if (positiveOnly && val <= 0) return false;
      if (nonNegativeOnly && val < 0) return false;
      return true;
    });

  if (valid.length < 2) return new Set();
  const target =
    mode === 'max'
      ? Math.max(...valid.map((v) => v.val))
      : Math.min(...valid.map((v) => v.val));

  const allEqual = valid.every((v) => Math.abs(v.val - target) < 1e-9);
  if (allEqual) return new Set();

  return new Set(valid.filter((v) => Math.abs(v.val - target) < 1e-9).map((v) => v.idx));
}

function rsiStatus(rsi) {
  if (rsi === null || rsi === undefined) return null;
  if (rsi >= 70) return { label: 'Overbought', cls: 'bg-rose-500/15 text-rose-500' };
  if (rsi <= 30) return { label: 'Oversold', cls: 'bg-emerald-500/15 text-emerald-500' };
  return { label: 'Netral', cls: 'bg-surface-2 text-text-muted' };
}

function parseSlotsFromParams(searchParams) {
  const raw = searchParams.get('tickers') || '';
  const list = raw
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, MAX_SLOTS);
  return [list[0] || '', list[1] || '', list[2] || ''];
}

export default function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [stocks, setStocks] = useState([]);
  const [stocksLoading, setStocksLoading] = useState(true);

  const [slots, setSlots] = useState(() => parseSlotsFromParams(searchParams));
  const [range, setRange] = useState(() => {
    const param = (searchParams.get('range') || '6B').toUpperCase();
    return RANGE_OPTIONS.some((r) => r.value === param) ? param : '6B';
  });
  const [chartMode, setChartMode] = useState('pct');

  const [compared, setCompared] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setStocksLoading(true);
    getStocks()
      .then((list) => {
        if (!cancelled) {
          setStocks(list);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Gagal memuat daftar saham.');
      })
      .finally(() => {
        if (!cancelled) setStocksLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeTickers = useMemo(() => {
    const unique = [];
    slots.forEach((t) => {
      if (t && !unique.includes(t)) unique.push(t);
    });
    return unique.slice(0, MAX_SLOTS);
  }, [slots]);

  const activeTickersKey = activeTickers.join(',');

  useEffect(() => {
    const next = new URLSearchParams();
    if (activeTickersKey) next.set('tickers', activeTickersKey);
    if (range !== '6B') next.set('range', range);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [activeTickersKey, range, searchParams, setSearchParams]);

  useEffect(() => {
    if (!activeTickersKey) {
      setCompared([]);
      setError('');
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    compareStocks(activeTickersKey.split(','), range)
      .then((data) => {
        if (!cancelled) setCompared(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Gagal memuat data perbandingan saham.');
          setCompared([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTickersKey, range]);

  const availablePresets = useMemo(() => {
    if (stocks.length === 0) return [];
    const tickerSet = new Set(stocks.map((s) => s.ticker));
    const matched = DEFAULT_PRESETS.map((p) => ({
      ...p,
      tickers: p.tickers.filter((t) => tickerSet.has(t)),
    })).filter((p) => p.tickers.length >= 2);

    if (matched.length > 0) return matched;

    const fallback = stocks
      .filter((s) => s.kind === 'stock')
      .slice(0, 3)
      .map((s) => s.ticker);
    return fallback.length >= 2 ? [{ label: 'Contoh Perbandingan', tickers: fallback }] : [];
  }, [stocks]);

  const updateSlot = (index, ticker) => {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = ticker;
      return next;
    });
  };

  const applyPreset = (tickers) => {
    setSlots([tickers[0] || '', tickers[1] || '', tickers[2] || '']);
  };

  const clearAll = () => {
    setSlots(['', '', '']);
  };

  const enriched = useMemo(
    () =>
      compared.map((item, idx) => ({
        ...item,
        color: SERIES_COLORS[idx % SERIES_COLORS.length],
        metrics: computeMetrics(item),
      })),
    [compared],
  );

  const chartSeries = useMemo(
    () =>
      enriched.map((item) => ({
        ticker: item.stock.ticker,
        companyName: item.stock.company_name,
        currency: item.stock.currency || 'IDR',
        color: item.color,
        prices: item.prices,
      })),
    [enriched],
  );

  const quickHighlights = useMemo(() => {
    if (enriched.length < 2) return [];
    const pickBest = (getter, mode, opts) => {
      const vals = enriched.map(getter);
      const best = getBestIndices(vals, mode, opts);
      if (best.size === 0) return null;
      const idx = Array.from(best)[0];
      return { item: enriched[idx], value: vals[idx] };
    };

    return [
      {
        title: `Performa Terbaik (${range})`,
        winner: pickBest((e) => e.metrics.periodReturn, 'max'),
        format: formatSignedPct,
      },
      {
        title: 'ROE Tertinggi',
        winner: pickBest((e) => e.metrics.latestFund?.roe ?? null, 'max'),
        format: formatPct,
      },
      {
        title: 'DER Paling Konservatif',
        winner: pickBest((e) => e.metrics.latestFund?.debt_to_equity ?? null, 'min', { nonNegativeOnly: true }),
        format: (v) => formatDecimal(v, 'x'),
      },
      {
        title: 'Volatilitas Terendah',
        winner: pickBest((e) => e.metrics.volatility, 'min', { positiveOnly: true }),
        format: formatPct,
      },
    ].filter((h) => h.winner !== null);
  }, [enriched, range]);

  const sections = useMemo(() => {
    if (enriched.length === 0) return [];
    return [
      {
        id: 'performance',
        title: 'Performa & Risiko Harga',
        icon: BarChart3,
        rows: [
          {
            label: 'Harga Terakhir',
            values: enriched.map((e) => e.metrics.lastClose),
            render: (v, e) => formatCurrency(v, e.stock.currency),
          },
          {
            label: 'Perubahan Harian',
            values: enriched.map((e) => e.metrics.changePct),
            bestMode: 'max',
            render: (v) => (
              <span className={v > 0 ? 'text-emerald-500' : v < 0 ? 'text-rose-500' : ''}>
                {formatSignedPct(v)}
              </span>
            ),
          },
          {
            label: `Return Periode (${range})`,
            values: enriched.map((e) => e.metrics.periodReturn),
            bestMode: 'max',
            render: (v) => (
              <span className={v > 0 ? 'text-emerald-500' : v < 0 ? 'text-rose-500' : ''}>
                {formatSignedPct(v)}
              </span>
            ),
          },
          {
            label: `Tertinggi (${range})`,
            values: enriched.map((e) => e.metrics.periodHigh),
            render: (v, e) => formatCurrency(v, e.stock.currency),
          },
          {
            label: `Terendah (${range})`,
            values: enriched.map((e) => e.metrics.periodLow),
            render: (v, e) => formatCurrency(v, e.stock.currency),
          },
          {
            label: 'Volatilitas Tahunan',
            values: enriched.map((e) => e.metrics.volatility),
            bestMode: 'min',
            bestOpts: { positiveOnly: true },
            render: (v) => formatPct(v),
          },
          {
            label: `Max Drawdown (${range})`,
            values: enriched.map((e) => e.metrics.maxDrawdown),
            bestMode: 'max',
            render: (v) => (
              <span className={v !== null && v < 0 ? 'text-rose-500' : ''}>{formatSignedPct(v)}</span>
            ),
          },
          {
            label: 'Volume Terakhir',
            values: enriched.map((e) => e.metrics.volume),
            bestMode: 'max',
            render: (v) => formatVolume(v),
          },
          {
            label: `Rata-rata Volume (${range})`,
            values: enriched.map((e) => e.metrics.avgVolume),
            bestMode: 'max',
            render: (v) => formatVolume(v),
          },
        ],
      },
      {
        id: 'technical',
        title: 'Indikator Teknikal Terkini',
        icon: Activity,
        rows: [
          {
            label: 'RSI (14)',
            values: enriched.map((e) => e.metrics.indicator?.rsi_14 ?? null),
            render: (v) => {
              const st = rsiStatus(v);
              return (
                <span className="inline-flex items-center gap-1.5">
                  <span>{formatDecimal(v)}</span>
                  {st && (
                    <span className={`rounded-badges px-1.5 py-0.5 text-[10px] font-medium ${st.cls}`}>
                      {st.label}
                    </span>
                  )}
                </span>
              );
            },
          },
          {
            label: 'MACD / Signal',
            values: enriched.map((e) => e.metrics.indicator?.macd ?? null),
            render: (_, e) => {
              const ind = e.metrics.indicator;
              if (!ind || ind.macd === null || ind.macd_signal === null) return '—';
              const bullish = ind.macd >= ind.macd_signal;
              return (
                <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                  <span>
                    {formatDecimal(ind.macd)} / {formatDecimal(ind.macd_signal)}
                  </span>
                  <span
                    className={`rounded-badges px-1.5 py-0.5 text-[10px] font-medium ${
                      bullish ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500'
                    }`}
                  >
                    {bullish ? 'Bullish' : 'Bearish'}
                  </span>
                </span>
              );
            },
          },
          {
            label: 'SMA 20 (vs Harga)',
            values: enriched.map((e) => e.metrics.indicator?.sma_20 ?? null),
            render: (v, e) =>
              v === null ? (
                '—'
              ) : (
                <span>
                  {formatCurrency(v, e.stock.currency)}{' '}
                  <span
                    className={`text-xs ${
                      (e.metrics.vsSma20 ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'
                    }`}
                  >
                    ({formatSignedPct(e.metrics.vsSma20)})
                  </span>
                </span>
              ),
          },
          {
            label: 'SMA 50 (vs Harga)',
            values: enriched.map((e) => e.metrics.indicator?.sma_50 ?? null),
            render: (v, e) =>
              v === null ? (
                '—'
              ) : (
                <span>
                  {formatCurrency(v, e.stock.currency)}{' '}
                  <span
                    className={`text-xs ${
                      (e.metrics.vsSma50 ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'
                    }`}
                  >
                    ({formatSignedPct(e.metrics.vsSma50)})
                  </span>
                </span>
              ),
          },
          {
            label: 'Tren MA (20 vs 50)',
            values: enriched.map((e) => {
              const ind = e.metrics.indicator;
              if (!ind || ind.sma_20 === null || ind.sma_50 === null) return null;
              return ind.sma_20 >= ind.sma_50 ? 1 : 0;
            }),
            render: (v) => {
              if (v === null) return '—';
              return (
                <span
                  className={`rounded-badges px-2 py-0.5 text-xs font-medium ${
                    v === 1 ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500'
                  }`}
                >
                  {v === 1 ? 'Uptrend (Golden)' : 'Downtrend (Death)'}
                </span>
              );
            },
          },
        ],
      },
      {
        id: 'fundamental',
        title: 'Fundamental Terbaru',
        icon: Building2,
        rows: [
          {
            label: 'Periode Laporan',
            values: enriched.map((e) => e.metrics.latestFund?.period || null),
            render: (v, e) =>
              v ? `${v}${e.metrics.latestFund?.period_type ? ` (${e.metrics.latestFund.period_type})` : ''}` : '—',
          },
          {
            label: 'Pendapatan (Revenue)',
            values: enriched.map((e) => e.metrics.latestFund?.revenue ?? null),
            bestMode: 'max',
            render: (v, e) => formatCompactMoney(v, e.stock.currency),
          },
          {
            label: 'Laba Bersih (Net Income)',
            values: enriched.map((e) => e.metrics.latestFund?.net_income ?? null),
            bestMode: 'max',
            render: (v, e) => formatCompactMoney(v, e.stock.currency),
          },
          {
            label: 'Net Profit Margin',
            values: enriched.map((e) => e.metrics.netProfitMargin),
            bestMode: 'max',
            render: (v) => formatPct(v),
          },
          {
            label: 'EPS',
            values: enriched.map((e) => e.metrics.latestFund?.eps ?? null),
            bestMode: 'max',
            render: (v, e) => formatCurrency(v, e.stock.currency),
          },
          {
            label: 'PER (Estimasi)',
            values: enriched.map((e) => e.metrics.estimatedPer),
            bestMode: 'min',
            bestOpts: { positiveOnly: true },
            render: (v) => formatDecimal(v, 'x'),
          },
          {
            label: 'ROE',
            values: enriched.map((e) => e.metrics.latestFund?.roe ?? null),
            bestMode: 'max',
            render: (v) => formatPct(v),
          },
          {
            label: 'ROA',
            values: enriched.map((e) => e.metrics.latestFund?.roa ?? null),
            bestMode: 'max',
            render: (v) => formatPct(v),
          },
          {
            label: 'Debt to Equity (DER)',
            values: enriched.map((e) => e.metrics.latestFund?.debt_to_equity ?? null),
            bestMode: 'min',
            bestOpts: { nonNegativeOnly: true },
            render: (v) => formatDecimal(v, 'x'),
          },
          {
            label: 'Total Aset',
            values: enriched.map((e) => e.metrics.latestFund?.total_assets ?? null),
            bestMode: 'max',
            render: (v, e) => formatCompactMoney(v, e.stock.currency),
          },
          {
            label: 'Total Liabilitas',
            values: enriched.map((e) => e.metrics.latestFund?.total_liabilities ?? null),
            render: (v, e) => formatCompactMoney(v, e.stock.currency),
          },
          {
            label: 'Total Ekuitas',
            values: enriched.map((e) => e.metrics.latestFund?.total_equity ?? null),
            bestMode: 'max',
            render: (v, e) => formatCompactMoney(v, e.stock.currency),
          },
        ],
      },
    ];
  }, [enriched, range]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-text">
            <Scale className="h-5 w-5 text-text-muted" strokeWidth={1.75} aria-hidden="true" />
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Bandingkan Saham</h1>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            Bandingkan hingga 3 emiten secara berdampingan berdasarkan performa harga, teknikal, dan fundamental.
          </p>
        </div>

        {activeTickers.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex h-9 items-center gap-1.5 self-start rounded-badges border border-border bg-surface px-3.5 text-xs font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text sm:self-auto"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reset Pilihan
          </button>
        )}
      </div>

      <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {slots.map((slotValue, idx) => {
            const otherSelected = new Set(slots.filter((v, i) => i !== idx && v));
            const options = stocks.filter((s) => !otherSelected.has(s.ticker));

            return (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor={`compare-slot-${idx}`} className="flex items-center gap-2 text-xs font-medium text-text-muted">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: SERIES_COLORS[idx] }}
                      aria-hidden="true"
                    />
                    Saham {idx + 1}
                  </label>
                  {slotValue && (
                    <button
                      type="button"
                      onClick={() => updateSlot(idx, '')}
                      aria-label={`Hapus saham ${idx + 1}`}
                      className="inline-flex items-center gap-0.5 text-[11px] text-text-muted transition-colors hover:text-text"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                      Hapus
                    </button>
                  )}
                </div>

                <StockSelectDropdown
                  id={`compare-slot-${idx}`}
                  stocks={options}
                  value={slotValue}
                  onChange={(val) => updateSlot(idx, val)}
                  placeholder={stocksLoading ? 'Memuat daftar saham…' : `Pilih saham ke-${idx + 1}`}
                  disabled={stocksLoading}
                />
              </div>
            );
          })}
        </div>

        {availablePresets.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3.5">
            <span className="text-xs text-text-muted">Preset cepat:</span>
            {availablePresets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset.tickers)}
                className="rounded-badges border border-border bg-surface-2 px-3 py-1 text-xs font-medium text-text transition-colors hover:border-border-strong hover:bg-bg"
              >
                {preset.label}{' '}
                <span className="num text-text-muted">({preset.tickers.join(' · ')})</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-500">
          {error}
        </div>
      )}

      {activeTickers.length === 0 ? (
        <section className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-text-muted">
            <Scale className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-text">Pilih Saham untuk Mulai Membandingkan</h2>
          <p className="mt-1 max-w-md text-sm text-text-muted">
            Pilih minimal 2 saham (maksimal 3) pada kolom di atas atau gunakan preset cepat untuk melihat perbandingan grafik dan metrik.
          </p>
        </section>
      ) : loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {activeTickers.map((t) => (
              <div key={t} className="h-28 animate-pulse rounded-xl border border-border bg-surface" />
            ))}
          </div>
          <div className="h-[380px] animate-pulse rounded-xl border border-border bg-surface" />
          <div className="h-[320px] animate-pulse rounded-xl border border-border bg-surface" />
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {enriched.map((item) => {
              const { stock, metrics, color } = item;
              const isUp = (metrics.changePct ?? 0) > 0;
              const isDown = (metrics.changePct ?? 0) < 0;

              return (
                <div
                  key={stock.stock_id}
                  className="relative overflow-hidden rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong"
                >
                  <div
                    className="absolute inset-x-0 top-0 h-1"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <StockLogo ticker={stock.ticker} size={36} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="num text-base font-semibold text-text">{stock.ticker}</span>
                          {stock.sector && (
                            <span className="truncate rounded-badges bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-text-muted">
                              {stock.sector}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-text-muted">{stock.company_name}</p>
                      </div>
                    </div>

                    <Link
                      to={`/stocks/${stock.ticker}`}
                      title={`Buka detail ${stock.ticker}`}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-badges border border-border bg-surface-2 text-text-muted transition-colors hover:text-text"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-2">
                    <div>
                      <p className="num text-xl font-semibold text-text">
                        {formatCurrency(metrics.lastClose, stock.currency)}
                      </p>
                      <p
                        className={`num mt-0.5 text-xs font-medium ${
                          isUp ? 'text-emerald-500' : isDown ? 'text-rose-500' : 'text-text-muted'
                        }`}
                      >
                        {formatSignedPct(metrics.changePct)} hari ini
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[11px] text-text-muted">Return {range}</p>
                      <p
                        className={`num text-sm font-semibold ${
                          (metrics.periodReturn ?? 0) > 0
                            ? 'text-emerald-500'
                            : (metrics.periodReturn ?? 0) < 0
                              ? 'text-rose-500'
                              : 'text-text'
                        }`}
                      >
                        {formatSignedPct(metrics.periodReturn)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>

          <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-text">Grafik Perbandingan Harga</h2>
                <p className="text-xs text-text-muted">
                  {chartMode === 'pct'
                    ? 'Perubahan kumulatif (%) dimulai dari titik 0% pada awal rentang.'
                    : 'Pergerakan harga penutupan nominal masing-masing emiten.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-badges border border-border bg-surface-2 p-0.5">
                  <button
                    type="button"
                    onClick={() => setChartMode('pct')}
                    className={`rounded-badges px-2.5 py-1 text-xs font-medium transition-colors ${
                      chartMode === 'pct' ? 'bg-accent text-accent-ink' : 'text-text-muted hover:text-text'
                    }`}
                  >
                    Relatif (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMode('price')}
                    className={`rounded-badges px-2.5 py-1 text-xs font-medium transition-colors ${
                      chartMode === 'price' ? 'bg-accent text-accent-ink' : 'text-text-muted hover:text-text'
                    }`}
                  >
                    Harga
                  </button>
                </div>

                <div className="inline-flex rounded-badges border border-border bg-surface-2 p-0.5">
                  {RANGE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRange(opt.value)}
                      className={`num rounded-badges px-2.5 py-1 text-xs font-medium transition-colors ${
                        range === opt.value
                          ? 'bg-accent text-accent-ink'
                          : 'text-text-muted hover:text-text'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <CompareChart series={chartSeries} mode={chartMode} />
          </section>

          {quickHighlights.length > 0 && (
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {quickHighlights.map((h) => (
                <div
                  key={h.title}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3.5"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
                      <Trophy className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                      {h.title}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: h.winner.item.color }}
                      />
                      <span className="num text-sm font-semibold text-text">
                        {h.winner.item.stock.ticker}
                      </span>
                    </div>
                  </div>
                  <span className="num shrink-0 rounded-badges bg-surface-2 px-2.5 py-1 text-xs font-semibold text-text">
                    {h.format(h.winner.value)}
                  </span>
                </div>
              ))}
            </section>
          )}

          <div className="space-y-5">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <section
                  key={section.id}
                  className="overflow-hidden rounded-xl border border-border bg-surface"
                >
                  <div className="flex items-center gap-2 border-b border-border bg-surface-2/50 px-4 py-3">
                    <Icon className="h-4 w-4 text-text-muted" strokeWidth={1.75} aria-hidden="true" />
                    <h2 className="text-sm font-semibold text-text">{section.title}</h2>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[540px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs text-text-muted">
                          <th className="w-[34%] px-4 py-2.5 font-medium">Metrik</th>
                          {enriched.map((item) => (
                            <th key={item.stock.stock_id} className="px-4 py-2.5 text-right font-semibold text-text">
                              <span className="inline-flex items-center justify-end gap-1.5">
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: item.color }}
                                />
                                <span className="num">{item.stock.ticker}</span>
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/70">
                        {section.rows.map((row) => {
                          const bestSet = getBestIndices(row.values, row.bestMode, row.bestOpts);
                          return (
                            <tr key={row.label} className="transition-colors hover:bg-surface-2/40">
                              <td className="px-4 py-2.5 text-xs font-medium text-text-muted sm:text-sm">
                                {row.label}
                              </td>
                              {enriched.map((item, idx) => {
                                const val = row.values[idx];
                                const isBest = bestSet.has(idx);
                                return (
                                  <td
                                    key={item.stock.stock_id}
                                    className={`num px-4 py-2.5 text-right text-xs sm:text-sm ${
                                      isBest ? 'bg-emerald-500/[0.06] font-semibold text-text' : 'text-text'
                                    }`}
                                  >
                                    {row.render(val, item)}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}