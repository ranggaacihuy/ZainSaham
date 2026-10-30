import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, MessageSquareText, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Button, EmptyState, ErrorState, PageHeader, Skeleton, SkeletonText, Tabs } from '../components/ui';
import AnalysisResult from '../components/AnalysisResult';
import ConfirmModal from '../components/ConfirmModal';
import MarkdownText from '../components/MarkdownText';
import StockLogo from '../components/StockLogo';
import StockSelectDropdown from '../components/StockSelectDropdown';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useAsync from '../hooks/useAsync';
import { loadEquities } from '../lib/stocksStore';
import { analysisTypeLabel, analyze, chatMessages, deleteSession, getSession, listSessions } from '../api/ai';
import { dateTime, number } from '../lib/format';

const KINDS = [
  { value: '', label: 'Semua' },
  { value: 'analysis', label: 'Analisis' },
  { value: 'chat', label: 'Tanya AI' },
];

function sessionLabel(session) {
  return session.kind === 'chat' ? 'Tanya AI' : analysisTypeLabel(session.analysis_type);
}

function TypeTag({ session }) {
  const isChat = session.kind === 'chat';
  return (
    <span
      className={`inline-flex h-5 items-center rounded-[6px] border px-2 text-[11px] font-medium ${
        isChat
          ? 'border-iris/30 bg-iris/10 text-iris'
          : 'border-border bg-bg text-text-muted'
      }`}
    >
      {sessionLabel(session)}
    </span>
  );
}

