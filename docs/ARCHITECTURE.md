---
scope: architecture
canonical-for: ["stack & versi", "struktur folder", "alur request", "logika bisnis", "gotchas", "cascade delete"]
sources: ["apps/api/pyproject.toml", "apps/web/package.json", "packages/riceguard_calc/", "apps/api/app/services/", "apps/api/Dockerfile"]
last-verified: 2026-11-28
---

# Arsitektur & Gotchas RiceGuard

> Berkas kanonik untuk stack terverifikasi, struktur monorepo, alur data, logika perhitungan, dan jebakan teknis. Skema tabel di `DOMAIN_MODEL.md`; spesifikasi endpoint di `api/`.

## 1. Stack (terverifikasi dari manifest)

| Lapisan | Teknologi | Versi / Sumber |
|---|---|---|
| Bahasa backend | Python | `>=3.11` (`apps/api/pyproject.toml`), CI `3.12` (`.github/workflows/ci.yml`), Docker `3.12-slim` |
| API Framework | FastAPI + Uvicorn + Pydantic Settings | `fastapi>=0.115`, `uvicorn[standard]>=0.30`, `pydantic-settings>=2.4` |
| Akses DB | SQLAlchemy 2 + psycopg 3 | `sqlalchemy>=2.0`, `psycopg[binary]>=3.2` (PostgreSQL 16 / Supabase) |
| Paket hitung | `riceguard_calc` (`pandas`) | `packages/riceguard_calc` (di-import oleh `apps/api` dan `dataset/scripts/`) |
| Auth JWT | `PyJWT[crypto]` | `pyjwt[crypto]>=2.9` (JWKS asimetris + fallback HS256) |
| Ekspor & Laporan | `openpyxl`, `jinja2`, `matplotlib` | `openpyxl>=3.1`, `jinja2>=3.1`, `matplotlib>=3.9` (Matplotlib di-import lazy) |
| HTTP Client | `httpx` | `httpx>=0.27` (Storage bucket & proxy forecast AI) |
| Frontend | React + Vite + TypeScript | `react ^19.1.0`, `vite ^7.1.0`, `typescript ~5.9.0` |
| UI & Styling | Tailwind CSS v4 + Radix UI (`shadcn/ui`) + `lucide-react` | `@tailwindcss/vite ^4.1.0`, `radix-ui ^1.8.1`, `sonner ^2.0.8` |
| State, Tabel, Grafik, Peta | TanStack Query v5, TanStack Table v8, Recharts v3, Leaflet + `react-leaflet` v5 | `@tanstack/react-query ^5.62.0`, `recharts ^3.11.1`, `react-leaflet ^5.0.0` |
| Auth klien (admin) | `@supabase/supabase-js` | `^2.119.2` (hanya dipakai `/admin/*`) |

## 2. Struktur Folder Monorepo

| Path | Isi |
|---|---|
| `packages/riceguard_calc/src/riceguard_calc/` | Sumber tunggal rumus (`build.py`, `matching.py`, `ingest.py`) |
| `apps/api/app/main.py` | Setup FastAPI, CORS, middleware `Cache-Control`, exception handler, registrasi router `/api/v1` |
| `apps/api/app/core/` | `config.py`, `security.py`, `errors.py`, `cache.py`, `rounding.py` |
| `apps/api/app/db/` | `session.py`, `models.py` |
| `apps/api/app/schemas/` | Skema Pydantic per fitur + `admin.py` |
| `apps/api/app/routers/{public,admin}/` | 12 modul router publik + 3 modul router admin (`versions`, `content`, `audit`) |
| `apps/api/app/services/` | Logika bisnis (`versions`, `compute`, `ingest`, `summary`, `provinces`, `distribution`, `recommendations`, `explain`, `map_layers`, `trends`, `exports`, `pdf`, `storage`, `forecast`, `audit`, `content`, `validation`, `seed`) |
| `apps/api/app/templates/reports/laporan.html` | Template Jinja2 A4 portrait siap-cetak browser (CSS `@media print`) |
| `apps/web/src/features/` | Halaman & query hook per fitur (`landing`, `dashboard`, `map`, `analysis`, `distribution`, `recommendations`, `trends`, `data`, `reports`, `forecast`, `admin`) |
| `apps/web/src/components/` | `ui/` (shadcn), `layout/`, `map/`, `charts/` |
| `apps/web/src/lib/` | `api.ts`, `api-types.ts`, `tipe-api.ts`, `format.ts`, `status.ts`, `supabase.ts`, `utils.ts` |
| `apps/web/public/geo/provinsi-38.min.geojson` | Batas poligon 38 provinsi (disalin juga di `dataset/geo/`) |
| `supabase/migrations/`, `supabase/seed/` | Skema SQL murni idempoten + RLS (`0001_init.sql`) dan seed statis (`0001_static.sql`) |
| `dataset/` | File sumber mentah `raw/`, `dataset_v1.csv`, `rekomendasi_distribusi_v1.csv`, CLI tipis, tes regresi |
| `scripts/` | `db-local.ps1`, `db_local_bootstrap.py`, `docs-guard.py`, `docs-hook.py`, `ci-check.py` |

