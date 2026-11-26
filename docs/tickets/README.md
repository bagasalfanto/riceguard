---
scope: tickets-index
canonical-for: ["peta tiket per wave", "status wave & blocker"]
sources: ["docs/tickets/", "docs/RiceGuard — PRD & Dokumen Teknis (FE + BE).md", "docs/INDEX.md"]
last-verified: 2026-11-26
---

# RiceGuard — Peta Tiket (12 Wave, 0–11)

Sumber spesifikasi historis: `docs/RiceGuard — PRD & Dokumen Teknis (FE + BE).md` (bagian 3, 5, 9, 10, 12). Dokumentasi teknis kanonik saat ini berada di `docs/INDEX.md`.
Tiket ditulis lokal karena `gh` CLI belum terpasang di mesin dev. Kalau nanti `gh` tersedia, tiap tiket di file ini dapat dipindah menjadi GitHub issue apa adanya (`docs/agents/issue-tracker.md`).

## Aturan wave

- **Satu wave = satu fitur.** Wave selesai kalau semua tiketnya lulus kriteria selesai fitur itu dan seluruh tes terkait hijau.
- Wave 0 wajib selesai total sebelum wave 1. Wave 1–9 hanya bergantung pada wave 0, kecuali yang ditulis eksplisit di kolom `Blocked by`.
- Wave 10 (admin) bukan salah satu dari 9 fitur publik, tetapi dibutuhkan agar data bisa diubah tanpa deploy.
- Tiap tiket = satu commit konvensional (`feat:`, `fix:`, `test:`, `chore:`, `docs:`) dengan pathspec eksplisit, tanpa trailer `Co-Authored-By`, sesuai `AGENTS.md`.

## Definisi selesai (berlaku semua tiket)

1. Kode + tes lulus: `pytest apps/api/tests packages/riceguard_calc/tests dataset/tests -q` dan `ruff check packages/riceguard_calc apps/api`.
2. `npm run build` dan `npm run lint` hijau di `apps/web` (kalau tiket menyentuh FE).
3. Tidak ada rumus di router dan tidak ada HTTP di service hitung/DB.
4. Angka yang keluar sama dengan `dataset/dataset_v1.csv` / `rekomendasi_distribusi_v1.csv` (toleransi 0,01 ton; kecuali dibulatkan untuk tampilan).
5. Error mengikuti format `{"error": {"code", "message", "details"}}`.

## Peta wave

| Wave | Fitur (PRD) | File | Tiket | Blocked by |
| --- | --- | --- | --- | --- |
| 0 | Fondasi: folder, dataset, DB, skeleton API/FE | `wave-0-foundation.md` | T0.1–T0.11 | — |
| 1 | 1. Landing & General Information (§5.1) | `wave-1-landing.md` | T1.1–T1.4 | Wave 0 |
| 2 | 2. Main Dashboard (§5.2) | `wave-2-dashboard.md` | T2.1–T2.5 | Wave 0 |
| 3 | 3. Interactive Rice Map (§5.3) | `wave-3-map.md` | T3.1–T3.5 | Wave 0 |
| 4 | 4. Regional Analysis (§5.4) | `wave-4-regional-analysis.md` | T4.1–T4.5 | Wave 0 |
| 5 | 5. Supply & Distribution (§5.5) | `wave-5-distribution.md` | T5.1–T5.4 | Wave 0, T6.1 (untuk `sisa`) |
| 6 | 6. Smart Recommendation + Simulasi (§5.6) | `wave-6-recommendation.md` | T6.1–T6.5 | Wave 0 |
| 7 | 7. Historical Trends (§5.7) | `wave-7-trends.md` | T7.1–T7.4 | Wave 0 |
| 8 | 8. Data Management & Transparency (§5.8) | `wave-8-data-transparency.md` | T8.1–T8.5 | Wave 0 |
| 9 | 9. Report & Export (§5.9) | `wave-9-reports.md` | T9.1–T9.4 | Wave 8 |
| 10 | Panel admin (§6) — di luar 9 fitur | `wave-10-admin.md` | T10.1–T10.9 | Wave 0 |
| 11 | Prediksi produksi (AI, model eksternal §5.10) — di luar 9 fitur | `wave-11-ai-forecast.md` | T11.0–T11.5 | T11.0 (kontrak model) |

## Blocker & prasyarat deploy

| # | Blocker | Kenapa | Status / Jalan keluar |
| --- | --- | --- | --- |
| B1 | `DATABASE_URL` (connection string pooler + password DB) | Migrasi dan seed butuh DDL; publishable key tidak bisa menulis | **Selesai.** Migrasi, seed statis, dan seed dataset 2025 sudah dijalankan ke Supabase `riceguard` lewat session pooler. |
| B2 | `SUPABASE_SERVICE_ROLE_KEY` / secret key (`sb_secret_...`) | Upload file mentah ke bucket privat `raw-uploads` (T10.4) dan baca ulang (T8.4) | **Terbuka untuk lingkungan live deploy.** Kode backend (`services/storage.py`) dan tes mock sudah selesai; isi secret key di `.env` hosting BE saat deploy. |
| B3 | MCP Supabase | Eksekusi DDL dan seed statis | **Selesai.** DDL dan seed statis diterapkan langsung. |
| B4 | `gh` CLI tidak terpasang | Tiket lokal, bukan GitHub issue | **Terbuka (opsional).** Pasang via `winget install GitHub.cli` lalu `gh auth login` bila ingin memindahkan tiket ke GitHub. |
| B5 | `dataset/geo/provinsi-38.min.geojson` | Wave 3 mengecek "tidak ada provinsi abu-abu" | **Selesai.** File ada (38 fitur) dan disalin ke `apps/web/public/geo/`. |
| B6 | `luas_km2` belum ada di dataset | Layer kepadatan penduduk (T3.3) | **Terbuka (menunggu data luas BPS).** Selama kosong, `/map/layers?layer=kepadatan` membalas `409 LAYER_UNAVAILABLE`. |

