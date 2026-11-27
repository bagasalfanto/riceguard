---
scope: kamus-kosakata
canonical-for: ["teks antarmuka", "navigasi & rute UI", "label status", "parameter URL", "header CSV", "larangan kata"]
sources: ["GLOSSARY.md", "apps/web/src/components/layout/Header.tsx", "apps/web/src/components/layout/AdminLayout.tsx", "apps/web/src/router.tsx", "apps/web/src/lib/status.ts", "apps/web/src/lib/format.ts", "apps/api/app/services/exports.py", "apps/api/app/core/errors.py"]
last-verified: 2026-11-27
---

# Kamus Kosakata Baku RiceGuard

> Dokumen ini adalah **sumber tunggal kebenaran (single source of truth)** untuk seluruh kosakata yang tampil di antarmuka, navigasi, label status, parameter URL, pesan kesalahan, dan header ekspor RiceGuard.

Rujukan pelengkap: `../GLOSSARY.md` (definisi istilah domain) · `DESIGN.md` (token visual & layout) · `RULES.md` (verifikasi & gaya kode).

---

## 1. Aturan Pakai (Wajib)

### 1.1 Satu Konsep, Satu Nama

Dilarang memakai sinonim bergantian untuk entitas, aksi, atau status yang sama. Konsistensi wajib menembus tujuh permukaan berikut sekaligus:

| # | Permukaan | Contoh Baku |
|---|---|---|
| 1 | Navigasi Header / Sidebar Admin | `Distribution Analysis` / `Versi Dataset` |
| 2 | Judul Halaman (`<h1>`) | `Rekomendasi Distribusi & Simulasi` |
| 3 | Judul Tabel / Seksi | `Validasi Data`, `Pusat Unduhan` |
| 4 | Tombol & Label Form | `Unduh laporan`, `Simpan sebagai Draft` |
| 5 | Pesan Toast / Alert | `Versi berhasil dipublikasikan.` |
| 6 | Parameter URL & Anchor | `?tahun=2025`, `?layer=status`, `/data#batasan` |
| 7 | Header Kolom CSV / Excel | `rice_balance_ton`, `jarak_km` |

### 1.2 Bahasa & Integritas Domain

- **Konten, deskripsi, tombol aksi, dan pesan error:** Bahasa Indonesia sesuai KBBI dan format angka `id-ID`.
- **Label menu utama publik:** mengikuti desain navigasi produk (`Dashboard`, `Rice Map`, `Regional Analysis`, `Distribution Analysis`, `Recommendations`, `Historical Trends`, `Data & Methodology`), ditambah tombol `Unduh laporan` (`/laporan`) dan menu gated `Prediksi` (`/prediksi`).
- **Kamus menuntun teks antarmuka, bukan mengubah nama kolom DB/API:** identifier teknis `snake_case` (`rice_balance_ton`, `kode_bps`, `kebutuhan_beras_ton`) tetap dipakai pada API, CSV, dan Excel.
- **Angka & font:** angka bisnis memakai `tabular-nums` (`Intl.NumberFormat("id-ID")`); `font-mono` hanya untuk identifier teknis (`kode_bps`, UUID, JSON detail audit).

---

## 2. Istilah Domain & Kata Terlarang

> Definisi rinci istilah domain ada di `../GLOSSARY.md`. Tabel ini mengikat pemakaian istilah di UI dan salinan teks.

| Istilah Baku | Wujud Teknis | Istilah Dilarang (Jangan Dipakai) |
|---|---|---|
| **Versi dataset** | `dataset_versions` | snapshot, batch, rilis |
| **Published / draft / archived** | `version_status` | aktif, final, terbit |
| **Kebutuhan beras** | `kebutuhan_beras_ton` | demand, konsumsi nasional |
| **Rice balance** | `rice_balance_ton` | **stok**, saldo, surplus (untuk nama metrik) |
| **Rasio swasembada** | `rasio_swasembada` | rasio produksi, self-sufficiency |
| **Surplus / balanced / defisit** | `province_status` (`surplus`/`balanced`/`defisit`) | untung/rugi, lebih/kurang |
| **Rekomendasi distribusi** | `distribution_recommendations` | **rute**, jadwal kirim, order |
| **Alur alokasi** | garis `FlowLines` di peta | **rute**, jalur logistik |
| **Jarak garis lurus** | `jarak_km` (Haversine) | **jarak tempuh**, **jarak rute** |
| **Simulasi** | `/rekomendasi/simulasi`, `POST /recommendations/simulate` | what-if, prediksi |
| **Prediksi** | `/prediksi`, `GET /forecast` | proyeksi resmi, angka dataset, simulasi |
| **Batasan klaim** | `LimitationBanner`, `site_content.limitations`, `#batasan` | disclaimer, catatan kaki |

