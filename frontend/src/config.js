// Konfigurasi terpusat frontend ZainSaham.
// Nilai dibaca dari variabel lingkungan Vite (file .env / .env.local).

function parseUserId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : 1;
}

const env = import.meta.env;

export const config = {
  // TODO: aktifkan saat backend punya auth Sanctum — ganti dengan user dari /me.
  userId: parseUserId(env.VITE_USER_ID ?? 1),
  // Backend belum punya endpoint profil, jadi nama & email hanya tampil bila diisi di .env.
  userName: env.VITE_USER_NAME || '',
  userEmail: env.VITE_USER_EMAIL || '',

  apiBaseUrl: '/api',
  // Timeout default untuk semua request (ms).
  timeout: 15000,
  // Gemini bisa butuh hingga 60 detik, jadi endpoint AI diberi waktu lebih panjang.
  aiTimeout: 70000,
};

export default config;

