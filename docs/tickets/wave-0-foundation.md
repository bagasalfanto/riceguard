---
scope: tickets/wave-0
canonical-for: ["spesifikasi tiket wave 0 fondasi"]
sources: ["docs/tickets/README.md", "docs/RiceGuard — PRD & Dokumen Teknis (FE + BE).md"]
last-verified: 2026-11-26
---

# Wave 0 — Fondasi

Selesai kalau: `uvicorn` melayani `GET /api/v1/health` dan `GET /api/v1/meta/years` dari DB hasil
seed; `npm run dev` di `apps/web` menampilkan shell layout; `pytest` hijau termasuk tes regresi
"output identik `dataset_v1.csv`".

Tidak ada fitur produk di wave ini. Tidak ada endpoint fitur selain `health` dan `meta/years`.

---

## T0.1 — Skeleton monorepo + perbaikan identitas repo

**Blocked by:** —

**Scope**
- Buat struktur persis PRD §8: `apps/web`, `apps/api`, `packages/riceguard_calc`, `supabase/migrations`,
  `supabase/seed`, `docs/tickets`.
- `package.json` root: `"workspaces": ["apps/web"]`, `"private": true`.
- `.gitignore`: `node_modules`, `dist`, `.venv`, `__pycache__`, `.env`, `.env.local`, `*.pyc`, `.pytest_cache`.
- `.env.example` di root + `apps/api/.env.example` + `apps/web/.env.example` (nama variabel PRD §11/§12, nilai kosong).
- `README.md` root: cara jalan (DB → API → FE), 5 perintah.
- `git remote set-url origin https://github.com/bagasalfanto/riceguard.git` (repo sudah di-rename).
- Ganti sisa rujukan `next-riceguard` → `riceguard` di `AGENTS.md`, `docs/agents/issue-tracker.md`.
- `AGENTS.md`: hapus bagian "Submodules" dan aturan `src/design-system` / `i18n-seed` (tidak ada di repo ini).
  Pertahankan aturan commit, triage label, domain docs. Ganti target push `origin/main`.

**Acceptance**
- `git remote -v` menunjuk `riceguard`.
- `npm install` di root sukses tanpa warning workspace.
- Tidak ada file yang menyebut `next-riceguard` (`grep -r next-riceguard` kosong).

**Tes:** `npm install`, `grep -r next-riceguard . --exclude-dir=node_modules` kosong.

---

## T0.2 — Vendor skill ke `.agent/skills`

**Blocked by:** T0.1

**Scope**
- Salin folder skill dari lokasi lokal ke `.agent/skills/*/SKILL.md`
  (salin utuh termasuk `references/`, `agents/`, `scripts/` bila ada):
  `ponytail`, `ponytail-review`, `ponytail-audit`, `frontend-design`, `anti-ui-slop`, `ui-design`,
  `ui-slop-score`, `accessibility`, `tailwind-4-docs`, `vercel-react-best-practices`, `tdd`,
  `grilling`, `domain-modeling`, `code-review`, `diagnosing-bugs`.
- `opencode.json` di root:

  ```json
  { "$schema": "https://opencode.ai/config.json",
    "skills": { "paths": [".agent/skills"] } }
  ```

- `.agent/README.md` (≤ 15 baris): cara menambah skill, aturan nama folder = `name` di frontmatter.

**Acceptance**
- Tiap folder punya berkas `"SKILL.md"` dengan frontmatter `name` = nama folder dan `description` terisi.
- `opencode.json` valid terhadap `https://opencode.ai/config.json`.
- Setelah restart opencode, skill muncul di daftar skill.

**Tes:** skrip cek: untuk tiap folder di `.agent/skills`, berkas `"SKILL.md"` ada dan baris `name:` cocok.

---

## T0.3 — Paket `riceguard_calc` (pemisahan logika P5)

**Blocked by:** T0.1

