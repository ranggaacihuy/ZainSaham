# ZainSaham

Aplikasi analisis saham Bursa Efek Indonesia (BEI) dengan grafik harga realtime dari Yahoo Finance dan analisis berbasis AI (Google Gemini).

## Fitur

- Daftar 21 saham BEI lengkap dengan harga dan perubahan harian.
- Grafik candlestick dan garis untuk rentang 1 bulan sampai 5 tahun. Halaman detail saham diperbarui otomatis setiap 30 detik selama bursa buka.
- Indikator teknikal RSI 14, MACD, SMA 20, dan SMA 50.
- Watchlist pribadi.
- Analisis AI (teknikal, fundamental, sentimen, menyeluruh) dan Tanya AI (chat) per saham.
- Riwayat analisis.

## Kebutuhan

| Perangkat | Versi |
| --- | --- |
| PHP | 8.3 atau lebih baru, dengan ekstensi `curl`, `openssl`, `mbstring`, `pdo_sqlite` |
| Composer | 2.x |
| Node.js | 20.19+ atau 22.12+ |
| npm | 10+ |

Dibutuhkan koneksi internet (untuk Yahoo Finance dan Gemini) serta API key Gemini, yang bisa dibuat gratis di [ai studio](https://aistudio.google.com/apikey).

## Instalasi

### 1. Ambil kode

```bash
git clone https://github.com/ranggaacihuy/ZainSaham.git
cd ZainSaham
```

### 2. Backend

```bash
cd BackendLaravel
composer install
php -r "copy('.env.example', '.env');"
php artisan key:generate
```

Buka `BackendLaravel/.env`, lalu isi API key Gemini:

```env
GEMINI_API_KEY=isi_api_key_anda
```

Buat database SQLite, lalu isi datanya:

```bash
php -r "touch('database/database.sqlite');"
php artisan migrate --seed
```

`migrate --seed` membuat semua tabel, membuat akun demo, dan mengambil data 21 emiten beserta harga 5 tahun terakhir dari Yahoo Finance. Prosesnya butuh sekitar satu menit.

### 3. Frontend

```bash
cd ../frontend
npm install
```

## Menjalankan Aplikasi

Jalankan backend dan frontend di dua terminal terpisah.

**Terminal 1, backend** (http://127.0.0.1:8000):

```bash
cd BackendLaravel
php artisan serve
```

**Terminal 2, frontend** (http://localhost:3000):

```bash
cd frontend
npm run dev
```

Buka **http://localhost:3000**, lalu masuk dengan akun demo.

**Terminal 3, opsional.** Scheduler untuk memperbarui harga seluruh saham secara otomatis: setiap 15 menit selama jam bursa, dan sekali pada pukul 17.00 WIB setelah bursa tutup.

```bash
cd BackendLaravel
php artisan schedule:work
```

## Akun Demo

| Email | Kata sandi |
| --- | --- |
| `demo@zainsaham.test` | `demo12345` |

Akun ini dibuat oleh `DemoUserSeeder`. Akun lain bisa dibuat lewat halaman **Daftar**.

## Data Pasar

Harga harian (OHLCV) diambil dari endpoint chart Yahoo Finance (`/v8/finance/chart/{kode}.JK`). Indikator teknikal dihitung sendiri oleh backend dari harga penutupan.

| Perintah | Kegunaan |
| --- | --- |
| `php artisan market:sync` | Memperbarui harga 1 bulan terakhir untuk semua saham |
| `php artisan market:sync BBCA TLKM` | Memperbarui saham tertentu saja |
| `php artisan market:sync --range=5y` | Mengambil ulang riwayat panjang (`5d`, `1mo`, `3mo`, `6mo`, `1y`, `2y`, `5y`, `10y`, `max`) |
| `php artisan db:seed --class=IdxStockSeeder` | Menambahkan emiten baru yang didaftarkan di `IdxStockSeeder` |

Catatan:

- Yahoo Finance adalah API tidak resmi. Datanya bisa tertunda beberapa menit, dan formatnya bisa berubah sewaktu-waktu.
- Data fundamental dan berita belum memiliki sumber otomatis. Karena itu, Analisis AI jenis Fundamental dan Sentimen menampilkan pesan "data belum tersedia" sampai tabel `stock_fundamentals` dan `news` diisi.

## Konfigurasi `.env`

| Variabel | Bawaan | Keterangan |
| --- | --- | --- |
| `GEMINI_API_KEY` | (kosong) | Wajib diisi untuk Analisis AI dan Tanya AI |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Model utama |
| `GEMINI_FALLBACK_MODELS` | `gemini-3.6-flash,gemini-3.5-flash-lite` | Dicoba berurutan bila model utama sibuk, kuotanya habis, atau timeout |
| `GEMINI_TIMEOUT` | `40` | Batas waktu per model (detik) |
| `GEMINI_TOTAL_TIMEOUT` | `60` | Batas waktu total semua percobaan (detik) |
| `GEMINI_CA_BUNDLE` | (kosong) | Path `cacert.pem` bila PHP gagal memverifikasi SSL |
| `YAHOO_FINANCE_BASE_URL` | `https://query1.finance.yahoo.com` | Alamat API Yahoo Finance |
| `YAHOO_FINANCE_DELAY_MS` | `800` | Jeda antar saham saat sinkronisasi |
| `YAHOO_FINANCE_QUOTE_TTL` | `15` | Lama cache harga realtime per saham (detik) |

### Memakai MySQL (opsional)

Untuk memakai MySQL (misalnya dari XAMPP) sebagai pengganti SQLite:

1. Buat database baru, misalnya `zainsaham`.
2. Ubah bagian database di `.env`:

   ```env
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=zainsaham
   DB_USERNAME=root
   DB_PASSWORD=
   ```

3. Jalankan `php artisan migrate --seed`.

## Pengujian

```bash
cd BackendLaravel
php artisan test
```

Semua panggilan ke Yahoo Finance dan Gemini di dalam test disimulasikan, sehingga test tidak membutuhkan internet maupun API key.

## API

Semua endpoint berawalan `/api`. Endpoint yang ditandai "Ya" membutuhkan header `Authorization: Bearer {token}` dari respons login.

| Metode | Endpoint | Login |
| --- | --- | --- |
| POST | `/register`, `/login` | Tidak |
| GET | `/me` · POST `/logout` | Ya |
| GET | `/stocks`, `/stocks/{id}` | Tidak |
| GET | `/stocks/{id}/prices`, `/indicators`, `/fundamentals`, `/news` | Tidak |
| GET | `/stocks/{id}/quote` (harga realtime) | Tidak |
| GET | `/users/{userId}/watchlist` | Ya |
| POST | `/watchlists` · DELETE `/watchlists/{id}` | Ya |
| GET | `/stocks/{id}/ai-analysis` · POST `/ai-analysis` | Ya |
| POST | `/ai-chat` · GET `/ai-chat/{sessionId}/messages` | Ya |

## Pemecahan Masalah

| Masalah | Solusi |
| --- | --- |
| "Layanan AI sedang sibuk" atau "terlalu lama merespons" | Server Gemini sedang penuh. Tunggu sebentar lalu coba lagi. Model cadangan dicoba otomatis. |
| "API key Gemini tidak valid" | Periksa `GEMINI_API_KEY` di `BackendLaravel/.env`. |
| `cURL error 60` (SSL) | Unduh `cacert.pem` dari curl.se, lalu isi path-nya di `GEMINI_CA_BUNDLE`. |
| Harga tidak terbaru di daftar saham | Jalankan `php artisan market:sync`, atau biarkan `php artisan schedule:work` berjalan. |
| Diminta masuk ulang setelah reset database | Token lama sudah tidak berlaku. Masuk lagi dengan akun demo. |
| Ingin mengulang database dari awal | `php artisan migrate:fresh --seed` (menghapus semua data). |

Log error backend tersimpan di `BackendLaravel/storage/logs/laravel.log`.
