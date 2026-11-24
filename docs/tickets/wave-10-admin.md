# Wave 10 — Panel admin (§6) — di luar 9 fitur, tapi wajib untuk mengubah data

Kriteria selesai PRD §6: `/admin/*` tanpa login → login; token non-admin → 403;
upload `dataset/raw/` menghasilkan angka identik `dataset_v1.csv` dan 27 rekomendasi identik;
versi published/archived tidak bisa diedit (UI dan API); rollback mengubah tampilan publik < 5 s.

**Blocker:** B2 (service role key) untuk Storage.

---

## T10.1 — `require_admin` (JWT Supabase)

**Blocked by:** T0.7

**Scope**
- `app/core/security.py`: ambil `Authorization: Bearer`, verifikasi dengan `PyJWT` +
  `PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")` (kunci di-cache).
- Cek `exp`, `iss = f"{SUPABASE_URL}/auth/v1"`, `aud = "authenticated"`.
- `sub` → `select 1 from admins where user_id = :sub`; tidak ada → 403 `FORBIDDEN`.
- Token tidak ada / invalid / kedaluwarsa → 401 `UNAUTHORIZED`.
- Fallback HS256 dengan `SUPABASE_JWT_SECRET` hanya bila env itu diisi **dan** JWKS gagal
  (project legacy). Log sekali, jangan spam.
- Dependency `require_admin` + `optional_admin` (untuk preview `version_id` publik, T0.5).

**Acceptance**
- Tanpa header → 401. Token valid non-admin → 403. Token admin → 200.
- `optional_admin` mengembalikan `None` untuk request publik (bukan error).

**Tes:** `test_auth.py` (4 kasus, pakai JWT yang di-generate dengan kunci uji).

---

## T10.2 — Endpoint baca admin

**Blocked by:** T10.1

**Scope**
- `GET /admin/me` → `{user_id, nama, email}`.
- `GET /admin/versions?tahun=&status=` → daftar versi (id, tahun, version_no, status, notes,
  created_by/at, published_by/at, `lulus_validasi`).
- `GET /admin/versions/{id}` → detail + `validation` + `summary` + `source_files`.
- `GET /admin/versions/{id}/provinces` → 38 baris versi itu (termasuk draft).

**Acceptance**
- Seed: 1 versi 2025 published.
- Draft bisa dibaca admin, tidak bisa dibaca publik (`/provinces?version_id=<draft>` tanpa JWT
  → versi published).

**Tes:** `test_admin_versions.py`.

---

## T10.3 — `POST /admin/versions/validate` (dry-run)

**Blocked by:** T10.1, T0.3

**Scope**
- `multipart/form-data`: `tahun`, `produksi`, `penduduk`, `konsumsi`, `referensi` (opsional).
- Batas ukuran `MAX_UPLOAD_MB` (2) per file → 413 `FILE_TOO_LARGE`. Ekstensi/tipenya divalidasi.
- Parse lewat `riceguard_calc.ingest`, jalankan `build()` + `match()`, jalankan 5 aturan validasi
  (T8.1), **tidak menyimpan apa pun** (tidak ada baris DB, tidak ada file Storage).
- Respons: `{validasi, pratinjau: [...38 baris...], ringkasan, rekomendasi: [...27...]}`.
- Gagal validasi keras (bukan 38 provinsi / nilai ≤ 0) → 422 `VALIDATION_FAILED` dengan
  `details` daftar aturan gagal.

**Acceptance**
- Upload 4 file `dataset/raw/` untuk 2025 → 38 baris identik `dataset_v1.csv`, 27 rekomendasi identik CSV.
- Upload file 3 MB → 413.
- Setelah request: `count(*)` di `dataset_versions` tidak berubah.

**Tes:** `test_admin_validate.py` (regresi identik + 413 + tidak menulis).

---

## T10.4 — `POST /admin/versions` (buat draft)

**Blocked by:** T10.3, B2

**Scope**
- Body sama dengan T10.3 + `notes` (wajib, tidak boleh kosong).
- Simpan 4 file ke Storage `raw-uploads/<tahun>/<version_id>/<nama_file>` (service role).
- Satu transaksi: `dataset_versions` (status `draft`, `version_no` = max+1 untuk tahun itu),
  38 `province_stats`, 27 `distribution_recommendations` (dengan `explanation` dari T6.2),
  `summary`, `validation`, `source_files`.
- Tulis `audit_log` (`action=upload`).
- Versi draft baru tidak mengubah tampilan publik.

**Acceptance**
- Setelah upload: 1 draft 2025 `version_no=2`; publik masih melihat v1.
- File ada di Storage dengan path yang tercatat di `source_files`.
- `notes` kosong → 400 `INVALID_PARAMS`.

**Tes:** `test_admin_create_version.py` (mock Storage; assert draft + publik tetap v1 + audit).

---

## T10.5 — `PATCH /admin/versions/{id}/provinces/{kode_bps}` + recompute

**Blocked by:** T10.4

**Scope**
- Body: subset `{penduduk_jiwa, konsumsi_kg_kapita_tahun, produksi_padi_ton_gkg, produksi_beras_ton}`
  + `reason` (wajib).
