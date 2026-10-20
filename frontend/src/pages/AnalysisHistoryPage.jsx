import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorState, Field, PageHeader, Select, Skeleton } from '../components/ui';
import AnalysisResult from '../components/AnalysisResult';
import { useAuth } from '../context/AuthContext';
import useAsync from '../hooks/useAsync';
import { loadStocks } from '../lib/stocksStore';
import { analysisTypeLabel, listByStock } from '../api/ai';
import { dateTime } from '../lib/format';

export default function AnalysisHistoryPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const ticker = (searchParams.get('ticker') || '').toUpperCase();
  const selectedId = Number(searchParams.get('id')) || null;

  const stocks = useAsync((opts) => loadStocks(opts), []);
  const stock = stocks.data?.find((s) => s.ticker === ticker) || null;

  // Backend mengembalikan analisis semua user untuk satu saham,
  // jadi listByStock memfilter ke user.user_id di frontend.
  const analyses = useAsync(
    (opts) => listByStock(stock.stock_id, user.user_id, opts),
    [stock?.stock_id, user.user_id],
    { enabled: Boolean(stock) },
  );

  const selected = useMemo(() => {
    const list = analyses.data || [];
    if (list.length === 0) return null;
    if (selectedId) {
      const found = list.find((a) => a.ai_analysis_id === selectedId);
      if (found) return found;
    }
    return list[0];
  }, [analyses.data, selectedId]);

  const updateParams = (changes) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  };

  const selectStock = (nextTicker) => {
    updateParams({ ticker: nextTicker, id: null });
  };

  const selectAnalysis = (id) => {
    updateParams({ id });
  };

  const newAnalysisPath = stock ? `/ai-analysis?ticker=${stock.ticker}` : '/ai-analysis';
  const missingTicker = ticker && stocks.data && !stock;

  return (
    <>
      <PageHeader
        title="Riwayat Analisis"
        description="Pilih saham untuk melihat hasil analisis AI yang pernah Anda jalankan."
        actions={
          <Button as={Link} to={newAnalysisPath} variant="primary" icon={Plus}>
            Analisis baru
          </Button>
        }
      />

      <div className="mb-6 max-w-sm">
        {stocks.loading && <Skeleton className="h-9" />}
        {stocks.error && <ErrorState compact error={stocks.error} onRetry={stocks.reload} />}
        {stocks.data && (
          <Field label="Saham" htmlFor="history-stock">
            <Select id="history-stock" value={stock ? stock.ticker : ''} onChange={(e) => selectStock(e.target.value)}>
              <option value="">Pilih saham</option>
              {stocks.data.map((s) => (
                <option key={s.stock_id} value={s.ticker}>
                  {s.ticker} — {s.company_name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      {!stock ? (
        <Card>
          <EmptyState
            message={missingTicker ? `Saham ${ticker} tidak ditemukan. Pilih saham lain.` : 'Pilih saham untuk menampilkan riwayat analisis.'}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Card
            title={`Riwayat ${stock.ticker}`}
            description={analyses.data ? `${analyses.data.length} analisis` : undefined}
            className="lg:col-span-4"
            padded={false}
          >
            {analyses.loading && (
              <div className="space-y-2 p-4">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            )}

            {analyses.error && <ErrorState error={analyses.error} onRetry={analyses.reload} />}

            {analyses.data && analyses.data.length === 0 && (
              <EmptyState
                message={`Belum ada analisis untuk ${stock.ticker}.`}
                action={
                  <Button as={Link} to={newAnalysisPath} size="sm" variant="primary">
                    Analisis baru
                  </Button>
                }
              />
            )}

            {analyses.data && analyses.data.length > 0 && (
              <ul className="max-h-140 overflow-y-auto">
                {analyses.data.map((item) => {
                  const active = selected?.ai_analysis_id === item.ai_analysis_id;
                  return (
                    <li key={item.ai_analysis_id} className="border-b border-border last:border-b-0">
                      <button
                        type="button"
                        onClick={() => selectAnalysis(item.ai_analysis_id)}
                        className={`relative block w-full px-4 py-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
                          active ? 'bg-surface-2' : 'hover:bg-surface-2'
                        }`}
                      >
                        {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" aria-hidden="true" />}
                        <div className="flex items-center justify-between gap-2">
                          <Badge>{analysisTypeLabel(item.session?.analysis_type)}</Badge>
                          <span className="text-xs text-text-muted">{dateTime(item.created_at)}</span>
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-sm text-text-muted">{item.result}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <div className="min-w-0 lg:col-span-8">
            {analyses.loading ? (
              <Card>
                <Skeleton className="h-48" />
              </Card>
            ) : selected ? (
              <Card padded={false}>
                <AnalysisResult analysis={selected} ticker={stock.ticker} companyName={stock.company_name} />
              </Card>
            ) : (
              <Card>
                <EmptyState message="Pilih salah satu analisis di sebelah kiri untuk melihat isinya." />
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  );
}
