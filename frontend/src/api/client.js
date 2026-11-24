import axios from 'axios';
import config from '../config';

export class ApiError extends Error {
  constructor({ status = 0, message, fieldErrors = {}, data = null }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.data = data;
  }
}

const OFFLINE_MESSAGE = 'Tidak dapat terhubung ke server. Periksa koneksi atau pastikan backend berjalan.';
const TOKEN_STORAGE_KEY = 'zainsaham_token';

export function getAuthToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function setAuthToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {}
}

const DEFAULT_MESSAGES = {
  400: 'Permintaan tidak valid.',
  401: 'Sesi telah berakhir. Silakan masuk kembali.',
  403: 'Akses ditolak.',
  404: 'Data tidak ditemukan.',
  422: 'Data yang dikirim tidak valid.',
  429: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.',
  500: 'Terjadi kesalahan pada server.',
  502: 'Server tidak dapat memproses permintaan saat ini.',
  503: 'Layanan sedang tidak tersedia.',
};

function toApiError(error) {
  if (error instanceof ApiError) return error;

  if (axios.isCancel(error)) {
    return new ApiError({ status: 0, message: 'Permintaan dibatalkan.' });
  }

  const response = error?.response;

  if (!response) {
    const isTimeout = error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT';
    return new ApiError({
      status: 0,
      message: isTimeout ? 'Server terlalu lama merespons. Coba lagi.' : OFFLINE_MESSAGE,
    });
  }

  const { status } = response;
  const body = response.data;
  const isJson = body !== null && typeof body === 'object';

  if (!isJson) {
    return new ApiError({
      status,
      message: status >= 500 ? OFFLINE_MESSAGE : DEFAULT_MESSAGES[status] || 'Permintaan gagal.',
    });
  }

  const ownMessage = body.success === false && typeof body.message === 'string' ? body.message : null;
  const fallback = DEFAULT_MESSAGES[status] || (status >= 500 ? DEFAULT_MESSAGES[500] : 'Permintaan gagal.');

  return new ApiError({
    status,
    message: ownMessage || fallback,
    fieldErrors: status === 422 && body.errors && typeof body.errors === 'object' ? body.errors : {},
    data: body.data ?? null,
  });
}

export const api = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: config.timeout,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((reqConfig) => {
  const token = getAuthToken();
  if (token) {
    reqConfig.headers.Authorization = `Bearer ${token}`;
  }
  return reqConfig;
});

let unauthorizedHandler = null;

// Dipanggil saat permintaan yang membawa token ditolak 401 (token dicabut atau
// kedaluwarsa), supaya aplikasi bisa mengakhiri sesi dan kembali ke halaman login.
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError = toApiError(error);
    const sentToken = Boolean(error?.config?.headers?.Authorization);
    if (apiError.status === 401 && sentToken && unauthorizedHandler) {
      unauthorizedHandler(apiError);
    }
    return Promise.reject(apiError);
  },
);

export function unwrap(response) {
  const body = response?.data;
  if (!body || typeof body !== 'object') {
    throw new ApiError({ status: response?.status ?? 0, message: 'Respons server tidak dikenali.' });
  }
  if (body.success === false) {
    throw new ApiError({
      status: response.status,
      message: body.message || 'Permintaan gagal.',
      data: body.data ?? null,
    });
  }
  return body.data;
}

export function fieldError(error, field) {
  const list = error?.fieldErrors?.[field];
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
}

export default api;
