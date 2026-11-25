# Wave 11 — Prediksi Produksi (AI), model eksternal (`/prediksi`)

Ini **bukan** salah satu dari 9 fitur inti. Spesifikasinya ada di PRD §5.10.
Model dilatih dan di-deploy oleh pemilik model di Hugging Face Space; repo ini hanya
menyimpan URL endpoint dan memanggilnya dari BE.

Kalau wave ini tidak selesai sebelum freeze, fitur tidak dirilis dan menu "Prediksi"
tidak pernah dirender. Tidak ada angka pengganti dan tidak ada halaman kosong.

---

## T11.0 — Kontrak dan endpoint model (blokir semua tiket di wave ini)

**Blocked by:** —

**Scope**
- Pemilik model menyerahkan: URL endpoint, apakah Space publik atau privat (beserta token),
  tahun target yang didukung, dan bentuk respons final.
- Kontrak usulan di PRD §5.10 disetujui atau direvisi **sebelum** kode BE ditulis.
  Perubahan kontrak setelah T11.1 selesai berarti mengulang T11.1 dan T11.4.

**Acceptance**
- `curl -X POST "$AI_ENDPOINT_URL"` dengan body contoh PRD §5.10 membalas 200 berisi `items`.
- Jawaban atas empat pertanyaan terbuka PRD §5.10 nomor 14 tercatat di tiket ini.

**Tes:** panggilan manual dari mesin pengembang, hasilnya ditempel di tiket.

---

## T11.1 — `GET /forecast` (proxy ke model)

**Blocked by:** T11.0

**Scope**
- `app/schemas/forecast.py`: `ForecastResponse` — `tahun`, `satuan`, `items[{kode_bps, provinsi,
  nilai, interval_bawah, interval_atas}]`, `model{nama, versi}`, `details`.
- `app/services/forecast.py`: susun payload dari `province_stats` versi published
  (kolom yang sama dengan kontrak), `POST` ke `AI_ENDPOINT_URL` dengan `httpx`,
  timeout `AI_TIMEOUT_DETIK`, header `Authorization: Bearer $AI_API_TOKEN` hanya kalau token diisi.
- Router `public/forecast.py`: `GET /forecast?tahun=`.
- `AI_ENDPOINT_URL` kosong → 503 `AI_UNAVAILABLE` dengan
  `details.alasan = "endpoint model belum dikonfigurasi"`.
- Model membalas non-200 atau timeout → 502 `AI_UPSTREAM_ERROR`, pesan tidak membocorkan isi token.
- `kode_bps` yang tidak ada di respons model dicatat di `details.kode_tanpa_prediksi`, bukan diisi 0.

**Acceptance**
- Tanpa `AI_ENDPOINT_URL`: 503, bukan 500.
- Dengan endpoint uji: 200, jumlah item = jumlah `kode_bps` yang dibalas model.
- Tidak ada token yang muncul di log atau di body respons.

**Tes:** `test_forecast.py` (503, 502, 200 dengan `httpx.MockTransport`).

---

## T11.2 — Halaman `/prediksi` (FE)

**Blocked by:** T11.1

**Scope**
- `src/features/forecast/PrediksiPage.tsx`: tabel per provinsi (nilai + interval kalau ada),
  pemilih tahun target dari `metadata` model, `Skeleton` saat memuat.
- Menu "Prediksi" di `Header` hanya dirender kalau `GET /forecast` membalas 200.
  Sumber status: satu query ringan yang hasilnya di-cache, bukan request di setiap render.
- 503 → halaman menampilkan "Prediksi belum tersedia" + alasan dari `details.alasan`.
- 502 → `Alert` destruktif + tombol "Coba lagi".

**Acceptance**
- Dengan `AI_ENDPOINT_URL` kosong, menu tidak muncul dan rute langsung menampilkan pesan.
- Tidak ada angka prediksi yang dipakai di halaman lain.

**Tes:** `npm run build`, cek manual dua kondisi (endpoint kosong dan endpoint uji).

---

## T11.3 — Penanda non-resmi dan batasan klaim

**Blocked by:** T11.2

**Scope**
- Banner tetap di `/prediksi`: "Angka prediksi berasal dari model eksternal, bukan bagian dataset
  resmi, dan tidak dipakai untuk rekomendasi distribusi."
- Tambah satu paragraf batasan ke blok konten `limitations` (lewat seed/admin, bukan hardcode FE).
- Cantumkan nama + versi model dari `model` kalau tersedia.

**Acceptance**
- Banner tampil di 375 px tanpa terpotong.
- Blok `limitations` menyebut prediksi setelah seed diperbarui.

**Tes:** cek manual; `GET /content?keys=limitations` memuat kalimat prediksi.

---

## T11.4 — Regresi: fitur AI tidak mengubah angka resmi

**Blocked by:** T11.1

**Scope**
- Tes yang memastikan `/summary`, `/provinces`, `/map/layers` menghasilkan angka identik
  dengan `dataset_v1.csv` saat `/forecast` aktif maupun 503.

**Acceptance**
- Kedua kondisi menghasilkan respons byte-identik untuk endpoint resmi.

**Tes:** `test_forecast_isolation.py`.

---

## T11.5 — Konfigurasi deploy

**Blocked by:** T11.1

**Scope**
- Set `AI_ENDPOINT_URL`, `AI_API_TOKEN` (kalau perlu), `AI_TIMEOUT_DETIK` di hosting BE.
- Catat di README cara mematikan fitur (kosongkan `AI_ENDPOINT_URL`).

**Acceptance**
- Deploy tanpa variabel AI tetap sehat: `/health` 200, `/forecast` 503.
- Deploy dengan variabel AI: `/forecast` 200.

**Tes:** cek manual di lingkungan deploy.
