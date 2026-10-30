import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BarChart3,
  FileText,
  Layers,
  LineChart,
  MessageSquareText,
  Newspaper,
  Plus,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { Button, Card, ErrorState, Field, PageHeader, Skeleton, SkeletonText, Tabs } from '../components/ui';
import AnalysisResult from '../components/AnalysisResult';
import ChatPanel from '../components/ChatPanel';
import StockLogo from '../components/StockLogo';
import StockSelectDropdown from '../components/StockSelectDropdown';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useAsync from '../hooks/useAsync';
import { loadEquities } from '../lib/stocksStore';
import { ANALYSIS_TYPES, analyze } from '../api/ai';

const MODES = [
  { value: 'analisis', label: 'Analisis', icon: BarChart3 },
  { value: 'chat', label: 'Tanya AI', icon: MessageSquareText },
];

const BENTO_META = {
  teknikal: {
    icon: LineChart,
    subtitle: 'Indikator harga, tren & volume',
  },
  fundamental: {
    icon: BarChart3,
    subtitle: 'Laporan keuangan & valuasi',
  },
  sentimen: {
    icon: Newspaper,
    subtitle: 'Berita pasar & opini publik',
  },
  combined: {
    icon: Layers,
    subtitle: 'Kombinasi semua aspek',
  },
};

const QUICK_TICKERS = ['BBCA', 'ANTM', 'BBRI', 'ADRO', 'TLKM'];

const PREVIEW_CARDS = [
  {
    icon: FileText,
    title: 'Ringkasan Eksekutif',
    desc: 'Sintesis kondisi terkini emiten, kekuatan utama, dan risiko kunci secara objektif.',
  },
  {
    icon: Activity,
    title: 'Level Support & Resistance',
    desc: 'Pembacaan indikator teknikal harian (RSI, MACD, SMA 20/50) beserta struktur harga.',
  },
  {
    icon: Newspaper,
    title: 'Sentimen & Katalis Pasar',
    desc: 'Rangkuman berita terbaru, rasio keuangan kuartalan/tahunan, dan katalis penggerak.',
  },
];

const chatSessionsByStock = new Map();

function StockSelect({ stocks, value, onChange }) {
  return (
    <Field label="Saham" htmlFor="ai-stock">
      <StockSelectDropdown id="ai-stock" stocks={stocks} value={value} onChange={onChange} placeholder="Pilih saham" />
    </Field>
  );
}

