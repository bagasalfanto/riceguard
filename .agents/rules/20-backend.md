---
trigger: glob
globs: "apps/api/**/*.py, packages/riceguard_calc/**/*.py, supabase/**/*.sql"
description: "Aturan berkas backend Python/FastAPI dan SQL: dokumen pemilik per jenis perubahan dan kontrak domain."
---

# Berkas Backend

Dokumen pemilik per jenis perubahan (`docs-map.json`):

| Yang berubah | Dokumen wajib |
|---|---|
| router, schema Pydantic | `docs/api/endpoints-*.md`, `docs/api/README.md` |
| model SQLAlchemy, migrasi SQL | `docs/DOMAIN_MODEL.md` |
| security JWT, audit, version lifecycle, ingest | `docs/ROLES_WORKFLOW.md` |
| `packages/riceguard_calc`, config, cache, services, Dockerfile | `docs/ARCHITECTURE.md` |

Kontrak yang tidak boleh dilanggar:

- Satu sumber kebenaran rumus di `packages/riceguard_calc`; router dan service tidak menulis ulang perhitungan.
- Publik hanya membaca versi `published`; koreksi selalu melalui versi `draft` baru sebelum `publish`/`rollback`.
- Tidak ada pendaftaran publik; autentikasi admin memverifikasi JWT Supabase dan tabel `admins`.
- Error seragam `{"error": {"code", "message", "details"}}` (`apps/api/app/core/errors.py`),
  pesan berbahasa Indonesia, tanpa membocorkan token atau rahasia.

Gaya: Ruff (`ruff.toml`) dan type annotation eksplisit. Rincian: `docs/RULES.md`.