> [!CAUTION]
> **Larangan kata "rute":** Kata `"rute"` dilarang keras muncul pada label UI, judul, tooltip, legenda peta, maupun teks penjelasan aplikasi web. Selalu gunakan **alur alokasi** atau **jarak garis lurus**.

---

## 3. Navigasi & Peta Halaman (`apps/web/src/router.tsx`)

### 3.1 Halaman Publik (`PublicLayout`)

| Path | Label Navigasi / Pemicu | Komponen Halaman | Catatan |
|---|---|---|---|
| `/` | Logo `RiceGuard` | `LandingPage` | Seluruh teks dari `/content` dan `/sources` |
| `/dashboard` | `Dashboard` | `DashboardPage` | `LimitationBanner` aktif |
| `/peta` | `Rice Map` | `PetaPage` | `LimitationBanner` aktif |
| `/analisis` | `Regional Analysis` | `AnalisisPage` (`AnalisisListView`) | Daftar & peringkat 38 provinsi |
| `/analisis/:kode` | Klik baris/panel provinsi | `AnalisisPage` (`AnalisisDetailView`) | Detail rumus terisi & 404 jika invalid |
| `/distribusi` | `Distribution Analysis` | `DistribusiPage` | `LimitationBanner` aktif |
| `/rekomendasi` | `Recommendations` | `RekomendasiPage` (tab `Rekomendasi resmi`) | `LimitationBanner` aktif |
| `/rekomendasi/simulasi` | Tab `Simulasi skenario` | `RekomendasiPage` (tab `Simulasi skenario`) | `LimitationBanner` aktif |
| `/tren` | `Historical Trends` | `TrenPage` | Menu disembunyikan jika tahun published < 2 |
| `/data` | `Data & Methodology` | `DataPage` | Anchor `#versi`, `#validasi`, `#unduhan`, `#sumber`, `#metodologi`, `#batasan` |
| `/laporan` | Tombol `Unduh laporan` | `LaporanPage` | 4 jenis laporan; tombol `Cetak / Simpan PDF`, `Unduh CSV`, `Unduh Excel` |
| `/prediksi` | `Prediksi` | `PrediksiPage` | Menu dirender hanya jika `GET /forecast` = 200 |

### 3.2 Halaman Admin (`AdminLayout` + `/admin/login`)

| Path | Label Sidebar (`AdminLayout`) | Komponen Halaman |
|---|---|---|
| `/admin/login` | — | `AdminLoginPage` |
| `/admin` | `Ringkasan` | `AdminDashboardPage` |
| `/admin/versi` | `Versi Dataset` | `AdminVersionsPage` |
| `/admin/versi/baru` | `Upload Versi Baru` | `AdminUploadWizardPage` |
| `/admin/versi/:id` | (dari daftar versi) | `AdminVersionDetailPage` |
| `/admin/konten` | `Konten & Sumber` | `AdminContentPage` |
| `/admin/log` | `Log Aktivitas` | `AdminAuditLogPage` |

---

## 4. Status, Badge & Label Cetak

### 4.1 Status Provinsi (`apps/web/src/lib/status.ts`, `apps/api/app/services/pdf.py`)

| Nilai API (`snake_case`) | Label UI | Pola Peta | Simbol PDF (B&W) | Keterangan Baku |
|---|---|---|---|---|
| `surplus` | `Surplus` | `solid` (`///` di PDF) | `[+]` | Produksi beras melebihi kebutuhan |
| `balanced` | `Balanced` | `garis` (`...` di PDF) | `[=]` | Produksi memenuhi 90–100% kebutuhan (kriteria swasembada FAO 1999) |
| `defisit` | `Defisit` | `titik` (`xxx` di PDF) | `[-]` | Produksi beras kurang dari 90% kebutuhan |

### 4.2 Status Versi & Aturan Validasi

