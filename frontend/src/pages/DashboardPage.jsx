import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge, Button, Card, Change, EmptyState, ErrorState, PageHeader, Skeleton, SkeletonText } from '../components/ui';
import Sparkline from '../components/Sparkline';
import NewsModal from '../components/NewsModal';
import { useAuth } from '../context/AuthContext';
import { useWatchlist } from '../context/WatchlistContext';
import useAsync from '../hooks/useAsync';
import { usePriceSummaries } from '../hooks/useStockData';
import { loadStocks } from '../lib/stocksStore';
import { mapLimit } from '../lib/cache';
import { getNews } from '../api/stocks';
import { analysisTypeLabel, listByStock } from '../api/ai';
import { date, dateTime, idr, pct, toneOf } from '../lib/format';

// Top Gainers/Losers dihitung di frontend hanya bila jumlah saham kecil (lihat BACKEND_GAPS.md).
const MOVERS_LIMIT = 30;
const SPARKLINE_POINTS = 30;

const toneText = { up: 'text-up', down: 'text-down', neutral: 'text-text' };

function StatCard({ label, children, loading }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <div className="num mt-1.5 text-xl font-semibold text-text">{loading ? <Skeleton className="h-7 w-20" /> : children}</div>
    </div>
  );
}

function sortByDateDesc(field) {
  return (a, b) => new Date(b[field] || 0).getTime() - new Date(a[field] || 0).getTime();
}

/** Promise.allSettled yang gagal hanya bila SEMUA permintaan gagal. */
function settledValues(results) {
  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  if (results.length > 0 && fulfilled.length === 0) throw results[0].reason;
  return { values: fulfilled.map((r) => r.value), failed: results.length - fulfilled.length };
}