**Scope**
- `packages/riceguard_calc/pyproject.toml` (name `riceguard_calc`, deps `pandas`).
- `src/riceguard_calc/__init__.py`, `build.py`, `matching.py`, `ingest.py`.
- `build.build(ref, produksi, penduduk, konsumsi, tahun, ambang=0.90) -> DataFrame`:
  fungsi murni menerima DataFrame, **bukan path**. Rumus & urutan kolom sama persis
  `dataset/scripts/build_dataset.py` baris 52–85.
- `matching.match(provinsi, params=None) -> list[dict]`: pindahkan `rekomendasi_distribusi` + `haversine_km` apa adanya. `params` ditambahkan di T6.1, untuk sekarang `None` = perilaku v1.
- `ingest.parse_produksi/parse_penduduk/parse_konsumsi/parse_referensi(bytes|str) -> DataFrame`:
  parser format Indonesia (`1.615.200,00`), alias `DI Yogyakarta`, join konsumsi lewat `kode_kemendagri`.
  Pindahkan `angka_id` dan `baca_tabel_pipa` dari `build_dataset.py`.
- `dataset/scripts/build_dataset.py` dan `matching.py` jadi CLI tipis yang memanggil paket
  (tetap bisa dijalankan dari folder `dataset/`). Output harus byte-identik dengan file CSV sekarang.

**Acceptance**
- `python dataset/scripts/build_dataset.py` menghasilkan `dataset_v1.csv` identik (bandingkan hash).
- `python dataset/scripts/matching.py` menghasilkan 27 baris, total 2.889.188 ton.
- 4 tes `dataset/tests/test_matching.py` lulus tanpa diubah isinya.

**Tes**
- `packages/riceguard_calc/tests/test_build_regression.py`: baca `dataset/raw/*` →
  `build()` → bandingkan 38 baris dengan `dataset_v1.csv` per kolom (toleransi 0,01).
- `test_match_regression.py`: → 27 baris, bandingkan `dari_kode, ke_kode, ton, jarak_km`.
- `test_ingest.py`: angka `1.615.200,00` → `1615200.0`; alias DI Yogyakarta terpetakan.

---

## T0.4 — Migrasi skema database

**Blocked by:** T0.1

**Scope** — `supabase/migrations/0001_init.sql`, persis PRD §9:
- Enum `version_status`, `province_status`.
- Tabel: `provinces`, `dataset_versions`, `province_stats`, `province_stat_edits`,
  `distribution_recommendations`, `data_sources`, `site_content`, `admins`, `audit_log`.
  Kolom, tipe, PK, FK, CHECK sesuai tabel PRD §9 (termasuk `luas_km2 numeric(12,2) null`).
- `create unique index dataset_versions_one_published on dataset_versions (tahun) where status = 'published'`.
- Index baca: `province_stats (version_id, status)`, `distribution_recommendations (version_id, urutan)`.
- `alter table ... enable row level security` untuk **semua** tabel `public`, **tanpa policy**
  (PRD §9: akses anon ditolak).
- Trigger `updated_at` tidak dipakai — kolom waktu eksplisit saja (sesuai PRD).

**Acceptance**
- Migrasi jalan bersih di database kosong dan idempoten saat dijalankan ulang lewat `supabase db push`
  (atau `psql -f`) pada project yang sama sekali baru.
- Insert dua versi `published` untuk tahun yang sama gagal dengan unique violation.
- `select * from provinces` lewat anon key gagal (RLS).

**Tes:** `apps/api/tests/test_schema.py` — cek 9 tabel ada, 2 enum ada, unique index ada, RLS aktif
(`pg_class.relrowsecurity`) untuk semua tabel.

---

## T0.5 — Model SQLAlchemy + sesi + resolver versi

**Blocked by:** T0.4

