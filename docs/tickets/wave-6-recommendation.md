---
scope: tickets/wave-6
canonical-for: ["spesifikasi tiket wave 6 rekomendasi & simulasi"]
sources: ["docs/tickets/README.md", "docs/RiceGuard — PRD & Dokumen Teknis (FE + BE).md"]
last-verified: 2026-11-26
---

# Wave 6 — Fitur 6: Smart Distribution Recommendation + Simulasi

Kriteria selesai PRD §5.6: simulasi default **identik** dengan rekomendasi resmi; respons < 1 s;
hasil tidak pernah melebihi sisa surplus/defisit (4 tes P5 tetap lulus); label "rekomendasi
potensial, bukan rencana logistik" selalu tampil.

Wave ini harus selesai **sebelum** T5.1 kalau T5.1 ingin menghitung `terpakai` dari parameter
default — secara praktis T6.1 dikerjakan paralel dengan Wave 5.

---

## T6.1 — Parameter simulasi di `riceguard_calc.matching`

**Blocked by:** T0.3

**Scope**
- `MatchParams` (dataclass / TypedDict): `ambang_swasembada=0.90`, `persen_surplus_dilepas=100`,
  `jarak_maks_km=None`, `kecualikan_pemasok=()`, `kecualikan_penerima=()`,
  `perubahan_produksi={}`, `perubahan_konsumsi_persen=0`.
- `match(provinsi, params=None)`:
  1. Terapkan `perubahan_produksi` (persen per kode) dan `perubahan_konsumsi_persen` ke
     `produksi_beras_ton` / `konsumsi_kg_kapita_tahun`, lalu hitung ulang `kebutuhan`, `balance`,
     `rasio`, `status` dengan `ambang_swasembada`.
  2. Surplus tersedia = `balance × persen_surplus_dilepas/100`.
  3. Buang pemasok/penerima yang dikecualikan; lewati pasangan dengan `jarak > jarak_maks_km`.
  4. Jalankan greedy v1 seperti sekarang.
- **Jangan** mengubah `matching.py` lama di `dataset/` — CLI tetap memanggil `params=None`.

**Acceptance**
- `params=None` dan `MatchParams()` menghasilkan output identik v1 (27 baris, byte-identik CSV).
- `persen_surplus_dilepas=80` mengurangi total teralokasi sesuai hitungan manual.
- `jarak_maks_km=200` membuang pasangan > 200 km.
- 4 tes P5 lama lulus tanpa perubahan.

**Tes:** `test_matching_params.py`: regresi default, persen, jarak maks, exclusion,
perubahan produksi (satu provinsi gagal panen), perubahan konsumsi, `ambang_swasembada=0.8` mengubah status.

---

## T6.2 — `explain.py` (kalimat penjelasan)

**Blocked by:** T6.1

**Scope**
- `app/services/explain.py`: template PRD §12 baris 846, tanpa AI:
  `"{dari} dipilih untuk {ke} karena merupakan provinsi surplus ke-{n} terdekat ({jarak} km) dengan
  sisa surplus {sisa} ton saat giliran {ke}. Alokasi {ton} ton menutup {persen}% defisit {ke}."`
- `n` = peringkat jarak pemasok itu di antara kandidat surplus untuk penerima tersebut.
- `sisa` = sisa surplus **sebelum** alokasi ini.
- `persen` = `ton / defisit_penerima × 100`, 1 desimal.
- Format angka `id-ID` (titik ribuan, koma desimal), satuan selalu ditulis.

**Acceptance**
- 27 kalimat terisi setelah seed diulang/`recompute`; tidak ada `{}` atau `None` di teks.
- Kalimat baris 1 cocok dengan angka: Jawa Barat → DKI Jakarta, 116,8 km, 863.504,32 ton, 100%.

**Tes:** `test_explain.py` (regenerasi untuk semua baris, cek substring kunci + tidak ada placeholder).

---

## T6.3 — `GET /recommendations`

**Blocked by:** T6.1, T6.2, T0.8

