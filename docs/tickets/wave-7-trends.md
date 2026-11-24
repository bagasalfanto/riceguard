# Wave 7 — Fitur 7: Historical Data & Trend Monitoring (`/tren`)

Kriteria selesai PRD §5.7: diuji dengan data dummy 2 tahun di dev (seed khusus), lalu otomatis
mati bila hanya 1 tahun.

Catatan: seed 2 tahun **hanya** di dev/test, tidak pernah masuk seed produksi.

---

## T7.1 — `GET /trends`

**Blocked by:** T0.6

**Scope**
- Query: `metric=produksi|kebutuhan|balance|rasio`, `kode_bps[]` (opsional, maks 5).
- Respons: `{metric, satuan, tahun: [2024, 2025], deret: [{label, kode_bps|null, nilai: [float|null]}]}`.
- Tanpa `kode_bps` → satu deret nasional (`label: "Nasional"`), nilai = Σ per tahun published.
- Dengan `kode_bps` → satu deret per provinsi; provinsi yang tidak ada di tahun tertentu → `null`
  (bukan 0), supaya garis putus, bukan turun ke nol.
- Hanya tahun published, urut naik.
- `kode_bps` > 5 atau tidak dikenal → 400 `INVALID_PARAMS`.

**Acceptance**
- Dengan 2 tahun seed: 2 titik per deret; nasional 2025 = 34.690.959.
- `?kode_bps[]=32&kode_bps[]=31` → 2 deret.
- Provinsi yang baru ada di 2025 → nilai 2024 `null`.

**Tes:** `test_trends.py` (nasional, multi-provinsi, null untuk tahun hilang, 400 > 5).

---

## T7.2 — `GET /compare`

**Blocked by:** T7.1

**Scope**
- Query: `tahun_a`, `tahun_b` (keduanya wajib, harus published, `a < b`).
- Respons: `{tahun_a, tahun_b, items: [{kode_bps, provinsi, produksi_a, produksi_b, delta_produksi,
  delta_produksi_persen, delta_balance_ton, status_a, status_b, berubah_status: bool}],
  status_berubah: [{kode_bps, provinsi, dari, ke}]}`.
- `delta_produksi_persen` `null` bila `produksi_a = 0`.
- Tahun sama atau `a > b` → 400 `INVALID_PARAMS`.

**Acceptance**
- Dengan 2 tahun: `items` 38 baris, `status_berubah` konsisten dengan `items`.
- `tahun_a=2025&tahun_b=2025` → 400.

**Tes:** `test_compare.py`.

---

## T7.3 — Gating "butuh minimal 2 tahun"

**Blocked by:** T7.1

**Scope**
- `GET /meta/years` sudah mengirim `butuh_minimal_2_tahun` (T1.3); pastikan nilainya
  `jumlah_tahun_published < 2`.
- `GET /trends` dan `GET /compare` dengan hanya 1 tahun → **200** dengan `deret: []` /
  `items: []` + field `alasan: "butuh minimal 2 tahun data"` (bukan 404 — halaman tetap ada).
- FE: menu "Historical Trends" tidak dirender bila `butuh_minimal_2_tahun`; route `/tren` tetap bisa
  dibuka langsung dan menampilkan `EmptyState` "Butuh minimal 2 tahun data".

**Acceptance**
- Seed 1 tahun: menu hilang, `/tren` menampilkan `EmptyState`.
- Seed 2 tahun: menu muncul, grafik terisi.

**Tes:** `test_trends_gating.py` + cek manual FE.

---

## T7.4 — Halaman Tren (FE)

**Blocked by:** T7.2, T3.5

**Scope**
- `src/components/charts/TrendLineChart` (garis, `ChartContainer` tinggi tetap, sumbu satuan).
- Blok PRD §5.7: tren nasional (produksi/kebutuhan/balance), `RegionalTrendComparison`
  (pilih hingga 5 provinsi, `MultiSelect`), `HistoricalMap` (slider tahun di atas peta Wave 3),
  `YearToYearComparison` (pilih A & B → tabel Δ + daftar perubahan status).
- Pilihan tahun/provinsi di URL.

**Acceptance**
- Dengan 2 tahun seed: keempat blok terisi dan angka cocok `/compare`.
- Dengan 1 tahun: `EmptyState` saja.

**Tes:** `npm run build`, cek manual dengan seed 2 tahun.
