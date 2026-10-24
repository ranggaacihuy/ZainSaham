# ZainSaham

Aplikasi analisis saham Bursa Efek Indonesia (BEI) dengan grafik harga realtime, data fundamental, berita, dan analisis berbasis AI (Google Gemini). Backend ditulis dengan Go (Gin), frontend dengan React.

## Fitur

- Daftar 21 saham BEI dengan pencarian, filter sektor, dan paginasi di server, lengkap dengan harga dan perubahan harian.
- Grafik candlestick dan garis untuk rentang 1 bulan sampai 5 tahun. Halaman detail saham diperbarui otomatis setiap 30 detik selama bursa buka.
- Indikator teknikal RSI 14, MACD, SMA 20, dan SMA 50.
- Data fundamental kuartalan dan tahunan (pendapatan, laba bersih, EPS, ROE, ROA, DER).
- Berita terbaru per saham dari media Indonesia.
- Dashboard berisi ringkasan watchlist, berita, analisis AI terakhir, dan top gainers/losers seluruh pasar.
- Watchlist pribadi beserta harga, perubahan, dan RSI terakhir.
- Analisis AI (teknikal, fundamental, sentimen, menyeluruh) dan Tanya AI (chat) per saham.
- Riwayat analisis dan percakapan: lihat semua sesi, bandingkan versi, analisis ulang, dan hapus.
- Profil: ubah nama, email, dan kata sandi, atau hapus akun.

## Kebutuhan

| Perangkat | Versi |
| --- | --- |
| Go | 1.26 atau lebih baru |
| Node.js | 20.19+ atau 22.12+ |
| npm | 10+ |

