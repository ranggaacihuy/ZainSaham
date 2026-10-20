import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button, Card, EmptyState, ErrorState, Field, PageHeader, Select, Skeleton, SkeletonText, Tabs } from '../components/ui';
import AnalysisResult from '../components/AnalysisResult';
import ChatPanel from '../components/ChatPanel';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useAsync from '../hooks/useAsync';
import { loadStocks } from '../lib/stocksStore';
import { ANALYSIS_TYPES, analyze } from '../api/ai';

const MODES = [
  { value: 'analisis', label: 'Analisis' },
  { value: 'chat', label: 'Tanya AI' },
];

// Sesi chat per saham disimpan di memori selama aplikasi terbuka (tidak di localStorage).
const chatSessionsByStock = new Map();

function StockSelect({ stocks, value, onChange }) {
  return (
    <Field label="Saham" htmlFor="ai-stock">
      <Select id="ai-stock" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Pilih saham</option>
        {stocks.map((s) => (
          <option key={s.stock_id} value={s.ticker}>
            {s.ticker} — {s.company_name}
          </option>
        ))}
      </Select>
    </Field>
  );
}

export default function AiAnalysisPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = searchParams.get('mode') === 'chat' ? 'chat' : 'analisis';
  const ticker = (searchParams.get('ticker') || '').toUpperCase();
  const sessionParam = Number(searchParams.get('session')) || null;

  const stocks = useAsync((opts) => loadStocks(opts), []);
  const stock = stocks.data?.find((s) => s.ticker === ticker) || null;

  const [analysisType, setAnalysisType] = useState('combined');
  const [run, setRun] = useState({ status: 'idle', result: null, error: null, ticker: null });
  const [chatKey, setChatKey] = useState(0);

  const updateParams = (changes) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  };

  const selectStock = (nextTicker) => {
    const next = stocks.data?.find((s) => s.ticker === nextTicker);
    const remembered = next ? chatSessionsByStock.get(next.stock_id) : null;
    updateParams({ ticker: nextTicker, session: mode === 'chat' ? remembered : null });
    if (run.ticker !== nextTicker) setRun({ status: 'idle', result: null, error: null, ticker: null });
  };

  const setMode = (value) => {
    const remembered = stock ? chatSessionsByStock.get(stock.stock_id) : null;
    updateParams({ mode: value === 'chat' ? 'chat' : null, session: value === 'chat' ? remembered : null });
  };

  const runAnalysis = async () => {
    if (!stock) return;
    setRun({ status: 'running', result: null, error: null, ticker: stock.ticker });
    try {
      const { analysis } = await analyze({ userId: user.user_id, stockId: stock.stock_id, analysisType });
      setRun({ status: 'done', result: analysis, error: null, ticker: stock.ticker });
    } catch (error) {
      setRun({ status: 'error', result: null, error, ticker: stock.ticker });
      if (error.status === 422) addToast(error.message, 'error');
    }
  };

  const onSessionChange = (id) => {
    if (!stock) return;
    if (id) chatSessionsByStock.set(stock.stock_id, id);
    else chatSessionsByStock.delete(stock.stock_id);
    updateParams({ session: id });
  };

  const newConversation = () => {
    if (stock) chatSessionsByStock.delete(stock.stock_id);
    updateParams({ session: null });
    setChatKey((k) => k + 1);
  };

  const missingTicker = ticker && stocks.data && !stock;
  const running = run.status === 'running';

  let right;
  if (!stock) {
    right = (
      <Card>
        <EmptyState
          message={missingTicker ? `Saham ${ticker} tidak ditemukan. Pilih saham lain.` : 'Pilih saham untuk memulai.'}
        />
      </Card>
    );
  } else if (mode === 'chat') {
    right = (
      <ChatPanel
        key={`${stock.stock_id}-${chatKey}`}
        stock={stock}
        userId={user.user_id}
        initialSessionId={sessionParam}
        onSessionChange={onSessionChange}
      />
    );
  } else if (run.status === 'running') {
    right = (
      <Card>
        <p className="mb-4 text-sm text-text-muted" aria-live="polite">
          AI sedang menyusun jawaban. Proses ini bisa memakan waktu hingga satu menit.
        </p>
        <SkeletonText lines={6} />
      </Card>
    );
  } else if (run.status === 'error') {
    right = (
      <Card>
        <ErrorState error={run.error} onRetry={runAnalysis} />
      </Card>
    );
  } else if (run.status === 'done' && run.result) {
    right = (
      <Card padded={false}>
        <AnalysisResult analysis={run.result} ticker={stock.ticker} companyName={stock.company_name} />
      </Card>
    );
  } else {
    right = (
      <Card>
        <EmptyState message={`Pilih jenis analisis untuk ${stock.ticker}, lalu jalankan.`} />
      </Card>
    );
  }

  return (
    <>
      <PageHeader title="Analisis AI" description="Jalankan analisis atau tanya AI tentang satu saham." />

      <Tabs items={MODES} value={mode} onChange={setMode} label="Mode analisis" className="mb-6" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Card>
            {stocks.loading && (
              <div className="space-y-3">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-9" />
              </div>
            )}
            {stocks.error && <ErrorState error={stocks.error} onRetry={stocks.reload} />}
            {stocks.data && (
              <div className="space-y-5">
                <StockSelect stocks={stocks.data} value={stock ? stock.ticker : ''} onChange={selectStock} />

                {mode === 'analisis' ? (
                  <>
                    <Field label="Jenis analisis">
                      <Tabs
                        variant="segmented"
                        columns={2}
                        label="Jenis analisis"
                        items={ANALYSIS_TYPES}
                        value={analysisType}
                        onChange={setAnalysisType}
                      />
                    </Field>
                    <Button variant="primary" className="w-full" onClick={runAnalysis} disabled={!stock || running}>
                      {running ? 'Menganalisis…' : 'Jalankan analisis'}
                    </Button>
                    {stock && (
                      <Link
                        to={`/analysis-history?ticker=${stock.ticker}`}
                        className="block text-center text-sm text-text-muted transition-colors duration-150 hover:text-text"
                      >
                        Lihat riwayat analisis {stock.ticker}
                      </Link>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm text-text-muted">
                      AI menjawab berdasarkan data harga, indikator, fundamental, dan berita {stock ? stock.ticker : 'saham'} yang
                      tersedia di ZainSaham.
                    </p>
                    <Button className="w-full" icon={Plus} onClick={newConversation} disabled={!stock}>
                      Percakapan baru
                    </Button>
                  </>
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="min-w-0 lg:col-span-8">{right}</div>
      </div>
    </>
  );
}
