---
scope: api/endpoints-admin
canonical-for: ["spesifikasi endpoint admin REST API"]
sources: ["apps/api/app/routers/admin/versions.py", "apps/api/app/routers/admin/content.py", "apps/api/app/routers/admin/audit.py", "apps/api/app/schemas/admin.py", "apps/api/app/services/ingest.py", "apps/api/app/services/compute.py"]
last-verified: 2026-11-26
---

# Endpoint Admin (`/api/v1/admin/*`)

> Berkas kanonik seluruh endpoint panel admin. Setiap rute pada dokumen ini dilindungi `require_admin` (`401 UNAUTHORIZED` tanpa/invalid JWT, `403 FORBIDDEN` jika `user_id` tidak terdaftar di tabel `admins`). Konvensi auth dan error format ada di `README.md`.

## 1. Ringkasan Endpoint Admin

| Method & Path | Input / Body | Status Sukses & Fungsi |
|---|---|---|
| `GET /api/v1/admin/me` | — | `200` Identitas admin terverifikasi |
| `GET /api/v1/admin/versions` | Query `tahun?`, `status?` | `200` Daftar versi terurut terbaru |
| `GET /api/v1/admin/versions/{version_id}` | Path UUID | `200` Detail versi + validasi + ringkasan + `source_files` + `edits` |
| `GET /api/v1/admin/versions/{version_id}/provinces` | Path UUID | `200` 38 baris provinsi + `is_edited` |
| `GET /api/v1/admin/versions/{version_id}/recommendations` | Path UUID | `200` Daftar rekomendasi + ringkasan |
| `POST /api/v1/admin/versions/validate` | Multipart form + file | `200` Dry-run validasi & pratinjau (tanpa tulis DB/Storage) |
| `POST /api/v1/admin/versions` | Multipart form + `notes` + file | `201` Upload Storage + simpan versi `draft` + audit `upload` |
| `PATCH /api/v1/admin/versions/{version_id}/provinces/{kode_bps}` | JSON `ProvinceStatPatchRequest` | `200` Edit input `draft` + recompute penuh + audit `edit_provinsi` |
| `POST /api/v1/admin/versions/{version_id}/recompute` | — | `200` Hitung ulang penuh `draft` + audit `recompute` |
| `POST /api/v1/admin/versions/{version_id}/publish` | — | `200` Terbitkan `draft` lulus validasi + arsipkan versi lama |
| `POST /api/v1/admin/versions/{version_id}/rollback` | — | `200` Terbitkan ulang versi `archived` + arsipkan versi aktif |
| `POST /api/v1/admin/versions/{version_id}/duplicate` | JSON `{"notes": "..."}` | `201` Salin versi apa pun menjadi `draft` baru |
| `DELETE /api/v1/admin/versions/{version_id}` | — | `200` Hapus versi `draft` + audit `hapus_draft` |
| `GET /api/v1/admin/content` | — | `200` Seluruh blok konten `site_content` |
| `PUT /api/v1/admin/content/{key}` | JSON `{"title", "body_md"}` | `200` Upsert blok konten + clear cache + audit `edit_konten` |
| `PUT /api/v1/admin/sources/{source_id}` | JSON `SourceUpdateRequest` | `200` Ubah metadata sumber data + clear cache + audit `edit_sumber` |
| `GET /api/v1/admin/audit-log` | Query `action?`, `actor?`, `page?`, `limit?` | `200` Daftar log insert-only paginasi |

## 2. Sesi & Baca Versi (`routers/admin/versions.py`)

- **`GET /admin/me`:** mengembalikan `{ "user_id": uuid, "nama": str, "email": str | null }`.
- **`GET /admin/versions`:** query opsional `tahun` dan `status` (`draft | published | archived`; status lain → `400 INVALID_PARAMS`). Mengembalikan `AdminVersionItem[]` terurut `(tahun DESC, version_no DESC)`.
- **`GET /admin/versions/{version_id}`:** UUID invalid → `404 NOT_FOUND`. Mengembalikan `{ "version", "validasi", "ringkasan", "source_files": [{ "key", "nama_file" }], "edits": AdminEditHistoryItem[] }` (riwayat edit terurut terbaru dulu).
- **`GET /admin/versions/{version_id}/provinces`:** mengembalikan `{ "version_id", "tahun", "status", "items": AdminProvinceStatItem[] }` (memuat flag `is_edited`).
- **`GET /admin/versions/{version_id}/recommendations`:** mengembalikan `{ "version_id", "tahun", "ringkasan", "items": RecommendationItem[] }`.

## 3. Validasi & Buat Versi Draft

### `POST /api/v1/admin/versions/validate` (Dry-Run)

- **Content-Type:** `multipart/form-data`.
- **Field wajib:** `tahun` (`1900..2100`), `produksi` (`.txt`/`.csv`), `penduduk` (`.txt`/`.csv`), `konsumsi` (`.txt`/`.csv`).
- **Field opsional:** `referensi` (`.csv`/`.txt`; bila kosong memakai isi tabel `provinces`).
- **Batas & validasi (`services/ingest.py`):**
  - Nama file tidak aman atau ekstensi bukan `.txt`/`.csv` → `400 INVALID_PARAMS`.
  - File kosong → `400 INVALID_PARAMS`.
  - Ukuran per file > `MAX_UPLOAD_MB` (default 2 MB) → `413 FILE_TOO_LARGE`.
  - Pipeline `run_dataset_pipeline` menjalankan `build()`, `match_detail()`, `kalimat_rekomendasi()`, `validasi()`, `summary_nasional()`.
  - Bila `not validasi["lulus"]` → `422 VALIDATION_FAILED` (`details: { "validasi": ... }`).