function AnalysisTypeBento({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Jenis analisis" className="grid grid-cols-2 gap-2.5">
      {ANALYSIS_TYPES.map((item) => {
        const active = item.value === value;
        const meta = BENTO_META[item.value] || BENTO_META.combined;
        const Icon = meta.icon;
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(item.value)}
            className={`group flex flex-col justify-between rounded-[10px] border p-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iris ${
              active
                ? 'border-iris bg-iris/[0.06] text-text'
                : 'border-border bg-bg/60 text-text hover:border-border-strong hover:bg-surface-2'
            }`}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-md border ${
                  active
                    ? 'border-iris/30 bg-iris/10 text-iris'
                    : 'border-border bg-surface text-text-muted group-hover:text-text'
                }`}
                aria-hidden="true"
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <span
                className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
                  active ? 'border-iris' : 'border-border-strong'
                }`}
                aria-hidden="true"
              >
                {active && <span className="h-1.5 w-1.5 rounded-full bg-iris" />}
              </span>
            </div>
            <div className="mt-3">
              <p className="text-xs font-medium text-text sm:text-sm">{item.label}</p>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-text-muted">{meta.subtitle}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ResearchBlueprint({ stock, stocks, missingTicker, ticker, onSelectStock, onRun, running }) {
  const availableQuick = QUICK_TICKERS.filter((t) => !stocks || stocks.some((s) => s.ticker === t));
  const chips = availableQuick.length > 0 ? availableQuick : (stocks || []).slice(0, 5).map((s) => s.ticker);

  return (
    <div className="relative flex min-h-[540px] flex-col justify-between overflow-hidden rounded-cards bg-surface p-6 shadow-subtle sm:p-8">
      <div className="bg-dot-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />

      {/* Top status bar */}
      <div className="relative z-[1] flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Terminal className="h-3.5 w-3.5 text-iris" strokeWidth={1.75} aria-hidden="true" />
          <span className="num uppercase tracking-wider">Research Workbench · AI Engine</span>
        </div>
        <span className="num inline-flex items-center gap-1.5 rounded-badges border border-border bg-bg px-2.5 py-0.5 text-[11px] text-text-muted">
          <span className={`h-1.5 w-1.5 rounded-full ${stock ? 'bg-iris' : 'bg-text-muted'}`} aria-hidden="true" />
          {stock ? `${stock.ticker} siap dianalisis` : 'Menunggu pilihan emiten'}
        </span>
      </div>

      {/* Center hero */}
      <div className="relative z-[1] mx-auto my-10 flex max-w-lg flex-col items-center text-center">
        {stock ? (
          <StockLogo ticker={stock.ticker} size="lg" />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-bg text-text shadow-subtle">
            <Sparkles className="h-5 w-5 text-iris" strokeWidth={1.75} aria-hidden="true" />
          </span>
        )}

        <h2 className="mt-4 text-lg font-medium text-text sm:text-xl">
          {missingTicker
            ? `Saham ${ticker} tidak ditemukan`
            : stock
              ? `Siap Menganalisis ${stock.ticker}`
              : 'Siap Menjalankan Analisis AI'}
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-text-muted">
          {missingTicker
            ? 'Emiten yang Anda cari belum tersedia. Silakan pilih emiten lain melalui daftar di panel kiri atau pintasan di bawah.'
            : stock
              ? `${stock.company_name}. Pilih aspek analisis di panel kiri lalu klik "Jalankan analisis" untuk membedah data pasar terkini.`
              : 'Pilih emiten di panel kiri atau gunakan pintasan cepat di bawah untuk membedah data pasar secara mendalam.'}
        </p>

        {stock ? (
          <Button variant="primary" size="md" className="mt-5" onClick={onRun} disabled={running}>
            {running ? 'Menganalisis…' : `Jalankan analisis ${stock.ticker}`}
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </Button>
        ) : (
          chips.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-text-muted">Pintasan emiten:</span>
              {chips.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => onSelectStock(code)}
                  className="num inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-bg pl-1.5 pr-2.5 text-xs font-medium text-text transition-colors duration-150 hover:border-iris hover:bg-iris/10 hover:text-iris focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iris"
                >
                  <StockLogo ticker={code} size="sm" />
                  {code}
                </button>
              ))}
            </div>
          )
        )}
      </div>

      {/* Bottom 3 Preview Feature Cards */}
      <div className="relative z-[1] grid grid-cols-1 gap-3 border-t border-border pt-5 sm:grid-cols-3">
        {PREVIEW_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="rounded-lg border border-border bg-bg/80 p-3.5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded border border-border bg-surface text-text-muted">
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <h3 className="text-xs font-medium text-text">{card.title}</h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-text-muted">{card.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AiAnalysisPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = searchParams.get('mode') === 'chat' ? 'chat' : 'analisis';
  const ticker = (searchParams.get('ticker') || '').toUpperCase();
  const sessionParam = Number(searchParams.get('session')) || null;

  const stocks = useAsync((opts) => loadEquities(opts), []);
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
      <ResearchBlueprint
        stock={ null }
        stocks={stocks.data}
        missingTicker={missingTicker}
        ticker={ticker}
        onSelectStock={selectStock}
        onRun={runAnalysis}
        running={running}
      />
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
      <Card className="min-h-[540px]">
        <div className="mb-6 flex items-center gap-2.5 border-b border-border pb-4 text-sm text-text-muted" aria-live="polite">
          <span className="h-2 w-2 animate-pulse rounded-full bg-iris" aria-hidden="true" />
          <span>AI sedang menyusun laporan analisis {stock.ticker}. Proses ini bisa memakan waktu hingga satu menit.</span>
        </div>
        <SkeletonText lines={10} />
      </Card>
    );
  } else if (run.status === 'error') {
    right = (
      <Card className="flex min-h-[540px] items-center justify-center">
        <ErrorState error={run.error} onRetry={runAnalysis} />
      </Card>
    );
  } else if (run.status === 'done' && run.result) {
    right = (
      <Card padded={false} className="min-h-[540px]">
        <AnalysisResult analysis={run.result} ticker={stock.ticker} companyName={stock.company_name} />
      </Card>
    );
  } else {
    right = (
      <ResearchBlueprint
        stock={stock}
        stocks={stocks.data}
        missingTicker={false}
        ticker={ticker}
        onSelectStock={selectStock}
        onRun={runAnalysis}
        running={running}
      />
    );
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Analisis AI"
        description="Jalankan analisis atau tanya AI tentang satu saham."
        actions={<Tabs variant="segmented" items={MODES} value={mode} onChange={setMode} label="Mode analisis" />}
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card title="Parameter Riset" description="Konfigurasi emiten dan cakupan analisis.">
          {stocks.loading && (
            <div className="space-y-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10" />
            </div>
          )}
          {stocks.error && <ErrorState error={stocks.error} onRetry={stocks.reload} />}
          {stocks.data && (
            <div className="space-y-5">
              <StockSelect stocks={stocks.data} value={stock ? stock.ticker : ''} onChange={selectStock} />

              {mode === 'analisis' ? (
                <>
                  <Field label="Jenis analisis">
                    <AnalysisTypeBento value={analysisType} onChange={setAnalysisType} />
                  </Field>
                  <Button variant="primary" size="lg" className="w-full" onClick={runAnalysis} disabled={!stock || running}>
                    {running ? 'Menganalisis…' : 'Jalankan analisis'}
                  </Button>
                  {stock && (
                    <Link
                      to={`/analysis-history?ticker=${stock.ticker}`}
                      className="flex items-center justify-center gap-1.5 pt-1 text-xs font-medium text-text-muted transition-colors duration-150 hover:text-text"
                    >
                      <span>Lihat riwayat analisis {stock.ticker}</span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <div className="rounded-lg border border-border bg-bg p-3.5 text-xs leading-relaxed text-text-muted">
                    AI menjawab berdasarkan data harga, indikator teknikal, fundamental, dan berita{' '}
                    <span className="font-medium text-text">{stock ? stock.ticker : 'saham'}</span> yang tersedia di ZainSaham.
                  </div>
                  <Button variant="secondary" className="w-full" icon={Plus} onClick={newConversation} disabled={!stock}>
                    Percakapan baru
                  </Button>
                </>
              )}
            </div>
          )}
        </Card>

        <div className="min-w-0">{right}</div>
      </div>
    </div>
  );
}
