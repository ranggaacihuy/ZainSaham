import axios from 'axios';
import config from '../config';

/**
 * Bentuk error seragam untuk seluruh aplikasi.
 * - status: kode HTTP (0 bila tidak ada respons, mis. jaringan putus / timeout)
 * - message: pesan yang aman ditampilkan ke pengguna (Bahasa Indonesia)
 * - fieldErrors: objek { field: [pesan] } dari validasi 422
 * - data: payload `data` dari respons error (mis. session_id pada 502 /ai-chat)
 */
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

const DEFAULT_MESSAGES = {
  400: 'Permintaan tidak valid.',
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

  // Respons non-JSON pada 5xx biasanya berarti proxy Vite gagal menghubungi Laravel.
  if (!isJson) {
    return new ApiError({
      status,
      message: status >= 500 ? OFFLINE_MESSAGE : DEFAULT_MESSAGES[status] || 'Permintaan gagal.',
    });
  }

  // Pesan dari controller ZainSaham ({ success: false, message }) sudah berbahasa Indonesia.
  // Pesan bawaan Laravel (404 findOrFail, 422 validasi) berbahasa Inggris, jadi pakai default.
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

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(toApiError(error)),
);

/** Ambil `data` dari respons `{ success, data }`. */
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

/** Pesan error yang aman ditampilkan (untuk toast / state error). */
export function errorMessage(error, fallback = 'Terjadi kesalahan.') {
  if (!error) return fallback;
  return error.message || fallback;
}

/** Pesan validasi pertama untuk field tertentu (422). */
export function fieldError(error, field) {
  const list = error?.fieldErrors?.[field];
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
}

export default api;