## Status wave

| Wave | Status | Catatan |
| --- | --- | --- |
| 0 | **Selesai** | Diverifikasi pada Postgres 16 lokal & Supabase: migrasi idempoten, seed 38 provinsi / 27 rekomendasi, paket `riceguard_calc`, CI 3 job. |
| 1 | **Selesai** | T1.1–T1.4 lulus tes (`/summary`, `/content`, `/sources`, `LandingPage.tsx`). Pengukuran Lighthouse live deploy tersisa pada checklist pra-demo. |
| 2 | **Selesai** | T2.1–T2.5 lulus tes (`/provinces`, `/rankings`, `pulau_breakdown`, delta tahun, `DashboardPage.tsx`, plus `/rice-balance`). |
| 3 | **Selesai** | T3.1–T3.5 lulus tes (`/map/layers` status & kuantil, `PetaPage.tsx`, mode banding tahun ter-gating >= 2 tahun). Layer kepadatan membalas `409` selama `luas_km2` kosong (B6). |
| 4 | **Selesai** | T4.1–T4.5 lulus tes (filter multi-nilai + `fields`, `GET /provinces/{kode_bps}` rumus terisi, pembulatan `bulatkan_ton`, `AnalisisPage.tsx`). |
| 5 | **Selesai** | T5.1–T5.4 lulus tes (`/distribution/overview`, `/suppliers/{kode_bps}`, `/distance-matrix`, `DistribusiPage.tsx` dengan `FlowLines`, 0 kata `"rute"`). |
| 6 | **Selesai** | T6.1–T6.5 lulus tes (`MatchParams` di `riceguard_calc`, `explain.py`, `/recommendations`, `/recommendations/simulate` < 1 s tanpa tulis DB, `RekomendasiPage.tsx`). |
| 7 | **Selesai** | T7.1–T7.4 lulus tes (`/trends`, `/compare`, gating 2 tahun `200`, `TrenPage.tsx` dan menu `Header.tsx` tersembunyi saat 1 tahun). |
| 8 | **Selesai** | T8.1–T8.5 lulus tes (`/validation`, ekspor CSV BOM & Excel 3 sheet, `/exports/raw/{nama_file}` allowlist anti-traversal, `DataPage.tsx` + `#batasan`). |
| 9 | **Selesai** | T9.1–T9.4 lulus tes (ADR `docs/adr/0002-pdf-generation.md` Opsi B WeasyPrint + Jinja2 + Matplotlib `Agg` berarsir B&W, `/reports/{jenis}.pdf`, `LaporanPage.tsx`, Dockerfile & CI Pango). Pada Windows dev tanpa GTK/Pango, 2 tes real WeasyPrint di-skip dan endpoint membalas `503 PDF_UNAVAILABLE`. |
| 10 | **Selesai** | T10.1–T10.9 lulus tes (JWKS/HS256 `security.py`, dry-run `/validate`, create draft + Storage upload, `PATCH` + `recompute`, `publish`/`rollback`/`duplicate`/`delete`, konten/sumber, audit log insert-only 9 aksi, `Admin*Page.tsx`). |
| 11 | **Selesai (ter-gating di balik `AI_ENDPOINT_URL`)** | T11.1–T11.5 lulus tes (`GET /forecast` + `503 AI_UNAVAILABLE` saat kosong + `502 AI_UPSTREAM_ERROR` + `test_forecast_isolation.py`, `PrediksiPage.tsx` + banner non-resmi, `Header.tsx` gating). Menunggu URL endpoint model eksternal (`T11.0`) untuk aktivasi produksi. |

## Keputusan yang sudah dikunci untuk semua tiket

- DB: Postgres Supabase, SQL murni di `supabase/migrations/`, **tanpa** Alembic.
- Akses DB: SQLAlchemy 2 + psycopg 3, role server (bypass RLS). FE tidak pernah query tabel.
- Hitung: hanya `packages/riceguard_calc` (pandas). Router/service tidak menulis rumus.
- Auth admin: verifikasi JWT Supabase via JWKS (fallback HS256 bila secret diisi), cek `sub` ada di tabel `admins`.
- Bahasa: copy UI dan nama kolom/field Bahasa Indonesia `snake_case`; kata `"rute"` tidak dipakai di UI.
- Python: venv + pip + `pyproject.toml` (`>=3.11`, CI `3.12`, lokal `3.13`).
- Node: npm workspaces.
