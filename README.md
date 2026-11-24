# RiceGuard

WebGIS + analitik keseimbangan produksi–kebutuhan beras 38 provinsi, dengan rekomendasi
alokasi dari provinsi surplus ke provinsi defisit.

Sumber kebenaran produk: `docs/RiceGuard - PRD & Dokumen Teknis (FE + BE).md`.
Rencana kerja: `docs/tickets/` (satu file per wave).

## Struktur

```
apps/web              React + Vite + TS + shadcn/ui
apps/api              FastAPI
packages/riceguard_calc   rumus + matching (pandas), dipakai api dan dataset
dataset               data mentah, dataset_v1.csv, rekomendasi, tes
supabase/migrations   skema SQL + RLS
supabase/seed         seed statis
.agent/skills         skill yang dipakai agent (lihat .agent/README.md)
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

## Tes

```bash
npm run test:calc    # regresi dataset_v1.csv + 4 tes algoritma
npm run test:api     # butuh DATABASE_URL yang sudah dimigrasi
npm run build:web
```

`scripts/db-local.ps1` juga punya `stop`, `status`, dan `reset`. Skrip ini tidak
dipakai di CI dan tidak menyentuh Supabase.

## Aturan angka

Semua angka berasal dari satu tempat: `packages/riceguard_calc`. Frontend tidak menghitung
rumus. Setiap angka publik bisa dilacak ke versi dataset, file mentah, dan admin yang publish.
