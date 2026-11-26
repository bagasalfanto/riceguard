# RiceGuard

WebGIS + analitik keseimbangan produksi–kebutuhan beras 38 provinsi, dengan rekomendasi
alokasi dari provinsi surplus ke provinsi defisit.

- Titik masuk dokumentasi AI & pengembang: `docs/INDEX.md` (`AGENTS.md` untuk aturan selalu-aktif, `llms.txt` untuk peta ringkas)
- Sumber kebenaran produk historis: `docs/RiceGuard — PRD & Dokumen Teknis (FE + BE).md`
- Rencana kerja per wave: `docs/tickets/README.md` (`docs/tickets/`)

## Struktur

```text
apps/web                  React 19 + Vite + TypeScript + Tailwind v4 + shadcn/ui + Leaflet
apps/api                  FastAPI + SQLAlchemy 2 + WeasyPrint/Jinja2/Matplotlib
packages/riceguard_calc   rumus + matching (pandas), dipakai api dan dataset
dataset                   data mentah, dataset_v1.csv, rekomendasi, tes regresi
supabase/migrations       skema SQL + RLS (tanpa Alembic)
supabase/seed             seed statis (38 provinsi, sumber data, konten situs)
docs                      dokumentasi modular kanonik, ADR, dan tiket per wave
.agent/skills             skill yang dipakai agent (lihat .agent/README.md)
```

## Menjalankan

```bash
# 1. Database
#    Tanpa Docker/Supabase, untuk tes lokal (Postgres 16 embedded, di .cache/):
powershell -ExecutionPolicy Bypass -File scripts/db-local.ps1 start

#    Atau ke Supabase: isi apps/api/.env dari apps/api/.env.example, lalu jalankan
#    supabase/migrations/0001_init.sql dan supabase/seed/0001_static.sql di SQL Editor.

# 2. Data seed (versi 2025 v1 published)
cd apps/api && python -m app.seed && cd ../..

# 3. Backend
pip install -e packages/riceguard_calc -e apps/api
npm run dev:api            # http://127.0.0.1:8000/docs

# 4. Frontend
cp apps/web/.env.example apps/web/.env.local
npm install
npm run dev:web            # http://localhost:5173
```

Catatan: endpoint laporan PDF (`GET /api/v1/reports/{jenis}.pdf`) memakai WeasyPrint yang membutuhkan pustaka sistem Pango/HarfBuzz di Linux/Docker (`libpango-1.0-0`, `libpangoft2-1.0-0`, `libharfbuzz-subset0`; lihat `apps/api/Dockerfile`). Pada host Windows tanpa GTK/Pango, seluruh endpoint lain tetap berjalan normal dan endpoint PDF membalas `503 PDF_UNAVAILABLE`.

`scripts/db-local.ps1` juga punya subperintah `stop`, `status`, dan `reset`. Skrip ini tidak dipakai di CI dan tidak menyentuh Supabase.

## Verifikasi & Tes

```bash
npm run ci:check            # standar verifikasi gabungan (ruff, test:calc, docs:guard, lint:web, build:web)
npm run docs:check          # jalankan docs:guard + docs:drift sekaligus
npm run docs:drift          # cek keselarasan kode vs dokumen pada perubahan lokal
npx --yes markdownlint-cli2 # lint gaya penulisan berkas Markdown (.markdownlint-cli2.jsonc)
npm run lint:py      # ruff check packages/riceguard_calc apps/api scripts
npm run test:calc    # regresi dataset_v1.csv + tes algoritma riceguard_calc
npm run test:api     # butuh DATABASE_URL yang sudah dimigrasi
npm run build:web    # tsc -b && vite build
```

## Aturan angka

Semua angka berasal dari satu tempat: `packages/riceguard_calc`. Frontend tidak menghitung
rumus. Setiap angka publik bisa dilacak ke versi dataset, file mentah, dan admin yang publish.

## Prediksi AI (opsional)

Endpoint `GET /api/v1/forecast` memproksi permintaan ke model eksternal (Hugging Face Space) dari
backend agar token tidak masuk bundle frontend dan bentuk respons tetap seragam.

Variabel environment di `apps/api`:

- `AI_ENDPOINT_URL`: URL endpoint `POST` model prediksi. **Kosongkan** untuk mematikan fitur
  secara aman — `GET /api/v1/forecast` akan membalas `503 AI_UNAVAILABLE`, `/health` serta seluruh
  endpoint resmi tetap normal, dan menu `"Prediksi"` di frontend tidak dirender.
- `AI_API_TOKEN`: token opsional (`Authorization: Bearer ...`) jika endpoint Space bersifat privat.
- `AI_TIMEOUT_DETIK`: batas waktu tunggu respons model dalam detik (default `20`).
