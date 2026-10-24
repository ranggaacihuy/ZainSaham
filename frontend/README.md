# ZainSaham Frontend

Antarmuka web untuk **ZainSaham** — alat kerja analisis saham Indonesia (BEI/IDX) untuk investor ritel. Dibangun dengan React 19, Vite, dan Tailwind CSS v4, serta terhubung ke backend Go (Gin) lewat `/api`.

## Stack Teknologi
- **React 19** + **React Router DOM v7**
- **Vite 8** (dev server & bundler, proxy `/api` ke `http://127.0.0.1:8000`)
- **Tailwind CSS v4** (`@tailwindcss/vite`) dengan token tema di `src/index.css`
- **Axios** dengan normalisasi respons dan error terpusat (`src/api/client.js`, `src/api/normalize.js`)
- **Lucide React** & **@fontsource-variable/inter**

## Cara Menjalankan

1. **Jalankan backend** terlebih dahulu di port `8000` (lihat [README utama](../README.md) untuk instalasi):
   ```bash
   cd ../backend
   go run ./cmd/zainsaham serve
   ```
2. **Instal dependensi dan jalankan frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Aplikasi dapat diakses di `http://localhost:3000`. Masuk dengan akun demo `demo@zainsaham.test` / `demo12345`, atau buat akun baru di halaman Daftar.

### Perintah Lainnya
- `npm run lint` — memeriksa kode dengan Oxlint
- `npm run build` — membangun bundel produksi ke folder `dist/`
- `npm run preview` — meninjau hasil build produksi

## Autentikasi

Login dan registrasi memakai `POST /api/login` dan `POST /api/register`. Token yang diterima disimpan di `localStorage` (`zainsaham_token`) dan dikirim sebagai header `Authorization: Bearer …` pada setiap request. Saat aplikasi dibuka, identitas pengguna diperbarui dari `GET /api/me`; bila token sudah tidak berlaku (HTTP 401), sesi lokal dihapus dan pengguna diarahkan ke halaman Masuk.

## Fitur

1. **Masuk & Daftar (`/login`, `/register`)**
   - Validasi dari backend ditampilkan per kolom (nama, email, kata sandi).
2. **Dashboard (`/dashboard`)**
   - Satu panggilan `GET /api/dashboard` untuk kartu ringkasan watchlist, daftar pantauan dengan sparkline 30 hari bursa, berita terkini dari saham di watchlist, Top Gainers & Losers seluruh pasar, dan 3 analisis AI terakhir.
3. **Daftar Saham (`/stocks`)**
   - Pencarian kode/nama perusahaan (debounce 400 ms), filter sektor, dan paginasi 20 baris dilakukan di server (`GET /api/stocks?q=&sector=&page=`), lengkap dengan harga dan perubahan harian.
   - Tombol cepat tambah/hapus watchlist pada setiap baris.
4. **Detail Saham (`/stocks/:ticker` & `/saham/:ticker`)**
   - Ringkasan harga terakhir (close, perubahan harian, O/H/L, volume).
   - **Harga realtime**: selama bursa buka, harga dan candle hari ini diperbarui setiap 30 detik lewat `GET /api/stocks/{stockId}/quote` (penanda **Live** / **Pasar tutup**).
   - **Tab Grafik**: candlestick OHLC atau garis penutupan + grafik volume dengan filter rentang `1B`, `3B`, `6B`, `1T`, `5T`.
   - **Tab Teknikal**: ringkasan status RSI 14, MACD vs Signal, posisi harga terhadap SMA 20 & SMA 50, serta grafik RSI dan MACD.
   - **Tab Fundamental**: grafik pendapatan vs laba bersih dan tabel rasio (EPS, ROE, ROA, DER), dengan pilihan kuartalan atau tahunan berdasarkan `period_type`.
   - **Tab Berita**: daftar berita emiten dengan modal baca dan tautan ke sumber asli.
5. **Watchlist (`/watchlist`)**
   - Daftar saham pantauan beserta harga terakhir, perubahan harian, RSI 14 terakhir, tanggal ditambahkan, dan konfirmasi hapus.
6. **Analisis AI (`/ai-analysis`)**
   - **Mode Analisis**: menjalankan analisis (`teknikal`, `fundamental`, `sentimen`, atau `combined` / Menyeluruh) lewat `POST /api/ai-analysis` dan merender hasilnya secara aman dengan markdown sederhana.
   - **Mode Tanya AI (Chat)**: percakapan interaktif tentang saham yang dipilih lewat `POST /api/ai-chat` dan `GET /api/ai-chat/{sessionId}/messages`, lengkap dengan pengiriman optimistik dan tombol *Kirim ulang* bila Gemini mengembalikan HTTP 502.
7. **Riwayat Analisis (`/analysis-history`)**
   - Semua sesi analisis dan Tanya AI milik pengguna (`GET /api/ai-sessions`), dengan filter jenis dan saham.
   - Detail sesi analisis menampilkan setiap versi hasil, tombol **Analisis ulang** untuk membuat versi baru, dan **Hapus** untuk menghapus sesi. Sesi Tanya AI bisa dilanjutkan.
8. **Profil (`/profile`)**
   - Ubah nama dan email, ubah kata sandi, keluar, dan hapus akun (`PUT` / `DELETE /api/profile`).
9. **Pencarian Cepat (`Ctrl K`)**
   - Modal pencarian saham lintas halaman yang menggunakan cache in-memory `stocksStore`.

Semua data berasal dari backend tanpa fallback data palsu.