- Hanya `status='draft'`; selain itu → 409 `VERSION_NOT_EDITABLE`.
- Tulis `province_stat_edits` (field, old, new, reason, actor) dan set `is_edited=true`.
- Jalankan ulang **penuh** `build()`+`match()` untuk 38 baris (matching global, PRD §12),
  lalu update semua `province_stats`, semua `distribution_recommendations`, `summary`, `validation`.
- `POST /admin/versions/{id}/recompute` melakukan hal sama tanpa edit.

**Acceptance**
- Edit produksi satu provinsi → rekomendasi provinsi lain bisa berubah (assert ada perubahan).
- Kolom turunan (kebutuhan/balance/rasio/status) tidak bisa dikirim — diabaikan atau 400.
- Edit versi published → 409.
- `province_stat_edits` bertambah 1 baris dengan reason.

**Tes:** `test_admin_patch.py` (409, kolom turunan ditolak, recompute penuh, audit `edit_provinsi`).

---

## T10.6 — publish / rollback / duplicate / delete

**Blocked by:** T10.5

**Scope**
- `POST /admin/versions/{id}/publish` — transaksi PRD §9:
  1. target harus `draft` dan `validation.lulus`; selain itu 409 / 422.
  2. `update ... set status='archived' where tahun=:t and status='published'`.
  3. `update ... set status='published', published_at=now(), published_by=:uid where id=:id`.
  4. insert `audit_log`.
  5. `cache.clear_version(...)` + `cache.clear_all()` setelah commit.
- `POST /admin/versions/{id}/rollback` — target harus `archived`; langkah sama, tapi audit `rollback`.
- `POST /admin/versions/{id}/duplicate` — salin versi apa pun jadi draft baru (`version_no` baru,
  `notes` dari body, `source_files` disalin, `status=draft`, `published_*` null).
- `DELETE /admin/versions/{id}` — hanya `draft`; hapus cascade stats/rekomendasi; file Storage
  boleh dibiarkan (catat di audit).

**Acceptance**
- Publish draft → versi lama `archived`, publik langsung melihat draft dalam < 5 s (cache dibersihkan).
- Dua publish untuk tahun yang sama tidak mungkin (unique index).
- Delete versi published → 409.
- Rollback versi archived → jadi published, yang tadi published jadi archived.
- Semua aksi tercatat di `audit_log` dengan `before/after`.

**Tes:** `test_admin_lifecycle.py` (publish, rollback, duplicate, delete, 409, cache invalidated).

---

## T10.7 — Konten & sumber data

**Blocked by:** T10.1

**Scope**
- `GET /admin/content` → semua blok; `PUT /admin/content/{key}` → `{title, body_md}`;
  key baru boleh dibuat, key tak dikenal di `GET /content` diabaikan.
- `PUT /admin/sources/{id}` → field sumber.
- Setelah simpan: `cache.clear_all()` (konten tidak diversikan), tulis `audit_log`
  (`edit_konten` / `edit_sumber`).

**Acceptance**
- `PUT /admin/content/about` → `GET /content?keys=about` berubah < 1 s.
- Key dengan `body_md` kosong tetap tersimpan (boleh mengosongkan blok).
- Audit mencatat before/after.

**Tes:** `test_admin_content.py`.

---

## T10.8 — `GET /admin/audit-log`

**Blocked by:** T10.6

**Scope**
- Query `action`, `actor`, `page`, `limit` (default 50, maks 200).
- Respons: `{items: [{id, created_at, actor, actor_nama, action, entity, entity_id, detail}], total}`.
- Tabel `audit_log` insert-only: tidak ada endpoint update/delete.
- Pastikan **semua** aksi tulis menulis audit: `upload, edit_provinsi, recompute, publish, rollback,
  duplicate, hapus_draft, edit_konten, edit_sumber`.

**Acceptance**
- 9 jenis aksi bisa difilter.
- `detail` memuat JSON before/after untuk edit.
- Tidak ada route yang mengubah `audit_log`.

**Tes:** `test_admin_audit.py` (tiap aksi muncul; filter; insert-only).

---

## T10.9 — UI admin (FE)

**Blocked by:** T10.2, T10.4, T10.6, T10.7, T10.8

**Scope**
- `AdminLayout` + guard: cek sesi Supabase → `GET /admin/me` → 403 tampilkan pesan, 401 → `/admin/login`.
- Halaman: `/admin/login`, `/admin` (ringkasan), `/admin/versi` (daftar + `Badge` status),
  `/admin/versi/baru` (wizard 4 langkah: tahun+catatan → upload → validasi → pratinjau+simpan),
  `/admin/versi/:id` (tab Data provinsi · Rekomendasi · Validasi · Riwayat; `Dialog` edit per baris
  dengan `reason` wajib; tombol sesuai matriks status PRD §6.3), `/admin/konten` (Markdown + pratinjau),
  `/admin/log`.
- `AlertDialog` konfirmasi untuk publish/rollback yang menyebut versi lama → versi baru.
- Setelah aksi tulis: `invalidateQueries` untuk key tahun terkait.

**Acceptance**
- Tanpa login → redirect ke `/admin/login`.
- Upload file contoh `dataset/raw/` lewat wizard → pratinjau 38 baris + 27 rekomendasi.
- Versi published: tombol edit hilang; API juga menolak (409).
- Rollback mengubah halaman publik dalam < 5 s.

**Tes:** `npm run build`, cek manual alur wizard + publish + rollback.
