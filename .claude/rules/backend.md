---
paths:
  - "apps/api/**/*.py"
  - "packages/riceguard_calc/**/*.py"
  - "supabase/**/*.sql"
---

# Berkas Backend (Python + FastAPI + Postgres)

Dokumen pemilik per jenis perubahan — peta mesinnya `docs-map.json`:

| Yang berubah | Dokumen wajib |
|---|---|
| router, schema Pydantic | `docs/api/endpoints-*.md`, `docs/api/README.md` |
| model SQLAlchemy, migrasi SQL | `docs/DOMAIN_MODEL.md` |
| security JWT, audit, version lifecycle, ingest | `docs/ROLES_WORKFLOW.md` |
| `packages/riceguard_calc`, config, cache, services, Dockerfile | `docs/ARCHITECTURE.md` |

## Kontrak yang tidak boleh dilanggar

- Satu sumber kebenaran perhitungan di `packages/riceguard_calc` (pandas): router dan service
  tidak menulis ulang rumus keseimbangan atau algoritma matching.
- Publik hanya membaca versi `published`; versi `published`/`archived` tidak pernah diedit langsung,
  koreksi selalu lewat versi `draft` baru sebelum `publish` atau `rollback`.
- Tidak ada pendaftaran publik; autentikasi admin memverifikasi JWT Supabase dan tabel `admins`.
- Skema database dikelola lewat SQL murni di `supabase/migrations/`, tanpa Alembic.
- Format error seragam `{"error": {"code", "message", "details"}}` berbahasa Indonesia tanpa
  membocorkan token atau rahasia.

## Gaya

Ruff sesuai `ruff.toml` (`E`, `F`, `W`, `I`, `UP`, `B`, panjang baris 120) dan type annotation
eksplisit. Rincian: `docs/RULES.md`.