- **Respons `200`:** `{ "validasi", "pratinjau": [...38 AdminProvinceStatItem...], "ringkasan", "rekomendasi": [...RecommendationItem...] }`. **Tidak** menulis ke DB maupun Storage.

### `POST /api/v1/admin/versions` (Buat Draft)

- Payload sama dengan `/validate` ditambah field form `notes` (wajib tidak kosong; kosong → `400 INVALID_PARAMS`).
- Menjalankan validasi & pipeline perhitungan penuh terlebih dahulu (`422` jika gagal tanpa menyentuh Storage).
- Mengunggah file mentah ke bucket `raw-uploads/<tahun>/<version_id>/<nama_file>` via `storage.upload_raw_object()` (`503 STORAGE_UNAVAILABLE` jika `SUPABASE_SERVICE_ROLE_KEY` belum terkonfigurasi).
- Jika `referensi` kustom diunggah, melakukan upsert `provinces`.
- Menyimpan dalam satu transaksi DB: `DatasetVersion` (`status="draft"`, `version_no = max + 1`), 38 `ProvinceStat`, seluruh `DistributionRecommendation` lengkap dengan `explanation`, dan `AuditLog(action="upload")`.
- Mengembalikan `201 Created`: `{ "version", "validasi", "ringkasan" }`.

## 4. Edit Provinsi, Recompute & Siklus Hidup Versi

### `PATCH /api/v1/admin/versions/{version_id}/provinces/{kode_bps}`

- **Syarat status:** versi harus `draft`; selain itu membalas `409 VERSION_NOT_EDITABLE`.
- **Body (`ProvinceStatPatchRequest`, `extra="forbid"`):** minimal satu dari 4 kolom input plus `reason` wajib tidak kosong:
  - `penduduk_jiwa?: int` (`> 0`)
  - `konsumsi_kg_kapita_tahun?: float` (`> 0`)
  - `produksi_padi_ton_gkg?: float` (`>= 0`)
  - `produksi_beras_ton?: float` (`>= 0`)
  - `reason: str` (`min_length=1`, non-whitespace)
  - Mengirim kolom turunan (`kebutuhan_beras_ton`, `rice_balance_ton`, `rasio_swasembada`, `status`) atau field asing lain membalas `400 INVALID_PARAMS`.
- **Efek:** mencatat setiap field berubah ke `province_stat_edits`, menandai `is_edited = True`, menjalankan `recompute_draft_version` penuh (38 provinsi + seluruh rekomendasi + `summary` + `validation` mempertahankan `acuan_bps`), dan mencatat `AuditLog(action="edit_provinsi")` dengan `before`/`after`.

### Aksi Siklus Versi (`POST` / `DELETE`)

| Endpoint | Syarat Status Target | Perilaku & Audit |
|---|---|---|
| `POST /admin/versions/{id}/recompute` | `draft` (`409` jika bukan) | Jalankan `recompute_draft_version`; tulis `AuditLog("recompute")` |
| `POST /admin/versions/{id}/publish` | `draft` (`409`) & `validation.lulus` (`422`) | Arsipkan `published` lama tahun sama → set target `published`, `cache.clear_all()`, `AuditLog("publish")` |
| `POST /admin/versions/{id}/rollback` | `archived` (`409` jika bukan) | Arsipkan `published` saat ini → set target `published`, `cache.clear_all()`, `AuditLog("rollback")` |
| `POST /admin/versions/{id}/duplicate` | Status apa pun; body `{ "notes" }` wajib | Buat `draft` baru (`version_no = max + 1`, `is_edited=false`), salin stats & rekomendasi, `AuditLog("duplicate")` (`201`) |
| `DELETE /admin/versions/{id}` | `draft` (`409` jika bukan) | Hapus `DatasetVersion` (cascade stats, edits, recommendations), tulis `AuditLog("hapus_draft")`, balas `{"deleted": true, "id"}` |

## 5. Konten, Sumber Data & Audit Log

- **`GET /admin/content`:** mengembalikan seluruh blok `ContentItem[]` dari `site_content`.
- **`PUT /admin/content/{key}`:** body `{ "title": str, "body_md": str }` (`body_md` boleh string kosong `""`, `title` wajib). Melakukan upsert berdasarkan `key`, mencatat `before`/`after` ke `AuditLog("edit_konten")`, dan memanggil `cache.clear_all()`.
- **`PUT /admin/sources/{source_id}`:** body `SourceUpdateRequest` (`nama?`, `instansi?`, `tabel_resmi?`, `tahun?`, `diperbarui?`, `url?`). Minimal 1 field dikirim; `nama` dan `instansi` tidak boleh `null`/kosong. Mencatat `AuditLog("edit_sumber")` dan memanggil `cache.clear_all()`.
- **`GET /admin/audit-log`:** query `action?`, `actor?` (UUID atau pencarian nama admin `ilike`), `page` (`>= 1`, default `1`), `limit` (`1..200`, default `50`). Mengembalikan `{ "items": AuditLogItem[], "total", "page", "limit" }`. Tidak tersedia endpoint `PUT`/`PATCH`/`DELETE` (insert-only).
