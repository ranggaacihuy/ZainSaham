import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, ArrowUpRight, Bookmark, TrendingDown, TrendingUp } from 'lucide-react';
import { Badge, Button, Card, Change, EmptyState, ErrorState, PageHeader, Skeleton, SkeletonText } from '../components/ui';
import Sparkline from '../components/Sparkline';
import StockLogo from '../components/StockLogo';
import NewsModal from '../components/NewsModal';
import useAsync from '../hooks/useAsync';
import { getDashboard } from '../api/dashboard';
import { analysisTypeLabel } from '../api/ai';
import { date, dateTime, idr, number, pct, signed, toneOf } from '../lib/format';

const toneText = { up: 'text-up', down: 'text-down', neutral: 'text-text' };
const tonePill = {
  up: 'bg-up/12 text-up',
  down: 'bg-down/12 text-down',
  neutral: 'bg-surface-2 text-text-muted',
};

function IndexCard({ dashboard }) {
  if (dashboard.loading) return <Skeleton className="col-span-full mb-6 min-h-52 w-full rounded-cards" />;

  const index = dashboard.data?.index;
  if (!index?.stock) return null;

  const { stock, summary } = index;
  const tone = toneOf(summary?.change_pct);

  return (
    <Link
      to={`/stocks/${stock.ticker}`}
      className="col-span-full mb-6 grid min-h-52 w-full grid-cols-1 items-center gap-6 rounded-cards bg-surface p-6 shadow-subtle transition-colors duration-150 hover:bg-surface-2 sm:p-7 lg:grid-cols-[minmax(240px,1fr)_minmax(280px,1.8fr)_minmax(220px,1fr)] lg:gap-8 lg:px-8"
    >
      {/* Left Zone */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-5 items-center rounded-badges border border-border bg-bg px-2.5 text-[11px] font-medium uppercase tracking-wider text-text-muted">
            Indeks Utama
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-text-muted" aria-hidden="true" />
            <span>IDX</span>
          </span>
        </div>
        <div className="mt-3 flex items-center gap-3.5">
          <StockLogo ticker={stock.ticker} size="lg" />
          <div className="min-w-0">
            <p className="num text-heading font-medium tracking-tight text-text sm:text-heading-lg">{stock.ticker}</p>
            <p className="mt-0.5 truncate text-sm text-text-muted">{stock.company_name}</p>
          </div>
        </div>
        {summary?.date && (
          <p className="num mt-2 flex items-center gap-1.5 text-xs text-text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-up" aria-hidden="true" />
            <span>Data penutupan · {date(summary.date)}</span>
          </p>
        )}
      </div>

      {/* Center Zone: Responsive Area Sparkline */}
      <div className="flex w-full items-center justify-center py-2">
        <Sparkline
          values={summary?.sparkline || []}
          width={640}
          height={108}
          strokeWidth={2}
          showArea
          className="h-24 w-full sm:h-28"
        />
      </div>

      {/* Right Zone: Giant Monospace Price + Semantic Pill Badge */}
      <div className="flex flex-col items-start lg:items-end lg:text-right">
        <p className="num text-heading-lg font-medium tracking-tight text-text sm:text-display-sm">
          {number(summary?.close, 2)}
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          <span className={`num inline-flex items-center rounded-badges px-3 py-1 text-xs font-medium sm:text-sm ${tonePill[tone]}`}>
            {signed(summary?.change_value, 2)} ({pct(summary?.change_pct)})
          </span>
        </div>
      </div>
    </Link>
  );
}

function StatCard({ label, icon: Icon, iconTone = 'text-text-muted bg-bg border-border', children, loading }) {
  return (
    <div className="flex flex-col justify-between rounded-cards bg-surface p-5 shadow-subtle">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-text-muted">{label}</p>
        {Icon && (
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${iconTone}`}
            aria-hidden="true"
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </span>
        )}
      </div>
      <div className="num mt-4 text-heading font-medium text-text">
        {loading ? <Skeleton className="h-8 w-24" /> : children}
      </div>
    </div>
  );
}

function ListSkeleton({ rows = 4, height = 'h-16' }) {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={height} />
      ))}
    </div>
  );
}

function WatchlistCard({ dashboard }) {
  const navigate = useNavigate();

  if (dashboard.loading) return <ListSkeleton rows={4} height="h-18" />;
  if (dashboard.error) return <ErrorState error={dashboard.error} onRetry={dashboard.reload} />;

  const items = dashboard.data.watchlist;
  if (items.length === 0) {
    return (
      <EmptyState
        message="Watchlist masih kosong."
        action={
          <Button as={Link} to="/stocks" size="sm" variant="primary">
            Cari saham
          </Button>
        }
      />
    );
  }

  return (
    <ul className="-mx-5 sm:-mx-6">
      {items.map((item) => {
        const ticker = item.stock?.ticker || `#${item.stock_id}`;
        return (
          <li key={item.watchlist_id} className="border-b border-border last:border-b-0">
            <button
              type="button"
              onClick={() => item.stock && navigate(`/stocks/${item.stock.ticker}`)}
              className="flex min-h-18 w-full items-center gap-3.5 px-5 py-3.5 text-left transition-colors duration-150 hover:bg-surface-2 sm:px-6"
            >
              <StockLogo ticker={ticker} size="md" />
              <div className="min-w-0 flex-1">
                <p className="num text-sm font-medium text-text sm:text-base">{ticker}</p>
                <p className="mt-0.5 truncate text-xs text-text-muted">{item.stock?.company_name}</p>
              </div>
              <div className="hidden shrink-0 sm:block">
                <Sparkline values={item.summary?.sparkline || []} width={132} height={36} strokeWidth={1.75} />
              </div>
              <div className="w-34 shrink-0 text-right sm:w-38">
                {item.summary ? (
                  <div className="flex flex-col items-end gap-1">
                    <p className="num text-sm font-medium text-text sm:text-base">{idr(item.summary.close)}</p>
                    <Change pctValue={item.summary.change_pct} pill />
                  </div>
                ) : (
                  <p className="text-xs text-text-muted">Harga belum tersedia</p>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function NewsCard({ dashboard }) {
  const [selected, setSelected] = useState(null);

  let body;
  if (dashboard.loading) {
    body = (
      <div className="space-y-4 py-3">
        {[0, 1, 2].map((i) => (
          <SkeletonText key={i} lines={2} />
        ))}
      </div>
    );
  } else if (dashboard.error) body = <ErrorState error={dashboard.error} onRetry={dashboard.reload} />;
  else if (dashboard.data.watchlist.length === 0) body = <EmptyState message="Tambahkan saham ke watchlist untuk melihat beritanya." />;
  else if (dashboard.data.news.length === 0) body = <EmptyState message="Belum ada berita untuk saham di watchlist." />;
  else {
    body = (
      <ul className="-mx-5 sm:-mx-6">
        {dashboard.data.news.map((item) => (
          <li key={item.news_id} className="border-b border-border last:border-b-0">
            <button
              type="button"
              onClick={() => setSelected(item)}
              className="group flex w-full items-start justify-between gap-3 px-5 py-4 text-left transition-colors duration-150 hover:bg-surface-2 sm:px-6"
            >
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium leading-snug text-text sm:text-base">{item.title}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                  {item.ticker && (
                    <span className="num inline-flex h-6 items-center gap-1.5 rounded-md border border-border bg-bg pl-1 pr-2 text-[11px] font-medium text-text">
                      <StockLogo ticker={item.ticker} size="sm" />
                      {item.ticker}
                    </span>
                  )}
                  {item.source && <span>{item.source}</span>}
                  {item.published_at && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="num">{date(item.published_at)}</span>
                    </>
                  )}
                </div>
              </div>
              <ArrowUpRight
                className="mt-0.5 h-4 w-4 shrink-0 text-text-muted opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-text group-hover:opacity-100"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Card title="Berita terkini" bodyClassName="py-1 sm:py-1">
      <NewsModal news={selected} onClose={() => setSelected(null)} />
      {body}
    </Card>
  );
}

function MoversList({ title, items }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-text-muted">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-text-muted">Tidak ada data.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((m) => (
            <li key={m.stock.stock_id}>
              <Link
                to={`/stocks/${m.stock.ticker}`}
                className="-mx-2.5 flex h-11 items-center gap-2.5 rounded-lg px-2.5 transition-colors duration-150 hover:bg-surface-2"
              >
                <StockLogo ticker={m.stock.ticker} size="sm" />
                <span className="num w-14 text-sm font-medium text-text">{m.stock.ticker}</span>
                <span className="num flex-1 text-right text-sm text-text">{idr(m.summary?.close)}</span>
                <div className="w-22 text-right">
                  <Change pctValue={m.summary?.change_pct} pill />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function moversDescription(data) {
  if (!data?.moversDate) return 'Perubahan harga dibanding hari bursa sebelumnya';
  return `${number(data.moversTotal, 0)} emiten yang dipantau · ${date(data.moversDate)} dibanding hari bursa sebelumnya`;
}

function MoversCard({ dashboard }) {
  return (
    <Card title="Top gainers & losers" description={moversDescription(dashboard.data)}>
      {dashboard.loading ? (
        <div className="grid gap-6 sm:grid-cols-2">
          <SkeletonText lines={5} />
          <SkeletonText lines={5} />
        </div>
      ) : dashboard.error ? (
        <ErrorState error={dashboard.error} onRetry={dashboard.reload} />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          <MoversList title="Naik terbanyak" items={dashboard.data.gainers} />
          <MoversList title="Turun terbanyak" items={dashboard.data.losers} />
        </div>
      )}
    </Card>
  );
}

function LatestAnalysisCard({ dashboard }) {
  let body;
  if (dashboard.loading) body = <SkeletonText lines={4} />;
  else if (dashboard.error) body = <ErrorState error={dashboard.error} onRetry={dashboard.reload} />;
  else if (dashboard.data.watchlist.length === 0) body = <EmptyState message="Analisis untuk saham di watchlist akan tampil di sini." />;
  else if (dashboard.data.analyses.length === 0) {
    body = (
      <EmptyState
        message="Belum ada analisis untuk saham di watchlist."
        action={
          <Button as={Link} to="/ai-analysis" size="sm" variant="primary">
            Jalankan analisis
          </Button>
        }
      />
    );
  } else {
    body = (
      <ul className="-mx-5 sm:-mx-6">
        {dashboard.data.analyses.map((a) => (
          <li key={a.ai_analysis_id} className="border-b border-border last:border-b-0">
            <Link
              to={`/analysis-history?session=${a.session_id}&id=${a.ai_analysis_id}`}
              className="block px-5 py-3.5 transition-colors duration-150 hover:bg-surface-2 sm:px-6"
            >
              <div className="flex items-center gap-2">
                <StockLogo ticker={a.stock?.ticker} size="sm" />
                <span className="num text-sm font-medium text-text">{a.stock?.ticker}</span>
                <Badge tone="iris">{analysisTypeLabel(a.session?.analysis_type)}</Badge>
                <span className="num ml-auto text-xs text-text-muted">{dateTime(a.created_at)}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-text-muted">{a.result}</p>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Card
      title="Analisis AI terakhir"
      description="Dari saham di watchlist"
      bodyClassName="py-1 sm:py-1"
      action={
        <Button as={Link} to="/ai-analysis" size="sm" variant="ghost">
          Analisis baru
        </Button>
      }
    >
      {body}
    </Card>
  );
}

export default function DashboardPage() {
  const dashboard = useAsync(() => getDashboard(), []);
  const data = dashboard.data;
  const stats = data?.stats;
  const hasWatchlist = Boolean(stats?.count);
  const upCount = stats?.up || 0;
  const downCount = stats?.down || 0;
  const avgTone = toneOf(stats?.avgChangePct);

  return (
    <div className="w-full">
      <PageHeader
        title="Dashboard"
        description={data?.lastPriceDate ? `Data harga terakhir ${date(data.lastPriceDate)}` : 'Ringkasan watchlist Anda'}
      />

      {/* Row 1: Top-Center Full-Width Hero Card (IHSG) */}
      <IndexCard dashboard={dashboard} />

      {/* Row 2: 4 Equal-Width KPI Metric Cards */}
      <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Saham di watchlist"
          icon={Bookmark}
          loading={dashboard.loading}
        >
          {stats?.count ?? '–'}
        </StatCard>

        <StatCard
          label={stats?.date ? `Rata-rata perubahan · ${date(stats.date)}` : 'Rata-rata perubahan'}
          icon={Activity}
          iconTone={
            avgTone === 'up'
              ? 'text-up bg-up/10 border-up/25'
              : avgTone === 'down'
                ? 'text-down bg-down/10 border-down/25'
                : 'text-text-muted bg-bg border-border'
          }
          loading={dashboard.loading}
        >
          <span className={toneText[avgTone]}>{pct(stats?.avgChangePct)}</span>
        </StatCard>

        <StatCard
          label="Saham naik"
          icon={TrendingUp}
          iconTone="text-up bg-up/10 border-up/25"
          loading={dashboard.loading}
        >
          <span className={upCount > 0 ? 'text-up' : ''}>{hasWatchlist ? upCount : '–'}</span>
        </StatCard>

        <StatCard
          label="Saham turun"
          icon={TrendingDown}
          iconTone="text-down bg-down/10 border-down/25"
          loading={dashboard.loading}
        >
          <span className={downCount > 0 ? 'text-down' : ''}>{hasWatchlist ? downCount : '–'}</span>
        </StatCard>
      </div>

      {/* Row 3+: Stocks & News Sections (2-column split across full width) */}
      <div className="mt-6 grid w-full grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          title="Watchlist"
          bodyClassName="py-0 sm:py-0"
          action={
            <Button as={Link} to="/watchlist" size="sm" variant="ghost">
              Lihat semua
            </Button>
          }
        >
          <WatchlistCard dashboard={dashboard} />
        </Card>

        <NewsCard dashboard={dashboard} />
        <MoversCard dashboard={dashboard} />
        <LatestAnalysisCard dashboard={dashboard} />
      </div>
    </div>
  );
}
