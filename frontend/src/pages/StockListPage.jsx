import { useEffect, useEffectEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
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
import StockLogo from '../components/StockLogo';
import useAsync from '../hooks/useAsync';
import useDebounce from '../hooks/useDebounce';
import { searchStocks } from '../api/stocks';
import { idr, number, toneOf } from '../lib/format';

const PAGE_SIZE = 20;

const toneBar = {
  up: 'bg-up',
  down: 'bg-down',
  neutral: 'bg-border-strong',
};

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

  const syncQuery = useEffectEvent((value) => {
    if (value !== q) updateParams({ q: value, page: 1 });
  });

  useEffect(() => {
    syncQuery(debouncedQuery.trim());
  }, [debouncedQuery]);

  const resetFilters = () => {
    setQuery('');
    setSearchParams({}, { replace: true });
  };

  const goToPage = (nextPage) => {
    updateParams({ page: nextPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const data = result.data;
  const items = data?.items || [];
  const hasFilter = Boolean(q || sector);
  const listKey = `${q}|${sector}|${page}`;

  return (
    <div className="w-full">
      <PageHeader
        title="Daftar Saham"
        description={data && !hasFilter ? `${number(data.total, 0)} saham terdaftar` : 'Saham BEI beserta harga terakhir'}
      />

      <Card padded={false} className="animate-fade-up overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border bg-surface px-5 py-3.5 sm:flex-row sm:items-center sm:px-6">
          <Input
            icon={Search}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari kode atau nama perusahaan"
            aria-label="Cari saham"
            wrapperClassName="sm:max-w-sm sm:flex-1"
            className="h-9 text-sm"
          />
          <Select
            value={sector}
            onChange={(e) => updateParams({ sector: e.target.value, page: 1 })}
            aria-label="Filter sektor"
            wrapperClassName="sm:w-56"
            className="h-9 text-sm"
            disabled={sectors.length === 0}
          >
            <option value="">Semua sektor</option>
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>

          <div className="flex items-center gap-2 sm:ml-auto">
            {hasFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="animate-dropdown-in inline-flex h-7 items-center gap-1 rounded-md border border-border bg-bg px-2.5 text-xs text-text-muted transition-colors duration-150 hover:border-border-strong hover:bg-surface-2 hover:text-text"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                Reset
              </button>
            )}
            {data && (
              <span
                className={`num inline-flex h-7 items-center rounded-md border border-border bg-bg px-2.5 text-xs text-text-muted transition-opacity duration-200 ${
                  result.loading ? 'opacity-50' : 'opacity-100'
                }`}
              >
                {number(data.total, 0)} hasil
              </span>
            )}
          </div>
        </div>

        {result.loading && (
          <div className="space-y-1.5 p-5 sm:p-6">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-14" />
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
              <Table className="table-fixed">
                <THead>
                  <tr>
                    <Th className="w-40 px-5 sm:px-6">Kode</Th>
                    <Th className="px-5 sm:px-6">Nama perusahaan</Th>
                    <Th className="hidden w-56 px-5 lg:table-cell sm:px-6">Sektor</Th>
                    <Th align="right" className="w-40 px-5 sm:px-6">
                      Harga
                    </Th>
                    <Th align="right" className="w-36 px-5 sm:px-6">
                      Perubahan
                    </Th>
                    <Th align="right" className="w-16 px-4 sm:px-5">
                      <span className="sr-only">Watchlist</span>
                    </Th>
                  </tr>
                </THead>
                <TBody key={listKey}>
                  {items.map((stock, idx) => {
                    const tone = toneOf(stock.summary?.change_pct);
                    const delay = Math.min(idx, 10) * 18;

                    return (
                      <Tr
                        key={stock.stock_id}
                        onClick={() => navigate(`/stocks/${stock.ticker}`)}
                        style={{ animationDelay: `${delay}ms` }}
                        className="group animate-fade-up"
                      >
                        <Td className="relative h-16 px-5 sm:px-6">
                          {/* Adaptive Semantic Hover Accent */}
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none absolute inset-y-2 left-0 w-0.5 origin-center scale-y-0 rounded-r-full transition-transform duration-200 ease-out group-hover:scale-y-100 ${toneBar[tone]}`}
                          />
                          <div className="flex items-center gap-3">
                            <span className="transition-transform duration-200 group-hover:scale-105">
                              <StockLogo ticker={stock.ticker} size="md" />
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="num text-sm font-medium text-text transition-transform duration-150 group-hover:translate-x-0.5 sm:text-base">
                                {stock.ticker}
                              </span>
                              <ArrowUpRight
                                className="h-3.5 w-3.5 text-text-muted opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-text group-hover:opacity-100"
                                strokeWidth={1.75}
                                aria-hidden="true"
                              />
                            </div>
                          </div>
                        </Td>
                        <Td className="h-16 truncate px-5 text-sm text-text sm:px-6">{stock.company_name}</Td>
                        <Td className="hidden h-16 px-5 lg:table-cell sm:px-6">
                          {stock.sector ? (
                            <span className="inline-flex h-6 items-center rounded-md border border-border bg-bg px-2 text-xs text-text-muted transition-colors duration-150 group-hover:border-border-strong">
                              {stock.sector}
                            </span>
                          ) : (
                            <span className="text-text-muted">–</span>
                          )}
                        </Td>
                        <Td num className="h-16 px-5 text-sm font-medium text-text sm:px-6 sm:text-base">
                          {idr(stock.summary?.close)}
                        </Td>
                        <Td num className="h-16 px-5 sm:px-6">
                          <Change pctValue={stock.summary?.change_pct} pill />
                        </Td>
                        <Td align="right" className="h-16 px-4 sm:px-5">
                          <WatchlistButton stock={stock} compact />
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            </TableWrap>

            {data.lastPage > 1 && (
              <nav aria-label="Paginasi" className="flex items-center justify-between gap-3 border-t border-border px-5 py-3.5 sm:px-6">
                <p className="num text-xs text-text-muted">
                  Halaman {data.page} dari {data.lastPage}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" icon={ChevronLeft} disabled={data.page <= 1} onClick={() => goToPage(data.page - 1)}>
                    Sebelumnya
                  </Button>
                  <Button size="sm" disabled={data.page >= data.lastPage} onClick={() => goToPage(data.page + 1)}>
                    Berikutnya
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </nav>
            )}
          </>
        )}
      </Card>
    </div>
  );
}