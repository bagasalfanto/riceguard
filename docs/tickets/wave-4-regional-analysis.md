---
scope: tickets/wave-4
canonical-for: ["spesifikasi tiket wave 4 analisis wilayah"]
sources: ["docs/tickets/README.md", "docs/RiceGuard — PRD & Dokumen Teknis (FE + BE).md"]
last-verified: 2026-11-26
---

# Wave 4 — Fitur 4: Regional Analysis (`/analisis`, `/analisis/:kode`)

Kriteria selesai PRD §5.4: angka di rumus terisi sama dengan kolom dataset (kebutuhan dibulatkan
ke ton); kode tidak valid → 404.

---

## T4.1 — Filter, sort, dan pencarian lanjutan di `/provinces`

**Blocked by:** T2.2

**Scope**
- Tambah `pulau` multi-nilai (`?pulau=Jawa,Sumatera`) dan `status` multi-nilai.
- Tambah `sort=peringkat` (alias: urut `rasio_swasembada` desc) dan `fields` (proyeksi kolom)
  supaya tabel analisis bisa meminta subset.
- `q` mencari di `provinsi` **dan** `kode_bps` (ketik `31` → DKI Jakarta).

**Acceptance**
- `?pulau=Jawa,Bali & Nusa Tenggara` → 9 baris (6 Jawa + 3 Bali & NT), dicek ke dataset.
- `?q=31` → DKI Jakarta.
- `fields=kode_bps,provinsi,status` → hanya 3 kunci + `tahun`/`version`/`total`.

**Tes:** `test_provinces_filters.py`.

---

## T4.2 — `GET /provinces/{kode_bps}` (detail + rumus terisi)

**Blocked by:** T0.6, T6.3

**Scope** — bentuk respons persis contoh PRD §10 baris 646–669:
- `tahun`, `version{id, version_no}`, semua kolom dataset provinsi itu.
- `perhitungan`: array langkah dengan `langkah`, `rumus`, `hasil`:
  1. `kebutuhan` — `"penduduk × konsumsi / 1000"` — hasil = `kebutuhan_beras_ton` (2 desimal).
  2. `balance` — `"produksi beras − kebutuhan"` — hasil = `rice_balance_ton`.
  3. `rasio` — `"produksi beras / kebutuhan"` — hasil = `rasio_swasembada`.
  4. `klasifikasi` — `rumus` berisi ambang (0,90 / 1,00) + `hasil` = `status`.
- `rekomendasi_terkait`: kalau defisit → baris yang `ke_kode` = kode ini; kalau surplus →
  baris yang `dari_kode` = kode ini; kalau balanced → `[]` + `catatan: "tidak ikut matching"`.
- `riwayat`: semua tahun published yang punya provinsi ini, urut tahun naik
  (`tahun, produksi_beras_ton, kebutuhan_beras_ton, rice_balance_ton, status`).
- Kode tidak ada di versi itu → 404 `NOT_FOUND` dengan `details.kode_bps`.

**Acceptance**
- `/provinces/31?tahun=2025` cocok persis contoh PRD (kecuali `version.id`).
- `/provinces/32` → `rekomendasi_terkait` berisi 3+ baris dengan `dari_kode=32`.
- `/provinces/61` (Kalimantan Barat) → `status=balanced`, `rekomendasi_terkait=[]`, ada `catatan`.

**Tes:** `test_province_detail.py` (4 status + 404 + `riwayat`).

---

## T4.3 — Konsistensi pembulatan di seluruh API

**Blocked by:** T4.2

**Scope**
- `app/core/rounding.py`: `bulatkan_ton(x)` → 2 desimal; dipakai semua respons ton.
  Jangan membulatkan `rasio_swasembada` (4 desimal dari DB).
- Uji: Σ nilai yang dikirim per provinsi = nilai di `summary` (≤ 1 ton).

**Acceptance**
- Tidak ada angka `float` dengan > 2 desimal di field `*_ton`.
- Σ 38 `produksi_beras_ton` = `summary.produksi_beras_ton` (± 1).

**Tes:** `test_rounding.py` + `test_consistency.py`.

---

## T4.4 — Halaman daftar Analisis (FE)

**Blocked by:** T4.1

**Scope**
- `TanStack Table` + `src/features/analysis/`: kolom PRD §5.4 (peringkat, provinsi, pulau, penduduk,
  konsumsi/kapita, produksi, kebutuhan, balance, rasio, `StatusBadge`).
- Sort per kolom lewat API (`sort`/`order`), filter `Select` status & pulau, input cari (debounce 300 ms).
- Tab "Regional Ranking": pilih `by=produksi|kebutuhan|balance` → panggil `/rankings?limit=38`.
- Filter disimpan di URL (`?status=&pulau=&sort=&q=`).
- Baris diklik → `/analisis/:kode`.

**Acceptance**
- 38 baris; sort & filter sesuai API (bukan sort di klien).
- Reload halaman mempertahankan filter dari URL.
- Di 375 px tabel bisa di-scroll horizontal tanpa memotong kolom status.

**Tes:** `npm run build`, cek manual.

---

## T4.5 — Halaman detail provinsi (FE)

**Blocked by:** T4.2, T4.4

**Scope**
- Header: nama, pulau, `StatusBadge`, `Progress` rasio dengan garis penanda 0,90 dan 1,00.
- Blok: Production, Consumption, `RiceDemandCalculation` (rumus terisi dari `perhitungan`),
  `RiceBalanceCalculation` (+ alasan klasifikasi).
- Distribusi terkait: tabel pemasok (defisit) / penerima (surplus) / teks "tidak ikut matching".
- Peta mini dengan provinsi di-highlight (`?prov=` → `ProvinceLayer`).
- `Historical Comparison` hanya bila `riwayat.length ≥ 2`.
- Kode invalid → halaman 404 + link kembali ke `/analisis`.

**Acceptance**
- Angka rumus terisi identik dengan tabel.
- Kalimantan Barat menampilkan badge `Balanced` walau balance negatif.
- `/analisis/99` → 404 dengan link kembali.

**Tes:** `npm run build`, cek manual 2 provinsi + 1 kode invalid.
