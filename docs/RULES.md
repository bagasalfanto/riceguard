---
scope: rules
canonical-for: ["perintah verifikasi & CI", "gaya kode Python & TypeScript", "pengujian", "git/PR", "larangan sentuh", "otomasi dokumentasi"]
sources: ["package.json", "ruff.toml", "apps/api/pyproject.toml", "apps/web/package.json", ".github/workflows/ci.yml", "docs-map.json", "AGENTS.md"]
last-verified: 2026-11-26
---

# Aturan Kerja & Perintah RiceGuard

> Berkas kanonik untuk perintah verifikasi, gaya kode, pengujian, git/PR, larangan, dan otomasi dokumentasi. Bila perintah di sini berbeda dari `package.json` atau `pyproject.toml`, manifest yang benar — selaraskan berkas ini.

## 1. Bahasa & Kosakata

- **Komunikasi, komentar kode, docstring, dan pesan kesalahan:** Bahasa Indonesia.
- **Kosakata antarmuka:** wajib mematuhi `KAMUS_KOSAKATA.md` dan `../GLOSSARY.md` sebelum menambah/mengubah teks UI, label, parameter URL, atau header ekspor.

## 2. Perintah Verifikasi

### Standar Tunggal Sebelum Menutup Tugas

```bash
npm run ci:check
```

`npm run ci:check` (`scripts/ci-check.py`) menjalankan rangkaian pemeriksaan terpadu lokal: lint Python (`ruff`), unit & regresi `riceguard_calc` + `dataset`, pemeriksaan dokumentasi (`docs-guard.py`), lint frontend (`oxlint`), serta build TypeScript/Vite (`tsc -b && vite build`). Tambahkan `--with-api` (atau jalankan saat `DATABASE_URL` aktif) untuk menyertakan `pytest apps/api/tests`.

### Rincian Perintah Satuan

| Perintah | Kegunaan | Berkas Konfigurasi / Target |
|---|---|---|
| `npm run ci:check` | Verifikasi gabungan (`ruff`, `test:calc`, `docs:guard`, `lint:web`, `build:web`) | `scripts/ci-check.py` |
| `npm run docs:check` | Menjalankan `docs:guard` dan `docs:drift` sekaligus | `package.json`, `scripts/docs-guard.py` |
| `npm run docs:guard` | Cek tautan, rujukan indeks, keterbacaan, dan harness via Python | `scripts/docs-guard.py` |
| `npm run docs:drift` | Cek drift kode-vs-dokumen pada perubahan lokal (`--drift --pending`) | `docs-map.json`, `scripts/docs-guard.py` |
| `npx --yes markdownlint-cli2` | Lint gaya penulisan Markdown (dijalankan CI `docs-verify.yml`) | `.markdownlint-cli2.jsonc` |
| `npm run lint:py` | Lint Python (`ruff check packages/riceguard_calc apps/api scripts`) | `ruff.toml` |
| `npm run lint:web` | Lint TypeScript/React (`oxlint`) | `apps/web/package.json` |
| `npm run build:web` | Typecheck & build Vite produksi (`tsc -b && vite build`) | `apps/web/tsconfig.json`, `apps/web/vite.config.ts` |
| `npm run test:calc` | Regresi `dataset_v1.csv` & 4 tes algoritma matching | `packages/riceguard_calc/tests`, `dataset/tests` |
| `npm run test:api` | Tes integrasi FastAPI (butuh `DATABASE_URL` Postgres yang sudah dimigrasi) | `apps/api/tests` |
| `npm run api:types` | Regenerasi `apps/web/src/lib/api-types.ts` dari OpenAPI API hidup | `apps/web/package.json` |
| `npm run dev:api` / `dev:web` | Menjalankan backend FastAPI (`:8000`) / frontend Vite (`:5173`) | `package.json` |

### Postgres 16 Lokal (Windows Dev)

Gunakan `scripts/db-local.ps1` (`start`, `stop`, `status`, `reset`) untuk menjalankan `npm run test:api` tanpa menyentuh database Supabase. Sebelum menjalankan tes lokal yang memodifikasi `apps/api/.env`, cadangkan berkas `.env` dan pulihkan setelah `stop`.

## 3. Gaya Kode & Penamaan

### Python (`ruff.toml`, FastAPI, SQLAlchemy 2, `riceguard_calc`)

- Target `py311`, `line-length = 120`, rules `["E", "F", "W", "I", "UP", "B"]` (`E501` diabaikan).
- `from __future__ import annotations`, type hints eksplisit, Pydantic v2 (`ConfigDict(extra="forbid")` pada payload PATCH parsial).
- **Pemisahan lapis wajib:** rumus hanya di `packages/riceguard_calc`; router bebas rumus; service DB/hitung bebas panggilan HTTP eksternal (kecuali gateway di `services/storage.py` dan `services/forecast.py`).
- Error API wajib melalui `AppError` (`app/core/errors.py`).

### TypeScript / React (`apps/web`)

- Strict TypeScript (`~5.9.0`), path alias `@/*` → `./src/*`, halaman `React.lazy`, linting via `oxlint`.
- Tidak ada perhitungan rumus atau duplikasi logika matching di FE.
- Format angka via `src/lib/format.ts`; warna status via `src/lib/status.ts` + token CSS OKLCH di `src/styles/index.css`.

### Konvensi Penamaan

