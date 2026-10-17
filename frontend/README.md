# ZainSaham Frontend (React + Vite + Tailwind CSS)

Frontend untuk **ZainSaham** (Aplikasi Analisis Saham Berbasis Artificial Intelligence untuk Investor Ritel Pasar Modal Indonesia / BEI / IDX), dikembangkan berdasarkan dokumen perancangan **SKPL** dan **DPPL** serta controller backend Laravel.

## 🎨 Tema & Desain
- **Warna Utama**: **Kuning Stabilo** (`#CCFF00`, `#DFFF00`)
- **Tampilan**: Dark Financial Terminal Theme (Obsidian & Slate) beraksen neon yellow stabilo, high contrast, responsif untuk Desktop & Mobile.

## 🚀 Fitur yang Tersedia (Sesuai SKPL & DPPL)
1. **Autentikasi & Akun**:
   - `LoginPage` (`/login` - P002): Form login, alert pesan error, dan tombol shortcut *Akun Demo*.
   - `RegisterPage` (`/register` - P001): Form registrasi lengkap dengan validasi kecocokan password.
   - `ProfilePage` (`/profile` - P012): Pengaturan profil, ubah email & password, serta aksi *Hapus Akun* (Soft Delete) dengan modal konfirmasi password.
2. **Dashboard** (`/dashboard` - P003):
   - **Watchlist Saya**: Ringkasan harga terakhir, persentase perubahan harian, dan grafik mini sparkline tren 1 bulan.
   - **Top Gainers & Top Losers**: 5 saham dengan kenaikan tertinggi dan 5 saham dengan penurunan terendah pada hari bursa terakhir.
   - **Berita Terkini**: 5 berita pasar terkini dengan modal pembaca lengkap & tautan ke sumber asli.
   - **Analisis AI Terakhir**: Ringkasan 3 sesi analisis AI terbaru dengan tombol cepat *+ Analisis Baru*.
3. **Daftar Saham** (`/stocks` - P004):
   - Pencarian real-time dengan jeda *debounce 400ms*.
   - Filter dropdown sektor (Keuangan, Material Dasar, Infrastruktur, Teknologi, Energi, dll.).
   - Tabel harga saham dengan indikator perubahan harian dan pagination (20 data per halaman).
4. **Detail Saham** (`/stocks/:ticker` - P005 - P008):
   - Header ringkasan emiten (Ticker, nama perusahaan, sektor, bursa, harga, high/low, volume).
   - Tombol toggle *+ Tambah ke Watchlist* / *Hapus dari Watchlist*.
   - Tombol *Analisis dengan AI*.
   - **Tab 1 - Grafik Harga (P005)**: Grafik Candlestick OHLC interaktif, mode grafik garis (Line), grafik volume perdagangan harian, serta chip rentang waktu (1B, 3B, 6B, 1T, 5T).
   - **Tab 2 - Indikator Teknikal (P006)**: Kartu ringkasan status RSI 14 (Overbought/Oversold/Netral), MACD / Signal line, SMA 20 / SMA 50, serta grafik interaktif RSI & MACD dengan histogram.
   - **Tab 3 - Fundamental (P007)**: Toggle periode *Kuartalan* & *Tahunan*, grafik perbandingan Pendapatan vs Laba Bersih, dan tabel rasio keuangan (EPS, ROE, ROA, DER) dengan rincian Aset, Liabilitas, & Ekuitas saat diklik.
   - **Tab 4 - Berita (P008)**: Daftar berita terkait saham beserta modal baca artikel & tombol *Baca di Sumber Asli*.
5. **Watchlist** (`/watchlist` - P009):
   - Tabel daftar pantauan lengkap dengan kode, nama, harga, persentase perubahan, nilai RSI 14, dan tanggal ditambahkan.
   - Dialog konfirmasi saat menghapus saham dari watchlist.
6. **Analisis AI** (`/ai-analysis` - P010):
   - Form pemilihan saham dan jenis analisis (*Teknikal*, *Fundamental*, *Sentimen Berita*, *Menyeluruh*).
   - Indikator status analisis interaktif (*Sedang menganalisis...*).
   - Panel hasil analisis AI dalam 4 bagian terstruktur:
     1. Ringkasan
     2. Poin Positif
     3. Risiko yang Perlu Diperhatikan
     4. Kesimpulan
   - Catatan disclaimer hukum & tombol *Analisis Ulang* untuk membuat versi analisis baru pada sesi yang sama.
7. **Riwayat Analisis AI** (`/analysis-history` - P011):
   - Filter riwayat berdasarkan kode saham dan jenis analisis.
   - Panel rincian hasil analisis dengan tab versi (*Versi 1*, *Versi 2*, dst.).
   - Aksi hapus sesi riwayat dengan dialog konfirmasi.
8. **Pencarian Cepat Global (Search Modal)**:
   - Akses via `Ctrl+K` atau klik bilah pencarian di header untuk navigasi instan ke emiten mana pun.

## 🛠️ Menjalankan Frontend
Masuk ke folder `frontend`:
```bash
cd frontend
npm install
npm run dev
```
Buka browser di `http://localhost:3000` (atau port yang ditampilkan Vite).

Aplikasi sudah dikonfigurasi dengan proxy ke backend Laravel di `http://localhost:8000/api` dan dilengkapi dengan mock fallback cerdas sehingga dapat langsung diuji dan didemokan tanpa kendala.
