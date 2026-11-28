---
scope: docs-index
canonical-for: ["peta dokumentasi", "routing dokumen per tugas", "daftar berkas harness"]
sources: ["AGENTS.md", "docs-map.json", "docs/"]
last-verified: 2026-11-28
---

# Indeks Dokumentasi RiceGuard

> Peta ini adalah **titik masuk** untuk AI Coding Agent dan pengembang. Baca baris tugas yang relevan, lalu buka **hanya** berkas yang ditunjuk. Jangan memuat seluruh `docs/` sekaligus.

Aturan kanonik: satu fakta hidup di **satu** berkas. Bila fakta muncul di dua tempat, ikuti kolom **Kanonik** pada tabel metadata dan berkas lain hanya menaut.

---

## 1. Peta Tugas ke Berkas

| Tugas / Pertanyaan | Buka |
|---|---|
| Aturan selalu-aktif, protokol edit atomik, commit discipline | `AGENTS.md` |
| Memahami gambaran proyek, angka dasar, batasan klaim | `docs/CONTEXT.md` |
| Menyentuh teks antarmuka (label, judul, tombol, status, URL, CSV) | `docs/KAMUS_KOSAKATA.md`, `GLOSSARY.md` |
| Merancang/mengaudit UI publik & admin, tema OKLCH, peta, grafik, PDF | `docs/DESIGN.md` |
| Menambah/ubah tabel database, kolom, enum, JSONB, ERD, seed | `docs/DOMAIN_MODEL.md` |
| Peran publik vs admin, auth JWT, siklus versi, wizard, audit log | `docs/ROLES_WORKFLOW.md` |
| Konvensi REST API, auth header, format error, cache, CORS | `docs/api/README.md` |
| Menambah/mengubah endpoint publik (`/api/v1/*`) | `docs/api/endpoints-public.md` |
| Menambah/mengubah endpoint admin (`/api/v1/admin/*`) | `docs/api/endpoints-admin.md` |
| Stack, struktur folder, alur `riceguard_calc`, gotchas, cascade | `docs/ARCHITECTURE.md` |
| Perintah verifikasi, gaya kode Python/TS, pengujian, harness docs | `docs/RULES.md` |
| Keputusan arsitektur (proxy forecast AI & laporan cetak browser) | `docs/adr/0001-forecast-lewat-backend.md`, `docs/adr/0003-laporan-pdf-dicetak-browser.md` |
| Status tiket per wave & blocker | `docs/tickets/README.md` |
| Status task tim per PIC (snapshot Trello, bukan spesifikasi) | `docs/rekap-riceguard.md` |
| Setup mesin & menjalankan proyek lokal | `README.md` |

Jika tugas menyentuh kode di `apps/api/` atau `apps/web/`, baca juga `AGENTS.md` terdekat di folder tersebut (`apps/api/AGENTS.md` atau `apps/web/AGENTS.md`).

---

## 2. Metadata Berkas Dokumentasi

