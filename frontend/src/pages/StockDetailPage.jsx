import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ExternalLink, MessageSquareText } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton, SkeletonText, Tabs } from '../components/ui';
import StockChart from '../components/StockChart';
import TechnicalChart from '../components/TechnicalChart';
import FundamentalChart from '../components/FundamentalChart';
import NewsModal from '../components/NewsModal';
import NotFound from '../components/NotFound';
import WatchlistButton from '../components/WatchlistButton';
import useAsync from '../hooks/useAsync';
import { getByTicker, loadStocks } from '../lib/stocksStore';
import { getFundamentals, getIndicators, getNews, getPrices } from '../api/stocks';
import { RANGES, classifyPeriods, describeIndicators, filterByRange, summarizePrices } from '../lib/market';
import { compact, date, dateTime, idr, pct, signed, toneOf } from '../lib/format';

const TABS = [
  { value: 'grafik', label: 'Grafik' },
  { value: 'teknikal', label: 'Teknikal' },
  { value: 'fundamental', label: 'Fundamental' },
  { value: 'berita', label: 'Berita' },
];

const toneText = { up: 'text-up', down: 'text-down', neutral: 'text-text-muted' };

function rangeNote(result) {
  if (!result?.isPartial || !result.since) return null;
  return `Data tersedia sejak ${date(result.since)}.`;
}

function HeaderSkeleton() {
  return (
    <div className="mb-6 space-y-3">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-9 w-48" />
    </div>
  );
}

function PriceHeader({ stock, prices }) {
  const summary = prices.data ? summarizePrices(prices.data) : null;
  const tone = toneOf(summary?.change_pct);

  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-text">{stock.ticker}</h1>
          {stock.sector && <Badge>{stock.sector}</Badge>}
          {stock.exchange && <span className="text-xs text-text-muted">{stock.exchange}</span>}
        </div>
        <p className="mt-0.5 truncate text-sm text-text-muted">{stock.company_name}</p>

        <div className="mt-3">
          {prices.loading && <Skeleton className="h-9 w-56" />}
          {prices.error && <ErrorState compact error={prices.error} onRetry={prices.reload} />}
          {summary && (
            <>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="num text-display font-semibold text-text">{idr(summary.close)}</span>
                <span className={`num text-sm font-medium ${toneText[tone]}`}>
                  {signed(summary.change_value)} ({pct(summary.change_pct)})
                </span>
              </div>
              <dl className="num mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                {[
                  ['O', idr(summary.open)],
                  ['H', idr(summary.high)],
                  ['L', idr(summary.low)],
                  ['Vol', compact(summary.volume)],
                ].map(([label, value]) => (
                  <div key={label} className="flex gap-1">
                    <dt>{label}</dt>
                    <dd className="text-text">{value}</dd>
                  </div>
                ))}
                <div>
                  <dt className="sr-only">Tanggal data</dt>
                  <dd>Data per {date(summary.date)}</dd>
                </div>
              </dl>
            </>
          )}
          {prices.data && !summary && <p className="text-sm text-text-muted">Data harga belum tersedia.</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <WatchlistButton stock={stock} />
        <Button as={Link} to={`/ai-analysis?ticker=${stock.ticker}`} variant="primary" icon={MessageSquareText}>
          Analisis AI
        </Button>
      </div>
    </div>
  );
}

function ChartTab({ prices, range, onRangeChange }) {
  const filtered = useMemo(() => filterByRange(prices.data || [], range, 'price_date'), [prices.data, range]);
  if (prices.loading) return <Skeleton className="h-100 rounded-xl" />;
  if (prices.error) return <Card><ErrorState error={prices.error} onRetry={prices.reload} /></Card>;
  if (!prices.data?.length) return <Card><EmptyState message="Data harga belum tersedia untuk saham ini." /></Card>;
  return <StockChart prices={filtered.items} currentRange={range} onRangeChange={onRangeChange} note={rangeNote(filtered)} />;
}

function TechnicalTab({ stockId, prices, range, onRangeChange }) {
  const indicators = useAsync((opts) => getIndicators(stockId, opts), [stockId]);
  const filtered = useMemo(
    () => filterByRange(indicators.data || [], range, 'indicator_date'),
    [indicators.data, range],
  );
  const description = useMemo(() => {
    const list = indicators.data || [];
    const lastClose = prices.data?.length ? prices.data[prices.data.length - 1].close_price : null;
    return describeIndicators(list[list.length - 1], lastClose);
  }, [indicators.data, prices.data]);

  if (indicators.loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-22 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-57.5 rounded-xl" />
      </div>
    );
  }
  if (indicators.error) return <Card><ErrorState error={indicators.error} onRetry={indicators.reload} /></Card>;
  if (!indicators.data?.length) return <Card><EmptyState message="Data indikator teknikal belum tersedia untuk saham ini." /></Card>;

  return (
    <div className="space-y-4">
      <Tabs
        variant="segmented"
        size="sm"
        label="Rentang waktu"
        items={RANGES.map((r) => ({ value: r.value, label: r.label }))}
        value={range}
        onChange={onRangeChange}
      />
      <TechnicalChart history={filtered.items} description={description} note={rangeNote(filtered)} />
    </div>
  );
}