| Domain | Nilai Teknis | Label UI |
|---|---|---|
| Status versi (`VERSION_STATUS_META`) | `draft` / `published` / `archived` | `Draft` / `Published` / `Archived` |
| Status aturan validasi (`VALIDATION_STYLE`) | `lulus` / `peringatan` / `gagal` | `Lulus` / `Peringatan` / `Gagal` |

---

## 5. Parameter URL & Deep-Linking

| Parameter / Hash | Halaman | Nilai Sah / Kegunaan |
|---|---|---|
| `?tahun=` | Semua halaman data | 4 digit tahun (`2025`), dikelola `useTahun` |
| `?layer=` | `/peta` | `status` (default), `produksi`, `kebutuhan` (`kepadatan` ter-gating jika `luas_km2` kosong) |
| `?prov=` | `/peta` | `kode_bps` provinsi terpilih (`"31"`, `"32"`, dst.) |
| `?status=` | `/peta`, `/analisis` | `surplus`, `balanced`, `defisit` |
| `?pulau=` | `/analisis` | Nama pulau atau daftar berkoma |
| `?q=` | `/analisis` | Kata kunci nama provinsi atau `kode_bps` |
| `?sort=` & `?order=` | `/analisis` | `provinsi`, `penduduk`, `produksi`, `kebutuhan`, `balance`, `rasio`, `peringkat` (`asc`/`desc`) |
| `?defisit=` | `/distribusi` | `kode_bps` provinsi defisit terpilih pada matriks pemasok |
| `?metric=`, `?kode_bps=`, `?tahun_a=`, `?tahun_b=` | `/tren` | Parameter histori multi-tahun (`metric`: `produksi`, `kebutuhan`, `balance`, `rasio`) |
| `#batasan` | `/data` | Target scroll langsung dari `LimitationBanner` |

---

## 6. Format Angka, Satuan & Header Ekspor

### 6.1 Pemformat Frontend (`apps/web/src/lib/format.ts`)

Seluruh nilai kosong/invalid menampilkan em-dash `"—"`. Pemisah ribuan `.` dan desimal `,` (`Intl.NumberFormat("id-ID")`):

- `formatTon(nilai, desimal = 0)` → `"34.690.959 ton"`
- `formatJiwa(nilai)` → `"5.631.760 jiwa"`
- `formatKm(nilai, desimal = 1)` → `"116,8 km"`
- `formatPersen(nilai, desimal = 1)` → `"90,0%"`
- `formatAngka(nilai, desimal = 0)` → angka terformat tanpa satuan

### 6.2 Header CSV & Excel (`apps/api/app/services/exports.py`)

CSV menggunakan encoding `UTF-8 BOM` (`\ufeff`), akhiran baris `\r\n`, desimal titik (mesin), dan tanpa pemisah ribuan:

- **Provinsi (`PROVINCE_CSV_HEADERS`):** `tahun`, `kode_bps`, `kode_kemendagri`, `provinsi`, `pulau`, `lat`, `lng`, `penduduk_jiwa`, `konsumsi_kg_kapita_tahun`, `produksi_padi_ton_gkg`, `produksi_beras_ton`, `kebutuhan_beras_ton`, `rice_balance_ton`, `rasio_swasembada`, `status`
- **Rekomendasi (`RECOMMENDATION_CSV_HEADERS`):** `urutan`, `dari_kode`, `dari`, `ke_kode`, `ke`, `ton`, `jarak_km`
- **Nama sheet Excel (`.xlsx`):** tepat 3 sheet bernama `Provinsi`, `Rekomendasi`, `Metadata`.

---

## 7. Aksi Audit Log & Kode Error API

- **9 Aksi Audit Log Kanonik (`AUDIT_ACTIONS`):** `upload`, `edit_provinsi`, `recompute`, `publish`, `rollback`, `duplicate`, `hapus_draft`, `edit_konten`, `edit_sumber`.
- **Kode Error API (`AppError`):** `INVALID_PARAMS` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `NO_PUBLISHED_VERSION` (404), `VERSION_NOT_EDITABLE` (409), `LAYER_UNAVAILABLE` (409), `FILE_TOO_LARGE` (413), `VALIDATION_FAILED` (422), `AI_UPSTREAM_ERROR` (502), `AI_UNAVAILABLE` (503), `STORAGE_UNAVAILABLE` (503).
