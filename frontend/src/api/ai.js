import api, { unwrap } from './client';
import config from '../config';
import {
  normalizeAnalysis,
  normalizeList,
  normalizeMessage,
  normalizeSession,
  normalizeSessionItem,
  normalizeStock,
} from './normalize';

export const ANALYSIS_TYPES = [
  { value: 'teknikal', label: 'Teknikal' },
  { value: 'fundamental', label: 'Fundamental' },
  { value: 'sentimen', label: 'Sentimen' },
  { value: 'combined', label: 'Menyeluruh' },
];

export function analysisTypeLabel(value) {
  return ANALYSIS_TYPES.find((t) => t.value === value)?.label || value || '–';
}

export async function analyze({ userId, stockId, analysisType, sessionId }) {
  const body = { user_id: userId, stock_id: stockId, analysis_type: analysisType };
  if (sessionId) body.session_id = sessionId;
  const res = await api.post('/ai-analysis', body, { timeout: config.aiTimeout });
  const data = unwrap(res);
  const session = normalizeSession(data?.session);
  const analysis = normalizeAnalysis({ ...(data?.analysis || {}), session: data?.session });
  return { session, analysis };
}

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

export async function chatMessages(sessionId) {
  const res = await api.get(`/ai-chat/${sessionId}/messages`);
  return normalizeList(unwrap(res), normalizeMessage);
}

export async function listSessions({ kind, stockId } = {}) {
  const res = await api.get('/ai-sessions', {
    params: { kind: kind || undefined, stock_id: stockId || undefined },
  });
  return normalizeList(unwrap(res), normalizeSessionItem);
}

export async function getSession(sessionId) {
  const res = await api.get(`/ai-sessions/${sessionId}`);
  const data = unwrap(res) || {};
  return {
    session: normalizeSessionItem(data.session || {}),
    analyses: normalizeList(data.analyses, normalizeAnalysis),
  };
}

export async function deleteSession(sessionId) {
  const res = await api.delete(`/ai-sessions/${sessionId}`);
  unwrap(res);
  return true;
}
