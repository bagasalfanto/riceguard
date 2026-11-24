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
#    isi apps/api/.env dari apps/api/.env.example, lalu:
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
python -m app.seed --app-dir apps/api

# 2. Backend
pip install -e packages/riceguard_calc -e apps/api
npm run dev:api            # http://127.0.0.1:8000/docs

# 3. Frontend
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

## Aturan angka

Semua angka berasal dari satu tempat: `packages/riceguard_calc`. Frontend tidak menghitung
rumus. Setiap angka publik bisa dilacak ke versi dataset, file mentah, dan admin yang publish.
