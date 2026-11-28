---
scope: project-context
canonical-for: ["gambaran umum proyek", "masalah & tujuan", "batasan klaim", "cakupan produk"]
sources: ["AGENTS.md", "dataset/dataset_v1.csv", "dataset/rekomendasi_distribusi_v1.csv", "supabase/seed/0001_static.sql"]
last-verified: 2026-11-27
---

# Konteks Proyek RiceGuard

> Ringkasan cepat untuk memahami **apa** RiceGuard dan **mengapa**. Detail teknis ada di berkas kanonik lain (lihat `INDEX.md`).

## 1. Fungsi Aplikasi

**RiceGuard** adalah platform WebGIS dan analitik keseimbangan produksi–kebutuhan beras di **38 provinsi** Indonesia beserta rekomendasi alokasi dari provinsi surplus ke provinsi defisit.

Masalah utama yang dijawab aplikasi:

1. **Ketimpangan persebaran nasional:** Pada dataset resmi 2025 (`dataset/dataset_v1.csv`), produksi beras nasional mencapai `34.690.959` ton vs kebutuhan `24.819.269` ton (`rice_balance_ton` nasional `+9.871.690` ton), namun **20 dari 38 provinsi** mengalami defisit (17 surplus, 1 balanced, 20 defisit).
2. **Data tersebar:** Data produksi (BPS), jumlah penduduk (BPS SUPAS), konsumsi beras per kapita (Bapanas), dan referensi spasial provinsi digabung menjadi satu angka kebutuhan, balance, rasio swasembada, dan status per provinsi.
3. **Alokasi potensial terjelaskan:** Setiap provinsi defisit dipasangkan ke provinsi surplus terdekat (jarak garis lurus haversine) lengkap dengan kalimat penjelasan deterministik dan simulasi skenario tanpa menyentuh database.

## 2. Angka Dasar Dataset Resmi 2025 (v1 Published)

| Indikator | Nilai (`dataset_v1.csv` / `rekomendasi_distribusi_v1.csv`) |
|---|---|
| Produksi beras nasional | `34.690.959` ton |
| Estimasi kebutuhan nasional | `24.819.269` ton |
| Rice balance nasional | `+9.871.690` ton |
| Sebaran status provinsi | `17` surplus · `1` balanced (Kalimantan Barat) · `20` defisit |
| Rekomendasi distribusi resmi | `27` pasangan pemasok–penerima, total alokasi `2.889.188` ton |

## 3. Batasan Klaim & Cakupan

> **Kanonik teks batasan:** `site_content` key `limitations` di `supabase/seed/0001_static.sql` (dapat disunting admin tanpa deploy ulang).

Batasan berikut **wajib** tampil di UI (`LimitationBanner`) dan footer setiap laporan cetak/Excel:

- **Bukan stok aktual:** `rice_balance_ton` adalah selisih produksi dan estimasi konsumsi rumah tangga tahunan; stok Bulog, cadangan pangan, impor, dan perdagangan antarwilayah tidak dihitung.
- **Bukan jarak jalan/laut:** Jarak antarprovinsi adalah **jarak garis lurus** (haversine antar-titik pusat provinsi), bukan jarak tempuh atau jalur logistik.
- **Bukan rencana logistik:** Rekomendasi distribusi bersifat potensial berbasis data tahunan; biaya angkut, moda transportasi, kapasitas pelabuhan, dan kebijakan tidak diperhitungkan.
- **Konsumsi rumah tangga saja:** Kebutuhan dihitung dari penduduk dikali konsumsi rumah tangga per kapita (Bapanas), tidak mencakup industri, hotel/restoran, maupun susut pascapanen.
- **Prediksi AI terisolasi:** Fitur opsional `/prediksi` (`GET /api/v1/forecast`) berasal dari model eksternal di luar dataset resmi dan tidak pernah dipakai untuk menghitung status provinsi atau rekomendasi distribusi.
- **Data aktual 2025, proyeksi belum ada:** dataset resmi hanya memuat tahun 2025 sebagai data aktual; proyeksi produksi dan kebutuhan 2026 ke atas belum tersedia dan masih rencana fitur, tanpa pelatihan model di repo ini.

**Di luar cakupan produk:** data tingkat kabupaten/kota, stok gudang real-time, harga eceran/grosir beras, dan akun pengguna publik (publik membaca tanpa login; hanya admin yang diautentikasi).

## 4. Ringkasan Domain & Bahasa

- **Sumber tunggal rumus:** paket `packages/riceguard_calc` (dipakai bersama oleh CLI `dataset/` dan backend FastAPI). Detail arsitektur: `ARCHITECTURE.md`.
- **Versioning dataset:** setiap tahun dapat memiliki banyak `dataset_versions` (`draft`, `published`, `archived`), tetapi maksimal **satu** versi `published` per tahun. Detail skema: `DOMAIN_MODEL.md`.
- **Dua peran:** `Publik` (baca + simulasi + unduh tanpa login) dan `Admin` (login Supabase Auth, terverifikasi di tabel `admins`). Detail alur: `ROLES_WORKFLOW.md`.
- **Ubiquitous language:** seluruh istilah domain mengikuti `../GLOSSARY.md`, dan seluruh teks antarmuka mengikuti `KAMUS_KOSAKATA.md`. Khususnya, istilah **"rute"** dilarang di antarmuka — gunakan **alur alokasi** dan **jarak garis lurus**.
