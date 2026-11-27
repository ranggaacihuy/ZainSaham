import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  Change,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  Table,
  TableWrap,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '../components/ui';
import ConfirmModal from '../components/ConfirmModal';
import SearchModal from '../components/SearchModal';
import StockLogo from '../components/StockLogo';
import { useWatchlist } from '../context/WatchlistContext';
import { date, idr, number, pct, toneOf } from '../lib/format';

const toneBar = {
  up: 'bg-up',
  down: 'bg-down',
  neutral: 'bg-border-strong',
};

function RsiCell({ rsi, delay = 0 }) {
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  if (rsi === null || rsi === undefined) {
    return <span className="text-text-muted">–</span>;
  }

  const value = Math.max(0, Math.min(100, Number(rsi)));
  const isOverbought = value >= 70;
  const isOversold = value <= 30;
  const isWarn = isOverbought || isOversold;
  const barColor = isOverbought ? 'bg-down' : isOversold ? 'bg-up' : 'bg-text-muted';
  const textColor = isWarn ? 'text-warn' : 'text-text';
  const statusLabel = isOverbought ? 'Overbought' : isOversold ? 'Oversold' : 'Netral';

  return (
    <div className="inline-flex items-center justify-end gap-2.5" title={`RSI 14: ${number(rsi)} (${statusLabel})`}>
      <span className="inline-flex items-center gap-1.5">
        {isWarn && <span className={`h-1.5 w-1.5 rounded-full ${barColor}`} aria-hidden="true" />}
        <span className={`num text-sm font-medium ${textColor}`}>{number(rsi)}</span>
      </span>
      <span className="hidden h-1.5 w-11 overflow-hidden rounded-full bg-surface-2 sm:inline-block" aria-hidden="true">
        <span
          className={`block h-full rounded-full transition-[width] duration-500 ease-out ${barColor}`}
          style={{
            width: filled ? `${value}%` : '0%',
            transitionDelay: `${delay}ms`,
          }}
        />
      </span>
    </div>
  );
}