| Berkas | Cakupan (scope) | Kanonik untuk | Sumber | Terverifikasi |
|---|---|---|---|---|
| `AGENTS.md` | tier-0: aturan selalu-aktif + router dokumen | protokol wajib agen, aturan inti, commit discipline | `docs-map.json`, `docs/RULES.md` | 2026-11-26 |
| `CLAUDE.md` | tier-0: konfigurasi Claude Code | impor `AGENTS.md`, penegakan hook Claude Code | `AGENTS.md`, `.claude/settings.json` | 2026-11-26 |
| `apps/api/AGENTS.md` | konvensi backend | panduan FastAPI, SQLAlchemy, dan `riceguard_calc` | `apps/api/`, `packages/riceguard_calc/` | 2026-11-26 |
| `apps/web/AGENTS.md` | konvensi frontend | panduan React, TypeScript, kosakata, dan tema | `apps/web/src/`, `docs/KAMUS_KOSAKATA.md` | 2026-11-26 |
| `llms.txt` | peta ringkas LLM | daftar berkas entry point dokumentasi | `docs/INDEX.md` | 2026-11-26 |
| `README.md` | setup manusia | quickstart lokal, db-local, perintah verifikasi, env AI | `package.json`, `scripts/db-local.ps1` | 2026-11-26 |
| `GLOSSARY.md` | glossary domain | definisi ringkas istilah domain dan kata terhindar | `docs/KAMUS_KOSAKATA.md` | 2026-11-26 |
| `docs/INDEX.md` | peta dokumen | routing dokumen & registry metadata (berkas ini) | `docs/`, `docs-map.json` | 2026-11-26 |
| `docs/CONTEXT.md` | konteks proyek | tujuan, angka v1, batasan klaim, cakupan produk | `dataset/dataset_v1.csv`, `supabase/seed/0001_static.sql` | 2026-11-26 |
| `docs/ARCHITECTURE.md` | arsitektur & gotchas | stack, struktur folder, alur request, rumus, gotchas | `apps/api/pyproject.toml`, `apps/web/package.json`, `packages/riceguard_calc/` | 2026-11-26 |
| `docs/DOMAIN_MODEL.md` | model domain | tabel, kolom, relasi, enum, JSONB, ERD, storage, seed | `supabase/migrations/0001_init.sql`, `apps/api/app/db/models.py` | 2026-11-26 |
| `docs/ROLES_WORKFLOW.md` | peran & alur kerja | izin publik vs admin, auth JWT, siklus versi, audit log | `apps/api/app/core/security.py`, `apps/api/app/routers/admin/` | 2026-11-26 |
| `docs/KAMUS_KOSAKATA.md` | kosakata antarmuka | teks UI, navigasi, status, parameter URL, header CSV | `apps/web/src/`, `apps/api/app/services/exports.py` | 2026-11-26 |
| `docs/DESIGN.md` | spesifikasi desain | token OKLCH terang/gelap, layout, peta, grafik, PDF, a11y | `apps/web/src/styles/index.css`, `apps/web/src/components/` | 2026-11-26 |
| `docs/RULES.md` | aturan kerja | perintah CI, gaya kode Python/TS, tes, git, harness docs | `package.json`, `ruff.toml`, `.github/workflows/ci.yml` | 2026-11-26 |
| `docs/api/README.md` | ikhtisar API | konvensi `/api/v1`, auth, error format, cache, CORS | `apps/api/app/main.py`, `apps/api/app/core/` | 2026-11-26 |
| `docs/api/endpoints-public.md` | endpoint publik | spesifikasi seluruh rute API publik `/api/v1/*` | `apps/api/app/routers/publik/`, `apps/api/app/schemas/` | 2026-11-26 |
| `docs/api/endpoints-admin.md` | endpoint admin | spesifikasi seluruh rute admin `/api/v1/admin/*` | `apps/api/app/routers/admin/`, `apps/api/app/schemas/admin.py` | 2026-11-26 |
| `docs/adr/0001-forecast-lewat-backend.md` | ADR forecast AI | alasan proxy `/forecast` melalui backend & off-switch | `apps/api/app/routers/publik/forecast.py`, `apps/api/app/services/forecast.py` | 2026-11-26 |
| `docs/adr/0002-pdf-generation.md` | ADR laporan PDF (digantikan) | catatan keputusan lama WeasyPrint; kanonik di ADR 0003 | `docs/adr/0003-laporan-pdf-dicetak-browser.md` | 2026-11-27 |
| `docs/adr/0003-laporan-pdf-dicetak-browser.md` | ADR laporan cetak | laporan HTML siap-cetak, penghapusan WeasyPrint/Pango | `apps/api/app/routers/publik/reports.py`, `apps/api/app/services/pdf.py`, `apps/web/src/features/reports/reportsData.ts` | 2026-11-27 |
| `docs/agents/domain.md` | panduan skill domain | konvensi pembacaan `GLOSSARY.md` dan `docs/adr/` | `AGENTS.md`, `GLOSSARY.md` | 2026-11-26 |
| `docs/agents/issue-tracker.md` | panduan issue tracker | konvensi `gh` CLI dan fallback lokal `docs/tickets/` | `AGENTS.md`, `docs/tickets/README.md` | 2026-11-26 |
| `docs/agents/triage-labels.md` | label triase | pemetaan lima peran label triase kanonik | `AGENTS.md` | 2026-11-26 |
| `docs/tickets/README.md` | indeks tiket wave | peta wave 0–11, status selesai, blocker, keputusan | `docs/tickets/` | 2026-11-26 |
| `docs/tickets/wave-0-foundation.md` | tiket wave 0 | fondasi monorepo, `riceguard_calc`, DB, CI | `docs/tickets/README.md` | 2026-11-26 |
| `docs/tickets/wave-1-landing.md` | tiket wave 1 | landing page, `/summary`, `/content`, `/sources` | `docs/tickets/README.md` | 2026-11-26 |
| `docs/tickets/wave-2-dashboard.md` | tiket wave 2 | dashboard nasional, `/provinces`, `/rankings`, delta | `docs/tickets/README.md` | 2026-11-26 |
| `docs/tickets/wave-3-map.md` | tiket wave 3 | peta interaktif, `/map/layers`, kuantil, kepadatan | `docs/tickets/README.md` | 2026-11-26 |
| `docs/tickets/wave-4-regional-analysis.md` | tiket wave 4 | analisis wilayah, rumus terisi, pembulatan | `docs/tickets/README.md` | 2026-11-26 |
| `docs/tickets/wave-5-distribution.md` | tiket wave 5 | analisis pasokan, pemasok defisit, matriks jarak | `docs/tickets/README.md` | 2026-11-26 |
| `docs/tickets/wave-6-recommendation.md` | tiket wave 6 | matching parameter, `explain.py`, simulasi skenario | `docs/tickets/README.md` | 2026-11-26 |
| `docs/tickets/wave-7-trends.md` | tiket wave 7 | tren multi-tahun, `/compare`, gating 2 tahun | `docs/tickets/README.md` | 2026-11-26 |
| `docs/tickets/wave-8-data-transparency.md` | tiket wave 8 | validasi 5 aturan, ekspor CSV/XLSX/raw, `/data` | `docs/tickets/README.md` | 2026-11-26 |
| `docs/tickets/wave-9-reports.md` | tiket wave 9 | laporan HTML siap-cetak, komposisi laporan, `/laporan` | `docs/tickets/README.md` | 2026-11-27 |
| `docs/tickets/wave-10-admin.md` | tiket wave 10 | auth JWKS, upload wizard, lifecycle versi, audit log | `docs/tickets/README.md` | 2026-11-26 |
| `docs/tickets/wave-11-ai-forecast.md` | tiket wave 11 | proxy `/forecast` ter-gating, isolasi, `/prediksi` | `docs/tickets/README.md` | 2026-11-26 |
| `docs/rekap-riceguard.md` | rekap Trello | snapshot status task tim per PIC (bukan spesifikasi produk) | Trello board 24 Nov | 2026-11-27 |
| `docs/RiceGuard — PRD & Dokumen Teknis (FE + BE).md` | spesifikasi produk historis | PRD & checklist kriteria fitur awal (arsip rujukan) | `docs/` | 2026-11-26 |

