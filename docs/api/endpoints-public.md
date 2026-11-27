---
scope: api/endpoints-public
canonical-for: ["spesifikasi endpoint publik REST API"]
sources: ["apps/api/app/main.py", "apps/api/app/routers/public/", "apps/api/app/schemas/"]
last-verified: 2026-11-26
---

# Endpoint Publik (`/api/v1/*`)

> Berkas kanonik seluruh endpoint publik tanpa wajib login. Konvensi global (`tahun`, `version_id` admin preview, cache, format error) ada di `README.md`.

## 1. Ringkasan Endpoint Publik

| Method & Path | Query / Body Utama | Respons Utama | Router Sumber |
|---|---|---|---|
| `GET /health` | — | `{"status": "ok"}` | `main.py` |
| `GET /api/v1/meta/years` | — | `MetaYears` | `public/meta.py` |
| `GET /api/v1/summary` | `tahun?`, `version_id?` | `SummaryResponse` | `public/summary.py` |
| `GET /api/v1/sources` | — | `list[SourceItem]` | `public/content.py` |
| `GET /api/v1/content` | `keys?` | `list[ContentItem]` | `public/content.py` |
| `GET /api/v1/provinces` | `tahun?`, `version_id?`, `status?`, `pulau?`, `q?`, `sort?`, `order?`, `fields?`, `limit?`, `offset?` | `ProvincesResponse` | `public/provinces.py` |
| `GET /api/v1/provinces/{kode_bps}` | `tahun?`, `version_id?` | `ProvinceDetailResponse` | `public/provinces.py` |
| `GET /api/v1/rankings` | `by?`, `tahun?`, `version_id?`, `limit?` | `RankingsResponse` | `public/provinces.py` |
| `GET /api/v1/map/layers` | `layer?`, `tahun?`, `version_id?` | `MapLayerResponse` | `public/map_layers.py` |
| `GET /api/v1/distribution/overview` | `tahun?`, `version_id?` | `DistributionOverviewResponse` | `public/distribution.py` |
| `GET /api/v1/distribution/suppliers/{kode_bps}` | `tahun?`, `version_id?` | `DistributionSuppliersResponse` | `public/distribution.py` |
| `GET /api/v1/distribution/distance-matrix` | `tahun?`, `version_id?` | `DistanceMatrixResponse` | `public/distribution.py` |
| `GET /api/v1/recommendations` | `tahun?`, `version_id?`, `dari_kode?`, `ke_kode?` | `RecommendationsResponse` | `public/recommendations.py` |
| `POST /api/v1/recommendations/simulate` | `version_id?` + JSON `SimulationRequest` | `SimulationResponse` | `public/recommendations.py` |
| `GET /api/v1/rice-balance` | `tahun?`, `version_id?` | `RiceBalanceResponse` | `public/rice_balance.py` |
| `GET /api/v1/trends` | `metric?`, `kode_bps?` | `TrendsResponse` | `public/trends.py` |
| `GET /api/v1/compare` | `tahun_a?`, `tahun_b?` | `CompareResponse` | `public/trends.py` |
| `GET /api/v1/validation` | `tahun?`, `version_id?` | `ValidationResponse` | `public/data_exports.py` |
| `GET /api/v1/exports/provinces.csv` | `tahun?`, `version_id?` | `text/csv; charset=utf-8` (BOM) | `public/data_exports.py` |
| `GET /api/v1/exports/recommendations.csv` | `tahun?`, `version_id?` | `text/csv; charset=utf-8` (BOM) | `public/data_exports.py` |
| `GET /api/v1/exports/provinces.xlsx` | `tahun?`, `version_id?` | Excel `.xlsx` (sheet aktif `Provinsi`) | `public/data_exports.py` |
| `GET /api/v1/exports/recommendations.xlsx` | `tahun?`, `version_id?` | Excel `.xlsx` (sheet aktif `Rekomendasi`) | `public/data_exports.py` |
| `GET /api/v1/exports/raw/{nama_file}` | `tahun?` (published only) | Binary raw file allowlisted | `public/data_exports.py` |
| `GET /api/v1/reports/{jenis}.pdf` | `tahun?`, `kode_bps?`, `version_id?` | `application/pdf` A4 portrait | `public/reports.py` |
| `GET /api/v1/forecast` | `tahun?`, `version_id?` | `ForecastResponse` | `public/forecast.py` |

## 2. Meta, Ringkasan & Konten

### `GET /api/v1/meta/years`

Mengembalikan daftar tahun yang memiliki versi `published` terurut naik:
`{ "tahun": [{ "tahun", "version_id", "version_no", "published_at" }], "jumlah_tahun": int, "butuh_minimal_2_tahun": bool, "tahun_terbaru": int | null }`.

### `GET /api/v1/summary`

