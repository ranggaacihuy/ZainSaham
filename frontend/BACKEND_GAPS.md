# Kekurangan Endpoint Backend ZainSaham (`BACKEND_GAPS.md`)

Dokumen ini mencatat endpoint dan kemampuan yang sebaiknya ditambahkan pada backend Laravel agar frontend tidak perlu melakukan agregasi, pemfilteran lintas-user, atau kalkulasi berat di sisi klien.

## 1. Autentikasi & Profil Pengguna (Laravel Sanctum)
- **`POST /api/login`, `POST /api/register`, `POST /api/logout`, `GET /api/me`** — Mengaktifkan autentikasi sesi/token pengguna nyata sehingga frontend tidak lagi bergantung pada `VITE_USER_ID` statis di konfigurasi.
- **`PUT /api/profile` & `DELETE /api/profile`** — Memungkinkan pengguna mengubah nama/email/kata sandi serta menonaktifkan akun (soft delete pada tabel `users`) langsung dari halaman Profil.

## 2. Data Pasar & Saham
- **Ringkasan harga terakhir pada `GET /api/stocks` (`close_price`, `prev_close`, `change_value`, `change_pct`, `volume`, `price_date`)** — Menghilangkan kebutuhan frontend untuk memanggil `/stocks/{id}/prices` satu per satu untuk setiap baris tabel daftar saham dan item watchlist.
- **Parameter `range` (`1B`, `3B`, `6B`, `1T`, `5T`) pada `GET /api/stocks/{stockId}/prices` dan `GET /api/stocks/{stockId}/indicators`** — Mengurangi ukuran payload jaringan karena klien tidak perlu mengunduh seluruh histori harga dan indikator sejak awal pencatatan.
- **Kolom atau format standar jenis periode (`quarterly` / `annual`) pada `GET /api/stocks/{stockId}/fundamentals`** — Memastikan pemisahan laporan kuartalan dan tahunan yang konsisten tanpa bergantung pada pencocokan pola string `period` di frontend.
- **Pencarian, filter sektor, dan paginasi di server pada `GET /api/stocks?q=&sector=&page=`** — Menjaga performa daftar saham tetap ringan ketika jumlah emiten BEI bertambah hingga ratusan saham.

## 3. Watchlist
- **Validasi unik `(user_id, stock_id)` pada `POST /api/watchlists` (HTTP 409/422 bila duplikat)** — Mencegah duplikasi data watchlist di tingkat database dan API tanpa mengandalkan pengecekan pra-kirim di frontend.
- **Ringkasan harga dan `rsi_14` terakhir langsung pada `GET /api/users/{userId}/watchlist`** — Menghapus kebutuhan multiple request harga dan indikator per saham saat membuka halaman Watchlist.

## 4. Dashboard & Berita
- **`GET /api/dashboard` (atau `GET /api/users/{userId}/dashboard`)** — Menyediakan ringkasan watchlist, berita gabungan terbaru, analisis AI terakhir, serta **Top Gainers/Losers** seluruh pasar dalam satu panggilan tanpa dibatasi batas jumlah saham (≤ 30) di frontend.
- **Informasi saham (`stock_id`, `ticker`, `company_name`) pada payload berita serta endpoint `GET /api/news?limit=`** — Memudahkan tampilan berita lintas saham di dashboard tanpa harus melakukan `Promise.allSettled` ke `/stocks/{id}/news` untuk setiap item watchlist.

## 5. Analisis AI & Chat AI
- **Filter `?user_id=` pada `GET /api/stocks/{stockId}/ai-analysis` dan penghapusan `context_data` dari respons list** — Mencegah pengiriman data analisis milik pengguna lain ke klien sekaligus menghemat bandwidth karena `context_data` berukuran sangat besar.
- **`GET /api/users/{userId}/ai-sessions` (daftar sesi analisis & chat milik user)** — Memungkinkan halaman Riwayat Analisis dan Tanya AI menampilkan seluruh sesi pengguna lintas saham tanpa harus memilih saham satu per satu terlebih dahulu.
- **Integrasi model Gemini nyata pada `POST /api/ai-analysis`** — Menggantikan teks placeholder sementara (`"Analisis AI sementara untuk …"`) pada `AiAnalysisController@store` dengan hasil analisis AI sesungguhnya seperti yang sudah berjalan pada `/api/ai-chat`.
- **`DELETE /api/analysis-sessions/{sessionId}`** — Memberikan kemampuan bagi pengguna untuk menghapus riwayat sesi analisis atau percakapan AI yang sudah tidak diperlukan.

