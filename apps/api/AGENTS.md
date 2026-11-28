# AGENTS.md — Backend (FastAPI + Python)

Panduan tambahan untuk berkas di `apps/api/` dan `packages/riceguard_calc/`. Aturan root di `../../AGENTS.md` tetap berlaku; berkas terdekat ini menang bila berselisih.

## Konvensi Struktur

- **Router HTTP** (`app/routers/public/`, `app/routers/admin/`): validasi query/body via Pydantic + FastAPI `Depends`, lalu delegasikan ke `app/services/`. **Dilarang menulis rumus** di router.
- **Schema** (`app/schemas/`): model Pydantic v2 request/response. PATCH input wajib memakai `ConfigDict(extra="forbid")` agar kolom turunan ditolak.
- **Service** (`app/services/`): logika domain, query SQLAlchemy 2, cache (`app/core/cache.py`), komposisi ekspor/PDF. Service hitung/DB tidak boleh memanggil HTTP eksternal (kecuali `storage.py` dan `forecast.py`).
- **Model DB** (`app/db/models.py`): pemetaan 1:1 terhadap `supabase/migrations/0001_init.sql` (SQL murni, **tanpa Alembic**).
- **Paket hitung** (`../../packages/riceguard_calc/src/riceguard_calc/`): satu-satunya sumber rumus `build`, `klasifikasi`, `match`, `match_detail`, `haversine_km`, dan parser `ingest`.

## Kontrak Data, Auth & Error

- Resolusi versi baca publik wajib lewat `resolve_published()` atau `resolve_for_read(..., admin=admin)` (`services/versions.py`): `?version_id=` hanya dihormati untuk admin.
- Auth admin (`app/core/security.py`): verifikasi JWT Supabase via `PyJWKClient(settings.jwks_url)` (fallback HS256 bila `SUPABASE_JWT_SECRET` diisi) + cek `user_id` di tabel `admins`.
- Semua error terstruktur memakai `AppError` (`app/core/errors.py`) → `{"error": {"code", "message", "details"}}`.
- Pembulatan ton pakai `bulatkan_ton` (`app/core/rounding.py`, 2 desimal); rasio 4 desimal; jarak 1 desimal.
- Laporan cetak (`app/services/pdf.py`): `render_report_html` menghasilkan HTML A4 siap-cetak (peta/grafik Matplotlib PNG data-URI, di-import lazy) yang disimpan PDF oleh browser; tidak ada WeasyPrint/Pango.
- Semua aksi tulis admin wajib mencatat `audit_log` insert-only (`services/audit.py`) dan memanggil `cache.clear_all()` bila memengaruhi data publik.
- Rincian skema: `../../docs/DOMAIN_MODEL.md`. Rincian endpoint: `../../docs/api/`.

## Gaya & Verifikasi

- Lint: Ruff (`../../ruff.toml`: Python target `py311`, `line-length = 120`, rules `E, F, W, I, UP, B`).
- Bahasa komentar, docstring, dan pesan error: **Bahasa Indonesia**.
- Perintah: `npm run lint:py && npm run test:calc` (serta `npm run test:api` bila Postgres lokal/CI siap); detail di `../../docs/RULES.md`.
