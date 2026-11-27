# RiceGuard — Data & Algoritma (P5)

Data 2025, 38 provinsi. Semua angka bisa dihasilkan ulang dari folder `raw/`.

## Cara menjalankan

```bash
pip install pandas pytest
python scripts/build_dataset.py      # -> dataset_v1.csv, data/provinces.json
python scripts/matching.py           # -> rekomendasi_distribusi_v1.csv, data/distribution.json
python -m pytest tests -q            # 4 kasus uji algoritma
python scripts/validate.py           # spot-check 5 provinsi + 11 aturan rekomendasi (opsional: pip install pyproj)
```

## File

| File | Isi |
| --- | --- |
| `dataset_v1.csv` | Per provinsi: penduduk, konsumsi/kapita, produksi, lat/lng, kebutuhan, balance, rasio, status |
| `rekomendasi_distribusi_v1.csv` | Rekomendasi kiriman: dari, ke, ton, jarak_km |
| `data/provinces.json`, `data/distribution.json` | Isi yang sama dalam JSON, siap dibaca frontend |
| `data/metrics.json` | Label, tooltip, penjelasan, rumus, sumber tiap metrik + template ringkasan per status (halaman Analisis Wilayah) |
| `scripts/build_dataset.py` | Hitung kebutuhan, rice balance, klasifikasi (pandas) |
| `scripts/matching.py` | Fungsi `rekomendasi_distribusi()` + `haversine_km()` |
| `scripts/validate.py` | Validasi: spot-check 5 provinsi ke angka sumber + cek aturan rekomendasi |
| `tests/test_matching.py` | 4 kasus uji |
| `raw/` | Data mentah dari sumber |

## Rumus

- kebutuhan (ton) = penduduk × konsumsi per kapita (kg) / 1000
- balance (ton) = produksi beras − kebutuhan
- rasio swasembada = produksi beras / kebutuhan
- status: surplus jika rasio > 1; balanced jika 0,90 ≤ rasio ≤ 1 (kriteria swasembada FAO 1999: produksi ≥ 90% kebutuhan); defisit jika rasio < 0,90

## Algoritma matching v1

1. Urutkan provinsi defisit dari defisit terbesar.
2. Untuk tiap provinsi defisit, ambil dari provinsi surplus terdekat (jarak haversine antar-titik provinsi), lalu yang terdekat berikutnya.
3. Alokasi = min(sisa defisit, sisa surplus), jadi tidak pernah melebihi keduanya.
4. Penerima hanya provinsi defisit, pemasok hanya provinsi surplus; provinsi balanced tidak ikut.

Jarak = garis lurus antar-titik pusat provinsi, bukan rute atau jarak jalan. Hasil adalah rekomendasi berbasis data tahunan, bukan rencana logistik (stok, biaya angkut, dan kebijakan belum dihitung).

## Sumber

- Produksi 2025: BPS, Produksi Padi dan Beras Menurut Provinsi, 2025
- Penduduk 2025: BPS, Jumlah Penduduk menurut Provinsi dan Jenis Kelamin, 2025 (hasil SUPAS 2025)
- Konsumsi 2025: Bapanas, Rata-rata Konsumsi per Jenis Pangan Penduduk Indonesia Provinsi Update Tahun 2025 (komoditas Beras, kg/kapita/tahun)
- Referensi provinsi & centroid: `raw/provinces-reference-serlin.csv` dari tim WebGIS (P3), sama dengan GeoJSON peta