**Scope**
- `apps/api/app/db/session.py`: `create_engine(DATABASE_URL)`, `SessionLocal`, dependency `get_db()`.
- `apps/api/app/db/models.py`: 9 model memetakan tabel T0.4. Nama kolom = nama DB.
- `apps/api/app/services/versions.py`:
  - `resolve_published(db, tahun: int | None) -> DatasetVersion` — `None` = tahun published terbaru;
    tidak ada → `AppError("NO_PUBLISHED_VERSION", 404)`.
  - `resolve_for_read(db, tahun, version_id, admin) -> DatasetVersion` — `version_id` hanya dihormati
    kalau `admin` tidak `None` (preview draft, PRD §10).
  - `list_published_years(db) -> list[dict]`.

**Acceptance**
- `resolve_published(db, 2025)` mengembalikan versi seed; `resolve_published(db, 2019)` → 404 `NO_PUBLISHED_VERSION`.

**Tes:** `test_versions.py` dengan fixture DB berisi 1 versi published.

---

## T0.6 — Seed 2025 v1 published

**Blocked by:** T0.3, T0.5

**Scope**
- `supabase/seed/seed.sql` untuk data statis: 38 `provinces` dari
  `dataset/raw/provinces-reference-serlin.csv`, `data_sources` (4 baris, PRD §3),
  `site_content` (6 key: `hero`, `about`, `sdg2`, `how_it_works`, `limitations`, `methodology`).
- `apps/api/app/services/seed.py` + `python -m app.seed`: baca `dataset/dataset_v1.csv` dan
  `rekomendasi_distribusi_v1.csv` → buat `dataset_versions` 2025 `version_no=1` status `published`,
  38 `province_stats`, 27 `distribution_recommendations` (kolom `explanation` diisi T6.2 nanti; `null` dulu),
  `summary` nasional, `validation` hasil cek, `source_files` menunjuk file `raw/` lokal.
- Seed idempoten: kalau tahun 2025 sudah punya versi published, keluar tanpa menulis.

**Acceptance**
- Setelah seed: 38 provinsi, 1 versi published 2025, 27 rekomendasi, total ton 2.889.188,00.
- `summary` = produksi 34.690.959, kebutuhan 24.819.269, balance +9.871.690, 17/1/20.
- Jalankan dua kali tidak menggandakan baris.

**Tes:** `test_seed.py` — jalankan seed di DB kosong, assert angka di atas, jalankan ulang, assert jumlah baris sama.

---

## T0.7 — Skeleton FastAPI

**Blocked by:** T0.1

**Scope**
- `apps/api/app/main.py`: `FastAPI(title="RiceGuard API")`, `CORSMiddleware` dari `CORS_ORIGINS`,
  mount semua router di `/api/v1`, exception handler untuk `AppError` dan `RequestValidationError`.