function SessionList({ sessions, selectedId, onSelect }) {
  return (
    <ul className="flex-1 divide-y divide-border overflow-y-auto">
      {sessions.map((item) => {
        const active = item.session_id === selectedId;
        const countLabel =
          item.kind === 'chat' ? `${number(item.messages_count, 0)} pesan` : `${number(item.analyses_count, 0)} versi`;
        return (
          <li key={item.session_id}>
            <button
              type="button"
              onClick={() => onSelect(item.session_id)}
              className={`relative block w-full px-5 py-4 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-iris ${
                active ? 'bg-surface-2' : 'hover:bg-surface-2/60'
              }`}
            >
              {active && <span className="absolute inset-y-0 left-0 w-[3px] bg-iris" aria-hidden="true" />}
              <div className="flex items-center gap-2">
                <StockLogo ticker={item.stock?.ticker} size="sm" />
                <span className="num text-sm font-medium text-text">{item.stock?.ticker || `#${item.stock_id}`}</span>
                <TypeTag session={item} />
                <span className="num ml-auto text-xs text-text-muted">{dateTime(item.updated_at)}</span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-text-muted">{item.preview}</p>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <span className="num inline-flex h-5 items-center rounded border border-border bg-bg px-2 text-[11px] text-text-muted">
                  {countLabel}
                </span>
                {item.stock?.company_name && (
                  <span className="truncate text-[11px] text-text-muted">{item.stock.company_name}</span>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ChatDetail({ session, onDelete }) {
  const ticker = session.stock?.ticker || '';
  const messages = useAsync(() => chatMessages(session.session_id), [session.session_id]);
  const chatUrl = `/ai-analysis?ticker=${ticker}&mode=chat&session=${session.session_id}`;

  return (
    <div className="flex h-full min-h-[620px] flex-col rounded-cards bg-surface shadow-subtle">
      {/* Sticky Reader Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {ticker && <StockLogo ticker={ticker} size="md" />}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="num inline-flex h-6 items-center rounded-md border border-border bg-bg px-2 text-xs font-medium text-text">
                {ticker || `#${session.stock_id}`}
              </span>
              <TypeTag session={session} />
              <span className="num text-xs text-text-muted">
                {number(session.messages_count, 0)} pesan · {dateTime(session.updated_at)}
              </span>
            </div>
            {session.stock?.company_name && (
              <p className="mt-1 truncate text-xs text-text-muted">{session.stock.company_name}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button as={Link} to={chatUrl} size="sm" variant="primary" icon={MessageSquareText}>
            Lanjutkan percakapan
          </Button>
          <Button size="sm" variant="ghost" icon={Trash2} onClick={onDelete} className="text-text-muted hover:text-down">
            Hapus
          </Button>
        </div>
      </header>

      {/* Full Scrollable Conversation Transcript */}
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
        {messages.loading && (
          <div className="space-y-3">
            <Skeleton className="h-16 w-2/3" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-14 w-1/2" />
          </div>
        )}

        {messages.error && <ErrorState error={messages.error} onRetry={messages.reload} />}

        {!messages.loading && !messages.error && (!messages.data || messages.data.length === 0) && (
          <p className="text-sm leading-relaxed text-text-muted">{session.preview}</p>
        )}

        {messages.data &&
          messages.data.map((m) =>
            m.role === 'user' ? (
              <div key={m.message_id || m.created_at} className="flex flex-col items-end">
                <div className="max-w-[85%] rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm text-text">
                  <p className="whitespace-pre-wrap wrap-break-word">{m.content}</p>
                </div>
                {m.created_at && <span className="num mt-1 text-[11px] text-text-muted">{dateTime(m.created_at)}</span>}
              </div>
            ) : (
              <div key={m.message_id || m.created_at} className="max-w-[94%] rounded-lg border border-border bg-bg/60 p-4">
                <MarkdownText text={m.content} />
                {m.created_at && <p className="num mt-2 text-[11px] text-text-muted">{dateTime(m.created_at)}</p>}
              </div>
            ),
          )}
      </div>

      {/* Bottom Action Footer */}
      <footer className="flex items-center justify-between gap-3 border-t border-border bg-bg/40 px-5 py-3.5 sm:px-6">
        <span className="text-xs text-text-muted">Bukan saran investasi. Lakukan riset mandiri.</span>
        <Link
          to={chatUrl}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text transition-colors duration-150 hover:text-iris"
        >
          <span>Lanjutkan percakapan di Analisis AI</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </footer>
    </div>
  );
}

function AnalysisDetail({ detail, versionId, onVersion, onReanalyze, onDelete, running }) {
  const { session, analyses } = detail;
  const current = analyses.find((a) => a.ai_analysis_id === versionId) || analyses[0];
  const versions = analyses.map((a, index) => ({
    value: String(a.ai_analysis_id),
    label: `Versi ${analyses.length - index}`,
  }));
  const ticker = session.stock?.ticker || '';

  return (
    <div className="flex h-full min-h-[620px] flex-col rounded-cards bg-surface shadow-subtle">
      {/* Sticky Reader Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {ticker && <StockLogo ticker={ticker} size="md" />}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="num inline-flex h-6 items-center rounded-md border border-border bg-bg px-2 text-xs font-medium text-text">
                {ticker || `#${session.stock_id}`}
              </span>
              <TypeTag session={{ ...session, kind: 'analysis' }} />
              <span className="num text-xs text-text-muted">
                {number(analyses.length, 0)} versi · {dateTime(current?.created_at || session.updated_at)}
              </span>
            </div>
            {session.stock?.company_name && (
              <p className="mt-1 truncate text-xs text-text-muted">{session.stock.company_name}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {versions.length > 1 && (
            <Tabs
              variant="segmented"
              size="sm"
              label="Versi analisis"
              items={versions}
              value={String(current?.ai_analysis_id)}
              onChange={(value) => onVersion(Number(value))}
            />
          )}
          <Button size="sm" icon={RefreshCw} onClick={onReanalyze} disabled={running}>
            {running ? 'Menganalisis…' : 'Analisis ulang'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={Trash2}
            onClick={onDelete}
            disabled={running}
            className="text-text-muted hover:text-down"
          >
            Hapus
          </Button>
        </div>
      </header>

      {/* Full Scrollable Body */}
      <div className="flex-1 overflow-y-auto">
        {running && (
          <div className="border-b border-border p-5 sm:p-6">
            <p className="mb-4 flex items-center gap-2 text-sm text-text-muted" aria-live="polite">
              <span className="h-2 w-2 animate-pulse rounded-full bg-iris" aria-hidden="true" />
              AI sedang menyusun versi baru. Proses ini bisa memakan waktu hingga satu menit.
            </p>
            <SkeletonText lines={6} />
          </div>
        )}

        {current && (
          <AnalysisResult
            analysis={{ ...current, session }}
            ticker={ticker}
            companyName={session.stock?.company_name}
          />
        )}
      </div>

      {/* Bottom Action Footer */}
      <footer className="flex items-center justify-between gap-3 border-t border-border bg-bg/40 px-5 py-3.5 sm:px-6">
        <span className="num text-xs text-text-muted">
          {current?.model_name ? `Model ${current.model_name}` : 'Laporan Analisis AI'}
        </span>
        <Link
          to={ticker ? `/ai-analysis?ticker=${ticker}` : '/ai-analysis'}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text transition-colors duration-150 hover:text-iris"
        >
          <span>Buka di Analisis AI</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </footer>
    </div>
  );
}

export default function AnalysisHistoryPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const kind = searchParams.get('kind') || '';
  const ticker = (searchParams.get('ticker') || '').toUpperCase();
  const sessionParam = Number(searchParams.get('session')) || null;
  const versionId = Number(searchParams.get('id')) || null;

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [running, setRunning] = useState(false);

  const stocks = useAsync((opts) => loadEquities(opts), []);
  const stock = stocks.data?.find((s) => s.ticker === ticker) || null;

  const sessions = useAsync(
    () => listSessions({ kind, stockId: stock?.stock_id }),
    [kind, stock?.stock_id],
    { enabled: !ticker || Boolean(stocks.data) },
  );

  const selectedId = sessionParam || sessions.data?.[0]?.session_id || null;
  const selected = sessions.data?.find((s) => s.session_id === selectedId) || null;

  const detail = useAsync(() => getSession(selectedId), [selectedId], {
    enabled: Boolean(selected && selected.kind === 'analysis'),
  });

  const updateParams = (changes) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  };

  const reanalyze = async () => {
    if (!detail.data) return;
    const { session } = detail.data;
    setRunning(true);
    try {
      const { analysis } = await analyze({
        userId: user.user_id,
        stockId: session.stock_id,
        analysisType: session.analysis_type,
        sessionId: session.session_id,
      });
      await Promise.all([detail.reload(), sessions.reload()]);
      updateParams({ session: session.session_id, id: analysis.ai_analysis_id });
      addToast('Versi analisis baru berhasil dibuat.', 'success');
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setRunning(false);
    }
  };

  const removeSelected = async () => {
    if (!selected) return;
    setDeleting(true);
    try {
      await deleteSession(selected.session_id);
      setConfirmDelete(false);
      updateParams({ session: null, id: null });
      await sessions.reload();
      addToast('Riwayat berhasil dihapus.', 'success');
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  let detailBody;
  if (sessions.loading || (selected?.kind === 'analysis' && detail.loading)) {
    detailBody = (
      <div className="flex min-h-[620px] flex-col rounded-cards bg-surface p-6 shadow-subtle">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 flex-1" />
      </div>
    );
  } else if (!selected) {
    detailBody = (
      <div className="flex min-h-[620px] items-center justify-center rounded-cards bg-surface p-6 shadow-subtle">
        <EmptyState message="Pilih salah satu riwayat di sebelah kiri untuk melihat isinya." />
      </div>
    );
  } else if (selected.kind === 'chat') {
    detailBody = <ChatDetail session={selected} onDelete={() => setConfirmDelete(true)} />;
  } else if (detail.error) {
    detailBody = (
      <div className="flex min-h-[620px] items-center justify-center rounded-cards bg-surface p-6 shadow-subtle">
        <ErrorState error={detail.error} onRetry={detail.reload} />
      </div>
    );
  } else if (detail.data) {
    detailBody = (
      <AnalysisDetail
        detail={detail.data}
        versionId={versionId}
        onVersion={(id) => updateParams({ id })}
        onReanalyze={reanalyze}
        onDelete={() => setConfirmDelete(true)}
        running={running}
      />
    );
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Riwayat Analisis"
        description="Semua analisis AI dan percakapan Tanya AI yang pernah Anda jalankan."
        actions={
          <Button as={Link} to={stock ? `/ai-analysis?ticker=${stock.ticker}` : '/ai-analysis'} variant="primary" icon={Plus}>
            Analisis baru
          </Button>
        }
      />

      <ConfirmModal
        isOpen={confirmDelete}
        title="Hapus riwayat"
        message={selected ? `Hapus riwayat ${sessionLabel(selected)} ${selected.stock?.ticker || ''} beserta seluruh isinya?` : ''}
        confirmText="Hapus"
        isDanger
        loading={deleting}
        onConfirm={removeSelected}
        onClose={() => !deleting && setConfirmDelete(false)}
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Tabs
          variant="segmented"
          size="sm"
          label="Jenis riwayat"
          items={KINDS}
          value={kind}
          onChange={(value) => updateParams({ kind: value, session: null, id: null })}
        />
        <StockSelectDropdown
          stocks={stocks.data || []}
          value={stock ? stock.ticker : ''}
          onChange={(val) => updateParams({ ticker: val, session: null, id: null })}
          allowEmpty
          emptyLabel="Semua saham"
          disabled={!stocks.data}
          className="sm:w-72"
        />
      </div>

      {/* Full-Height Master-Detail Split View */}
      <div className="grid min-h-[620px] grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
        {/* Left Column — Session List (36% / 4 cols) */}
        <section className="flex min-h-[620px] flex-col overflow-hidden rounded-cards bg-surface shadow-subtle lg:col-span-4">
          <header className="sticky top-0 z-[1] flex items-center justify-between gap-3 border-b border-border bg-surface px-5 py-4">
            <h2 className="text-base font-medium text-text">Riwayat</h2>
            {sessions.data && (
              <span className="num inline-flex h-5 items-center rounded-badges border border-border bg-bg px-2.5 text-xs text-text-muted">
                {number(sessions.data.length, 0)} sesi
              </span>
            )}
          </header>

          {sessions.loading && (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          )}

          {sessions.error && (
            <div className="flex flex-1 items-center justify-center p-4">
              <ErrorState error={sessions.error} onRetry={sessions.reload} />
            </div>
          )}

          {sessions.data && sessions.data.length === 0 && (
            <div className="flex flex-1 items-center justify-center p-4">
              <EmptyState
                message="Belum ada riwayat yang cocok."
                action={
                  <Button as={Link} to="/ai-analysis" size="sm" variant="primary">
                    Analisis baru
                  </Button>
                }
              />
            </div>
          )}

          {sessions.data && sessions.data.length > 0 && (
            <SessionList
              sessions={sessions.data}
              selectedId={selectedId}
              onSelect={(id) => updateParams({ session: id, id: null })}
            />
          )}
        </section>

        {/* Right Column — Full Document & Conversation Reader (64% / 8 cols) */}
        <div className="min-w-0 lg:col-span-8">{detailBody}</div>
      </div>
    </div>
  );
}