| Lapisan | Konvensi | Contoh |
|---|---|---|
| Kolom DB, field JSON API, header CSV | `snake_case` Bahasa Indonesia | `kode_bps`, `rice_balance_ton`, `kebutuhan_beras_ton` |
| Model SQLAlchemy / Pydantic / Komponen React | `PascalCase` | `DatasetVersion`, `ProvinceItem`, `LaporanPage` |
| Fungsi / hook TS & utilitas | `camelCase` (`use*` untuk hook) | `useTahun`, `formatTon`, `tampilanStatus` |
| Fungsi / variabel Python | `snake_case` | `bulatkan_ton`, `resolve_for_read` |
| Konstanta global | `SCREAMING_SNAKE_CASE` | `BATAS_SWASEMBADA`, `PROVINCE_CSV_HEADERS` |

## 4. Pengujian & CI

- **GitHub Actions (`.github/workflows/ci.yml`):**
  - Job `calc`: `ruff check packages/riceguard_calc apps/api` + `pytest packages/riceguard_calc/tests dataset/tests -q`.
  - Job `api`: Postgres 16 service container, install `postgresql-client libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz-subset0`, buat stub `auth.users`, jalankan `supabase/migrations/0001_init.sql` & `supabase/seed/0001_static.sql`, lalu `pytest apps/api/tests -q`.
  - Job `web`: `npm ci`, `npm run lint --workspace apps/web`, `npm run build --workspace apps/web`.
- **Catatan test lokal Windows:** WeasyPrint membutuhkan pustaka native Pango/GObject; dua tes PDF real WeasyPrint di `test_reports_pdf.py` otomatis di-skip pada Windows saat DLL Pango tidak tersedia, dan berjalan penuh pada CI Ubuntu.

## 5. Git & Pull Request

Mengikuti **Commit discipline** di `../AGENTS.md`:

- Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `perf:`, `ci:`).
- Selalu gunakan pathspec eksplisit: `git commit -- <paths>` — **dilarang `git add -A`** dan dilarang `git commit` tanpa path eksplisit.
- Jalankan `git status` sebelum setiap komit.
- **Dilarang keras** menambahkan trailer `Co-Authored-By:` maupun menyebut nama agent, tool, atau model di pesan commit atau deskripsi PR.

## 6. Larangan Disentuh Manual

`node_modules/`, `.venv/`, `.cache/`, `apps/web/dist/`, `apps/web/src/lib/api-types.ts` (regenerasi lewat `npm run api:types`), serta file `.env` / `.env.local` berisi rahasia.

## 7. Otomasi & Penegakan Dokumentasi

Satu implementasi Python (`scripts/docs-guard.py`) + satu dispatcher (`scripts/docs-hook.py`) melayani seluruh harness AI dan CI tanpa ketergantungan PHP.

### 7.1 Mode `scripts/docs-guard.py`

| Mode | Fungsi |
|---|---|
| `--check-links` | Tautan markdown `](...)` dan rujukan gaya backtick `*.md` (melarang `file://` dan path absolut) |
| `--check-refs` | `docs/INDEX.md` bagian 2 versus berkas di disk (mendeteksi *ghost* & *orphan*) |
| `--check-readability` | Frontmatter wajib (`scope`, `canonical-for`, `sources`, `last-verified`), tepat 1 H1, batas 400 baris (kecuali `max-lines`), `llms.txt`, dan frontmatter rule Antigravity |
| `--check-harness` | Keberadaan & validitas berkas config pada `docs-map.json` kunci `harness` serta rujukannya ke `scripts/docs-hook.py` |
| `--drift --staged` / `--pending` / `--base=<ref>` | Mendeteksi perubahan kode tanpa dokumen pendamping sesuai `docs-map.json` (`untracked: true` untuk `api-endpoints`, `domain-model`, `docs-topology`) |
| `--stale --max-age=<hari>` | Mendeteksi dokumen yang `sources`-nya berubah melewati `last-verified` |
| `--check-attestation` | Memeriksa blok `[Docs Consulted:]` / `[Docs Updated:]` (sifat *advisory*) |

### 7.2 Lapis Penegakan & Pelepasan Drift

| Lapis | Mekanisme | Sifat |
|---|---|---|
| L1 instruksi | `AGENTS.md`, `CLAUDE.md`, `opencode.json`, `.agents/rules/*.md`, `.claude/rules/*.md` | Di konteks agen; bersifat instruksional |
| L2 hook | `.agents/hooks.json`, `.claude/settings.json`, `.codex/hooks.json`, `.opencode/plugins/docs-enforcer.ts` | Deterministik: menolak Write/Edit/Bash saat drift (Stop max 3x) |
| L3 commit & CI | `.githooks/pre-commit`, `.github/workflows/docs-verify.yml`, `docs-drift.yml`, `docs-stale.yml` | Gerbang akhir saat commit & PR |

- Aktifkan hook git lokal sekali per klon: `git config core.hooksPath .githooks`.
- Pelepasan drift yang sah memakai label PR `docs-exempt`, trailer commit/PR `Docs-Exempt: <alasan>`, atau env lokal `DOCS_STRICT_OVERRIDE=<alasan>` (selalu dicatat di output guard).
- **Batas cakupan:** tautan eksternal `http/https` hanya dicek terjadwal di `docs-stale.yml` (tidak memblokir PR); `--pending` hanya memindai berkas untracked untuk aturan ber-`untracked: true` dan aturan penuh ditegakkan oleh `--staged` serta CI `--base`.
