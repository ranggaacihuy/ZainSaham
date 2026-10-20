import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Send } from 'lucide-react';
import { Button, Textarea } from './ui';
import MarkdownText from './MarkdownText';
import { chat, chatMessages } from '../api/ai';
import { fieldError } from '../api/client';
import { dateTime } from '../lib/format';

const MAX_LENGTH = 5000;
let localSeq = 0;
const nextKey = (prefix) => {
  localSeq += 1;
  return `${prefix}-${localSeq}`;
};

function toBubble(message) {
  return { ...message, key: message.message_id ? `m-${message.message_id}` : nextKey('m'), status: 'sent' };
}

/**
 * Chat AI untuk satu saham.
 * - session_id disimpan dari balasan pertama dan dikirim pada pesan berikutnya.
 * - Bila `initialSessionId` ada, riwayat dimuat dari /ai-chat/{sessionId}/messages.
 * - Pesan user tampil optimistik; kegagalan (mis. 502) ditampilkan inline dengan "Kirim ulang".
 */
export default function ChatPanel({ stock, userId, initialSessionId, onSessionChange }) {
  const [sessionId, setSessionId] = useState(initialSessionId || null);
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState({ loading: Boolean(initialSessionId), error: null });
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const sessionRef = useRef(sessionId);
  const textareaRef = useRef(null);

  const updateSession = (id) => {
    sessionRef.current = id;
    setSessionId(id);
    onSessionChange?.(id);
  };

  const loadHistory = async (id) => {
    setHistory({ loading: true, error: null });
    try {
      const list = await chatMessages(id);
      setMessages(list.map(toBubble));
      setHistory({ loading: false, error: null });
    } catch (error) {
      setHistory({ loading: false, error });
    }
  };

  useEffect(() => {
    if (initialSessionId) loadHistory(initialSessionId);
    // Hanya saat mount; komponen di-remount (key) bila saham/sesi berganti.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const send = async (text) => {
    const content = text.trim();
    if (!content || sending) return;
    const key = nextKey('local');
    setMessages((prev) => [...prev, { key, role: 'user', content, status: 'sending' }]);
    setSending(true);
    try {
      const res = await chat({ userId, stockId: stock.stock_id, sessionId: sessionRef.current, message: content });
      if (res.session_id && res.session_id !== sessionRef.current) updateSession(res.session_id);
      setMessages((prev) => [
        ...prev.map((m) => (m.key === key ? { ...m, status: 'sent' } : m)),
        toBubble(res.assistant_message),
      ]);
    } catch (error) {
      // 502 tetap mengirim session_id: simpan agar percakapan berlanjut di sesi yang sama.
      if (error.data?.session_id) updateSession(Number(error.data.session_id));
      // 403: sesi tidak cocok dengan user/saham → mulai sesi baru saat kirim ulang.
      if (error.status === 403) updateSession(null);
      const message = fieldError(error, 'message') || error.message;
      setMessages((prev) => prev.map((m) => (m.key === key ? { ...m, status: 'error', error: message } : m)));
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const resend = (key) => {
    const failed = messages.find((m) => m.key === key);
    if (!failed) return;
    setMessages((prev) => prev.filter((m) => m.key !== key));
    send(failed.content);
  };

  const onSubmit = (event) => {
    event.preventDefault();
    const text = input;
    setInput('');
    send(text);
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onSubmit(event);
    }
  };

  return (
    <div className="flex h-[min(640px,calc(100vh-220px))] min-h-105 flex-col rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-text">Tanya AI · {stock.ticker}</h2>
          <p className="truncate text-xs text-text-muted">
            {sessionId ? `Sesi #${sessionId}` : 'Percakapan baru'}
          </p>
        </div>
      </div>

      <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
        {history.loading && <p className="text-sm text-text-muted">Memuat riwayat percakapan…</p>}
        {history.error && (
          <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-down">{history.error.status === 404 ? 'Sesi chat tidak ditemukan.' : history.error.message}</span>
            {history.error.status !== 404 && (
              <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => loadHistory(sessionId)}>
                Coba lagi
              </Button>
            )}
          </div>
        )}
        {!history.loading && !history.error && messages.length === 0 && (
          <p className="text-sm text-text-muted">
            Tanyakan tentang {stock.ticker}, misalnya tren harga, indikator teknikal, atau kinerja keuangannya.
          </p>
        )}

        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.key} className="flex flex-col items-end">
              <div
                className={`max-w-[85%] whitespace-pre-wrap wrap-break-word rounded-xl bg-surface-2 px-3 py-2 text-sm text-text ${
                  m.status === 'sending' ? 'opacity-70' : ''
                }`}
              >
                {m.content}
              </div>
              {m.status === 'error' && (
                <div role="alert" className="mt-1.5 flex flex-wrap items-center justify-end gap-2 text-xs">
                  <span className="text-down">{m.error}</span>
                  <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => resend(m.key)} disabled={sending}>
                    Kirim ulang
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div key={m.key} className="max-w-[92%]">
              <MarkdownText text={m.content} />
              {m.created_at && <p className="mt-1 text-xs text-text-muted">{dateTime(m.created_at)}</p>}
            </div>
          ),
        )}

        {sending && <p className="text-sm text-text-muted">AI sedang menyusun jawaban…</p>}
      </div>

      <form onSubmit={onSubmit} className="border-t border-border p-3">
        <label htmlFor="chat-input" className="sr-only">
          Pesan untuk AI
        </label>
        <div className="flex items-end gap-2">
          <Textarea
            id="chat-input"
            ref={textareaRef}
            rows={2}
            value={input}
            maxLength={MAX_LENGTH}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Tulis pertanyaan… (Enter untuk kirim, Shift+Enter baris baru)"
            disabled={sending || history.loading}
            className="max-h-40"
          />
          <Button type="submit" variant="primary" size="md" icon={Send} disabled={!input.trim() || sending || history.loading}>
            <span className="sr-only sm:not-sr-only">Kirim</span>
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-text-muted">
          <span>Jawaban AI bukan saran investasi.</span>
          {input.length > MAX_LENGTH - 500 && (
            <span className="num">
              {input.length}/{MAX_LENGTH}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
