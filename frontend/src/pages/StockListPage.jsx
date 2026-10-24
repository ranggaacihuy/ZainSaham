import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Table,
  TableWrap,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  Change,
} from '../components/ui';
import WatchlistButton from '../components/WatchlistButton';
import useAsync from '../hooks/useAsync';
import useDebounce from '../hooks/useDebounce';
import { searchStocks } from '../api/stocks';
import { idr, number } from '../lib/format';

const PAGE_SIZE = 20;

export default function StockListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const sector = searchParams.get('sector') || '';
  const q = searchParams.get('q') || '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const [query, setQuery] = useState(q);
  const [sectors, setSectors] = useState([]);
  const debouncedQuery = useDebounce(query, 400);

  const result = useAsync(
    async () => {
      const data = await searchStocks({ q, sector, page, perPage: PAGE_SIZE });
      setSectors(data.sectors);
      return data;
    },
    [q, sector, page],
  );

  const updateParams = (changes) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined || (key === 'page' && value === 1)) next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  };

  // Sinkronkan pencarian (debounce 400 ms) ke URL dan kembali ke halaman 1.
  useEffect(() => {
    if (debouncedQuery.trim() !== q) updateParams({ q: debouncedQuery.trim(), page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  const resetFilters = () => {
    setQuery('');
    setSearchParams({}, { replace: true });
  };

  const data = result.data;
  const items = data?.items || [];
  const hasFilter = Boolean(q || sector);

  return (
    <>
      <PageHeader
        title="Daftar Saham"
        description={data && !hasFilter ? `${number(data.total, 0)} saham terdaftar` : 'Saham BEI beserta harga terakhir'}
      />

      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <Input
            icon={Search}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari kode atau nama perusahaan"
            aria-label="Cari saham"
            wrapperClassName="sm:max-w-xs sm:flex-1"
          />
          <Select
            value={sector}
            onChange={(e) => updateParams({ sector: e.target.value, page: 1 })}
            aria-label="Filter sektor"
            wrapperClassName="sm:w-56"
            disabled={sectors.length === 0}
          >
            <option value="">Semua sektor</option>
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          {data && <p className="num text-xs text-text-muted sm:ml-auto">{number(data.total, 0)} hasil</p>}
        </div>

        {result.loading && (
          <div className="space-y-px p-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        )}

        {result.error && <ErrorState error={result.error} onRetry={result.reload} />}

        {data && items.length === 0 && (
          <EmptyState
            message={hasFilter || page > 1 ? 'Tidak ada saham yang cocok dengan filter.' : 'Belum ada data saham.'}
            action={
              (hasFilter || page > 1) && (
                <Button size="sm" onClick={resetFilters}>
                  Hapus filter
                </Button>
              )
            }
          />
        )}

        {items.length > 0 && (
          <>
            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <Th>Kode</Th>
                    <Th>Nama perusahaan</Th>
                    <Th className="hidden lg:table-cell">Sektor</Th>
                    <Th align="right">Harga</Th>
                    <Th align="right">Perubahan</Th>
                    <Th align="right">
                      <span className="sr-only">Watchlist</span>
                    </Th>
                  </tr>
                </THead>
                <TBody>
                  {items.map((stock) => (
                    <Tr key={stock.stock_id} onClick={() => navigate(`/stocks/${stock.ticker}`)}>
                      <Td className="font-semibold text-text">{stock.ticker}</Td>
                      <Td className="max-w-40 truncate text-text-muted sm:max-w-xs">{stock.company_name}</Td>
                      <Td className="hidden text-text-muted lg:table-cell">{stock.sector || '–'}</Td>
                      <Td num className="text-text">
                        {idr(stock.summary?.close)}
                      </Td>
                      <Td num>
                        <Change pctValue={stock.summary?.change_pct} />
                      </Td>
                      <Td align="right" className="w-12 pr-2">
                        <WatchlistButton stock={stock} compact />
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableWrap>

            {data.lastPage > 1 && (
              <nav aria-label="Paginasi" className="flex items-center justify-between gap-3 px-4 py-3">
                <p className="num text-xs text-text-muted">
                  Halaman {data.page} dari {data.lastPage}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" icon={ChevronLeft} disabled={data.page <= 1} onClick={() => updateParams({ page: data.page - 1 })}>
                    Sebelumnya
                  </Button>
                  <Button
                    size="sm"
                    disabled={data.page >= data.lastPage}
                    onClick={() => updateParams({ page: data.page + 1 })}
                  >
                    Berikutnya
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </nav>
            )}
          </>
        )}
      </Card>
    </>
  );
}
