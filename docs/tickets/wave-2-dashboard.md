# Wave 2 — Fitur 2: Main Dashboard (`/dashboard`)

Kriteria selesai PRD §5.2: total kartu = jumlah 38 baris (≤ 1 ton selisih); Kalimantan Barat
tampil `balanced`; grafik terbaca di 375 px.

---

## T2.1 — Delta tahun-sebelumnya di `/summary`

**Blocked by:** T1.1

**Scope**
- `app/services/summary.py`: `delta_tahun_sebelumnya` = `{tahun, produksi_persen, kebutuhan_persen,
  balance_ton, balance_persen}` dibanding tahun published terdekat **di bawah** tahun ini.
- `null` kalau tidak ada tahun sebelumnya atau tahun sebelumnya tidak berurutan (`tahun - 1`).
- Pembagian nol → persen `null`, bukan `Infinity`.

**Acceptance**
- Dengan seed 2 tahun dummy (2024, 2025): delta terisi dan cocok dengan hitungan manual.
- Dengan 1 tahun: `null`.

**Tes:** `test_summary_delta.py` (fixture 2 tahun).

---

## T2.2 — `GET /provinces` (daftar)

**Blocked by:** T0.6

**Scope**
- Query: `tahun`, `status` (surplus|balanced|defisit, boleh berkoma), `pulau`, `q` (cari nama, case-insensitive),
  `sort` (`produksi|kebutuhan|balance|rasio|penduduk|provinsi`), `order` (`asc|desc`, default `asc` untuk
  nama, `desc` untuk numerik), `limit`, `offset`.
- Respons: `{tahun, version, items: [...semua kolom dataset...], total}`.
  Kolom = PRD §3 tabel "Output" persis, termasuk `tahun, kode_bps, kode_kemendagri, provinsi, pulau,
  lat, lng, penduduk_jiwa, konsumsi_kg_kapita_tahun, produksi_padi_ton_gkg, produksi_beras_ton,
  kebutuhan_beras_ton, rice_balance_ton, rasio_swasembada, status`.
- `status` dikirim huruf kecil apa adanya.
- Nilai enum tidak valid → 400 `INVALID_PARAMS`.
- `sort` tidak dikenal → 400, bukan diam-diam diabaikan.

**Acceptance**
- `?status=defisit` → 20 baris; `?status=balanced` → 1 (Kalimantan Barat, `rice_balance_ton` negatif).
- `?pulau=Papua` → 6 baris.
- `?q=jakarta` → DKI Jakarta.
- `?sort=balance&order=desc` → baris pertama Jawa Timur (2.426.819,33 — dicek ke `dataset_v1.csv`).

**Tes:** `test_provinces_list.py` (filter, sort, q, 400 untuk sort invalid, pagination).

---

## T2.3 — `GET /rankings`

**Blocked by:** T2.2

**Scope**
- `?by=produksi|kebutuhan|surplus|defisit&limit=5&tahun=`.
- `surplus` = urut `rice_balance_ton` desc, hanya `status='surplus'`.
- `defisit` = urut `rice_balance_ton` asc, hanya `status='defisit'`.
- Respons: `{by, tahun, items: [{peringkat, kode_bps, provinsi, nilai}]}`.

**Acceptance**
- `by=produksi&limit=5` → Jawa Timur, Jawa Barat, Jawa Tengah, Sulawesi Selatan,
  Sumatera Selatan (urut turun, dicek terhadap `dataset_v1.csv`).
- `limit` > 38 dipotong jadi 38, tidak error.

**Tes:** `test_rankings.py`.

---

## T2.4 — Rincian per pulau di `/summary`

**Blocked by:** T1.1

**Scope**
- Tambah `pulau_breakdown` ke respons `/summary`:
  `[{pulau, produksi_beras_ton, kebutuhan_beras_ton, porsi_produksi, porsi_kebutuhan, jumlah_provinsi}]`
  untuk 7 pulau PRD §3, urut `produksi_beras_ton` desc.
- Dihitung di service dari `province_stats`, disimpan di `summary` jsonb saat compute/seed supaya
  FE, PDF, dan grafik memakai angka yang sama.

**Acceptance**
- Jumlah `porsi_produksi` = 1,0000 (± 0,0001).
- Jawa = 5 provinsi (Banten, DKI Jakarta, Jawa Barat, Jawa Tengah, Jawa Timur, DI Yogyakarta → **6**);
  dicek terhadap dataset, bukan ditebak.

**Tes:** `test_summary_pulau.py`.

---

## T2.5 — Halaman Dashboard (FE)

**Blocked by:** T2.1, T2.2, T2.3, T2.4

**Scope**
- 4 kartu KPI (PRD §5.2A) + perubahan % bila `delta` tidak `null`. Kartu status → link
  `/analisis?status=...`.
- `src/components/charts/`: `ProdVsDemandChart` (bar berpasangan, 38 provinsi, urut produksi turun,
  scroll horizontal < 768 px), `BalanceBarChart` (divergen, warna dari `status`), `IslandShareChart`
  (bar bertumpuk 100%, 7 pulau, tooltip kontribusi provinsi).
- Top-5 lists (PRD §5.2C), tiap baris link ke `/analisis/:kode`.
- `ChartContainer` tinggi tetap + `accessibilityLayer` + tooltip `id-ID` + satuan di sumbu.
- Query key `['summary', tahun]`, `['provinces', tahun]`, `['rankings', by, tahun]`.

**Acceptance**
- Σ kartu = Σ 38 baris (≤ 1 ton).
- Kalimantan Barat `balanced` di ketiga grafik.
- Terbaca di 375 px.
- Tidak ada rumus di FE (semua angka dari API).

**Tes:** `npm run build`, cek manual 3 lebar.
