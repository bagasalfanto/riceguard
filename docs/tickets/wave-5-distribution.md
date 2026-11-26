---
scope: tickets/wave-5
canonical-for: ["spesifikasi tiket wave 5 distribusi"]
sources: ["docs/tickets/README.md", "docs/RiceGuard — PRD & Dokumen Teknis (FE + BE).md"]
last-verified: 2026-11-26
---

# Wave 5 — Fitur 5: Supply & Distribution Analysis (`/distribusi`)

Kriteria selesai PRD §5.5: jumlah garis = jumlah baris rekomendasi (27 untuk 2025);
jarak di matriks sama dengan `jarak_km` hasil `haversine_km` (1 desimal).

---

## T5.1 — `GET /distribution/overview`

**Blocked by:** T0.6

**Scope**
- Respons: `{tahun, version, surplus: [...], defisit: [...], ringkasan}`.
- `surplus[i]`: `{kode_bps, provinsi, pulau, rice_balance_ton (surplus), terpakai_ton, sisa_ton}` —
  `terpakai_ton` = Σ `ton` rekomendasi dengan `dari_kode` = kode itu; `sisa_ton` = surplus − terpakai.
- `defisit[i]`: `{kode_bps, provinsi, pulau, rice_balance_ton (negatif), defisit_ton, terpenuhi_ton,
  persen_terpenuhi, prioritas}` — `prioritas` = urutan defisit terbesar (1 = terbesar), sama dengan
  urutan yang dipakai algoritma.
- `ringkasan`: `total_surplus_ton`, `total_terpakai_ton`, `total_sisa_ton`, `total_defisit_ton`,
  `total_terpenuhi_ton`, `persen_defisit_tertutup`, `jumlah_pasangan`.
- Provinsi `balanced` **tidak muncul** di kedua daftar.

**Acceptance**
- 17 surplus, 20 defisit, 27 pasangan, total terpakai 2.889.188,00, sisa surplus 9.921.467,00
  (12.810.655 − 2.889.188), persen tertutup 100.
- Prioritas 1 = DKI Jakarta? **Tidak** — cek: defisit terbesar 2025 adalah DKI Jakarta 863.504,32;
  verifikasi terhadap CSV, jangan menebak.

**Tes:** `test_distribution_overview.py` (jumlah, total, sisa, prioritas monoton).

---

## T5.2 — `GET /distribution/suppliers/{kode_bps}`

**Blocked by:** T5.1

**Scope**
- Untuk satu provinsi defisit: daftar **semua** provinsi surplus, urut jarak naik
  (`jarak_km` 1 desimal dari `haversine_km`), dengan `surplus_ton`, `terpakai_ton`, `sisa_ton`,
  `jarak_km`, `satu_pulau: bool`, `dipakai_di_rekomendasi: bool`.
- Provinsi surplus sendiri atau balanced → 400 `INVALID_PARAMS` dengan
  `details.alasan: "bukan provinsi defisit"`.

**Acceptance**
- `/suppliers/31` → 17 baris, baris pertama Jawa Barat 116,8 km.
- Jarak identik dengan kolom `jarak_km` di `rekomendasi_distribusi_v1.csv` untuk pasangan yang sama.
- `/suppliers/32` → 400.

**Tes:** `test_suppliers.py` (jarak vs CSV, 400 untuk surplus, 404 untuk kode tak dikenal).

---

## T5.3 — `GET /distribution/distance-matrix`

**Blocked by:** T5.2

**Scope**
- Matriks `defisit × surplus`: `{tahun, baris: [kode defisit], kolom: [kode surplus],
  jarak_km: [[float, ...], ...], satuan: "km"}`.
- Dihitung dari `provinces.lat/lng` memakai `riceguard_calc.matching.haversine_km`
  (**bukan** rumus baru), dibulatkan 1 desimal.
- Urutan baris = prioritas defisit; urutan kolom = surplus terbesar.

**Acceptance**
- Dimensi 20 × 17.
- Setiap sel yang muncul sebagai pasangan di rekomendasi resmi = `jarak_km` CSV.
- Simetris terhadap matriks transpos bila dihitung untuk peran tertukar.

**Tes:** `test_distance_matrix.py`.

---

## T5.4 — Halaman Distribusi (FE)

**Blocked by:** T5.1, T5.2, T5.3, T3.4

**Scope**
- `src/features/distribution/`:
  - `SurplusTable` (surplus, terpakai, sisa) dan `DeficitTable` (defisit, rasio, prioritas).
  - `SupplyDemandMap`: `FlowLines` dari centroid ke centroid, tebal 2–10 px ∝ √ton, panah arah
    (dekorator/penanda), klik garis → `Sheet` detail.
  - `DistanceMatrix`: heatmap ringan + `Select` provinsi defisit → tabel pemasok terurut jarak.
  - `ConnectivityPanel`: tandai satu pulau / lintas pulau (dari `satu_pulau`).
- Label UI: "Alur alokasi" dan "jarak garis lurus". **Kata "rute" tidak dipakai.**
- `Banner` batasan klaim di atas halaman.

**Acceptance**
- 27 garis di peta.
- Jarak di matriks = API (1 desimal).
- Tidak ada string "rute" (`grep -ri rute src/` kosong).

**Tes:** `npm run build`, cek manual + grep.