function WatchlistSummaryBar({ items }) {
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const stats = useMemo(() => {
    let up = 0;
    let down = 0;
    let flat = 0;
    let sumPct = 0;
    let pctCount = 0;

    for (const item of items) {
      const ch = item.summary?.change_pct;
      const tone = toneOf(ch);
      if (tone === 'up') up += 1;
      else if (tone === 'down') down += 1;
      else flat += 1;

      if (ch !== null && ch !== undefined && Number.isFinite(Number(ch))) {
        sumPct += Number(ch);
        pctCount += 1;
      }
    }

    const total = items.length || 1;
    return {
      up,
      down,
      flat,
      upPct: (up / total) * 100,
      flatPct: (flat / total) * 100,
      downPct: (down / total) * 100,
      avgPct: pctCount > 0 ? sumPct / pctCount : null,
    };
  }, [items]);

  const avgTone = toneOf(stats.avgPct);
  const avgColor = avgTone === 'up' ? 'text-up' : avgTone === 'down' ? 'text-down' : 'text-text-muted';

  return (
    <div className="flex flex-col gap-2.5 border-b border-border bg-surface px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1.5 text-text-muted">
          <span className="h-2 w-2 rounded-full bg-up" aria-hidden="true" />
          <span className="num font-medium text-text">{stats.up}</span> naik
        </span>
        {stats.flat > 0 && (
          <span className="inline-flex items-center gap-1.5 text-text-muted">
            <span className="h-2 w-2 rounded-full bg-border-strong" aria-hidden="true" />
            <span className="num font-medium text-text">{stats.flat}</span> stagnan
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 text-text-muted">
          <span className="h-2 w-2 rounded-full bg-down" aria-hidden="true" />
          <span className="num font-medium text-text">{stats.down}</span> turun
        </span>
        {stats.avgPct !== null && (
          <span className="hidden items-center gap-1.5 border-l border-border pl-4 text-text-muted sm:inline-flex">
            Rata-rata <span className={`num font-medium ${avgColor}`}>{pct(stats.avgPct)}</span>
          </span>
        )}
      </div>

      <div
        className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-2 sm:w-44"
        aria-label={`Proporsi watchlist: ${stats.up} naik, ${stats.flat} stagnan, ${stats.down} turun`}
      >
        <span
          className="h-full bg-up transition-[width] duration-500 ease-out"
          style={{ width: filled ? `${stats.upPct}%` : '0%' }}
        />
        <span
          className="h-full bg-border-strong transition-[width] duration-500 ease-out"
          style={{ width: filled ? `${stats.flatPct}%` : '0%' }}
        />
        <span
          className="h-full bg-down transition-[width] duration-500 ease-out"
          style={{ width: filled ? `${stats.downPct}%` : '0%' }}
        />
      </div>
    </div>
  );
}

export default function WatchlistPage() {
  const navigate = useNavigate();
  const watchlist = useWatchlist();
  const searchRef = useRef(null);
  const [toRemove, setToRemove] = useState(null);
  const [removing, setRemoving] = useState(false);

  const confirmRemove = async () => {
    if (!toRemove) return;
    setRemoving(true);
    await watchlist.remove(toRemove.stock_id);
    setRemoving(false);
    setToRemove(null);
  };

  const showSkeleton = watchlist.loading && watchlist.items.length === 0;

  return (
    <div className="w-full">
      <div className="relative z-20">
        <PageHeader
          title="Watchlist"
          description={
            watchlist.items.length > 0 ? `${watchlist.items.length} saham dipantau` : 'Saham yang Anda pantau'
          }
          actions={<SearchModal ref={searchRef} showShortcut={false} align="right" />}
        />
      </div>

      <ConfirmModal
        isOpen={Boolean(toRemove)}
        title="Hapus dari watchlist"
        message={toRemove ? `Hapus ${toRemove.stock?.ticker || 'saham ini'} dari watchlist?` : ''}
        confirmText="Hapus"
        isDanger
        loading={removing}
        onConfirm={confirmRemove}
        onClose={() => !removing && setToRemove(null)}
      />

      <Card padded={false} className="animate-fade-up relative z-10 overflow-hidden">
        {showSkeleton && (
          <div className="space-y-1.5 p-5 sm:p-6">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        )}

        {watchlist.error && watchlist.items.length === 0 && (
          <ErrorState error={watchlist.error} onRetry={() => watchlist.reload().catch(() => {})} />
        )}

        {!watchlist.loading && !watchlist.error && watchlist.items.length === 0 && (
          <div className="relative overflow-hidden">
            <div
              className="pointer-events-none absolute inset-0 bg-dot-grid opacity-35 mask-radial-fade dark:opacity-20"
              aria-hidden="true"
            />
            <div className="relative z-10">
              <EmptyState
                message="Watchlist masih kosong."
                action={
                  <Button size="sm" variant="primary" onClick={() => searchRef.current?.focus()}>
                    Cari saham
                  </Button>
                }
              />
            </div>
          </div>
        )}

        {watchlist.items.length > 0 && (
          <>
            <WatchlistSummaryBar items={watchlist.items} />

            <TableWrap>
              <Table className="table-fixed">
                <THead>
                  <tr>
                    <Th className="w-40 px-5 sm:px-6">Kode</Th>
                    <Th className="hidden px-5 sm:table-cell sm:px-6">Nama perusahaan</Th>
                    <Th align="right" className="w-40 px-5 sm:px-6">
                      Harga
                    </Th>
                    <Th align="right" className="w-36 px-5 sm:px-6">
                      Perubahan
                    </Th>
                    <Th align="right" className="w-36 px-5 sm:px-6">
                      RSI 14
                    </Th>
                    <Th align="right" className="hidden w-36 px-5 md:table-cell sm:px-6">
                      Ditambahkan
                    </Th>
                    <Th align="right" className="w-16 px-4 sm:px-5">
                      <span className="sr-only">Aksi</span>
                    </Th>
                  </tr>
                </THead>
                <TBody>
                  {watchlist.items.map((item, idx) => {
                    const ticker = item.stock?.ticker || `#${item.stock_id}`;
                    const summary = item.summary;
                    const tone = toneOf(summary?.change_pct);
                    const pending = watchlist.isPending(item.stock_id);
                    const delay = Math.min(idx, 10) * 24;

                    return (
                      <Tr
                        key={item.watchlist_id}
                        onClick={() => !pending && item.stock && navigate(`/stocks/${item.stock.ticker}`)}
                        style={{ animationDelay: `${delay}ms` }}
                        className={`group animate-fade-up transition-opacity duration-200 ${
                          pending ? 'pointer-events-none opacity-40' : ''
                        }`}
                      >
                        <Td className="relative h-16 px-5 sm:px-6">
                          {/* Adaptive Semantic Hover Accent */}
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none absolute inset-y-2 left-0 w-0.5 origin-center scale-y-0 rounded-r-full transition-transform duration-200 ease-out group-hover:scale-y-100 ${toneBar[tone]}`}
                          />
                          <div className="flex items-center gap-3">
                            <span className="transition-transform duration-200 group-hover:scale-105">
                              <StockLogo ticker={ticker} size="md" />
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="num text-sm font-medium text-text transition-transform duration-150 group-hover:translate-x-0.5 sm:text-base">
                                {ticker}
                              </span>
                              <ArrowUpRight
                                className="h-3.5 w-3.5 text-text-muted opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-text group-hover:opacity-100"
                                strokeWidth={1.75}
                                aria-hidden="true"
                              />
                            </div>
                          </div>
                        </Td>
                        <Td className="hidden h-16 truncate px-5 text-sm text-text sm:table-cell sm:px-6">
                          {item.stock?.company_name || '–'}
                        </Td>
                        <Td num className="h-16 px-5 text-sm font-medium text-text sm:px-6 sm:text-base">
                          {idr(summary?.close)}
                        </Td>
                        <Td num className="h-16 px-5 sm:px-6">
                          <Change pctValue={summary?.change_pct} pill />
                        </Td>
                        <Td num className="h-16 px-5 sm:px-6">
                          <RsiCell rsi={summary?.rsi_14} delay={delay + 80} />
                        </Td>
                        <Td num className="hidden h-16 px-5 text-xs text-text-muted md:table-cell sm:px-6">
                          {date(item.created_at)}
                        </Td>
                        <Td align="right" className="h-16 px-4 sm:px-5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setToRemove(item);
                            }}
                            disabled={pending}
                            aria-label={`Hapus ${ticker} dari watchlist`}
                            title="Hapus dari watchlist"
                            className="group/del inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-all duration-150 hover:bg-down/10 hover:text-down active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iris disabled:opacity-50"
                          >
                            <Trash2
                              className="h-4 w-4 transition-transform duration-150 group-hover/del:scale-110"
                              strokeWidth={1.75}
                            />
                          </button>
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            </TableWrap>
          </>
        )}
      </Card>
    </div>
  );
}