function FundamentalTab({ stockId }) {
  const fundamentals = useAsync((opts) => getFundamentals(stockId, opts), [stockId]);
  const [periodType, setPeriodType] = useState('quarterly');
  const periods = useMemo(() => classifyPeriods(fundamentals.data || []), [fundamentals.data]);

  if (fundamentals.loading) return <Skeleton className="h-105 rounded-xl" />;
  if (fundamentals.error) return <Card><ErrorState error={fundamentals.error} onRetry={fundamentals.reload} /></Card>;
  if (!fundamentals.data?.length) return <Card><EmptyState message="Data fundamental belum tersedia untuk saham ini." /></Card>;

  // Toggle hanya muncul bila pola periode benar-benar bisa dibedakan.
  if (periods.canToggle) {
    return (
      <FundamentalChart
        fundamentals={periodType === 'annual' ? periods.annual : periods.quarterly}
        periodType={periodType}
        onTypeChange={setPeriodType}
      />
    );
  }
  return <FundamentalChart fundamentals={fundamentals.data} />;
}

function NewsTab({ stock }) {
  const news = useAsync((opts) => getNews(stock.stock_id, opts), [stock.stock_id]);
  const [selected, setSelected] = useState(null);

  if (news.loading) {
    return (
      <Card>
        <div className="space-y-5">
          {[0, 1, 2].map((i) => (
            <SkeletonText key={i} lines={2} />
          ))}
        </div>
      </Card>
    );
  }
  if (news.error) return <Card><ErrorState error={news.error} onRetry={news.reload} /></Card>;
  if (!news.data?.length) return <Card><EmptyState message={`Belum ada berita untuk ${stock.ticker}.`} /></Card>;

  return (
    <Card padded={false}>
      <NewsModal news={selected} onClose={() => setSelected(null)} />
      <ul>
        {news.data.map((item) => (
          <li key={item.news_id} className="border-b border-border last:border-b-0">
            <button
              type="button"
              onClick={() => setSelected({ ...item, ticker: stock.ticker })}
              className="block w-full px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-2 sm:px-5"
            >
              <p className="text-sm font-medium text-text">{item.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-text-muted">{item.content}</p>
              <p className="mt-1.5 flex items-center gap-1 text-xs text-text-muted">
                {[item.source, dateTime(item.published_at)].filter(Boolean).join(' · ')}
                {item.source_url && <ExternalLink className="h-3 w-3" aria-hidden="true" />}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function StockDetailPage() {
  const { ticker } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [range, setRange] = useState('3B');
  const tab = TABS.some((t) => t.value === searchParams.get('tab')) ? searchParams.get('tab') : 'grafik';

  const stockState = useAsync(
    async (opts) => {
      if (opts?.force) await loadStocks({ force: true });
      return getByTicker(ticker);
    },
    [ticker],
  );
  const stock = stockState.data;
  const prices = useAsync((opts) => getPrices(stock.stock_id, opts), [stock?.stock_id], { enabled: Boolean(stock) });

  const setTab = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'grafik') next.delete('tab');
    else next.set('tab', value);
    setSearchParams(next, { replace: true });
  };

  const backLink = (
    <Link to="/stocks" className="mb-4 inline-flex items-center gap-1 text-sm text-text-muted transition-colors duration-150 hover:text-text">
      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      Daftar saham
    </Link>
  );

  if (stockState.loading) {
    return (
      <>
        {backLink}
        <HeaderSkeleton />
        <Skeleton className="h-100 rounded-xl" />
      </>
    );
  }

  if (stockState.error) {
    return (
      <>
        {backLink}
        <Card>
          <ErrorState error={stockState.error} onRetry={stockState.reload} />
        </Card>
      </>
    );
  }

  if (!stock) {
    return (
      <NotFound
        title={`Saham ${String(ticker).toUpperCase()} tidak ditemukan`}
        message="Periksa kembali kode saham atau cari dari daftar saham."
        actionLabel="Ke daftar saham"
        actionTo="/stocks"
      />
    );
  }

  return (
    <>
      {backLink}
      <PriceHeader stock={stock} prices={prices} />

      <Tabs items={TABS} value={tab} onChange={setTab} label="Bagian detail saham" className="mb-4" />

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'grafik' && <ChartTab prices={prices} range={range} onRangeChange={setRange} />}
        {tab === 'teknikal' && <TechnicalTab stockId={stock.stock_id} prices={prices} range={range} onRangeChange={setRange} />}
        {tab === 'fundamental' && <FundamentalTab stockId={stock.stock_id} />}
        {tab === 'berita' && <NewsTab stock={stock} />}
      </div>
    </>
  );
}
