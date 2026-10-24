import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge, Button, Card, Change, EmptyState, ErrorState, PageHeader, Skeleton, SkeletonText } from '../components/ui';
import Sparkline from '../components/Sparkline';
import NewsModal from '../components/NewsModal';
import useAsync from '../hooks/useAsync';
import { getDashboard } from '../api/dashboard';
import { analysisTypeLabel } from '../api/ai';
import { date, dateTime, idr, pct, toneOf } from '../lib/format';

const toneText = { up: 'text-up', down: 'text-down', neutral: 'text-text' };

function StatCard({ label, children, loading }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <div className="num mt-1.5 text-xl font-semibold text-text">{loading ? <Skeleton className="h-7 w-20" /> : children}</div>
    </div>
  );
}

function ListSkeleton({ rows = 4, height = 'h-11' }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={height} />
      ))}
    </div>
  );
}

function WatchlistCard({ dashboard }) {
  const navigate = useNavigate();

  if (dashboard.loading) return <ListSkeleton />;
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
    <ul className="-mx-4 sm:-mx-5">
      {items.map((item) => (
        <li key={item.watchlist_id} className="border-b border-border last:border-b-0">
          <button
            type="button"
            onClick={() => item.stock && navigate(`/stocks/${item.stock.ticker}`)}
            className="flex h-14 w-full items-center gap-3 px-4 text-left transition-colors duration-150 hover:bg-surface-2 sm:px-5"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text">{item.stock?.ticker || `#${item.stock_id}`}</p>
              <p className="truncate text-xs text-text-muted">{item.stock?.company_name}</p>
            </div>
            <div className="hidden shrink-0 sm:block">
              <Sparkline values={item.summary?.sparkline || []} />
            </div>
            <div className="w-28 shrink-0 text-right">
              {item.summary ? (
                <>
                  <p className="num text-sm text-text">{idr(item.summary.close)}</p>
                  <Change pctValue={item.summary.change_pct} className="text-xs" />
                </>
              ) : (
                <p className="text-xs text-text-muted">Harga belum tersedia</p>
              )}
            </div>
          </button>
        </li>
      ))}
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
      <ul className="-mx-4 sm:-mx-5">
        {dashboard.data.news.map((item) => (
          <li key={item.news_id} className="border-b border-border last:border-b-0">
            <button
              type="button"
              onClick={() => setSelected(item)}
              className="block w-full px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-2 sm:px-5"
            >
              <p className="line-clamp-2 text-sm text-text">{item.title}</p>
              <p className="mt-1 text-xs text-text-muted">
                {[item.ticker, item.source, date(item.published_at)].filter(Boolean).join(' · ')}
              </p>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Card title="Berita terkini" className="lg:col-span-4" bodyClassName="py-1 sm:py-1">
      <NewsModal news={selected} onClose={() => setSelected(null)} />
      {body}
    </Card>
  );
}

function MoversList({ title, items }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium text-text-muted">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-text-muted">Tidak ada data.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((m) => (
            <li key={m.stock.stock_id}>
              <Link
                to={`/stocks/${m.stock.ticker}`}
                className="-mx-2 flex h-9 items-center gap-3 rounded-lg px-2 transition-colors duration-150 hover:bg-surface-2"
              >
                <span className="w-14 text-sm font-semibold text-text">{m.stock.ticker}</span>
                <span className="num flex-1 text-right text-sm text-text">{idr(m.summary?.close)}</span>
                <Change pctValue={m.summary?.change_pct} className="w-20 text-right text-sm" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MoversCard({ dashboard }) {
  return (
    <Card title="Top gainers & losers" description="Perubahan dari dua hari bursa terakhir" className="lg:col-span-6">
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
      <ul className="-mx-4 sm:-mx-5">
        {dashboard.data.analyses.map((a) => (
          <li key={a.ai_analysis_id} className="border-b border-border last:border-b-0">
            <Link
              to={`/analysis-history?session=${a.session_id}&id=${a.ai_analysis_id}`}
              className="block px-4 py-3 transition-colors duration-150 hover:bg-surface-2 sm:px-5"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-text">{a.stock?.ticker}</span>
                <Badge>{analysisTypeLabel(a.session?.analysis_type)}</Badge>
                <span className="ml-auto text-xs text-text-muted">{dateTime(a.created_at)}</span>
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
      className="lg:col-span-6"
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

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={data?.lastPriceDate ? `Data harga terakhir ${date(data.lastPriceDate)}` : 'Ringkasan watchlist Anda'}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Saham di watchlist" loading={dashboard.loading}>
          {stats?.count ?? '–'}
        </StatCard>
        <StatCard label="Rata-rata perubahan hari ini" loading={dashboard.loading}>
          <span className={toneText[toneOf(stats?.avgChangePct)]}>{pct(stats?.avgChangePct)}</span>
        </StatCard>
        <StatCard label="Saham naik" loading={dashboard.loading}>
          <span className={stats?.up > 0 ? 'text-up' : ''}>{hasWatchlist ? stats.up : '–'}</span>
        </StatCard>
        <StatCard label="Saham turun" loading={dashboard.loading}>
          <span className={stats?.down > 0 ? 'text-down' : ''}>{hasWatchlist ? stats.down : '–'}</span>
        </StatCard>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card
          title="Watchlist"
          className="lg:col-span-8"
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
    </>
  );
}