**Scope**
- Respons: `{tahun, version, ringkasan, items: [...]}`.
- `ringkasan`: `total_dialokasikan_ton`, `persen_defisit_tertutup`, `jumlah_pasangan`,
  `rata_jarak_tertimbang_ton` = `Σ(ton × jarak_km) / Σ ton`, `total_ton_km`.
- `items[i]`: `{urutan, dari_kode, dari, ke_kode, ke, ton, jarak_km, persen_kebutuhan_penerima,
  explanation}`.
- Filter opsional `dari_kode`, `ke_kode`.
- `explanation` dibaca dari kolom DB; kalau `null` (seed lama) → generate on the fly lewat `explain.py`
  dan simpan.

**Acceptance**
- 27 baris; total 2.889.188,00; `rata_jarak_tertimbang_ton` cocok hitungan manual dari CSV.
- `?dari_kode=32` → hanya baris Jawa Barat.

**Tes:** `test_recommendations.py`.

---

## T6.4 — `POST /recommendations/simulate`

**Blocked by:** T6.3

**Scope**
- Body persis PRD §10 baris 671–685 (`tahun`, `ambang_swasembada`, `persen_surplus_dilepas`,
  `jarak_maks_km`, `kecualikan_pemasok`, `kecualikan_penerima`, `perubahan_produksi`,
  `perubahan_konsumsi_persen`, `mode`).
- Validasi Pydantic: rentang sesuai PRD §5.6 tabel parameter (ambang 0,80–1,00; persen 10–100;
  jarak 100–4.000; perubahan produksi −50…+50; konsumsi −20…+20). Di luar rentang → 400 `INVALID_PARAMS`.
- `mode`: hanya `"greedy_v1"` diterima di wave ini. `"optimal"` → 400 dengan
  `details.alasan: "mode optimal belum diimplementasikan"` (keputusan PRD pertanyaan terbuka #4).
- Respons: `{rekomendasi: [...], provinsi: [{kode_bps, status, rice_balance_ton}], ringkasan,
  banding_resmi: {delta_ton, delta_ton_km, status_berubah: [...], defisit_tidak_tertutup: [...]}}`.
- **Tidak menulis ke DB.** Tidak memakai cache tulis.
- Target < 1 s untuk 38 provinsi (ukur dan catat di log).

**Acceptance**
- Body dengan semua default → `rekomendasi` identik `GET /recommendations` (tes otomatis,
  bandingkan baris per baris).
- `persen_surplus_dilepas=50` → `delta_ton` negatif; `defisit_tidak_tertutup` tidak kosong.
- `perubahan_produksi={"33": -20}` → status Jawa Tengah berubah / alokasi berubah, dan
  `banding_resmi.status_berubah` memuat kode `33` bila memang berubah.
- Tidak ada baris DB baru setelah simulasi (assert count sebelum/sesudah).

**Tes:** `test_simulate.py` (default = resmi, rentang invalid 400, tidak menulis DB, waktu < 1 s).

---

## T6.5 — Halaman Rekomendasi + Simulasi (FE)

**Blocked by:** T6.3, T6.4, T5.4

**Scope**
- `Tabs`: **Rekomendasi resmi** | **Simulasi skenario**.
- Tab resmi: 4 kartu ringkasan, tabel (urutan, pemasok, penerima, ton, jarak, % kebutuhan),
  filter pemasok/penerima, klik baris → `Sheet` berisi `explanation`, peta garis (komponen Wave 5),
  tombol unduh CSV/Excel/PDF.
- Tab simulasi: form `Form` + `Slider` + `Switch` + `MultiSelect` (8 parameter PRD §5.6),
  tombol "Jalankan" (`useMutation`, bukan on-change), kartu perbandingan dengan resmi,
  "Reset ke default", "Salin link skenario" (parameter di URL query).
- Label "rekomendasi potensial, bukan rencana logistik" di atas hasil kedua tab.

**Acceptance**
- Jalankan simulasi default → tabel & ringkasan sama dengan tab resmi.
- Reload URL skenario → form terisi dan hasil bisa dijalankan ulang.
- Respons terasa < 1 s (loading state muncul, tidak menggantung).

**Tes:** `npm run build`, cek manual 2 skenario.