- `app/core/config.py` (pydantic-settings): `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `SUPABASE_JWT_SECRET` (opsional), `CORS_ORIGINS`, `MAX_UPLOAD_MB=2`.
- `app/core/errors.py`: `AppError(code, status_code, message, details)` → body PRD §10.
- `app/core/security.py`: placeholder `require_admin` yang selalu 401 sampai T10.1.
- `app/routers/public/meta.py`: `GET /meta/years`.
- `GET /health` (di luar `/api/v1`) → `{"status": "ok"}`.
- `apps/api/pyproject.toml`: fastapi, uvicorn[standard], sqlalchemy, psycopg[binary], pydantic-settings,
  pyjwt[crypto], pandas, openpyxl, httpx, pytest, pytest-cov.
- `apps/api/tests/conftest.py`: `TestClient`, fixture DB transaksional yang di-rollback.

**Acceptance**
- `GET /api/v1/meta/years` → `{"tahun": [{"tahun": 2025, "version_id": "...", "version_no": 1, "published_at": "..."}], "jumlah_tahun": 1, "butuh_minimal_2_tahun": true, "tahun_terbaru": 2025}`.
  (Objek, bukan array telanjang, karena T1.3 menambahkan field di level atas.)
- `GET /api/v1/provinces?tahun=2019` → 404 body `{"error": {"code": "NO_PUBLISHED_VERSION", ...}}`.
- `GET /docs` menampilkan OpenAPI.

**Tes:** `test_meta.py`, `test_errors.py` (format error + status code).

---

## T0.8 — Cache respons publik

**Blocked by:** T0.7

**Scope**
- `app/core/cache.py`: cache in-memory dict berkey `(path, version_id, query_string)`,
  `get/set/clear_version(version_id)`, `clear_all()`. TTL 5 menit.
- Dependency `cached_response` dipakai semua router publik baca.
- Header `Cache-Control: public, max-age=300` untuk respons publik sukses.

**Acceptance**
- Request kedua dengan kunci sama tidak menyentuh DB (assert jumlah query via event listener).
- `clear_version(id)` membuat request berikutnya query DB lagi.

**Tes:** `test_cache.py`.

---

## T0.9 — Scaffold frontend

**Blocked by:** T0.1

**Scope**
- `apps/web`: Vite + React 19 + TS, `@/*` alias di `tsconfig` + `vite.config.ts`,
  Tailwind CSS v4, `npx shadcn@latest init`, pasang komponen PRD §11 (daftar di baris 750).
- `src/styles/index.css`: token tema + `--status-surplus`, `--status-balanced`, `--status-defisit`,
  `--seq-1`…`--seq-5`, mode terang & gelap.
- `src/router.tsx`: 11 route publik + `/admin/login` sebagai placeholder `EmptyState`.
  Semua halaman `React.lazy`.
- `src/components/layout/`: `PublicLayout`, `Header` (7 menu, `YearSelect`, tombol "Unduh laporan",
  toggle tema, `Sheet` di mobile), `Footer`, `LimitationBanner`.
- `src/lib/api.ts`: fetch wrapper, base URL `VITE_API_BASE_URL`, token admin, parsing error PRD §10.
- `src/lib/format.ts`: `formatTon`, `formatJiwa`, `formatPersen`, `formatKm` (`Intl.NumberFormat('id-ID')`).
- `src/lib/status.ts`: label/warna/ikon per status (huruf kecil → label).
- `src/hooks/useTahun.ts`: baca/tulis `?tahun`.
- `TanStack Query` provider + `staleTime` 5 menit.
- `src/main.tsx` bootstrap. Tidak ada halaman berisi data di wave ini.

**Acceptance**
- `npm run build` sukses, bundle awal < 400 KB gzip.
- `/`, `/dashboard`, `/peta` render shell + `LimitationBanner` tanpa error konsol.
- Ganti tema terang/gelap bekerja; di 375 px menu jadi drawer.

**Tes:** `npm run build`; cek manual 375/768/1280 px.

---

## T0.10 — Tipe TS dari OpenAPI + skrip dev

**Blocked by:** T0.7, T0.9

**Scope**
- `apps/web/package.json` script `"api:types": "openapi-typescript http://127.0.0.1:8000/openapi.json -o src/lib/api-types.ts"`.
- Root `package.json` script: `"dev:api"`, `"dev:web"`, `"test:api"`, `"test:calc"`.
- `src/lib/api-types.ts` di-commit (hasil generate), dipakai `api.ts`.

**Acceptance**
- `npm run api:types` dengan API hidup menulis file tanpa error.
- `tsc --noEmit` hijau.

**Tes:** `npm run build`.

---

## T0.11 — CI

**Blocked by:** T0.3, T0.7, T0.9

**Scope**
- `.github/workflows/ci.yml`: job `calc` (`pytest packages/riceguard_calc/tests dataset/tests`),
  job `api` (Postgres service container → `psql -f supabase/migrations/*.sql` → `pytest apps/api/tests`),
  job `web` (`npm ci`, `npm run build`, `npm run lint`).
- Tambah `ruff` (lint Python) + `eslint` konfigurasi minimal.

**Acceptance**
- Ketiga job hijau di push pertama.
- Gagal kalau regresi `dataset_v1.csv` muncul.

**Tes:** workflow run hijau.
