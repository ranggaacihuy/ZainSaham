// Konfigurasi terpusat frontend ZainSaham.

export const config = {
  apiBaseUrl: '/api',
  // Timeout default untuk semua request (ms).
  timeout: 15000,
  // Gemini bisa butuh hingga 60 detik, jadi endpoint AI diberi waktu lebih panjang.
  aiTimeout: 70000,
};

export default config;