function WatchlistCard({ watchlist, summaries }) {
  const navigate = useNavigate();

  if (watchlist.loading && watchlist.items.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-11" />
        ))}
      </div>
    );
  }
  if (watchlist.error && watchlist.items.length === 0) {
    return <ErrorState error={watchlist.error} onRetry={() => watchlist.reload().catch(() => {})} />;
  }
  if (watchlist.items.length === 0) {
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
      {watchlist.items.map((item) => {
        const entry = summaries[item.stock_id];
        const closes = entry?.prices?.slice(-SPARKLINE_POINTS).map((p) => p.close_price) || [];
        return (
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
                {entry?.status === 'done' ? <Sparkline values={closes} /> : <Skeleton className="h-7 w-24" />}
              </div>
              <div className="w-28 shrink-0 text-right">
                {!entry || entry.status === 'loading' ? (
                  <div className="space-y-1">
                    <Skeleton className="ml-auto h-4 w-16" />
                    <Skeleton className="ml-auto h-3 w-12" />
                  </div>
                ) : entry.status === 'error' ? (
                  <p className="text-xs text-text-muted">Harga gagal dimuat</p>
                ) : (
                  <>
                    <p className="num text-sm text-text">{idr(entry.summary?.close)}</p>
                    <Change pctValue={entry.summary?.change_pct} className="text-xs" />
                  </>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function NewsCard({ watchlist }) {
  const [selected, setSelected] = useState(null);
  const key = watchlist.items.map((i) => i.stock_id).join(',');

  // Berita tidak punya ticker, jadi ambil per saham watchlist lalu gabungkan di frontend.
  const news = useAsync(
    async (opts) => {
      const results = await Promise.allSettled(
        watchlist.items.map(async (item) => {
          const list = await getNews(item.stock_id, opts);
          return list.map((n) => ({ ...n, ticker: item.stock?.ticker || '', stock_id: item.stock_id }));
        }),
      );
      const { values } = settledValues(results);
      return values.flat().sort(sortByDateDesc('published_at')).slice(0, 5);
    },
    [key],
    { enabled: watchlist.items.length > 0 },
  );

  let body;
  if (watchlist.loading && watchlist.items.length === 0) body = <SkeletonText lines={4} />;
  else if (watchlist.items.length === 0) body = <EmptyState message="Tambahkan saham ke watchlist untuk melihat beritanya." />;
  else if (news.loading) {
    body = (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <SkeletonText key={i} lines={2} />
        ))}
      </div>
    );
  } else if (news.error) body = <ErrorState error={news.error} onRetry={news.reload} />;
  else if (!news.data?.length) body = <EmptyState message="Belum ada berita untuk saham di watchlist." />;
  else {
    body = (
      <ul className="-mx-4 sm:-mx-5">
        {news.data.map((item) => (
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
                <span className="num flex-1 text-right text-sm text-text">{idr(m.summary.close)}</span>
                <Change pctValue={m.summary.change_pct} className="w-20 text-right text-sm" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MoversCard({ stocks }) {
  const ids = stocks.map((s) => s.stock_id);
  const { summaries, retry } = usePriceSummaries(ids);
  const entries = ids.map((id) => summaries[id]);
  const loading = entries.some((e) => !e || e.status === 'loading');
  const allFailed = entries.length > 0 && entries.every((e) => e?.status === 'error');

  const ranked = stocks
    .map((stock) => ({ stock, summary: summaries[stock.stock_id]?.summary }))
    .filter((m) => m.summary && m.summary.change_pct !== null);
  const gainers = ranked.filter((m) => m.summary.change_pct > 0).sort((a, b) => b.summary.change_pct - a.summary.change_pct).slice(0, 5);
  const losers = ranked.filter((m) => m.summary.change_pct < 0).sort((a, b) => a.summary.change_pct - b.summary.change_pct).slice(0, 5);

  return (
    <Card title="Top gainers & losers" description="Perubahan dari dua hari bursa terakhir" className="lg:col-span-6">
      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2">
          <SkeletonText lines={5} />
          <SkeletonText lines={5} />
        </div>
      ) : allFailed ? (
        <ErrorState message="Harga saham gagal dimuat." onRetry={retry} />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          <MoversList title="Naik terbanyak" items={gainers} />
          <MoversList title="Turun terbanyak" items={losers} />
        </div>
      )}
    </Card>
  );
}

function LatestAnalysisCard({ watchlist, userId, className }) {
  const key = watchlist.items.map((i) => i.stock_id).join(',');

  // Tidak ada endpoint analisis per user: ambil per saham watchlist (maks 5 paralel) lalu filter user.
  const analyses = useAsync(
    async (opts) => {
      const results = await mapLimit(watchlist.items, 5, async (item) => {
        const list = await listByStock(item.stock_id, userId, opts);
        return list.map((a) => ({ ...a, stock: item.stock }));
      });
      const { values } = settledValues(results);
      return values.flat().sort(sortByDateDesc('created_at')).slice(0, 3);
    },
    [key, userId],
    { enabled: watchlist.items.length > 0 },
  );

  let body;
  if (watchlist.items.length === 0 && !watchlist.loading) {
    body = <EmptyState message="Analisis untuk saham di watchlist akan tampil di sini." />;
  } else if (analyses.loading || watchlist.loading) body = <SkeletonText lines={4} />;
  else if (analyses.error) body = <ErrorState error={analyses.error} onRetry={analyses.reload} />;
  else if (!analyses.data?.length) {
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
        {analyses.data.map((a) => (
          <li key={a.ai_analysis_id} className="border-b border-border last:border-b-0">
            <Link
              to={`/analysis-history?ticker=${a.stock?.ticker || ''}&id=${a.ai_analysis_id}`}
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
      className={className}
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
  const { user } = useAuth();
  const watchlist = useWatchlist();
  const stocks = useAsync((opts) => loadStocks(opts), []);

  const watchIds = watchlist.items.map((i) => i.stock_id);
  const { summaries } = usePriceSummaries(watchIds);

  const stats = useMemo(() => {
    const done = watchIds.map((id) => summaries[id]).filter((e) => e?.status === 'done' && e.summary);
    const changes = done.map((e) => e.summary.change_pct).filter((v) => v !== null);
    const avg = changes.length ? changes.reduce((a, b) => a + b, 0) / changes.length : null;
    const latestDate = done.map((e) => e.summary.date).sort().pop() || null;
    return {
      loading: watchIds.some((id) => !summaries[id] || summaries[id].status === 'loading'),
      avg,
      up: changes.filter((v) => v > 0).length,
      down: changes.filter((v) => v < 0).length,
      latestDate,
    };
  }, [watchIds, summaries]);

  const showMovers = stocks.data && stocks.data.length > 0 && stocks.data.length <= MOVERS_LIMIT;
  const hasWatchlist = watchlist.items.length > 0;
  const watchlistLoading = watchlist.loading && !hasWatchlist;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={stats.latestDate ? `Data harga terakhir ${date(stats.latestDate)}` : 'Ringkasan watchlist Anda'}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Saham di watchlist" loading={watchlistLoading}>
          {watchlist.items.length}
        </StatCard>
        <StatCard label="Rata-rata perubahan hari ini" loading={watchlistLoading || (hasWatchlist && stats.loading)}>
          <span className={toneText[toneOf(stats.avg)]}>{pct(stats.avg)}</span>
        </StatCard>
        <StatCard label="Saham naik" loading={watchlistLoading || (hasWatchlist && stats.loading)}>
          <span className={stats.up > 0 ? 'text-up' : ''}>{hasWatchlist ? stats.up : '–'}</span>
        </StatCard>
        <StatCard label="Saham turun" loading={watchlistLoading || (hasWatchlist && stats.loading)}>
          <span className={stats.down > 0 ? 'text-down' : ''}>{hasWatchlist ? stats.down : '–'}</span>
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
          <WatchlistCard watchlist={watchlist} summaries={summaries} />
        </Card>

        <NewsCard watchlist={watchlist} />

        {stocks.error && (
          <Card className="lg:col-span-6">
            <ErrorState error={stocks.error} onRetry={stocks.reload} />
          </Card>
        )}
        {showMovers && <MoversCard stocks={stocks.data} />}

        <LatestAnalysisCard
          watchlist={watchlist}
          userId={user.user_id}
          className={showMovers || stocks.error ? 'lg:col-span-6' : 'lg:col-span-12'}
        />
      </div>
    </>
  );
}
