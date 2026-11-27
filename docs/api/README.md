---
scope: api/overview
canonical-for: ["konvensi REST API", "autentikasi JWT backend", "format error seragam", "cache respons", "CORS & pembulatan"]
sources: ["apps/api/app/main.py", "apps/api/app/core/security.py", "apps/api/app/core/errors.py", "apps/api/app/core/cache.py", "apps/api/app/core/rounding.py", "apps/api/app/services/versions.py"]
last-verified: 2026-11-27
---

# Konvensi REST API RiceGuard

> Untuk agen dan pengembang backend/frontend. Berkas ini memuat **konvensi global** `/api/v1`. Daftar endpoint ada di `endpoints-public.md` dan `endpoints-admin.md`. Skema tabel database ada di `../DOMAIN_MODEL.md`.

## 1. Ikhtisar Arsitektur HTTP

- **Prefix API:** `/api/v1` (`apps/api/app/main.py`), kecuali `GET /health` di root.
- **OpenAPI & TypeGen:** dokumentasi interaktif otomatis tersedia di `/docs` dan `/openapi.json`. Frontend menghasilkan tipe TypeScript lewat `npm run api:types` ke `apps/web/src/lib/api-types.ts`.
- **Konvensi field:** seluruh nama field JSON mengikuti kolom dataset (`snake_case` Bahasa Indonesia) agar API, database, CSV, dan Excel seragam.
- **Integritas perhitungan:** router hanya memvalidasi parameter dan memanggil service; seluruh perhitungan angka berasal dari `packages/riceguard_calc`.

## 2. Resolusi Versi Dataset (`services/versions.py`)

Setiap endpoint data tahunan menerima parameter query opsional `tahun` dan `version_id`:

1. **Request publik (tanpa token admin valid):** selalu memakai `resolve_published(db, tahun)`. Jika `tahun` kosong, dipilih tahun `published` terbaru; jika `tahun` tidak memiliki versi `published`, API membalas `404 NO_PUBLISHED_VERSION`. Parameter `?version_id=` **diabaikan** bagi publik.
2. **Request admin preview (`optional_admin` valid):** jika `version_id` diberikan, API mengembalikan versi tersebut (termasuk `draft` atau `archived`). Nilai `version_id` non-UUID ditolak rapi sebagai `404 NOT_FOUND` sebelum menyentuh Postgres.

## 3. Autentikasi & Otorisasi Admin (`core/security.py`)

Semua endpoint di bawah `/api/v1/admin/*` mewajibkan dependency `require_admin`:

- **Header:** `Authorization: Bearer <Supabase_Access_Token>`.
- **Verifikasi JWT:** memakai `PyJWKClient` terhadap `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` (mendukung algoritma asimetris `RS*`/`ES*`/`PS*`/`EdDSA`), memeriksa `exp`, `iss = <SUPABASE_URL>/auth/v1`, dan `aud = "authenticated"`.
- **Fallback legacy:** bila verifikasi JWKS gagal dan `SUPABASE_JWT_SECRET` diisi, token diverifikasi dengan `HS256` (mencatat warning log sekali).
- **Cek otorisasi:** `sub` (UUID) dicocokkan ke tabel `admins`. Token kosong/invalid/kedaluwarsa membalas `401 UNAUTHORIZED`; token valid tetapi `sub` tidak terdaftar di `admins` membalas `403 FORBIDDEN`.

## 4. Format Error Seragam (`core/errors.py`)

Seluruh `AppError` maupun `RequestValidationError` (Pydantic) dinormalisasi menjadi JSON:

```json
{
  "error": {
    "code": "VERSION_NOT_EDITABLE",
    "message": "Hanya versi draft yang dapat diedit",
    "details": { "status": "published" }
  }
}
```

| HTTP | Kode (`error.code`) | Kapan Terjadi |
|---|---|---|
| `400` | `INVALID_PARAMS` | Query, body, enum, ekstensi upload, atau validasi Pydantic tidak sah |
| `401` | `UNAUTHORIZED` | Header Bearer hilang, format salah, token invalid, atau kedaluwarsa |
| `403` | `FORBIDDEN` | JWT valid namun `user_id` tidak ada di tabel `admins` |
| `404` | `NOT_FOUND` | Kode provinsi, UUID versi, file sumber allowlisted, atau ID sumber tidak ditemukan |
| `404` | `NO_PUBLISHED_VERSION` | Tahun yang diminta belum memiliki versi `published` |
| `409` | `VERSION_NOT_EDITABLE` | Upaya edit, recompute, publish, rollback, atau hapus pada status yang tidak diizinkan |
| `409` | `LAYER_UNAVAILABLE` | `GET /map/layers?layer=kepadatan` saat seluruh `provinces.luas_km2` masih `NULL` |
| `413` | `FILE_TOO_LARGE` | Ukuran berkas unggahan melebihi `MAX_UPLOAD_MB` (default `2` MB) |
| `422` | `VALIDATION_FAILED` | Dataset unggahan gagal aturan validasi atau draft belum `lulus` saat `publish` |
| `502` | `AI_UPSTREAM_ERROR` | Endpoint model eksternal gagal merespons, timeout, non-200, atau JSON invalid |
| `503` | `AI_UNAVAILABLE` | `AI_ENDPOINT_URL` kosong (fitur prediksi AI dimatikan aman) |
| `503` | `STORAGE_UNAVAILABLE` | `SUPABASE_SERVICE_ROLE_KEY` belum terkonfigurasi atau gagal menghubungi Storage |

## 5. Cache, CORS & Pembulatan

- **In-memory cache (`core/cache.py`):** `ResponseCache` menyimpan hingga `512` entri selama `300` detik dengan kunci `(nama_endpoint, version_id, query_signature)`. Dipanggil `cache.clear_all()` setiap kali `publish`, `rollback`, `PUT /admin/content/{key}`, atau `PUT /admin/sources/{id}` sukses.
- **HTTP Cache Header (`main.py`):** middleware `cache_control_publik` menambahkan `Cache-Control: public, max-age=300` pada respons `200` endpoint `GET /api/v1/*` **kecuali** request membawa header `Authorization` (mencegah cache bersama menyimpan preview draft).
- **CORS:** mengizinkan origin dari `CORS_ORIGINS`, method `GET, POST, PATCH, PUT, DELETE, OPTIONS`, header `Authorization, Content-Type`, serta mengekspos header `Content-Disposition` agar frontend dapat membaca nama berkas unduhan.
- **Pembulatan (`core/rounding.py`):** semua field `*_ton` dibulatkan `2` desimal (`bulatkan_ton`); `rasio_swasembada` dipertahankan `4` desimal; `jarak_km` `1` desimal.

## Lihat Juga

- `endpoints-public.md` — seluruh endpoint publik (`/api/v1/*`)
- `endpoints-admin.md` — seluruh endpoint admin (`/api/v1/admin/*`)
- `../DOMAIN_MODEL.md` — skema tabel, enum, dan relasi basis data
