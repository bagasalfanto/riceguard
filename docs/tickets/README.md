# RiceGuard — Peta Tiket Backend (9 fitur, per wave)

Sumber tunggal: `docs/RiceGuard - PRD & Dokumen Teknis (FE + BE).md` (bagian 3, 5, 9, 10, 12).
Tiket ditulis lokal karena `gh` CLI tidak terpasang di mesin ini. Kalau nanti `gh` tersedia,
tiap tiket di file ini dipindah jadi GitHub issue apa adanya (judul + body + edge blokir).

## Aturan wave

- **Satu wave = satu fitur.** Wave selesai kalau semua tiketnya lulus kriteria selesai
  fitur itu di PRD §5 (atau §6 untuk admin) **dan** semua tes wave itu hijau.
- Wave 0 wajib selesai total sebelum wave 1. Wave 1–9 hanya bergantung pada wave 0,
  bukan satu sama lain, kecuali yang ditulis eksplisit di kolom `Blocked by`.
- Wave 10 (admin) bukan salah satu dari 9 fitur, tetapi dibutuhkan agar data bisa
  diubah tanpa deploy. Boleh dikerjakan paralel setelah wave 0.
- Tiap tiket = satu commit (`feat:`, `fix:`, `test:`, `chore:`) dengan pathspec eksplisit,
  tanpa trailer `Co-Authored-By`, sesuai `AGENTS.md`.

## Definisi selesai (berlaku semua tiket)

1. Kode + tes lulus: `pytest apps/api/tests packages/riceguard_calc/tests dataset/tests -q`.
2. `npm run build` dan `npm run lint` hijau di `apps/web` (kalau tiket menyentuh FE).
3. Tidak ada rumus di router dan tidak ada HTTP di service (PRD §12).
4. Angka yang keluar sama dengan `dataset/dataset_v1.csv` / `rekomendasi_distribusi_v1.csv`
   (toleransi 0,01 ton; kecuali dibulatkan untuk tampilan).
5. Error mengikuti format `{"error": {"code", "message", "details"}}` (PRD §10).

## Peta wave

| Wave | Fitur (PRD §) | File | Tiket | Blocked by |
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

## Blocker yang harus dibuka pemilik repo

| # | Blocker | Kenapa | Jalan keluar |
| --- | --- | --- | --- |
| B1 | `DATABASE_URL` (connection string pooler + password DB) | Migrasi dan seed butuh DDL; publishable key tidak bisa menulis | Ambil di Supabase → Project Settings → Database → Connection string (Session pooler, port 5432/6543) |
| B2 | `SUPABASE_SERVICE_ROLE_KEY` / secret key (`sb_secret_...`) | Upload file mentah ke bucket privat `raw-uploads` (T10.4) dan baca ulang (T8.4) | Project Settings → API keys → secret key |
| B3 | MCP Supabase tidak tersedia di sesi ini | Hanya ada MCP `context7` dan `stitch` | Pakai `psql`/`supabase db push` dengan B1; atau tambahkan MCP server supabase lalu restart opencode |
| B4 | `gh` CLI tidak terpasang | Tiket lokal, bukan GitHub issue | `winget install GitHub.cli` lalu `gh auth login` |
| B5 | `dataset/geo/provinsi-38.min.geojson` belum ada | Wave 3 tidak bisa mengecek "tidak ada provinsi abu-abu" | Minta file GeoJSON dari P3 |
| B6 | `luas_km2` belum ada di dataset | Layer kepadatan penduduk (T3.3) | Pakai luas BPS, atau hitung dari poligon GeoJSON (pertanyaan terbuka PRD #2) |

## Keputusan yang sudah dikunci untuk semua tiket

- DB: Postgres Supabase, SQL murni di `supabase/migrations/`, **tanpa** Alembic.
- Akses DB: SQLAlchemy 2 + psycopg 3, role server (bypass RLS). FE tidak pernah query tabel.
- Hitung: hanya `packages/riceguard_calc` (pandas). Router/service tidak menulis rumus.
- Auth admin: verifikasi JWT Supabase via JWKS, cek `sub` ada di tabel `admins`.
- Bahasa: copy UI dan nama kolom/field Bahasa Indonesia `snake_case`; kata "rute" tidak dipakai.
- Python: venv + pip + `pyproject.toml` (Python 3.14 terpasang; cadangan 3.12 kalau ada wheel hilang).
- Node: npm workspaces.
