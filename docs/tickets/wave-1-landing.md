---
scope: tickets/wave-1
canonical-for: ["spesifikasi tiket wave 1 landing"]
sources: ["docs/tickets/README.md", "docs/RiceGuard — PRD & Dokumen Teknis (FE + BE).md"]
last-verified: 2026-11-26
---

# Wave 1 — Fitur 1: Landing & General Information (`/`)

Kriteria selesai PRD §5.1: 3 angka hero sama persis dengan Dashboard untuk tahun yang sama;
semua teks dari `site_content`; Lighthouse mobile Performance ≥ 85, Accessibility ≥ 90.

---

## T1.1 — `GET /summary` (agregat nasional)

**Blocked by:** T0.6, T0.8

**Scope**
- `app/schemas/summary.py`: `SummaryResponse` — `tahun`, `version{id, version_no}`, `produksi_beras_ton`,
  `kebutuhan_beras_ton`, `rice_balance_ton`, `rasio_swasembada`, `jumlah_status{surplus, balanced, defisit}`,
  `total_dialokasikan_ton`, `delta_tahun_sebelumnya: null | {...}`.
- `app/services/summary.py`: baca `dataset_versions.summary` (jsonb) — **jangan** agregasi ulang di request
  (PRD §9). Kalau `summary` kosong → hitung dari `province_stats` lalu simpan.
- Router `public/summary.py`: `GET /summary?tahun=`.
- `rasio_swasembada` nasional = total produksi / total kebutuhan, 4 desimal.

**Acceptance**
- 2025: 34.690.959 / 24.819.269 / +9.871.690 / 17·1·20 / 2.889.188,00.
- `delta_tahun_sebelumnya` = `null` selama hanya 1 tahun published (delta diisi di T2.1).
- `?tahun=2019` → 404 `NO_PUBLISHED_VERSION`.

**Tes:** `test_summary.py` (angka, `delta` null, 404).

---

## T1.2 — `GET /sources` dan `GET /content`

**Blocked by:** T0.6, T0.8

**Scope**
- `GET /sources` → `[{id, key, nama, instansi, tabel_resmi, tahun, diperbarui, url}]` dari `data_sources`,
  urut `id`.
- `GET /content?keys[]=` → `[{key, title, body_md, updated_at}]`. Tanpa `keys` → semua blok.
  Key tak dikenal diabaikan, bukan error.
- Cache per `(endpoint, version_id=null)` — konten tidak diversikan, jadi cache dikosongkan saat
  konten disimpan (T10.7 memanggil `cache.clear_all()`).

**Acceptance**
- 4 sumber, 6 blok konten setelah seed.
- `?keys=about` → tepat 1 item.
- `PUT /admin/content/about` lalu `GET /content?keys=about` langsung berubah (< 1 s).

**Tes:** `test_content.py`, `test_sources.py`.

---

## T1.3 — Endpoint pendukung pemilih tahun

**Blocked by:** T1.1

**Scope**
- `GET /meta/years` (sudah ada di T0.7) ditambah field `jumlah_tahun` dan
  `butuh_minimal_2_tahun: bool` untuk gating menu Tren (PRD §5.7).
- `GET /summary` menerima `version_id` (dihormati hanya untuk admin) — pakai `resolve_for_read` T0.5.

**Acceptance**
- Dengan 1 tahun: `butuh_minimal_2_tahun = true`, `jumlah_tahun = 1`.
- Request publik dengan `version_id` versi draft → parameter diabaikan, tetap versi published.

**Tes:** `test_meta.py` (tambahan).

---

## T1.4 — Halaman Landing (FE)

**Blocked by:** T1.1, T1.2, T0.9

**Scope**
- `src/features/landing/`: `Hero` (judul + 1 kalimat masalah + 3 angka dari `/summary` +
  tombol "Buka Dashboard"/"Lihat Peta"), `About`, `Sdg2`, `HowItWorks` (4 langkah), `DataSources`,
  `Limitations` (`Alert`).
- Semua teks dari `/content`; kalau key kosong → render `null` (jangan hardcode teks).
- Angka lewat `formatTon` / `formatJiwa`.
- State: `Skeleton` saat loading, `Alert` destruktif + "Coba lagi" saat error.

**Acceptance**
- 3 angka hero identik dengan `/dashboard` untuk tahun yang sama (cek manual + snapshot).
- Tidak ada string copy hardcode di komponen.
- Lighthouse mobile: Perf ≥ 85, A11y ≥ 90.

**Tes:** `npm run build`, Lighthouse manual, satu test Playwright opsional (bila Playwright dipasang).
