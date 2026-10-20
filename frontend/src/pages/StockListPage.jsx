import { useEffect, useMemo, useState } from 'react';
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
import { usePriceSummaries } from '../hooks/useStockData';
import { loadStocks } from '../lib/stocksStore';
import { idr, number } from '../lib/format';

const PAGE_SIZE = 20;

function PriceCells({ entry }) {
  if (!entry || entry.status === 'loading') {
    return (
      <>
        <Td num>
          <Skeleton className="ml-auto h-4 w-16" />
        </Td>
        <Td num>
          <Skeleton className="ml-auto h-4 w-14" />
        </Td>
      </>
    );
  }
  if (entry.status === 'error') {
    return (
      <>
        <Td num className="text-text-muted" title={entry.error?.message}>–</Td>
        <Td num className="text-text-muted">–</Td>
      </>
    );
  }
  return (
    <>
      <Td num className="text-text">{idr(entry.summary?.close)}</Td>
      <Td num>
        <Change pctValue={entry.summary?.change_pct} />
      </Td>
    </>
  );
}

export default function StockListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const sector = searchParams.get('sector') || '';
  const q = searchParams.get('q') || '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const [query, setQuery] = useState(q);
  const debouncedQuery = useDebounce(query, 400);

  const stocks = useAsync((opts) => loadStocks(opts), []);

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

  const sectors = useMemo(() => {
    const set = new Set((stocks.data || []).map((s) => s.sector).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, 'id'));
  }, [stocks.data]);

  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    return (stocks.data || []).filter((s) => {
      if (sector && s.sector !== sector) return false;
      if (!term) return true;
      return s.ticker.toLowerCase().includes(term) || s.company_name.toLowerCase().includes(term);
    });
  }, [stocks.data, q, sector]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Harga hanya diambil untuk baris yang sedang tampil (maks 20), lazy & di-cache.
  const { summaries } = usePriceSummaries(pageItems.map((s) => s.stock_id));

  const resetFilters = () => {
    setQuery('');
    setSearchParams({}, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Daftar Saham"
        description={stocks.data ? `${number(stocks.data.length, 0)} saham terdaftar` : 'Semua saham yang tersedia'}
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
            disabled={!stocks.data}
          >
            <option value="">Semua sektor</option>
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          {stocks.data && (
            <p className="num text-xs text-text-muted sm:ml-auto">{number(filtered.length, 0)} hasil</p>
          )}
        </div>

        {stocks.loading && (
          <div className="space-y-px p-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        )}

        {stocks.error && <ErrorState error={stocks.error} onRetry={stocks.reload} />}

        {stocks.data && filtered.length === 0 && (
          <EmptyState
            message={stocks.data.length === 0 ? 'Belum ada data saham.' : 'Tidak ada saham yang cocok dengan filter.'}
            action={
              stocks.data.length > 0 && (
                <Button size="sm" onClick={resetFilters}>
                  Hapus filter
                </Button>
              )
            }
          />
        )}

        {stocks.data && filtered.length > 0 && (
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
                  {pageItems.map((stock) => (
                    <Tr key={stock.stock_id} onClick={() => navigate(`/stocks/${stock.ticker}`)}>
                      <Td className="font-semibold text-text">{stock.ticker}</Td>
                      <Td className="max-w-40 truncate text-text-muted sm:max-w-xs">{stock.company_name}</Td>
                      <Td className="hidden text-text-muted lg:table-cell">{stock.sector || '–'}</Td>
                      <PriceCells entry={summaries[stock.stock_id]} />
                      <Td align="right" className="w-12 pr-2">
                        <WatchlistButton stock={stock} compact />
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableWrap>

            {totalPages > 1 && (
              <nav aria-label="Paginasi" className="flex items-center justify-between gap-3 px-4 py-3">
                <p className="num text-xs text-text-muted">
                  Halaman {currentPage} dari {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    icon={ChevronLeft}
                    disabled={currentPage <= 1}
                    onClick={() => updateParams({ page: currentPage - 1 })}
                  >
                    Sebelumnya
                  </Button>
                  <Button size="sm" disabled={currentPage >= totalPages} onClick={() => updateParams({ page: currentPage + 1 })}>
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