Backend memakai SQLite murni Go, jadi tidak perlu gcc maupun server database terpisah. Dibutuhkan koneksi internet (untuk Yahoo Finance, Google News, dan Gemini) serta API key Gemini, yang bisa dibuat gratis di [ai studio](https://aistudio.google.com/apikey).

## Instalasi

### 1. Ambil kode

```bash
git clone https://github.com/ranggaacihuy/ZainSaham.git
cd ZainSaham
```

### 2. Backend

Salin `.env.example` menjadi `.env`. Di Windows (PowerShell/CMD), pakai `copy` sebagai pengganti `cp`.

```bash
cd backend
cp .env.example .env
```

Buka `backend/.env`, lalu isi API key Gemini:

```env
GEMINI_API_KEY=isi_api_key_anda
```

Unduh dependensi dan siapkan database:

```bash
go mod download
go run ./cmd/zainsaham setup
```

Perintah `setup` membuat semua tabel di `backend/data/zainsaham.db`, membuat akun demo, lalu mengambil 21 emiten beserta harga 5 tahun, data fundamental, dan berita terbaru. Prosesnya butuh sekitar satu menit.

### 3. Frontend

```bash
cd ../frontend
npm install
```

## Menjalankan Aplikasi

Jalankan backend dan frontend di dua terminal terpisah.

**Terminal 1, backend** (http://127.0.0.1:8000):

```bash
cd backend
go run ./cmd/zainsaham serve
```

**Terminal 2, frontend** (http://localhost:3000):

```bash
cd frontend
npm run dev
```

Buka **http://localhost:3000**, lalu masuk dengan akun demo.

Untuk menjalankan backend tanpa `go run`, build dulu menjadi satu file:

```bash
cd backend
go build -o bin/zainsaham ./cmd/zainsaham
./bin/zainsaham serve
```

## Akun Demo

| Email | Kata sandi |
| --- | --- |
| `demo@zainsaham.test` | `demo12345` |

Akun ini dibuat oleh perintah `setup` (atau `seed`). Akun lain bisa dibuat lewat halaman **Daftar**.

## Perintah Backend

Semua perintah dijalankan dari folder `backend`.

| Perintah | Kegunaan |
| --- | --- |
| `go run ./cmd/zainsaham serve` | Menjalankan REST API beserta scheduler |
| `go run ./cmd/zainsaham setup` | `migrate` lalu `seed` (instalasi pertama) |
| `go run ./cmd/zainsaham migrate` | Membuat atau memperbarui tabel database |
| `go run ./cmd/zainsaham seed` | Membuat akun demo dan mengambil 21 emiten (harga 5 tahun, fundamental, berita) |
| `go run ./cmd/zainsaham sync` | Memperbarui harga 1 bulan terakhir, fundamental, dan berita semua saham |
| `go run ./cmd/zainsaham sync BBCA TLKM` | Memperbarui saham tertentu saja |
| `go run ./cmd/zainsaham sync --only=news` | Memperbarui sebagian data saja (`prices`, `fundamentals`, `news`, dipisah koma) |
| `go run ./cmd/zainsaham sync --range=5y` | Mengambil ulang riwayat harga panjang (`5d`, `1mo`, `3mo`, `6mo`, `1y`, `2y`, `5y`, `10y`, `max`) |

Untuk menambah emiten, daftarkan kode dan sektornya di `backend/internal/seed/seed.go`, lalu jalankan `seed` lagi.

## Data Pasar

| Data | Sumber | Jadwal otomatis saat `serve` |
| --- | --- | --- |
| Harga harian (OHLCV) | Yahoo Finance, endpoint chart | Setiap 15 menit pada jam bursa, dan pukul 17.00 WIB |
| Indikator teknikal | Dihitung backend dari harga penutupan | Ikut setiap pembaruan harga |
| Fundamental | Yahoo Finance, endpoint fundamentals-timeseries | Setiap Senin pukul 06.00 WIB |
| Berita | RSS Google News (bahasa Indonesia) | Setiap jam |
| Harga realtime | Yahoo Finance, diambil saat halaman detail dibuka | Cache 15 detik |

Catatan:

- Yahoo Finance dan RSS Google News adalah sumber tidak resmi yang gratis. Datanya bisa tertunda beberapa menit, dan formatnya bisa berubah sewaktu-waktu.
- Fundamental tersedia untuk 5 kuartal dan 4 tahun terakhir. ROE dan ROA kuartalan disetahunkan (laba kuartal × 4).
- Berita hanya menyimpan judul, sumber, tanggal, dan tautan. Isi lengkap dibaca di situs aslinya.
- Scheduler bisa dimatikan dengan `SCHEDULER_ENABLED=false`.

## Konfigurasi `.env`

| Variabel | Bawaan | Keterangan |
| --- | --- | --- |
| `APP_HOST` / `APP_PORT` | `127.0.0.1` / `8000` | Alamat server API |
| `APP_ENV` | `development` | Isi `production` untuk mode rilis Gin |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000` | Origin yang boleh memanggil API langsung (pisahkan dengan koma) |
| `SCHEDULER_ENABLED` | `true` | Sinkronisasi data otomatis saat `serve` |
| `DB_CONNECTION` | `sqlite` | `sqlite` atau `mysql` |
| `DB_DATABASE` | `data/zainsaham.db` | Path file SQLite, atau nama database MySQL |
| `GEMINI_API_KEY` | (kosong) | Wajib diisi untuk Analisis AI dan Tanya AI |
| `GEMINI_MODEL` | `gemini-3.6-flash` | Model utama |
| `GEMINI_FALLBACK_MODELS` | `gemini-3.5-flash-lite` | Dicoba berurutan bila model utama sibuk, kuotanya habis, atau timeout |
| `GEMINI_THINKING_LEVEL` | `low` | Tingkat "berpikir" model; `low` jauh lebih cepat. Kosongkan untuk bawaan model |
| `GEMINI_TIMEOUT` | `40` | Batas waktu per model (detik) |
| `GEMINI_TOTAL_TIMEOUT` | `60` | Batas waktu total semua percobaan (detik) |
| `YAHOO_FINANCE_BASE_URL` | `https://query1.finance.yahoo.com` | Alamat API Yahoo Finance |
| `YAHOO_FINANCE_DELAY_MS` | `800` | Jeda antar saham saat sinkronisasi |
| `YAHOO_FINANCE_QUOTE_TTL` | `15` | Lama cache harga realtime per saham (detik) |
| `NEWS_BASE_URL` | `https://news.google.com` | Alamat RSS Google News |
| `NEWS_LIMIT` | `20` | Jumlah berita terbaru yang disimpan per saham setiap sinkronisasi |

### Memakai MySQL (opsional)

Untuk memakai MySQL (misalnya dari XAMPP) sebagai pengganti SQLite:

1. Buat database baru, misalnya `zainsaham`.
2. Ubah bagian database di `backend/.env`:

   ```env
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=zainsaham
   DB_USERNAME=root
   DB_PASSWORD=
   ```

3. Jalankan `go run ./cmd/zainsaham setup`.

## Pengujian

```bash
cd backend
go test ./...
```

```bash
cd frontend
npm run lint
npm run build
```

Semua panggilan ke Yahoo Finance, Google News, dan Gemini di dalam test backend disimulasikan, dan database test berjalan di memori, sehingga test tidak membutuhkan internet maupun API key.

## API

Semua endpoint berawalan `/api`. Endpoint yang ditandai "Ya" membutuhkan header `Authorization: Bearer {token}` dari respons login.

| Metode | Endpoint | Login | Keterangan |
| --- | --- | --- | --- |
| POST | `/register`, `/login` | Tidak | Mendapatkan token |
| GET | `/me` · POST `/logout` | Ya | |
| PUT · DELETE | `/profile` | Ya | Ubah profil atau hapus akun |
| GET | `/stocks` | Tidak | Semua saham + ringkasan harga; dengan `?page=` menjadi paginasi (`q`, `sector`, `per_page`) |
| GET | `/stocks/{id}` | Tidak | |
| GET | `/stocks/{id}/prices`, `/indicators` | Tidak | Opsional `?range=1B`, `3B`, `6B`, `1T`, `5T` |
| GET | `/stocks/{id}/fundamentals`, `/news` | Tidak | |
| GET | `/stocks/{id}/quote` | Tidak | Harga realtime |
| GET | `/news` | Tidak | Berita lintas saham (`limit`, `stock_ids`) |
| GET | `/dashboard` | Ya | Ringkasan untuk halaman Dashboard |
| GET | `/users/{userId}/watchlist` | Ya | Termasuk harga, RSI, dan sparkline |
| POST | `/watchlists` · DELETE `/watchlists/{id}` | Ya | |
| GET | `/stocks/{id}/ai-analysis` · POST `/ai-analysis` | Ya | `session_id` opsional untuk analisis ulang |
| POST | `/ai-chat` · GET `/ai-chat/{sessionId}/messages` | Ya | |
| GET | `/ai-sessions` | Ya | Semua sesi analisis dan chat (`kind`, `stock_id`) |
| GET · DELETE | `/ai-sessions/{sessionId}` | Ya | Detail beserta semua versi analisis, atau hapus sesi |

Status server bisa dicek di `GET /up`.

## Pemecahan Masalah

| Masalah | Solusi |
| --- | --- |
| "Layanan AI sedang sibuk" atau "terlalu lama merespons" | Server Gemini sedang penuh. Tunggu sebentar lalu coba lagi. Model cadangan dicoba otomatis. |
| "API key Gemini tidak valid" | Periksa `GEMINI_API_KEY` di `backend/.env`, lalu jalankan ulang `serve`. |
| Harga, fundamental, atau berita tidak terbaru | Jalankan `go run ./cmd/zainsaham sync`, atau biarkan `serve` berjalan dengan scheduler aktif. |
| `address already in use` pada port 8000 | Hentikan proses lain di port itu, atau ganti `APP_PORT` (sesuaikan juga proxy di `frontend/vite.config.js`). |
| Diminta masuk ulang setelah reset database | Token lama sudah tidak berlaku. Masuk lagi dengan akun demo. |
| Ingin mengulang database dari awal | Hapus `backend/data/zainsaham.db`, lalu jalankan `go run ./cmd/zainsaham setup` (semua data hilang). |

Log backend tampil langsung di terminal tempat `serve` dijalankan.
