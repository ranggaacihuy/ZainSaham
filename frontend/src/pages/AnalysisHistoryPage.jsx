import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MessageSquareText, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Select, Skeleton, SkeletonText, Tabs } from '../components/ui';
import AnalysisResult from '../components/AnalysisResult';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useAsync from '../hooks/useAsync';
import { loadEquities } from '../lib/stocksStore';
import { analysisTypeLabel, analyze, deleteSession, getSession, listSessions } from '../api/ai';
import { dateTime, number } from '../lib/format';

const KINDS = [
  { value: '', label: 'Semua' },
  { value: 'analysis', label: 'Analisis' },
  { value: 'chat', label: 'Tanya AI' },
];

function sessionLabel(session) {
  return session.kind === 'chat' ? 'Tanya AI' : analysisTypeLabel(session.analysis_type);
}

function SessionList({ sessions, selectedId, onSelect }) {
  return (
    <ul className="max-h-140 overflow-y-auto">
      {sessions.map((item) => {
        const active = item.session_id === selectedId;
        return (
          <li key={item.session_id} className="border-b border-border last:border-b-0">
            <button
              type="button"
              onClick={() => onSelect(item.session_id)}
              className={`relative block w-full px-4 py-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
                active ? 'bg-surface-2' : 'hover:bg-surface-2'
              }`}
            >
              {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" aria-hidden="true" />}
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-text">{item.stock?.ticker || `#${item.stock_id}`}</span>
                <Badge>{sessionLabel(item)}</Badge>
                <span className="ml-auto text-xs text-text-muted">{dateTime(item.updated_at)}</span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-sm text-text-muted">{item.preview}</p>
              <p className="num mt-1 text-xs text-text-muted">
                {item.kind === 'chat' ? `${number(item.messages_count, 0)} pesan` : `${number(item.analyses_count, 0)} versi`}
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ChatDetail({ session, onDelete }) {
  const ticker = session.stock?.ticker || '';
  return (
    <Card
      title={`Tanya AI · ${ticker}`}
      description={`${number(session.messages_count, 0)} pesan · terakhir ${dateTime(session.updated_at)}`}
      action={
        <Button size="sm" variant="ghost" icon={Trash2} onClick={onDelete}>
          Hapus
        </Button>
      }
    >
      <p className="text-sm text-text-muted">{session.preview}</p>
      <Button
        as={Link}
        to={`/ai-analysis?ticker=${ticker}&mode=chat&session=${session.session_id}`}
        variant="primary"
        icon={MessageSquareText}
        className="mt-4"
      >
        Lanjutkan percakapan
      </Button>
    </Card>
  );
}

function AnalysisDetail({ detail, versionId, onVersion, onReanalyze, onDelete, running }) {
  const { session, analyses } = detail;
  const current = analyses.find((a) => a.ai_analysis_id === versionId) || analyses[0];
  const versions = analyses.map((a, index) => ({
    value: String(a.ai_analysis_id),
    label: `Versi ${analyses.length - index}`,
  }));

  return (
    <div className="space-y-4">
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
        <div className="ml-auto flex gap-2">
          <Button size="sm" icon={RefreshCw} onClick={onReanalyze} disabled={running}>
            {running ? 'Menganalisis…' : 'Analisis ulang'}
          </Button>
          <Button size="sm" variant="ghost" icon={Trash2} onClick={onDelete} disabled={running}>
            Hapus
          </Button>
        </div>
      </div>

      {running && (
        <Card>
          <p className="mb-4 text-sm text-text-muted" aria-live="polite">
            AI sedang menyusun versi baru. Proses ini bisa memakan waktu hingga satu menit.
          </p>
          <SkeletonText lines={6} />
        </Card>
      )}

      {current && (
        <Card padded={false}>
          <AnalysisResult
            analysis={{ ...current, session }}
            ticker={session.stock?.ticker || ''}
            companyName={session.stock?.company_name}
          />
        </Card>
      )}
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
      <Card>
        <Skeleton className="h-48" />
      </Card>
    );
  } else if (!selected) {
    detailBody = (
      <Card>
        <EmptyState message="Pilih salah satu riwayat di sebelah kiri untuk melihat isinya." />
      </Card>
    );
  } else if (selected.kind === 'chat') {
    detailBody = <ChatDetail session={selected} onDelete={() => setConfirmDelete(true)} />;
  } else if (detail.error) {
    detailBody = (
      <Card>
        <ErrorState error={detail.error} onRetry={detail.reload} />
      </Card>
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
    <>
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
        <Select
          value={stock ? stock.ticker : ''}
          onChange={(e) => updateParams({ ticker: e.target.value, session: null, id: null })}
          aria-label="Filter saham"
          wrapperClassName="sm:w-72"
          disabled={!stocks.data}
        >
          <option value="">Semua saham</option>
          {(stocks.data || []).map((s) => (
            <option key={s.stock_id} value={s.ticker}>
              {s.ticker} — {s.company_name}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card
          title="Riwayat"
          description={sessions.data ? `${number(sessions.data.length, 0)} sesi` : undefined}
          className="lg:col-span-4"
          padded={false}
        >
          {sessions.loading && (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          )}

          {sessions.error && <ErrorState error={sessions.error} onRetry={sessions.reload} />}

          {sessions.data && sessions.data.length === 0 && (
            <EmptyState
              message="Belum ada riwayat yang cocok."
              action={
                <Button as={Link} to="/ai-analysis" size="sm" variant="primary">
                  Analisis baru
                </Button>
              }
            />
          )}

          {sessions.data && sessions.data.length > 0 && (
            <SessionList
              sessions={sessions.data}
              selectedId={selectedId}
              onSelect={(id) => updateParams({ session: id, id: null })}
            />
          )}
        </Card>

        <div className="min-w-0 lg:col-span-8">{detailBody}</div>
      </div>
    </>
  );
}
