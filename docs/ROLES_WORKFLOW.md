---
scope: roles-workflow
canonical-for: ["peran & matriks izin", "autentikasi admin JWT", "siklus versi dataset", "wizard upload", "audit log"]
sources: ["apps/api/app/core/security.py", "apps/api/app/routers/admin/versions.py", "apps/api/app/routers/admin/content.py", "apps/api/app/routers/admin/audit.py", "apps/api/app/services/audit.py", "apps/web/src/hooks/useAdminSession.tsx"]
last-verified: 2026-11-26
---

# Peran, Autentikasi & Alur Kerja RiceGuard

> Berkas kanonik untuk peran pengguna, gerbang autentikasi admin, siklus hidup versi dataset, alur unggah/edit/publikasi, serta pencatatan audit log. Spesifikasi HTTP detail ada di `api/endpoints-admin.md`.

## 1. Peran & Matriks Izin

RiceGuard memiliki tepat **dua** peran tanpa sub-role bertingkat dan tanpa pendaftaran mandiri di UI:

- **Publik:** seluruh pengunjung tanpa login. Hanya membaca versi berstatus `published`, menjalankan simulasi skenario on-the-fly (tidak disimpan), serta mengunduh CSV/Excel/PDF/file mentah versi `published`.
- **Admin:** pengelola data dengan akun Supabase Auth yang `user_id`-nya terdaftar di tabel `admins`. Semua admin memiliki hak yang sama. Akun admin dibuat manual di dashboard Supabase lalu didaftarkan ke `admins`.

| Aksi | Publik | Admin |
|---|---|---|
| Baca halaman publik & API `/api/v1/*` (`published`) | Ya | Ya |
| Preview versi `draft` / `archived` via `?version_id=` | Tidak (diabaikan) | Ya (`optional_admin`) |
| Jalankan simulasi skenario (`POST /recommendations/simulate`) | Ya | Ya |
| Unduh CSV / Excel / PDF / file mentah versi `published` | Ya | Ya |
| Masuk `/admin` & akses `/api/v1/admin/*` | Tidak (`401`) | Ya |
| Validasi & unggah file mentah jadi versi `draft` | Tidak | Ya |
| Edit baris provinsi pada versi `draft` & hitung ulang | Tidak | Ya |
| Publish, rollback, duplikat, hapus `draft` | Tidak | Ya |
| Ubah konten situs (`site_content`) & sumber data (`data_sources`) | Tidak | Ya |
| Baca log aktivitas (`GET /admin/audit-log`) | Tidak | Ya |

## 2. Alur Autentikasi Admin (Supabase Auth + FastAPI)

1. Pengelola masuk di `/admin/login` lewat form email + kata sandi Supabase Auth (`apps/web/src/lib/supabase.ts` — aman bernilai `null` di build publik jika env kosong). Tombol pendaftaran mandiri tidak ada.
2. `useAdminSession` menyinkronkan `session.access_token` ke header `Authorization: Bearer <JWT>` (`setTokenAdmin`) lalu memanggil `GET /api/v1/admin/me`.
3. Di backend (`apps/api/app/core/security.py`):
   - `require_admin` mengekstrak Bearer token, memverifikasi tanda tangan via `PyJWKClient(settings.jwks_url)` (algoritma asimetris, `exp`, `iss = <SUPABASE_URL>/auth/v1`, `aud = "authenticated"`).
   - Bila verifikasi JWKS gagal dan `SUPABASE_JWT_SECRET` diisi, backend melakukan fallback ke `HS256` dengan peringatan log satu kali.
   - Token tidak ada / salah / kedaluwarsa → `401 UNAUTHORIZED`.
   - `sub` valid UUID namun tidak ditemukan pada tabel `admins` → `403 FORBIDDEN`.
   - `optional_admin` mengembalikan `None` saat header kosong atau token tidak valid, sehingga endpoint publik tetap aman tanpa membocorkan versi `draft`.

## 3. Siklus Hidup Versi Dataset

Satu tahun boleh memiliki banyak versi, tetapi **hanya satu** versi berstatus `published` (dijaga partial unique index `dataset_versions_one_published`).

```mermaid
stateDiagram-v2
    [*] --> draft: Upload (/admin/versi) atau Duplicate (/duplicate)
    draft --> draft: Edit baris (PATCH) / Recompute
    draft --> [*]: Hapus draft (DELETE)
    draft --> published: Publish (draft lulus validasi; published lama -> archived)
    published --> draft: Duplicate jadi draft baru
    published --> archived: Digantikan oleh publish atau rollback lain
    archived --> published: Rollback (published saat ini -> archived)
    archived --> draft: Duplicate jadi draft baru
```

