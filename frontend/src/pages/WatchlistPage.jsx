import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Trash2 } from 'lucide-react';
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
import { useWatchlist } from '../context/WatchlistContext';
import { date, idr, number } from '../lib/format';

function rsiTone(rsi) {
  if (rsi === null || rsi === undefined) return 'text-text-muted';
  if (rsi >= 70 || rsi <= 30) return 'text-warn';
  return 'text-text';
}

export default function WatchlistPage() {
  const navigate = useNavigate();
  const watchlist = useWatchlist();
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
    <>
      <PageHeader
        title="Watchlist"
        description={
          watchlist.items.length > 0 ? `${watchlist.items.length} saham dipantau` : 'Saham yang Anda pantau'
        }
        actions={
          <Button as={Link} to="/stocks" icon={Search}>
            Cari saham
          </Button>
        }
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
          <div className="space-y-px p-4">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
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
              <Button as={Link} to="/stocks" size="sm" variant="primary">
                Cari saham
              </Button>
            }
          />
        )}

        {watchlist.items.length > 0 && (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <Th>Kode</Th>
                  <Th className="hidden sm:table-cell">Nama perusahaan</Th>
                  <Th align="right">Harga</Th>
                  <Th align="right">Perubahan</Th>
                  <Th align="right">RSI 14</Th>
                  <Th align="right" className="hidden md:table-cell">
                    Ditambahkan
                  </Th>
                  <Th align="right">
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
                      <Td className="font-semibold text-text">{ticker}</Td>
                      <Td className="hidden max-w-xs truncate text-text-muted sm:table-cell">
                        {item.stock?.company_name || '–'}
                      </Td>
                      <Td num className="text-text">
                        {idr(summary?.close)}
                      </Td>
                      <Td num>
                        <Change pctValue={summary?.change_pct} />
                      </Td>
                      <Td num className={rsiTone(summary?.rsi_14)}>
                        {number(summary?.rsi_14)}
                      </Td>
                      <Td num className="hidden text-text-muted md:table-cell">
                        {date(item.created_at)}
                      </Td>
                      <Td align="right" className="w-12 pr-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setToRemove(item);
                          }}
                          disabled={watchlist.isPending(item.stock_id)}
                          aria-label={`Hapus ${ticker} dari watchlist`}
                          title="Hapus dari watchlist"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-down disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
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
    </>
  );
}
