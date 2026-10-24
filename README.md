# ZainSaham

Aplikasi analisis saham BEI. Backend Go (Gin), frontend React.

Butuh API key Gemini dari [Google AI Studio](https://aistudio.google.com/apikey).

## Menjalankan dengan Docker

```bash
git clone https://github.com/ranggaacihuy/ZainSaham
cd ZainSaham
cp backend/.env.example backend/.env
```

Isi `GEMINI_API_KEY` di `backend/.env`, lalu:

```bash
docker compose up -d --build
```

Buka http://localhost:3000. Saat pertama kali start butuh sekitar 5 menit untuk mengambil data. Pantau dengan `docker compose logs -f backend`.

| Perintah | Fungsi |
| --- | --- |
| `docker compose down` | Shutdown |
| `docker compose up -d --build` | Nyalakan lagi atau build ulang |
| `docker compose exec backend zainsaham sync` | Perbarui data pasar |
| `docker compose down -v` | Matikan dan hapus database |

## Running Tanpa Docker

Membutuhkan Go 1.26+ dan Node.js 22+.

```bash
cd backend
cp .env.example .env
```

Isi `GEMINI_API_KEY` di `backend/.env`, lalu:

```bash
go run ./cmd/zainsaham setup
go run ./cmd/zainsaham serve
```

Di terminal kedua:

```bash
cd frontend
npm install
npm run dev
```

Buka http://localhost:3000.

## Akun demo

- Email: `demo@zainsaham.test`
- Kata sandi: `demo12345`

## Perintah backend

```
zainsaham <perintah> [argumen]

	serve       jalankan REST API dan scheduler
	migrate     buat atau perbarui tabel database
	seed        isi akun demo, IHSG, dan emiten terbesar BEI
	setup       jalankan migrate lalu seed
	sync        perbarui harga, fundamental, dan berita
	listings    tambahkan emiten baru dari daftar emiten terbesar BEI
```

Detail tiap perintah: `go run ./cmd/zainsaham help <perintah>`.

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