Aturan integritas siklus versi (`apps/api/app/routers/admin/versions.py`):

- **Versi `published` dan `archived` terkunci (read-only):** `PATCH`, `recompute`, dan `DELETE` pada selain `draft` ditolak dengan `409 VERSION_NOT_EDITABLE`.
- **Syarat `publish`:** target harus berstatus `draft` (`409` jika bukan) dan `validation.lulus === true` (`422 VALIDATION_FAILED` jika gagal).
- **Transaksi atomik (`_swap_published_version`):** mengarsipkan versi `published` tahun sama menjadi `archived`, menetapkan target menjadi `published` (`published_at`, `published_by`), menulis `audit_log`, melakukan `commit`, lalu memanggil `cache.clear_all()` sehingga tampilan publik langsung diperbarui (< 5 detik).

## 4. Alur Upload 4-Langkah & Edit Draft

1. **Langkah 1–2 (Wizard `/admin/versi/baru`):** Admin memilih `tahun` + `notes` wajib (kosong → `400 INVALID_PARAMS`), lalu mengunggah 3 file wajib (`produksi`, `penduduk`, `konsumsi`) dan opsional `referensi` (`.txt`/`.csv`, batas `MAX_UPLOAD_MB` = 2 MB per file → lebih besar membalas `413 FILE_TOO_LARGE`).
2. **Langkah 3 (`POST /api/v1/admin/versions/validate`):** Dry-run penuh tanpa menulis DB atau Storage (`ingest.parse_uploaded_bundle` → `compute.run_dataset_pipeline`). Lima aturan validasi (`services/validation.py`):
   - `jumlah_provinsi`: tepat 38 provinsi dan cocok referensi.
   - `nilai_positif`: `penduduk_jiwa > 0`, `konsumsi_kg_kapita_tahun > 0`, `produksi >= 0`.
   - `total_produksi`: selisih total provinsi vs baris `Indonesia` BPS <= `0,1%` (atau `peringatan` jika baris `Indonesia` tidak ada).
   - `total_penduduk`: selisih total penduduk vs baris `Indonesia` BPS <= `0,1%`.
   - `perubahan_besar`: `peringatan` (tidak memblokir) jika produksi provinsi berubah > `30%` dibanding versi `published` tahun yang sama.
   - Jika ada aturan berstatus `gagal`, API membalas `422 VALIDATION_FAILED` dengan daftar `aturan`.
3. **Langkah 4 (`POST /api/v1/admin/versions`):** Menjalankan pipeline validasi lagi sebelum menyentuh Storage/DB; mengunggah file mentah ke `raw-uploads/<tahun>/<version_id>/<nama_file>`; menyimpan `DatasetVersion(draft)`, 38 `ProvinceStat`, dan `DistributionRecommendation` lengkap dengan `explanation` dalam satu transaksi.
4. **Edit Baris Provinsi (`PATCH /api/v1/admin/versions/{id}/provinces/{kode_bps}`):**
   - Hanya menerima 4 field input (`penduduk_jiwa`, `konsumsi_kg_kapita_tahun`, `produksi_padi_ton_gkg`, `produksi_beras_ton`) + `reason` wajib (`ConfigDict(extra="forbid")` menolak kolom turunan dengan `400`).
   - Mencatat perubahan ke `province_stat_edits`, menandai `is_edited = true`, lalu memanggil `recompute_draft_version()` untuk menghitung ulang **seluruh 38 provinsi dan seluruh pasangan rekomendasi** karena algoritma matching bersifat global.

## 5. Konten, Simulasi, Prediksi AI & Audit Log

- **Kelola Konten (`/admin/konten`):** `PUT /api/v1/admin/content/{key}` (`body_md` boleh kosong) dan `PUT /api/v1/admin/sources/{id}` langsung berlaku ke publik setelah `cache.clear_all()`.
- **Simulasi & Prediksi AI:** Simulasi memakai state memori tanpa menulis DB/cache; Prediksi AI (`GET /api/v1/forecast`) hanya proksi terisolasi ke model eksternal (`AI_ENDPOINT_URL`) dan tidak pernah memodifikasi tabel atau angka resmi.
- **Audit Log Insert-Only (`GET /api/v1/admin/audit-log`):** Tidak memiliki endpoint `PUT`/`PATCH`/`DELETE`. Sembilan aksi yang dicatat dengan rincian JSON (`before`/`after` bila relevan): `upload`, `edit_provinsi`, `recompute`, `publish`, `rollback`, `duplicate`, `hapus_draft`, `edit_konten`, `edit_sumber`.