Berkas aturan agent dan berkas mesin penegakan dokumentasi di luar `docs/` tetap terdaftar di sini karena memengaruhi routing dan validasi otomatis (rincian mekanisme ada di `docs/RULES.md`):

| Berkas | Lapis | Peran |
|---|---|---|
| `CLAUDE.md` | L1 | Impor `AGENTS.md` + penegakan khusus Claude Code |
| `opencode.json` | L1 | Konfigurasi path skill untuk OpenCode |
| `.agents/rules/*.md` | L1 | Rule Antigravity berfrontmatter `trigger` |
| `.claude/rules/*.md` | L1 | Rule Claude Code berpatokan `paths` |
| `.agents/hooks.json` | L2 | Hook Antigravity (`PreInvocation`, `PreToolUse`, `Stop`), termasuk `invoke_subagent` |
| `.claude/settings.json` | L2 | Hook Claude Code (termasuk matcher `Agent`) |
| `.codex/hooks.json` | L2 | Hook Codex (`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `SubagentStart`, `Stop`) |
| `.opencode/plugins/docs-enforcer.ts` | L2 | Plugin penegak OpenCode (termasuk tool `task` dan resolver Python) |
| `.githooks/pre-commit` | L3 | Gerbang commit lokal (`docs-guard.py --staged`) |
| `.github/workflows/docs-verify.yml` | L3 | CI markdownlint, tautan, rujukan indeks, keterbacaan, harness |
| `.github/workflows/docs-drift.yml` | L3 | Gerbang kode-vs-dokumen per PR |
| `.github/workflows/docs-stale.yml` | L3 | Pemindaian ketebasan dokumen terjadwal |
| `.markdownlint-cli2.jsonc` | mesin | Konfigurasi markdownlint |
| `docs-map.json` | mesin | Peta kode-ke-dokumen + registry berkas config harness |
| `scripts/docs-guard.py` | mesin | Pemeriksa tautan, indeks, keterbacaan, drift, dan ketebasan |
| `scripts/docs-hook.py` | mesin | Dispatcher hook lintas client agent |
| `scripts/ci-check.py` | mesin | Runner verifikasi terpadu lokal (`npm run ci:check`) |

---

## 3. Aturan Pemeliharaan

- Setiap berkas `docs/` diawali blok YAML `scope`, `canonical-for`, `sources`, dan `last-verified` (`YYYY-MM-DD`).
- Ubah `last-verified` saat isi berkas diselaraskan kembali dengan kode.
- Bila kode dan dokumen berselisih, **kode adalah sumber kebenaran**; selaraskan dokumen pada komit yang sama. Pengecualian: `KAMUS_KOSAKATA.md` memutus untuk kosakata antarmuka.
- Tautan antar-dokumen wajib **relatif** — terhadap direktori berkas atau terhadap akar repo. Dilarang tautan absolut (`/path`) atau tautan berawalan `file://`.
- Rujuk bab lain lewat **nama bagian/tautan**, bukan nomor baris atau nomor urut mentah, agar tidak rapuh saat berkas dipecah.