Agregat nasional dari `dataset_versions.summary` (atau dihitung ulang otomatis bila kosong):
`{ "tahun", "version": { "id", "version_no" }, "produksi_beras_ton", "kebutuhan_beras_ton", "rice_balance_ton", "rasio_swasembada", "jumlah_status": { "surplus", "balanced", "defisit" }, "total_dialokasikan_ton", "delta_tahun_sebelumnya": { "tahun", "produksi_persen", "kebutuhan_persen", "balance_ton", "balance_persen" } | null, "pulau_breakdown": [{ "pulau", "produksi_beras_ton", "kebutuhan_beras_ton", "porsi_produksi", "porsi_kebutuhan", "jumlah_provinsi" }] }`.
`delta_tahun_sebelumnya` bernilai `null` jika tidak ada versi `published` pada `tahun - 1`.

### `GET /api/v1/sources` & `GET /api/v1/content`

- `GET /sources`: daftar `SourceItem` (`id`, `key`, `nama`, `instansi`, `tabel_resmi`, `tahun`, `diperbarui`, `url`) urut `id`.
- `GET /content`: menerima `?keys=about&keys=sdg2` atau `?keys=about,sdg2`. Tanpa `keys`, mengembalikan seluruh blok. Key tak dikenal diabaikan.

## 3. Provinsi, Peringkat, Neraca & Peta

### `GET /api/v1/provinces` & `GET /api/v1/provinces/{kode_bps}`

- **Query filter `/provinces`:**
  - `status`: tunggal atau berkoma (`surplus`, `balanced`, `defisit`) — nilai asing membalas `400 INVALID_PARAMS`.
  - `pulau`: tunggal atau berkoma (nama pulau resmi).
  - `q`: pencarian case-insensitive pada `Province.nama` maupun `kode_bps`.
  - `sort`: `produksi | kebutuhan | balance | rasio | peringkat | penduduk | provinsi` (default `provinsi`). `peringkat` mengurutkan `rasio_swasembada` desc.
  - `order`: `asc | desc` (default `asc` untuk `provinsi`, `desc` untuk numerik).
  - `fields`: daftar field `ProvinceItem` dipisah koma untuk proyeksi JSON ringkas.
  - `limit`: `1..500` (default `100`), `offset`: `>= 0` (default `0`).
- **`GET /provinces/{kode_bps}`:** mengembalikan seluruh kolom `ProvinceItem` + `version`, `perhitungan` (`kebutuhan`, `balance`, `rasio`, `klasifikasi`), `rekomendasi_terkait` (list pemasok jika `defisit`, list penerima jika `surplus`, atau `[]` dengan `catatan` jika `balanced`), dan `riwayat[]` lintas seluruh tahun `published`. Kode tak ditemukan → `404 NOT_FOUND`.

### `GET /api/v1/rankings` & `GET /api/v1/rice-balance`

- `GET /rankings`: `by` dalam `produksi | kebutuhan | surplus | defisit | balance` (default `produksi`), `limit` dipotong ke `1..38` (default `5`). Mengembalikan `{ "by", "tahun", "items": [{ "peringkat", "kode_bps", "provinsi", "nilai" }] }`.
- `GET /rice-balance`: mengembalikan agregat nasional (sama dengan `/summary`) dan 38 baris provinsi terurut `rice_balance_ton` menurun (`{ "tahun", "version", "nasional", "items" }`).

### `GET /api/v1/map/layers`

- Parameter `layer` dalam `status | produksi | kebutuhan | kepadatan` (default `status`).
- `status`: mengembalikan `values[kode_bps] = "surplus" | "balanced" | "defisit"` dan 3 kelas tetap lengkap dengan `color_token` (`--status-surplus`, `--status-balanced`, `--status-defisit`) dan `pola` (`solid`, `garis`, `titik`).
- `produksi` & `kebutuhan`: mengembalikan hingga 5 kelas kuantil (`--seq-1`..`--seq-5`), `min`, `max`, `satuan: "ton"`.
- `kepadatan`: jika seluruh `provinces.luas_km2` kosong, membalas `409 LAYER_UNAVAILABLE` (`details.alasan = "luas_km2 belum tersedia"`); jika terisi sebagian, kode tanpa luas bernilai `null` dan dicatat di `details.kode_tanpa_luas`.

## 4. Distribusi, Rekomendasi & Simulasi

### `GET /api/v1/distribution/*`

- **`GET /distribution/overview`:** mengembalikan `{ tahun, version, surplus[], defisit[], ringkasan }` (provinsi `balanced` tidak disertakan). Item `surplus` memuat `rice_balance_ton`, `terpakai_ton`, `sisa_ton`; item `defisit` memuat `defisit_ton`, `rasio_swasembada`, `terpenuhi_ton`, `persen_terpenuhi`, `prioritas` (1 = defisit terbesar).
- **`GET /distribution/suppliers/{kode_bps}`:** mengembalikan seluruh kandidat provinsi surplus terurut jarak garis lurus terpendek untuk satu provinsi `defisit`. Bila target berstatus `surplus` atau `balanced` → `400 INVALID_PARAMS` (`details.alasan = "bukan provinsi defisit"`).
- **`GET /distribution/distance-matrix`:** mengembalikan matriks jarak haversine (`1` desimal, `satuan: "km"`) berukuran `defisit × surplus` (`baris[]` kode defisit urut prioritas, `kolom[]` kode surplus urut balance menurun).