## 3. Alur Request & Data

- **Baca publik:** Browser (`apps/web`) → `GET /api/v1/...` → `resolve_published` / `resolve_for_read` → cek `ResponseCache` in-memory → SQLAlchemy query Postgres → JSON (`Cache-Control: public, max-age=300` bila tanpa header `Authorization`).
- **Simulasi on-the-fly:** `POST /api/v1/recommendations/simulate` → muat `ProvinceStat` versi target → jalankan `riceguard_calc.match_detail(..., MatchParams)` di memori → hitung selisih terhadap rekomendasi resmi (`banding_resmi`) → kembalikan JSON tanpa menulis DB atau cache.
- **Upload & Edit Admin:** `POST /api/v1/admin/versions/validate` (dry-run tanpa tulis DB/Storage) → `POST /api/v1/admin/versions` (validasi dulu, lalu unggah file ke Supabase Storage `raw-uploads/<tahun>/<version_id>/`, lalu satu transaksi DB status `draft`) → `PATCH /provinces/{kode_bps}` memicu `recompute_draft_version` penuh untuk 38 provinsi dan seluruh rekomendasi.
- **Prediksi AI (opsional):** Browser → `GET /api/v1/forecast` → jika `AI_ENDPOINT_URL` kosong, balas `503 AI_UNAVAILABLE`; jika terisi, backend kirim `POST` ke endpoint eksternal dengan header `Authorization: Bearer` (bila `AI_API_TOKEN` ada), catat kode yang hilang di `details.kode_tanpa_prediksi`.

## 4. Logika Bisnis (`packages/riceguard_calc` & Services)

1. **Perhitungan Provinsi (`riceguard_calc/build.py`):**
   - `kebutuhan_beras_ton = Decimal(penduduk_jiwa) * Decimal(konsumsi_kg_kapita_tahun) / 1000` (dibulatkan 2 desimal `ROUND_HALF_UP`).
   - `rice_balance_ton = produksi_beras_ton - kebutuhan_beras_ton` (2 desimal).
   - `rasio_swasembada = produksi_beras_ton / kebutuhan_beras_ton` (4 desimal).
   - `klasifikasi(rasio, balance, ambang=0.90)`: `surplus` jika `balance > 0` (setara rasio > 1); `balanced` jika `rasio >= ambang`; selain itu `defisit`.
2. **Matching Greedy v1 (`riceguard_calc/matching.py`):**
   - Penerima hanya berstatus `defisit` (diurutkan dari defisit terbesar, yaitu `balance` paling negatif); pemasok hanya berstatus `surplus`; provinsi `balanced` tidak ikut matching.
   - Untuk tiap penerima, kandidat pemasok diurutkan berdasar jarak `haversine_km(lat, lng)` (`RADIUS_BUMI_KM = 6371.0088`, dibulatkan 1 desimal). Alokasi `ton = min(sisa_defisit, sisa_surplus)`.
   - `MatchParams` mendukung simulasi: `ambang_swasembada` (0.80–1.00), `persen_surplus_dilepas` (10–100), `jarak_maks_km` (100–4000), `kecualikan_pemasok`, `kecualikan_penerima`, `perubahan_produksi` (-50..+50%), `perubahan_konsumsi_persen` (-20..+20%). Mode simulasi saat ini hanya `"greedy_v1"` (`"optimal"` membalas `400 INVALID_PARAMS`).
3. **Pembulatan & Penjelasan:** `bulatkan_ton()` (`core/rounding.py`) membulatkan seluruh nilai `*_ton` ke 2 desimal; rasio tetap 4 desimal; jarak 1 desimal. Kalimat penjelasan (`services/explain.py`) dibuat deterministik dari template tanpa LLM.
4. **Layer Peta (`services/map_layers.py`):** `status` (3 kategori tetap) serta `produksi`, `kebutuhan`, `kepadatan` (5 kelas kuantil `quantile_classes`; nilai kembar digabung).

## 5. Gotchas (Jebakan Penting)

