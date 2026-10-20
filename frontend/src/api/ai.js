import api, { unwrap } from './client';
import config from '../config';
import { normalizeAnalysis, normalizeList, normalizeMessage, normalizeSession, normalizeStock } from './normalize';
import { createCache } from '../lib/cache';

/** Jenis analisis yang dikirim ke backend. "Menyeluruh" di UI dikirim sebagai `combined`. */
export const ANALYSIS_TYPES = [
  { value: 'teknikal', label: 'Teknikal' },
  { value: 'fundamental', label: 'Fundamental' },
  { value: 'sentimen', label: 'Sentimen' },
  { value: 'combined', label: 'Menyeluruh' },
];

export function analysisTypeLabel(value) {
  return ANALYSIS_TYPES.find((t) => t.value === value)?.label || value || '–';
}

// GET /stocks/{stockId}/ai-analysis mengembalikan analisis semua user,
// sehingga hasilnya di-cache per saham lalu difilter per user.
const analysesCache = createCache(
  async (stockId) => {
    const res = await api.get(`/stocks/${stockId}/ai-analysis`);
    // normalizeAnalysis membuang context_data agar tidak tersimpan di memori/state.
    return normalizeList(unwrap(res), normalizeAnalysis);
  },
  { ttl: 60 * 1000 },
);

export async function listByStock(stockId, userId, options) {
  const all = await analysesCache.get(Number(stockId), options);
  return all.filter((a) => a.session?.user_id === Number(userId));
}

// POST /ai-analysis → { session, analysis }
export async function analyze({ userId, stockId, analysisType }) {
  const res = await api.post(
    '/ai-analysis',
    { user_id: userId, stock_id: stockId, analysis_type: analysisType },
    { timeout: config.aiTimeout },
  );
  const data = unwrap(res);
  analysesCache.invalidate(Number(stockId));
  const session = normalizeSession(data?.session);
  const analysis = normalizeAnalysis({ ...(data?.analysis || {}), session: data?.session });
  return { session, analysis };
}

// POST /ai-chat → { session_id, stock, user_message, assistant_message }
// 502: Gemini gagal (error.data.session_id tetap dikirim). 403: sesi tidak cocok.
export async function chat({ userId, stockId, sessionId, message }) {
  const body = { user_id: userId, stock_id: stockId, message };
  if (sessionId) body.session_id = sessionId;
  const res = await api.post('/ai-chat', body, { timeout: config.aiTimeout });
  const data = unwrap(res);
  return {
    session_id: Number(data.session_id),
    stock: normalizeStock(data.stock),
    user_message: data.user_message ? normalizeMessage(data.user_message) : null,
    assistant_message: normalizeMessage(data.assistant_message || {}),
  };
}

// GET /ai-chat/{sessionId}/messages — urut kronologis.
export async function chatMessages(sessionId) {
  const res = await api.get(`/ai-chat/${sessionId}/messages`);
  return normalizeList(unwrap(res), normalizeMessage);
}