### `GET /api/v1/recommendations` & `POST /api/v1/recommendations/simulate`

- **`GET /recommendations`:** mendukung filter opsional `dari_kode` dan `ke_kode`. Mengembalikan `ringkasan` (`total_dialokasikan_ton`, `persen_defisit_tertutup`, `jumlah_pasangan`, `rata_jarak_tertimbang_ton`, `total_ton_km`) dan `items[]` (`urutan`, `dari_kode`, `dari`, `ke_kode`, `ke`, `ton`, `jarak_km`, `persen_kebutuhan_penerima`, `satu_pulau`, `explanation`).
- **`POST /recommendations/simulate`:** menghitung skenario on-the-fly **tanpa menulis DB maupun cache**. Body JSON `SimulationRequest`:
  - `tahun?: int | null`
  - `ambang_swasembada: float` (`0.80..1.00`, default `0.90`)
  - `persen_surplus_dilepas: float` (`10.0..100.0`, default `100.0`)
  - `jarak_maks_km?: float | null` (`100.0..4000.0`, default `null`)
  - `kecualikan_pemasok: str[]`, `kecualikan_penerima: str[]`
  - `perubahan_produksi: dict[str, float]` (tiap nilai `-50.0..50.0`)
  - `perubahan_konsumsi_persen: float` (`-20.0..20.0`, default `0.0`)
  - `mode: str` (default `"greedy_v1"`; `"optimal"` ditolak `400 INVALID_PARAMS` dengan `details.alasan = "mode optimal belum diimplementasikan"`)
  - Mengembalikan `rekomendasi[]`, `provinsi[]`, `ringkasan`, dan `banding_resmi` (`delta_ton`, `delta_ton_km`, `status_berubah[]`, `defisit_tidak_tertutup[]`).

## 5. Tren, Validasi, Ekspor, PDF & Forecast

### `GET /api/v1/trends` & `GET /api/v1/compare`

- **`GET /trends`:** query `metric` (`produksi|kebutuhan|balance|rasio`) dan `kode_bps` (maksimal 5 kode; mendukung `?kode_bps=32&kode_bps=31`, `?kode_bps[]=32`, atau koma). Jika tahun `published < 2`, tetap membalas `200` dengan `butuh_minimal_2_tahun: true`, `alasan: "butuh minimal 2 tahun data"`, `deret: []`.
- **`GET /compare`:** query `tahun_a` dan `tahun_b` (`tahun_a < tahun_b`, wajib diisi keduanya atau dikosongkan keduanya bila tahun `published >= 2`). Bila tahun `published < 2` dan parameter kosong, membalas `200` gating (`butuh_minimal_2_tahun: true`).

### `GET /api/v1/validation`, Ekspor & Laporan PDF

- **`GET /validation`:** mengembalikan metadata versi (`tahun`, `version_no`, `version_id`, `published_at`, `published_by_nama`, `notes`), `lulus`, `diperiksa_pada`, 5 item `aturan`, serta `source_files`.
- **CSV & Excel (`/exports/*`):** header CSV identik `dataset_v1.csv` / `rekomendasi_distribusi_v1.csv`; `.xlsx` memiliki 3 sheet (`Provinsi`, `Rekomendasi`, `Metadata`).
- **Raw file (`/exports/raw/{nama_file}`):** hanya mengizinkan berkas milik versi `published` yang terdaftar pada allowlist `source_files` (menolak path traversal atau draft dengan `404 NOT_FOUND`). Membutuhkan `SUPABASE_SERVICE_ROLE_KEY` (`503 STORAGE_UNAVAILABLE` jika belum diatur).
- **Laporan PDF (`/reports/{jenis}.pdf`):** `jenis` dalam `nasional | provinsi | surplus-defisit | rekomendasi`. `provinsi` mewajibkan `?kode_bps=`. Menghasilkan `application/pdf` A4 portrait dengan metadata versi/sumber/batasan/tanggal cetak dan pola ramah cetak hitam-putih, atau `503 PDF_UNAVAILABLE` bila Pango tidak terpasang di server.

### `GET /api/v1/forecast`

- Jika `AI_ENDPOINT_URL` kosong → `503 AI_UNAVAILABLE` (`details.alasan = "endpoint model belum dikonfigurasi"`).
- Mengirim payload fitur 38 provinsi versi `published` (atau versi published terbaru saat `tahun` target melebihi tahun published terbaru) ke `AI_ENDPOINT_URL` via `httpx`.
- Kegagalan upstream / timeout / JSON invalid → `502 AI_UPSTREAM_ERROR` tanpa membocorkan token. Kode resmi yang tidak dikembalikan model dicatat di `details.kode_tanpa_prediksi`.
