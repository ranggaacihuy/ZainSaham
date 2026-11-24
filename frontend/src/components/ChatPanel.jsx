import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Send } from 'lucide-react';
import { Button, Textarea } from './ui';
import MarkdownText from './MarkdownText';
import StockLogo from './StockLogo';
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

export default function ChatPanel({ stock, userId, initialSessionId, onSessionChange }) {
  const [sessionId, setSessionId] = useState(initialSessionId || null);
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState({ loading: Boolean(initialSessionId), error: null });
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const sessionRef = useRef(sessionId);
  // Sesi yang dibuat panel ini sendiri (dikembalikan parent lewat URL).
  const ownSessionRef = useRef(null);
  const textareaRef = useRef(null);

  const updateSession = (id) => {
    sessionRef.current = id;
    ownSessionRef.current = id;
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

  // initialSessionId berubah karena dua hal: panel ini membuat sesi baru (parent
  // menaruhnya di URL), atau sesi lain dipilih dari luar. Hanya yang kedua yang
  // perlu memuat riwayat; memuat ulang sesi sendiri akan menimpa status pesan
  // lokal seperti pesan gagal dan tombol "Kirim ulang".
  useEffect(() => {
    if (!initialSessionId || initialSessionId === ownSessionRef.current) return undefined;
    sessionRef.current = initialSessionId;
    setSessionId(initialSessionId);
    setHistory({ loading: true, error: null });
    let active = true;
    chatMessages(initialSessionId).then(
      (list) => {
        if (!active) return;
        setMessages(list.map(toBubble));
        setHistory({ loading: false, error: null });
      },
      (error) => {
        if (active) setHistory({ loading: false, error });
      },
    );
    return () => {
      active = false;
    };
  }, [initialSessionId]);

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
    <div className="flex h-[min(640px,calc(100vh-200px))] min-h-[540px] flex-col rounded-cards bg-surface shadow-subtle">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <StockLogo ticker={stock.ticker} size="md" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-medium text-text">Tanya AI · {stock.ticker}</h2>
              <span className="num inline-flex h-5 items-center rounded border border-border bg-bg px-1.5 text-[11px] text-text-muted">
                {sessionId ? `Sesi #${sessionId}` : 'Baru'}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-text-muted">{stock.company_name}</p>
          </div>
        </div>
      </div>

      <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4" aria-live="polite">
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
                className={`max-w-[85%] whitespace-pre-wrap wrap-break-word rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-text ${
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
            <div key={m.key} className="max-w-[92%] rounded-lg border border-border bg-bg/60 p-4">
              <MarkdownText text={m.content} />
              {m.created_at && <p className="num mt-2 text-xs text-text-muted">{dateTime(m.created_at)}</p>}
            </div>
          ),
        )}

        {sending && (
          <p className="flex items-center gap-2 text-sm text-text-muted">
            <span className="h-2 w-2 animate-pulse rounded-full bg-iris" aria-hidden="true" />
            AI sedang menyusun jawaban…
          </p>
        )}
      </div>

      <form onSubmit={onSubmit} className="border-t border-border p-3.5">
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