- **6 Provinsi Papua berbeda kode BPS vs Kemendagri:** Join `produksi` & `penduduk` memakai nama provinsi (dengan alias `DI Yogyakarta` → `Daerah Istimewa Yogyakarta`), sedangkan `konsumsi` **wajib** join lewat `kode_kemendagri`. Primary key sistem adalah `kode_bps`.
- **Kalimantan Barat (`61`) pada 2025:** `rice_balance_ton` bernilai negatif (`-49.776,59` ton), namun `rasio_swasembada` = `0,9001` (>= 0,90), sehingga berstatus `balanced`. UI dan peta **wajib** memakai kolom `status`, bukan tanda balance.
- **SQL murni tanpa Alembic + RLS Supabase:** Skema dikelola di `supabase/migrations/0001_init.sql`. Semua tabel `public` mengaktifkan RLS tanpa policy `anon`/`authenticated`; backend membaca/menulis lewat connection string Postgres langsung.
- **Laporan HTML siap-cetak, bukan PDF server-side:** `GET /api/v1/reports/{jenis}.html` mengembalikan HTML A4 lengkap (peta & grafik Matplotlib sebagai PNG data-URI) dan browser pengguna yang menyimpan PDF lewat dialog cetak. Tidak ada WeasyPrint/Pango, jadi tidak ada dependensi pustaka native dan tidak ada `503 PDF_UNAVAILABLE`. Nomor halaman `Halaman X / Y` tidak tersedia karena margin box `@page` tidak didukung browser; footer teks diulang lewat `position: fixed`. Lihat `adr/0003-laporan-pdf-dicetak-browser.md`.
- **Matplotlib lazy-import:** `services/pdf.py` meng-import `matplotlib` di dalam fungsi render, bukan di level modul, agar proses API tidak membayar ~80 MB RAM selama laporan belum diminta (penting di host 512 MB).
- **Layer `kepadatan` (`409 LAYER_UNAVAILABLE`):** Selama `provinces.luas_km2` bernilai `NULL` semua, `GET /api/v1/map/layers?layer=kepadatan` membalas HTTP 409 agar UI menampilkan state terkendali.
- **GeoJSON pada `react-leaflet`:** Komponen `<GeoJSON>` tidak otomatis me-render ulang style saat prop data berubah; `ProvinceLayer.tsx` memakai `key` atau pembaruan style eksplisit tanpa mengunduh ulang GeoJSON.
- **Cache publik vs Preview Draft:** Middleware `cache_control_publik` (`app/main.py`) tidak memasang `Cache-Control: public, max-age=300` bila request membawa header `Authorization` agar preview draft admin tidak tersimpan di cache bersama.

### Perilaku Cascade Delete

| Induk | Anak yang ikut terhapus otomatis (`ON DELETE CASCADE`) |
|---|---|
| `dataset_versions` | `province_stats`, `province_stat_edits`, `distribution_recommendations` |
| `auth.users` (Supabase) | `admins` |

FK `province_stats.kode_bps`, `province_stat_edits.kode_bps`, serta `distribution_recommendations.{dari_kode,ke_kode}` merujuk `provinces.kode_bps` tanpa cascade delete agar referensi provinsi terlindungi dari penghapusan tak sengaja.

## 6. Deployment (Vercel)

`vercel.json` di akar mendefinisikan satu project dengan dua service:

| Service | Root | Framework | Peran publik |
|---|---|---|---|
| `api` | `apps/api` | `fastapi` (entrypoint dideteksi otomatis: `app/main.py`) | `/api/(.*)` dan `/health` |
| `web` | `apps/web` | `vite` | sisanya, dengan SPA fallback `/(.*)` → `/index.html` |

- **Tanpa service binding:** `web` adalah SPA statis yang memanggil `/api/v1` same-origin (default `BASE_URL` di `src/lib/api.ts`); tidak ada panggilan server-ke-server sehingga tidak ada URL internal yang perlu di-inject.
- **`packages/riceguard_calc` bukan service:** ia dependensi path `apps/api` lewat `[tool.uv.sources]`, sehingga installer uv Vercel ikut memasangnya. Instalasi lokal/CI tetap menyebut kedua editable sekaligus.
- **Router publik wajib bernama `publik`, bukan `public`:** Vercel memperlakukan setiap direktori bernama `public/` sebagai aset statis CDN dan **mengeluarkannya dari bundle fungsi Python**. Saat masih `app/routers/public/`, import `app.routers.public` gagal di runtime sehingga semua rute membalas `FUNCTION_INVOCATION_FAILED` tanpa traceback di log. Direktori itu kini `app/routers/publik/`.
- **`maxDuration: 60`** pada fungsi API memberi ruang render laporan Matplotlib (Hobby: 10 detik bawaan).
- **GeoJSON laporan:** `buildCommand` service `api` menyalin `dataset/geo/provinsi-38.min.geojson` ke `apps/api/dataset/geo/` karena file itu berada di luar root service, lalu gagal build bila salinan tidak ada; `services/pdf.py` menemukannya lewat fallback `Path.cwd()`.
- **Variabel lingkungan wajib di Vercel:** `DATABASE_URL` (pooler Supabase), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `CORS_ORIGINS`, `MPLCONFIGDIR=/tmp` (cache font Matplotlib di filesystem read-only). `AI_ENDPOINT_URL` opsional (kosong = `/forecast` membalas `503 AI_UNAVAILABLE`).
