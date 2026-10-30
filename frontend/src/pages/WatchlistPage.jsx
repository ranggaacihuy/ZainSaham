import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
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
import { date, idr, number } from '../lib/format';

function RsiCell({ rsi }) {
  if (rsi === null || rsi === undefined) {
    return <span className="text-text-muted">–</span>;
  }
  const pct = Math.max(0, Math.min(100, Number(rsi)));
  const isWarn = pct >= 70 || pct <= 30;
  const barColor = pct >= 70 ? 'bg-down' : pct <= 30 ? 'bg-up' : 'bg-text-muted';
  const textColor = isWarn ? 'text-warn' : 'text-text';

  return (
    <div className="inline-flex items-center justify-end gap-2.5">
      <span className={`num text-sm font-medium ${textColor}`}>{number(rsi)}</span>
      <span className="hidden h-1.5 w-10 overflow-hidden rounded-full bg-surface-2 sm:inline-block" aria-hidden="true">
        <span className={`block h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </span>
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
      <PageHeader
        title="Watchlist"
        description={
          watchlist.items.length > 0 ? `${watchlist.items.length} saham dipantau` : 'Saham yang Anda pantau'
        }
        actions={<SearchModal ref={searchRef} showShortcut={false} align="right" />}
      />

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

      <Card padded={false}>
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
          <EmptyState
            message="Watchlist masih kosong."
            action={
              <Button size="sm" variant="primary" onClick={() => searchRef.current?.focus()}>
                Cari saham
              </Button>
            }
          />
        )}

        {watchlist.items.length > 0 && (
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
                {watchlist.items.map((item) => {
                  const ticker = item.stock?.ticker || `#${item.stock_id}`;
                  const summary = item.summary;
                  return (
                    <Tr key={item.watchlist_id} onClick={() => item.stock && navigate(`/stocks/${item.stock.ticker}`)}>
                      <Td className="h-16 px-5 sm:px-6">
                        <div className="flex items-center gap-3">
                          <StockLogo ticker={ticker} size="md" />
                          <span className="num text-sm font-medium text-text sm:text-base">{ticker}</span>
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
                        <RsiCell rsi={summary?.rsi_14} />
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
                          disabled={watchlist.isPending(item.stock_id)}
                          aria-label={`Hapus ${ticker} dari watchlist`}
                          title="Hapus dari watchlist"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors duration-150 hover:bg-down/10 hover:text-down focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iris disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                        </button>
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
