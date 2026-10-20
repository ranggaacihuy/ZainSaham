# ZainSaham Frontend

Antarmuka web untuk **ZainSaham** — alat kerja analisis saham Indonesia (BEI/IDX) untuk investor ritel. Dibangun dengan React 19, Vite, dan Tailwind CSS v4, serta terhubung langsung ke backend Laravel (`/api`).

## Stack Teknologi
- **React 19** + **React Router DOM v7**
- **Vite 8** (dev server & bundler, proxy `/api` ke `http://127.0.0.1:8000`)
- **Tailwind CSS v4** (`@tailwindcss/vite`) dengan token tema di `src/index.css`
- **Axios** dengan normalisasi respons dan error terpusat (`src/api/client.js`, `src/api/normalize.js`)
- **Lucide React** & **@fontsource-variable/inter**

## Cara Menjalankan

1. **Jalankan backend Laravel** terlebih dahulu di port `8000`:
   ```bash
   cd ../BackendLaravel
   php artisan serve
   ```
2. **Instal dependensi dan jalankan frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Aplikasi dapat diakses di `http://localhost:3000`.

### Perintah Lainnya
- `npm run lint` — memeriksa kode dengan Oxlint
- `npm run build` — membangun bundel produksi ke folder `dist/`
- `npm run preview` — meninjau hasil build produksi

## Konfigurasi Variabel Lingkungan (`.env`)

Backend saat ini belum memiliki endpoint autentikasi dan profil pengguna. Identitas pengguna aktif diatur secara terpusat di `src/config.js` melalui variabel lingkungan Vite (opsional, buat file `.env.local` bila ingin mengubah nilai default):

```env
VITE_USER_ID=1
VITE_USER_NAME=
VITE_USER_EMAIL=
```

- `VITE_USER_ID` (default: `1`) — `user_id` yang dikirim ke endpoint watchlist, analisis AI, dan chat AI.
- `VITE_USER_NAME` & `VITE_USER_EMAIL` (opsional) — ditampilkan pada sidebar dan halaman Profil bila diisi.

## Fitur Aktif

1. **Dashboard (`/dashboard`)**
   - Kartu ringkasan watchlist (jumlah saham, rata-rata perubahan harian, jumlah saham naik & turun).
   - Daftar pantauan dengan sparkline 30 hari bursa terakhir, harga penutupan, dan persentase perubahan.
   - Berita terkini gabungan dari saham-saham di watchlist beserta modal baca berita.
   - Top Gainers & Losers (ditampilkan bila total saham terdaftar ≤ 30).
   - Ringkasan 3 analisis AI terakhir untuk saham di watchlist.
2. **Daftar Saham (`/stocks`)**
   - Pencarian kode/nama perusahaan (debounce 400 ms), filter sektor dinamis dari data, dan paginasi 20 baris per halaman.
   - Pengambilan harga & perubahan harian secara lazy (hanya untuk baris yang tampil di halaman aktif, di-cache di memori).
   - Tombol cepat tambah/hapus watchlist pada setiap baris.
3. **Detail Saham (`/stocks/:ticker` & `/saham/:ticker`)**
   - Ringkasan harga terakhir (close, perubahan harian, O/H/L, volume) yang dihitung dari histori harga.
   - **Tab Grafik**: candlestick OHLC atau garis penutupan + grafik volume dengan filter rentang `1B`, `3B`, `6B`, `1T`, `5T`.
   - **Tab Teknikal**: ringkasan status RSI 14, MACD vs Signal, posisi harga terhadap SMA 20 & SMA 50, serta grafik RSI dan MACD.
   - **Tab Fundamental**: grafik perbandingan pendapatan vs laba bersih dan tabel rasio keuangan (EPS, ROE, ROA, DER) dengan rincian aset, liabilitas, dan ekuitas.
   - **Tab Berita**: daftar berita emiten dengan modal baca lengkap dan tautan ke sumber asli.
4. **Watchlist (`/watchlist`)**
   - Daftar saham pantauan beserta harga terakhir, perubahan harian, nilai RSI 14 terakhir (lazy), tanggal ditambahkan, dan konfirmasi hapus.
   - Pencegahan duplikat sebelum mengirim `POST /api/watchlists`.
5. **Analisis AI (`/ai-analysis`)**
   - **Mode Analisis**: menjalankan analisis (`teknikal`, `fundamental`, `sentimen`, atau `combined` / Menyeluruh) lewat `POST /api/ai-analysis` dan merender hasilnya secara aman dengan markdown sederhana.
   - **Mode Tanya AI (Chat)**: percakapan interaktif tentang saham yang dipilih lewat `POST /api/ai-chat` dan `GET /api/ai-chat/{sessionId}/messages`, lengkap dengan pengiriman optimistik dan tombol *Kirim ulang* bila Gemini mengembalikan HTTP 502.
6. **Riwayat Analisis (`/analysis-history`)**
   - Memilih saham dari daftar, mengambil `GET /api/stocks/{stockId}/ai-analysis`, memfilter hasil milik pengguna saat ini (`user_id`), dan menampilkan daftar di kiri serta detail di kanan.
7. **Profil (`/profile`)**
   - Tampilan informasi akun aktif secara *read-only*.
8. **Pencarian Cepat (`Ctrl K`)**
   - Modal pencarian saham lintas halaman yang menggunakan cache in-memory `stocksStore`.

## Keterbatasan Backend Saat Ini

Semua data berasal dari backend (tanpa fallback data palsu / mock). Beberapa fitur yang belum didukung oleh endpoint backend telah disesuaikan atau disembunyikan sementara:
- **Login, Registrasi, Logout, serta Ubah/Hapus Profil** disembunyikan dari rute dan navigasi karena backend belum menyediakan autentikasi Sanctum (`/login`, `/register`, `/logout`, `/me`, `/profile`).
- **Hapus Sesi, Analisis Ulang, dan Tab Versi** pada Riwayat Analisis dihapus karena tidak ada endpoint-nya di backend.
- **Top Gainers/Losers** dihitung di frontend hanya jika jumlah saham ≤ 30 agar tidak memicu ratusan request harga sekaligus.

Rincian lengkap endpoint yang direkomendasikan untuk ditambahkan ke backend dapat dilihat di [`BACKEND_GAPS.md`](./BACKEND_GAPS.md).
