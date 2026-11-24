# Wave 8 — Fitur 8: Data Management & Transparency (`/data`)

Kriteria selesai PRD §5.8: file unduhan sama persis kolomnya dengan `dataset_v1.csv`
(urutan & nama); Excel berisi 3 sheet: Provinsi, Rekomendasi, Metadata.

---

## T8.1 — `GET /validation`

**Blocked by:** T0.6

**Scope**
- Respons: `{tahun, version, lulus: bool, aturan: [{kode, label, status: "lulus"|"peringatan"|"gagal",
  detail}], diperiksa_pada}`.
- Aturan (PRD §6.2 langkah 3):
  1. `jumlah_provinsi` — tepat 38 dan semua cocok referensi.
  2. `nilai_positif` — tidak ada penduduk/konsumsi ≤ 0, produksi < 0.
  3. `total_produksi` — Σ vs baris "Indonesia" BPS, toleransi 0,1%.
  4. `total_penduduk` — Σ vs BPS, toleransi 0,1%.
  5. `perubahan_besar` — peringatan bila > 30% vs versi published tahun yang sama sebelumnya.
- Hasil disimpan di `dataset_versions.validation` saat seed/compute; endpoint hanya membaca.
- Angka pembanding "Indonesia" BPS disimpan di `source_files` (jsonb) supaya tidak perlu parse ulang
  saat baca.

**Acceptance**
- Seed 2025: `lulus=true`, 5 aturan `lulus`/`peringatan` (tidak ada `gagal`).
- Detail `total_produksi` memuat angka Σ dan angka BPS + selisih persen.

**Tes:** `test_validation.py` (seed lulus; versi dengan produksi diubah 50% → `perubahan_besar`
`peringatan`).

---

## T8.2 — Ekspor CSV

**Blocked by:** T4.2, T6.3

**Scope**
- `GET /exports/provinces.csv?tahun=` → `text/csv; charset=utf-8` dengan **BOM** (`\ufeff`).
- `GET /exports/recommendations.csv?tahun=` → idem.
- Header & urutan kolom **identik** `dataset_v1.csv` / `rekomendasi_distribusi_v1.csv`
  (15 kolom provinsi, 7 kolom rekomendasi: `urutan,dari_kode,dari,ke_kode,ke,ton,jarak_km`).
- `Content-Disposition: attachment; filename="riceguard-provinsi-2025-v1.csv"`.
- Angka tanpa pemisah ribuan (CSV mesin), desimal titik, `\r\n` line ending.

**Acceptance**
- Bandingkan byte (setelah BOM) dengan `dataset/dataset_v1.csv` untuk 2025 → sama persis.
- Kolom rekomendasi sama persis dengan `rekomendasi_distribusi_v1.csv`.

**Tes:** `test_exports_csv.py` (bandingkan teks, urutan kolom, BOM ada).

---

## T8.3 — Ekspor Excel

**Blocked by:** T8.2

**Scope**
- `GET /exports/provinces.xlsx` dan `/exports/recommendations.xlsx` → `openpyxl`.
- File berisi 3 sheet: **Provinsi** (38 baris, kolom sama CSV), **Rekomendasi** (27 baris),
  **Metadata** (versi, `version_no`, tahun, `published_at`, `published_by`, sumber 4 baris,
  batasan klaim 1 kalimat, tanggal cetak).
- Format angka ribuan `#,##0.00`, header bold + freeze pane baris 1, lebar kolom auto.

**Acceptance**
- `openpyxl.load_workbook` → tepat 3 sheet dengan nama di atas.
- Sheet Metadata memuat versi dan tanggal cetak.
- Angka di sheet Provinsi = CSV.

**Tes:** `test_exports_xlsx.py`.

---

## T8.4 — `GET /exports/raw/{nama_file}`

**Blocked by:** T0.6, B2

**Scope**
- Ambil file dari Supabase Storage bucket privat `raw-uploads/<tahun>/<version_id>/<nama_file>`
  lewat service role (server-side saja).
- `nama_file` di-*allowlist*: hanya 4 nama dari `source_files` versi itu (`provinces-reference-serlin.csv`,
  `produksi_<tahun>.txt`, `penduduk_supas2025.txt`, `konsumsi_bapanas_<tahun>.csv`).
  Nama lain → 404 `NOT_FOUND`. **Jangan** menyusun path dari input mentah tanpa validasi
  (path traversal).
- `Content-Disposition: attachment`, `Content-Type` sesuai ekstensi.

**Acceptance**
- 4 file bisa diunduh untuk versi 2025 setelah T10.4 menyimpan file.
- `../../etc/passwd` dan `produksi_2024.txt` → 404.
- Request tanpa sesi admin tetap boleh (publik, PRD §2), tapi file-nya harus milik versi published.

**Tes:** `test_exports_raw.py` (allowlist, traversal, 404 versi draft).

---

## T8.5 — Halaman Data & Metodologi (FE)

**Blocked by:** T8.1, T8.2, T8.3, T1.2

**Scope**
- Tabel sumber data (dari `/sources`), info versi (versi, tanggal publish, admin, catatan),
  pemilih tahun, panel validasi (per aturan dengan `Badge` lulus/peringatan/gagal),
  tombol unduh CSV & Excel (provinsi + rekomendasi + file mentah),
  metodologi dari `/content?keys=methodology` + anchor `#batasan`.

**Acceptance**
- Unduhan dari browser menghasilkan file yang sama dengan tes backend.
- `#batasan` bisa di-scroll langsung dari banner halaman lain.
- Validasi menampilkan 5 aturan.

**Tes:** `npm run build`, cek manual unduh 4 file.
