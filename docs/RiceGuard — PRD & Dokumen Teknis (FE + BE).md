---
scope: historical-prd
canonical-for: ["spesifikasi produk awal (arsip historis)", "checklist kriteria PRD"]
sources: ["docs/INDEX.md"]
last-verified: 2026-11-26
max-lines: "1100"
---

# RiceGuard — PRD & Dokumen Teknis (FE + BE)

> **Catatan historis:** Dokumen ini adalah spesifikasi produk dan perancangan awal sebelum implementasi modular selesai. Untuk dokumentasi teknis kanonik yang selalu diselaraskan dengan kode aktual, lihat `INDEX.md`.

Nov 25, 2026 · @Bagas

## Ringkasan & keputusan yang sudah dikunci

RiceGuard adalah web WebGIS + analitik yang menunjukkan keseimbangan produksi–kebutuhan beras 38 provinsi dan merekomendasikan alokasi dari provinsi surplus ke provinsi defisit. Dokumen ini mencakup PRD (bagian 1–7) dan dokumen teknis untuk FE dan BE (bagian 8–13). Targetnya: **semua 9 fitur selesai sebelum 30 November 2026**.

| Area | Keputusan | Sumber keputusan |
| --- | --- | --- |
| Frontend | React + Vite + TypeScript, shadcn/ui di atas Tailwind CSS v4 | Bagas |
| Backend | FastAPI (Python). Algoritma P5 (`build_dataset.py`, `matching.py`) dipakai langsung, tidak ditulis ulang | Bagas (tetap FastAPI) |
| Database, auth, file | Supabase: Postgres + Supabase Auth (khusus admin) + Storage untuk file upload | Bagas |
| Role | Publik (tanpa login) dan Admin | Bagas |
| Data | 2025, 38 provinsi. Skema DB dan API sudah multi-tahun; UI historis otomatis muncul saat ada ≥ 2 tahun data | Bagas |
| Admin | Upload data mentah, edit per provinsi, kelola konten, versi dataset (publish/rollback) | Bagas |
| Rekomendasi | Hasil resmi disimpan per versi dataset + halaman simulasi yang menghitung on-the-fly | Bagas |
| Next.js | Tidak dipakai. Catatan: nama repo GitHub masih `next-riceguard`, bisa di-rename agar tidak membingungkan juri/tim | Dari pilihan FastAPI |

Cara membaca: PM dan seluruh tim membaca bagian 1–7; P2 dan P3 fokus ke bagian 5, 7 dan 11; P4 ke bagian 9, 10 dan 12; P5 ke bagian 3 dan 12 (service hitung). Hal yang belum diputuskan ada di bagian terakhir, ditulis sebagai pertanyaan, bukan asumsi.

## 1. Latar belakang, masalah, dan tujuan

Secara nasional beras 2025 surplus sekitar 9,87 juta ton, tetapi 20 dari 38 provinsi defisit. Masalahnya ada di **persebaran**, bukan total. RiceGuard membuat ketimpangan itu terlihat di peta, lalu memberi rekomendasi alokasi yang bisa dijelaskan alasannya.

Angka dari `dataset_v1.csv` (tahun 2025):

| Ukuran | Nilai |
| --- | --- |
| Produksi beras nasional | 34.690.959 ton (sama dengan baris "Indonesia" BPS) |
| Estimasi kebutuhan nasional | 24.819.269 ton |
| Rice balance nasional | +9.871.690 ton |
| Provinsi surplus / balanced / defisit | 17 / 1 / 20 |
| Total surplus provinsi surplus | 12.810.655 ton |
| Total defisit provinsi defisit | 2.889.188 ton |
| Rekomendasi distribusi v1 | 27 pasangan kirim, 2.889.188 ton (seluruh defisit tertutup) |

**Masalah yang dijawab**

1. Data produksi (BPS), penduduk (BPS) dan konsumsi (Bapanas) tersebar di tabel terpisah dan belum digabung jadi angka kebutuhan per provinsi.
2. Tidak ada tampilan spasial yang langsung menunjukkan provinsi mana surplus dan mana defisit.
3. Ketika defisit ditemukan, belum ada alat bantu untuk melihat provinsi pemasok terdekat yang masih punya surplus.

**Tujuan produk**

1. Mengetahui masalah: dashboard nasional + analisis per provinsi.
2. Memahami persebaran: peta interaktif surplus–defisit.
3. Memberi alternatif tindakan: rekomendasi distribusi resmi + simulasi skenario.
4. Transparan: setiap angka bisa dilacak ke sumber dan rumusnya.

**Kaitan SDG 2 (Zero Hunger):** RiceGuard menyasar ketersediaan pangan pokok (beras) per wilayah, sebagai alat bantu analisis untuk ketahanan pangan.

**Batasan klaim (wajib tampil di UI dan presentasi)**

- Balance = produksi − estimasi konsumsi. Ini **bukan stok beras aktual**: stok Bulog, cadangan, impor, dan perdagangan antarwilayah tidak dihitung.
- Jarak = garis lurus antar-titik pusat provinsi (haversine), bukan jarak jalan atau rute laut.
- Rekomendasi = **rekomendasi potensial berbasis data tahunan**, bukan rencana logistik. Biaya angkut, moda, dan kebijakan belum dihitung.
- Kebutuhan memakai konsumsi rumah tangga per kapita (Bapanas), jadi kebutuhan industri, hotel/restoran, dan susut tidak termasuk.

**Di luar cakupan:** data kabupaten/kota, data stok, harga beras, akun pengguna publik. Prediksi produksi (ML) **bukan** bagian dari dataset resmi: kalau ditampilkan, ia berdiri sebagai fitur terpisah di atas model eksternal (lihat §5.10) dan tidak pernah mengubah angka resmi, rekomendasi, atau laporan.

## 2. Role & hak akses

Ada dua role: **Publik** membaca semua data versi yang sedang dipublikasi tanpa login; **Admin** login lewat Supabase Auth untuk mengubah data, konten, dan versi. Pendaftaran publik ditutup: akun admin dibuat manual di dashboard Supabase lalu didaftarkan ke tabel `admins`.

**Persona**

| Persona | Contoh | Kebutuhan utama | Role |
| --- | --- | --- | --- |
| Pengambil kebijakan / analis pangan | Staf dinas ketahanan pangan, Bapanas | Lihat provinsi defisit, pemasok terdekat, unduh laporan | Publik |
| Peneliti / mahasiswa | Dosen, mahasiswa | Unduh data, baca metodologi, uji skenario | Publik |
| Masyarakat umum & juri lomba | Pengunjung | Paham kondisi beras nasional dalam 1 menit | Publik |
| Pengelola data | Anggota tim (P5, P4) | Upload data tahun baru, koreksi angka, publish versi | Admin |

**Matriks izin**

| Aksi | Publik | Admin |
| --- | --- | --- |
| Lihat dashboard, peta, analisis, distribusi, rekomendasi, tren, metodologi | Ya (versi published) | Ya (versi published + draft untuk preview) |
| Jalankan simulasi skenario | Ya (tidak disimpan) | Ya (tidak disimpan) |
| Unduh CSV/Excel dan laporan PDF | Ya | Ya |
| Login ke `/admin` | Tidak | Ya |
| Upload data mentah → buat versi draft | Tidak | Ya |
| Edit angka per provinsi di versi draft | Tidak | Ya |
| Publish versi / rollback ke versi lama | Tidak | Ya |
| Edit konten (About, How it works, sumber data, metodologi) | Tidak | Ya |
| Lihat log aktivitas admin | Tidak | Ya |

Aturan: versi yang sudah **published atau archived tidak bisa diedit**. Koreksi selalu lewat versi draft baru, supaya angka yang pernah tampil ke publik tetap bisa dilacak.

Catatan: tidak ada sub-role (misal super-admin). Semua admin punya hak yang sama.

## 3. Data yang sudah ada (dari folder `dataset/`)

Dataset P5 sudah lengkap untuk 2025: 38 provinsi, dihasilkan ulang dari `raw/` oleh `build_dataset.py`, lalu `matching.py` menghasilkan 27 rekomendasi. FE dan BE tidak boleh menghitung rumus sendiri; semua angka berasal dari service hitung di backend yang memanggil logika P5.

**File input mentah (yang nanti di-upload admin)**

| File | Format | Kolom | Catatan parser |
| --- | --- | --- | --- |
| `provinces-reference-serlin.csv` | CSV, header | kode\_bps, kode\_kemendagri, provinsi, pulau, lat, lng | Referensi tetap dari P3; sama dengan GeoJSON peta |
| `produksi_<tahun>.txt` | Pipa `\|`, tanpa header | provinsi, produksi padi (ton GKG), produksi beras (ton) | Angka format Indonesia `1.615.200,00`; ada baris total `Indonesia` |
| `penduduk_supas2025.txt` | Pipa `\|`, tanpa header | provinsi, jumlah penduduk | Format `5.631.760`; ada baris `Indonesia` |
| `konsumsi_bapanas_<tahun>.csv` | CSV, header | kode\_kemendagri, provinsi, konsumsi\_kg\_kapita\_tahun | Join pakai **kode\_kemendagri**, bukan nama |

Produksi dan penduduk di-join lewat **nama provinsi** (dengan alias `DI Yogyakarta` → `Daerah Istimewa Yogyakarta`); konsumsi lewat kode Kemendagri. Untuk 6 provinsi Papua, kode BPS dan Kemendagri **berbeda** (contoh: Papua BPS 94, Kemendagri 91). Primary key di sistem = `kode_bps`.

**Output: kolom `dataset_v1.csv` / `provinces.json`**

| Kolom | Tipe | Satuan / isi |
| --- | --- | --- |
| tahun | int | 2025 |
| kode\_bps | string | "11"–"97" |
| kode\_kemendagri | string | "11"–"96" |
| provinsi | string | Nama resmi |
| pulau | string | Sumatera, Jawa, Bali & Nusa Tenggara, Kalimantan, Sulawesi, Maluku, Papua |
| lat, lng | float | Titik pusat provinsi |
| penduduk\_jiwa | int | jiwa |
| konsumsi\_kg\_kapita\_tahun | float | kg/kapita/tahun |
| produksi\_padi\_ton\_gkg | float | ton GKG |
| produksi\_beras\_ton | float | ton |
| kebutuhan\_beras\_ton | float | ton |
| rice\_balance\_ton | float | ton (+ surplus, − kurang) |
| rasio\_swasembada | float | produksi / kebutuhan, 4 desimal |
| status | enum | surplus \| balanced \| defisit |

**Rumus**

```latex
\text{kebutuhan} = \frac{\text{penduduk} \times \text{konsumsi per kapita (kg)}}{1000}
```

```latex
\text{balance} = \text{produksi beras} - \text{kebutuhan}, \qquad \text{rasio} = \frac{\text{produksi beras}}{\text{kebutuhan}}
```

Status: **surplus** jika rasio > 1; **balanced** jika 0,90 ≤ rasio ≤ 1 (kriteria swasembada FAO 1999); **defisit** jika rasio < 0,90.

Kasus khusus yang harus ditangani UI: Kalimantan Barat berstatus **balanced** walau balance-nya negatif (−49.777 ton, rasio 0,9001). Jadi warna peta dan badge mengikuti kolom `status`, bukan tanda balance.

**Output: rekomendasi (`rekomendasi_distribusi_v1.csv` / `distribution.json`)**

Kolom: urutan, dari\_kode, dari, ke\_kode, ke, ton, jarak\_km. Algoritma matching v1 (greedy):

1. Urutkan provinsi defisit dari defisit terbesar.
2. Untuk tiap defisit, ambil dari provinsi surplus terdekat (haversine antar-titik pusat), lalu yang berikutnya.
3. Alokasi = min(sisa defisit, sisa surplus).
4. Provinsi balanced tidak menjadi pemasok maupun penerima.

`tests/test_matching.py` berisi 4 kasus uji (pemasok terdekat dulu, defisit terbesar dulu, alokasi tidak melebihi sisa, balanced tidak ikut). Tes ini dijalankan di CI backend.

**Sumber resmi**

- Produksi 2025: BPS, Produksi Padi dan Beras Menurut Provinsi (Survei KSA & Ubinan, tabel diperbarui 12 Feb 2026).
- Penduduk 2025: BPS, hasil SUPAS 2025.
- Konsumsi 2025: Bapanas, Rata-rata Konsumsi per Jenis Pangan Penduduk Indonesia Provinsi, komoditas Beras.
- Referensi provinsi & centroid: tim WebGIS (P3).

**Yang belum ada di folder:** file GeoJSON batas 38 provinsi. Konfirmasi P5: join ke GeoJSON Satria memakai kode\_bps, dan nama provinsi di dataset sudah disamakan dengan peta. File GeoJSON-nya tinggal dimasukkan ke repo.

## 4. Peta situs & navigasi

Ada 11 route publik dan 7 route admin. Navigasi utama mengikuti 7 menu dari rancangan tim; Landing dan Laporan berada di luar menu (Landing lewat logo, Laporan lewat tombol "Unduh laporan" di header).

**Halaman publik**

| Route | Menu | Fitur dari daftar (nomor) | Isi utama |
| --- | --- | --- | --- |
| `/` | Logo | 1. Landing & General Information | Hero, About, SDG 2, How it works, ringkasan sumber data, CTA ke Dashboard |
| `/dashboard` | Dashboard | 2. Main Dashboard | KPI nasional, grafik per provinsi, top-5, filter tahun |
| `/peta` | Rice Map | 3. Interactive Rice Map | Peta choropleth, 4 layer, legenda, pencarian, popup, panel detail |
| `/analisis` | Regional Analysis | 4. Regional Analysis | Tabel ranking 38 provinsi + filter status/pulau |
| `/analisis/:kode` | (dari tabel/peta) | 4. Regional Analysis | Detail satu provinsi: angka, rumus terisi, pemasok/penerima terkait |
| `/distribusi` | Distribution Analysis | 5. Supply & Distribution Analysis | Daftar pemasok vs penerima, matriks jarak, peta garis alur, prioritas |
| `/rekomendasi` | Recommendations | 6. Smart Distribution Recommendation | Tabel rekomendasi resmi + penjelasan per baris |
| `/rekomendasi/simulasi` | (tab di Recommendations) | 6. Distribution Scenario Simulation | Form parameter → hasil on-the-fly, bandingkan dengan resmi |
| `/tren` | Historical Trends | 7. Historical Data & Trend Monitoring | Grafik tren & perbandingan tahun. Menu disembunyikan selama tahun published < 2 |
| `/data` | Data & Methodology | 8. Data Management & Transparency | Sumber, waktu update, metodologi, hasil validasi, unduh CSV/Excel |
| `/laporan` | Tombol header | 9. Report & Export | Pilih jenis laporan + provinsi + tahun → PDF/CSV/Excel |

**Halaman admin** (semua di bawah `/admin`, wajib login)

| Route | Isi |
| --- | --- |
| `/admin/login` | Form email + password (Supabase Auth) |
| `/admin` | Ringkasan: versi published per tahun, draft terbuka, aktivitas terakhir |
| `/admin/versi` | Daftar versi dataset per tahun dengan status draft / published / archived |
| `/admin/versi/baru` | Wizard upload 4 file mentah → validasi → buat draft |
| `/admin/versi/:id` | Detail versi: tabel 38 provinsi (bisa diedit kalau draft), hasil validasi, rekomendasi, tombol hitung ulang / publish / rollback |
| `/admin/konten` | Editor konten halaman publik (About, How it works, sumber, metodologi) |
| `/admin/log` | Log aktivitas admin |

**Elemen global (semua halaman publik)**

- Header: logo, 7 menu, pemilih tahun, tombol "Unduh laporan", toggle tema terang/gelap. Di mobile menu pindah ke `Sheet` (drawer).
- Pemilih tahun disimpan di URL (`?tahun=2025`) agar link bisa dibagikan. Selama hanya ada satu tahun, pemilih tampil sebagai label statis "Data 2025".
- Banner batasan klaim (satu baris) di Dashboard, Peta, Distribusi, Rekomendasi, dengan link ke `/data#batasan`.
- Footer: sumber data, versi dataset yang tampil (misal "v3 · dipublikasi 28 Nov 2026"), link repo.

## 5. Spesifikasi fitur per halaman

Setiap halaman ditulis dengan pola yang sama: tujuan, isi & komponen, data (endpoint di bagian 10), interaksi, state, dan kriteria selesai. Kriteria selesai dipakai sebagai checklist QA sebelum 30 Nov. Semua halaman publik membaca **versi dataset yang sedang published** untuk tahun terpilih.

State standar untuk semua halaman data: **loading** = `Skeleton` sesuai bentuk konten; **error** = `Alert` destruktif + tombol "Coba lagi"; **kosong** (tahun tanpa versi published) = pesan "Data tahun ini belum dipublikasi" + link ke tahun terbaru.

### 5.1 Landing & General Information — `/`

Tujuan: pengunjung paham RiceGuard dan masalahnya dalam ± 1 menit, lalu masuk ke Dashboard.

| Blok | Isi | Komponen | Sumber konten |
| --- | --- | --- | --- |
| Hero | Judul, satu kalimat masalah, 3 angka kunci (balance nasional, jumlah provinsi defisit, ton yang bisa dialokasikan), tombol "Buka Dashboard" dan "Lihat Peta" | `Button`, `Card` | Judul/teks: `site_content`; angka: `GET /api/v1/summary` |
| About RiceGuard | Masalah dan solusi | `Card` | `site_content` key `about` |
| SDG 2 | Kaitan dengan Zero Hunger | `Card`, `Badge` | `site_content` key `sdg2` |
| How it works | 4 langkah: data → hitung balance → peta → rekomendasi | Komponen step custom | `site_content` key `how_it_works` |
| Data sources | 3 sumber + tahun + link ke `/data` | `Card` | `GET /api/v1/sources` |
| Batasan | Ringkasan batasan klaim | `Alert` | `site_content` key `limitations` |

Kriteria selesai:

- [x] 3 angka hero sama persis dengan Dashboard untuk tahun yang sama.
- [x] Semua teks berasal dari `site_content`, jadi bisa diubah admin tanpa deploy.
- [ ] Lighthouse mobile: Performance ≥ 85, Accessibility ≥ 90.

### 5.2 Main Dashboard — `/dashboard`

Tujuan: gambaran nasional produksi vs kebutuhan untuk satu tahun.

**A. National Rice Overview** — 4 kartu KPI (`Card`):

| Kartu | Nilai | Keterangan kecil |
| --- | --- | --- |
| Produksi beras nasional | Σ produksi\_beras\_ton | "ton, BPS" |
| Estimasi kebutuhan nasional | Σ kebutuhan\_beras\_ton | "ton, penduduk × konsumsi" |
| Rice balance nasional | Σ rice\_balance\_ton | Hijau jika +, merah jika −; rasio nasional |
| Provinsi surplus / balanced / defisit | 17 / 1 / 20 | Klik → `/analisis?status=...` |

Jika ada ≥ 2 tahun, tiap kartu menampilkan perubahan (%) dibanding tahun sebelumnya.

**B. Statistical Visualization** (shadcn `chart` di atas Recharts):

1. Produksi vs kebutuhan per provinsi — bar berpasangan, 38 provinsi, urut produksi menurun, scroll horizontal di mobile.
2. Rice balance per provinsi — bar divergen di sekitar nol, warna mengikuti `status`.
3. Kontribusi produksi per pulau — bar bertumpuk 100% (7 pulau). Kontribusi per provinsi ditampilkan di tooltip.

**C. Top Regional Statistics** — 4 daftar top-5 (`Card` + `Table` kecil): produksi tertinggi, kebutuhan terbesar, surplus tertinggi (ton), defisit terbesar (ton). Setiap baris link ke `/analisis/:kode`.

**D. Year Filter** — pemilih tahun global di header (lihat bagian 4).

Kriteria selesai:

- [x] Total di kartu sama dengan jumlah 38 baris versi published (selisih pembulatan ≤ 1 ton).
- [x] Kalimantan Barat tampil sebagai balanced (bukan defisit) di semua grafik.
- [ ] Grafik bisa dibaca di lebar 375 px. *(Cek visual manual 3 lebar pada lingkungan deploy akhir.)*

### 5.3 Interactive Rice Map (WebGIS) — `/peta`

Tujuan: melihat persebaran surplus–defisit dan membuka detail provinsi dari peta. Ini salah satu dari tiga fitur inti.

Tata letak: peta penuh di kiri; panel samping di kanan (desktop) atau `Drawer` dari bawah (mobile).

| Bagian | Spesifikasi |
| --- | --- |
| Basemap | Leaflet + tile OpenStreetMap atau CARTO Positron (atribusi wajib tampil) |
| Batas wilayah | GeoJSON 38 provinsi dari P3, di-join ke data lewat kode provinsi |
| Layer (radio, satu aktif) | 1) Surplus & defisit (default, 3 warna kategori); 2) Produksi beras (5 kelas); 3) Kebutuhan/konsumsi (5 kelas); 4) Kepadatan penduduk (5 kelas, jiwa/km²) |
| Legenda | Mengikuti layer aktif; kelas dan warnanya dari API agar sama dengan laporan |
| Search | `Command` (combobox) cari nama provinsi → peta zoom ke provinsi + panel terbuka |
| Hover | Highlight batas + tooltip nama dan nilai layer aktif |
| Klik | Popup ringkas (nama, status, produksi, kebutuhan, balance, rasio) + panel detail + tombol "Analisis lengkap" ke `/analisis/:kode` |
| Titik pusat | Opsional: label nilai di centroid (lat/lng dataset), bisa dimatikan |
| Year Comparison | Hanya jika ≥ 2 tahun: mode "Bandingkan" = dua peta berdampingan (tahun A vs B) dengan zoom tersinkron |

Kepadatan penduduk butuh luas wilayah (km²), yang **belum ada di dataset**. Lihat Pertanyaan terbuka.

Kriteria selesai:

- [x] 38 poligon terwarnai; tidak ada provinsi abu-abu karena kode tidak cocok.
- [x] Ganti layer < 200 ms (tanpa request ulang GeoJSON).
- [x] Peta bisa dipakai dengan keyboard: search lalu Enter membuka panel provinsi.
- [x] Warna punya pola/label teks juga, tidak hanya warna (aksesibilitas buta warna).

### 5.4 Regional Analysis — `/analisis` dan `/analisis/:kode`

**Halaman daftar** — tabel 38 provinsi (`Table` + TanStack Table): peringkat, provinsi, pulau, penduduk, konsumsi/kapita, produksi, kebutuhan, balance, rasio, status (`Badge`). Bisa urut per kolom, filter status dan pulau (`Select`), cari nama. Tab Regional Ranking: urut berdasarkan produksi, kebutuhan, atau balance.

**Halaman detail provinsi**:

| Blok | Isi |
| --- | --- |
| Header | Nama, pulau, `Badge` status, rasio swasembada (progress bar dengan garis 0,90 dan 1,00) |
| Production Analysis | Produksi padi (ton GKG) dan beras (ton) |
| Consumption Analysis | Penduduk × konsumsi per kapita |
| Rice Demand Calculation | Rumus terisi angka: "5.631.760 × 93,9 kg / 1000 = 528.822 ton" |
| Rice Balance Calculation | "930.489 − 528.822 = +401.667 ton" + klasifikasi dan alasannya |
| Distribusi terkait | Jika defisit: daftar pemasok yang direkomendasikan; jika surplus: daftar penerima; jika balanced: teks "tidak ikut matching" |
| Historical Comparison | Hanya jika ≥ 2 tahun: grafik garis produksi, kebutuhan, balance |
| Peta mini | Provinsi di-highlight |

Kriteria selesai:

- [x] Angka di rumus terisi sama dengan kolom dataset (kebutuhan dibulatkan ke ton).
- [x] Kode tidak valid → halaman 404 dengan link kembali ke daftar.

### 5.5 Supply & Distribution Analysis — `/distribusi`

Tujuan: memperlihatkan siapa calon pemasok dan siapa yang butuh, sebelum masuk ke rekomendasi.

| Fitur | Spesifikasi |
| --- | --- |
| Surplus Region Identification | Tabel 17 provinsi surplus: surplus (ton), sisa setelah rekomendasi resmi |
| Deficit Region Identification | Tabel 20 provinsi defisit: defisit (ton), rasio |
| Distribution Priority | Urutan defisit terbesar (ton) = urutan yang dipakai algoritma. Ditampilkan juga rasio supaya provinsi dengan rasio sangat rendah (misal Kep. Riau 0,0023) terlihat |
| Supply-Demand Matching | Peta garis: setiap rekomendasi = garis dari centroid pemasok ke penerima, tebal ∝ ton. Klik garis → detail |
| Geographic Distance Analysis | Matriks jarak (km) defisit × surplus; pilih satu provinsi defisit → tabel pemasok terurut jarak |
| Potential Supplier Ranking | Untuk provinsi defisit terpilih: pemasok terurut jarak, dengan surplus tersedia |
| Regional Connectivity Analysis | Data jaringan transportasi **belum ada**. Usulan v1: tandai pasangan satu pulau vs lintas pulau (dari kolom `pulau`). Perlu persetujuan tim |
| Distribution Route Visualization | Garis lurus antar-titik tengah provinsi. Label di UI: "Alur alokasi" dan "jarak garis lurus"; kata "rute" tidak dipakai di label mana pun |

Kriteria selesai:

- [x] Jumlah garis di peta = jumlah baris rekomendasi resmi (27 untuk 2025).
- [x] Jarak di matriks sama dengan `jarak_km` hasil `haversine_km` P5 (1 desimal).

### 5.6 Smart Distribution Recommendation — `/rekomendasi` dan `/rekomendasi/simulasi`

Ada dua tab (`Tabs`): **Rekomendasi resmi** (disimpan per versi dataset, dihitung saat admin publish) dan **Simulasi skenario** (dihitung on-the-fly, tidak disimpan).

**Tab Rekomendasi resmi**

| Fitur | Spesifikasi |
| --- | --- |
| Ringkasan | Total dialokasikan (ton), % defisit nasional yang tertutup, jumlah pasangan, rata-rata jarak tertimbang ton (ton-km / ton) |
| Tabel | Urutan, pemasok, penerima, ton, jarak (km), % kebutuhan penerima yang tertutup. Filter per pemasok/penerima |
| Recommended Supplier / Allocation | Kolom pemasok dan ton dari tabel di atas |
| Distribution Priority | Kolom urutan; penerima dengan defisit terbesar dilayani lebih dulu |
| Distance-Based Recommendation | Kolom jarak; pemasok terdekat dipilih lebih dulu |
| Recommendation Explanation | Klik baris → `Sheet` berisi kalimat penjelasan yang dibuat backend dari data, contoh: "Jawa Barat dipilih untuk DKI Jakarta karena merupakan provinsi surplus terdekat (116,8 km) dengan surplus 1.509.346 ton. Alokasi 863.504 ton menutup 100% defisit DKI Jakarta." |
| Peta | Garis pemasok → penerima, sama dengan halaman Distribusi |
| Unduh | CSV / Excel tabel + PDF laporan rekomendasi |

**Tab Simulasi skenario** (Distribution Scenario Simulation + Supply-Demand Optimization)

Form (`Form` + `Slider` + `Switch` + `MultiSelect` dari `Command`). Parameter usulan, perlu disetujui P5 karena algoritma `matching.py` harus menerima parameter ini:

| Parameter | Default | Rentang | Efek |
| --- | --- | --- | --- |
| Ambang swasembada (balanced) | 0,90 | 0,80–1,00 | Mengubah batas status defisit/balanced |
| Persentase surplus yang boleh dilepas | 100% | 10–100% | Menyisakan cadangan di provinsi pemasok |
| Jarak maksimum pemasok–penerima | tanpa batas | 100–4.000 km | Pasangan lebih jauh diabaikan |
| Kecualikan pemasok | — | daftar surplus | Provinsi tidak boleh jadi pemasok |
| Kecualikan penerima | — | daftar defisit | Provinsi tidak dilayani |
| Perubahan produksi per provinsi | 0% | −50% s/d +50% | Simulasi gagal panen / kenaikan produksi |
| Perubahan konsumsi nasional | 0% | −20% s/d +20% | Simulasi perubahan konsumsi per kapita |
| Mode algoritma | Greedy v1 | Greedy v1 / Optimal | "Optimal" = minimasi total ton-km (program linear). Opsional, lihat Pertanyaan terbuka |

Hasil simulasi: tabel dan peta yang sama dengan tab resmi, ditambah kartu **perbandingan dengan resmi** (Δ ton dialokasikan, Δ ton-km, provinsi yang berubah status, defisit yang tidak tertutup). Tombol "Reset ke default" dan "Salin link skenario" (parameter disimpan di URL query).

Kriteria selesai:

- [x] Simulasi dengan parameter default menghasilkan hasil **identik** dengan rekomendasi resmi (uji otomatis).
- [x] Respons simulasi < 1 detik untuk 38 provinsi.
- [x] Hasil tidak pernah melebihi sisa surplus maupun defisit (4 tes P5 tetap lulus).
- [x] Label "rekomendasi potensial, bukan rencana logistik" selalu tampil di atas hasil.

### 5.7 Historical Data & Trend Monitoring — `/tren`

Status: halaman dibuat, tetapi **menu dan route hanya aktif jika jumlah tahun published ≥ 2**. Dengan data sekarang (hanya 2025) halaman menampilkan keadaan kosong "Butuh minimal 2 tahun data".

| Fitur | Spesifikasi |
| --- | --- |
| Production / Consumption / Rice Balance Trends | Grafik garis nasional per tahun |
| Regional Trend Comparison | Pilih hingga 5 provinsi → grafik garis per provinsi |
| Historical Map | Slider tahun di atas peta surplus–defisit |
| Year-to-Year Comparison | Pilih tahun A dan B → tabel Δ per provinsi + daftar provinsi yang berubah status |

Kriteria selesai:

- [x] Diuji dengan data dummy 2 tahun di lingkungan dev (seed khusus), lalu dimatikan otomatis di produksi bila hanya 1 tahun.

### 5.8 Data Management & Transparency — `/data`

| Fitur | Spesifikasi |
| --- | --- |
| Data Source Information | Tabel sumber: nama tabel resmi, instansi, tahun, tanggal diperbarui, link |
| Data Update Information | Versi yang tampil, tanggal publish, admin yang mem-publish, catatan perubahan |
| Data Year Selection | Pemilih tahun global |
| Data Validation | Hasil cek otomatis versi published: 38 provinsi lengkap, total produksi vs baris "Indonesia" BPS, total penduduk vs BPS, tidak ada nilai kosong/negatif |
| Data Download | CSV dan Excel: dataset provinsi, rekomendasi, data mentah |
| Methodology Explanation | Rumus (bagian 3), definisi status, algoritma matching, batasan klaim (anchor `#batasan`) |

Kriteria selesai:

- [x] File unduhan sama persis kolomnya dengan `dataset_v1.csv` (urutan dan nama kolom).
- [x] Excel berisi 3 sheet: Provinsi, Rekomendasi, Metadata (versi, sumber, tanggal).

### 5.9 Report & Export — `/laporan`

Pengguna memilih jenis laporan, tahun, dan (untuk laporan wilayah) provinsi, lalu mengunduh.

| Laporan | Isi | Format |
| --- | --- | --- |
| National Rice Security Report | KPI nasional, peta surplus–defisit, top-5, batasan | PDF |
| Regional Analysis Report | Satu provinsi: angka, rumus terisi, distribusi terkait | PDF |
| Surplus-Deficit Report | Daftar 38 provinsi per status + peta | PDF, CSV, Excel |
| Distribution Recommendation Report | Tabel rekomendasi + penjelasan + peta garis | PDF, CSV, Excel |

Setiap laporan mencantumkan versi dataset, tanggal cetak, sumber, dan batasan klaim di footer. Cara membuat PDF dibahas di bagian 12.

Kriteria selesai:

- [x] PDF A4 portrait, maksimal 4 halaman untuk laporan nasional, terbaca saat dicetak hitam-putih.
- [x] Angka di PDF sama dengan halaman web untuk versi yang sama.

### 5.10 Prediksi Produksi (AI) — `/prediksi` (tambahan, opsional)

Status: **di luar 9 fitur inti**. Hanya dikerjakan kalau endpoint model sudah hidup. Kalau tidak, fitur ini tidak dirilis dan tidak ada menu yang mengarah ke halaman kosong.

**Pemilik model.** Model dilatih dan di-deploy oleh anggota tim terpisah di Hugging Face Space. Repo ini **tidak** memuat kode training, bobot, atau dataset latih; yang disimpan hanya URL endpoint dan token opsional.

**Alur.** FE → BE (`GET /api/v1/forecast`) → endpoint HF. FE tidak pernah memanggil HF langsung, karena token Space tidak boleh masuk bundle FE, CORS HF tidak diandalkan, dan BE perlu menyeragamkan bentuk respons dengan endpoint lain.

**Halaman `/prediksi`.**
- Menampilkan prediksi per provinsi untuk tahun target, terpisah dari data resmi.
- Banner tetap di atas konten: "Angka prediksi berasal dari model eksternal, bukan bagian dataset resmi, dan tidak dipakai untuk rekomendasi distribusi."
- `AI_ENDPOINT_URL` kosong atau model membalas error → halaman menampilkan "Prediksi belum tersedia", **tidak** menampilkan angka pengganti.
- Menu "Prediksi" hanya dirender kalau `GET /forecast` membalas 200.

**Kontrak yang dibutuhkan dari model** (usulan; harus disetujui pemilik model sebelum BE ditulis).

Request `POST {AI_ENDPOINT_URL}`:

```json
{
  "tahun": 2026,
  "provinsi": [
    {
      "kode_bps": "11",
      "provinsi": "Aceh",
      "penduduk_jiwa": 5631760,
      "konsumsi_kg_kapita_tahun": 93.9,
      "produksi_beras_ton": 930489.0,
      "kebutuhan_beras_ton": 528822.26
    }
  ]
}
```

Respons 200:

```json
{
  "tahun": 2026,
  "satuan": "ton",
  "items": [
    {
      "kode_bps": "11",
      "provinsi": "Aceh",
      "nilai": 950000.0,
      "interval_bawah": 900000.0,
      "interval_atas": 1000000.0
    }
  ],
  "model": {"nama": "nama-model", "versi": "1.0.0"}
}
```

`nilai` wajib; `interval_bawah`, `interval_atas`, dan `model` opsional.

Kriteria selesai:

- [ ] 38 `kode_bps` pada respons model, atau BE menandai kode yang hilang di `details.kode_tanpa_prediksi`. *(BE & unit mock lulus; menunggu endpoint model eksternal `T11.0`.)*
- [x] `AI_ENDPOINT_URL` kosong → 503 `AI_UNAVAILABLE`; halaman tetap bisa dibuka.
- [x] Angka di Dashboard, Peta, Rekomendasi, dan laporan **tidak berubah** karena fitur ini.

Belum diputuskan (dijawab pemilik model, jangan diasumsikan):

1. Tahun target yang didukung model.
2. Fitur masukan tambahan yang dibutuhkan model (harga, luas panen, cuaca).
3. Space publik atau privat (menentukan perlu `AI_API_TOKEN` atau tidak).
4. Apakah model melaporkan interval keyakinan, dan bagaimana cara membacanya.

## 6. Panel admin

Semua perubahan data lewat **versi dataset**. Satu tahun bisa punya banyak versi, tapi hanya satu yang published. Publik selalu membaca versi published; admin bisa melihat draft sebagai preview.

&#91;embedded content: siklus versi dataset · draft, published, archived\]

Draft bisa diedit dan dihapus; published dan archived hanya bisa diduplikat atau di-rollback.

### 6.1 Login — `/admin/login`

- Email + password lewat Supabase Auth (`supabase-js` di FE). Tidak ada tombol daftar.
- Setelah login, FE mengirim access token (JWT) di header `Authorization: Bearer` ke FastAPI. FastAPI memverifikasi token dan mengecek `user_id` ada di tabel `admins`; jika tidak → 403.
- Sesi habis → kembali ke login dengan pesan.

### 6.2 Upload data mentah — `/admin/versi/baru` (wizard 4 langkah)

1. **Pilih tahun & catatan** — tahun (angka), catatan perubahan (wajib).
2. **Upload file** — 3 file wajib: produksi, penduduk, konsumsi. File referensi provinsi opsional (default memakai referensi yang sudah ada). Batas 2 MB per file; format seperti tabel di bagian 3.
3. **Validasi** — backend mem-parse dan menampilkan hasil per aturan (lulus / peringatan / gagal):
   - Tepat 38 provinsi dan semuanya cocok dengan referensi (nama atau kode).
   - Tidak ada nilai kosong, nol, atau negatif di penduduk, konsumsi, produksi.
   - Σ produksi provinsi = baris "Indonesia" BPS (toleransi 0,1%).
   - Σ penduduk provinsi = baris "Indonesia" BPS (toleransi 0,1%).
   - Peringatan (tidak memblokir): perubahan > 30% dibanding versi published tahun yang sama.
4. **Pratinjau & simpan draft** — tabel 38 provinsi hasil hitung + ringkasan + rekomendasi. Tombol "Simpan sebagai draft".

File mentah disimpan di Supabase Storage (bucket privat `raw-uploads/<tahun>/<versi>/`) agar setiap versi bisa ditelusuri ke file aslinya.

### 6.3 Detail versi & edit per provinsi — `/admin/versi/:id`

- Header: tahun, nomor versi, status (`Badge`), dibuat oleh/kapan, catatan.
- Tabel 38 provinsi. Jika **draft**: kolom input (penduduk, konsumsi/kapita, produksi padi, produksi beras) bisa diedit per baris lewat `Dialog`, dengan alasan perubahan wajib. Kolom turunan (kebutuhan, balance, rasio, status) read-only dan dihitung ulang oleh backend setelah simpan.
- Baris yang diubah dari data upload diberi tanda dan riwayatnya bisa dilihat.
- Tab: Data provinsi · Rekomendasi · Validasi · Riwayat perubahan.
- Tombol (sesuai status):

| Status | Aksi tersedia |
| --- | --- |
| draft | Edit, Hitung ulang, Preview publik, Publish, Hapus draft |
| published | Duplikat jadi draft baru, Unduh |
| archived | Rollback (publish ulang versi ini), Duplikat, Unduh |

Publish dan rollback memakai `AlertDialog` konfirmasi yang menyebut versi lama → versi baru.

### 6.4 Kelola konten — `/admin/konten`

Daftar blok konten (key, judul, isi Markdown) untuk Landing, About, SDG 2, How it works, Batasan, Metodologi, dan info sumber data. Editor Markdown sederhana (`Textarea` + pratinjau). Simpan langsung berlaku (konten tidak diversikan, tetapi setiap simpan tercatat di log).

### 6.5 Log aktivitas — `/admin/log`

Tabel: waktu, admin, aksi (upload, edit\_provinsi, recompute, publish, rollback, edit\_konten, hapus\_draft), objek, detail (JSON sebelum/sesudah). Filter aksi dan admin.

Kriteria selesai panel admin:

- [x] Pengguna tanpa login yang membuka `/admin/*` diarahkan ke login; token non-admin mendapat 403 dari API.
- [x] Upload file contoh di `dataset/raw/` menghasilkan angka identik dengan `dataset_v1.csv` dan rekomendasi identik dengan `rekomendasi_distribusi_v1.csv`.
- [x] Versi published/archived tidak bisa diedit (UI dan API sama-sama menolak).
- [x] Rollback mengubah tampilan publik dalam < 5 detik tanpa deploy ulang.

## 7. Kebutuhan non-fungsional

Target ukurnya dipilih agar bisa diperiksa sebelum demo, bukan angka ideal produksi.

| Area | Kebutuhan | Cara cek |
| --- | --- | --- |
| Performa API | Endpoint baca < 300 ms (p95) dari server; simulasi < 1 s | Log waktu respons FastAPI |
| Performa FE | Bundle awal < 400 KB gzip; Leaflet dan Recharts di-lazy-load per halaman | `vite build` + `rollup-plugin-visualizer` |
| GeoJSON | File batas provinsi disederhanakan (mapshaper) jadi < 1,5 MB, disajikan statis dari FE dengan cache | Ukuran file |
| Responsif | Semua halaman publik usable di 375 px, 768 px, 1280 px | Cek manual 3 lebar |
| Aksesibilitas | Kontras WCAG AA; status tidak hanya lewat warna (ada teks/ikon); semua kontrol bisa dengan keyboard; `aria-label` di peta dan grafik | Lighthouse ≥ 90, uji keyboard |
| Bahasa & format angka | Format Indonesia: titik ribuan, koma desimal (`Intl.NumberFormat('id-ID')`); satuan selalu ditulis (ton, kg/kapita/tahun, km) | Review UI |
| Keamanan | Endpoint tulis hanya untuk admin (JWT + tabel `admins`); RLS aktif di semua tabel; service role key hanya di server; CORS hanya domain FE; upload dibatasi tipe & ukuran | Uji 401/403, cek env FE tidak berisi secret |
| Konsistensi angka | Satu sumber hitung (service Python P5); FE tidak menghitung ulang rumus | Tes kesamaan dengan `dataset_v1.csv` |
| Ketersediaan saat penjurian | Supabase Free menjeda project setelah 1 minggu tidak aktif; perlu dicek sebelum hari penjurian | Checklist pra-demo |
| Keterlacakan | Setiap angka publik bisa ditelusuri ke versi, file mentah, dan admin yang publish | Halaman `/data` |

Supabase menjeda project paket Free jika aktivitas database terlalu sedikit selama seminggu ([Supabase](https://supabase.com/docs/guides/platform/free-project-pausing)). Karena itu ada langkah "buka dashboard Supabase & cek status project" di checklist pra-demo.

**Aturan istilah di UI** (dari catatan P5)

- Jarak selalu ditulis "jarak garis lurus" (antar-titik tengah provinsi). Garis di peta disebut "alur alokasi". Kata **"rute" tidak dipakai** di label, judul, tooltip, maupun legenda.
- Nilai `status` di data dan API selalu huruf kecil (`surplus`, `balanced`, `defisit`); FE hanya mengubah tampilannya jadi label (Surplus, Balanced, Defisit) lewat `lib/status.ts`.
- Satuan: semua dalam ton, kecuali konsumsi (kg/kapita/tahun) dan jarak (km). Satuan selalu tampil di header kolom, sumbu grafik, dan tooltip.

## 8. Arsitektur sistem

FE React hanya bicara ke FastAPI untuk data, dan ke Supabase Auth hanya untuk login admin. FastAPI adalah satu-satunya yang membaca/menulis Postgres dan Storage, dan satu-satunya yang menjalankan rumus P5. Dengan begitu angka di web, laporan, dan unduhan selalu dari sumber yang sama.

&#91;embedded content: arsitektur RiceGuard · FE, FastAPI, Supabase\]

Browser hanya ke Supabase untuk login; semua data, rumus, dan file lewat FastAPI.

**Alur baca publik**: browser → `GET /api/v1/...?tahun=2025` → FastAPI mencari versi published tahun itu → query Postgres → JSON (di-cache per `version_id`).

**Alur admin upload**: FE login via Supabase Auth → kirim file multipart + JWT ke FastAPI → FastAPI verifikasi JWT, simpan file ke Storage, parse, panggil `calc.build()` dan `calc.match()` → tulis versi draft + baris provinsi + rekomendasi ke Postgres → balas hasil validasi.

**Alur simulasi**: browser kirim parameter → FastAPI ambil baris provinsi versi published → terapkan perubahan skenario di memori → `calc.match(params)` → JSON. Tidak ada yang ditulis ke DB.

**Struktur repo (monorepo, satu repo GitHub)**

```
riceguard/
├── apps/
│   ├── web/            # React + Vite + TS + shadcn (P1, P2, P3)
│   └── api/            # FastAPI (P4)
├── packages/
│   └── riceguard_calc/ # rumus + matching P5, jadi paket Python yang di-import api/
├── dataset/            # tetap: raw/, scripts/ (CLI tipis yang memanggil riceguard_calc), tests/
├── supabase/
│   ├── migrations/     # SQL skema + RLS
│   └── seed/           # seed versi 2025 dari dataset_v1.csv
├── docs/               # PRD ini, ADR, GLOSSARY
└── AGENTS.md
```

Perubahan yang dibutuhkan di kode P5: `build_dataset.py` sekarang membaca file dari folder `raw/`. Logika intinya perlu dipisah jadi fungsi murni yang menerima DataFrame (bukan path), misal `build(ref, produksi, penduduk, konsumsi, tahun) -> DataFrame`, supaya bisa dipanggil API dengan file hasil upload. CLI lama tetap jalan dengan memanggil fungsi itu.

**Tech stack**

| Lapisan | Pilihan | Status |
| --- | --- | --- |
| FE build | Vite + React 19 + TypeScript | Dikunci |
| UI | shadcn/ui (Radix) + Tailwind CSS v4 + lucide-react | Dikunci |
| Routing FE | React Router | Usulan |
| Data fetching FE | TanStack Query | Usulan |
| Tabel | TanStack Table (pola Data Table shadcn) | Usulan |
| Form | react-hook-form + zod (pola Form shadcn) | Usulan |
| Grafik | shadcn `chart` (Recharts) | Usulan |
| Peta | Leaflet 1.9 + react-leaflet 5 | Usulan (sesuai rancangan tim: Leaflet) |
| Backend | FastAPI + Pydantic v2 + Uvicorn | Dikunci |
| Akses DB | SQLAlchemy 2 + psycopg 3 ke Postgres Supabase | Usulan |
| Hitung | pandas (sudah dipakai P5) | Dikunci |
| DB, Auth, Storage | Supabase | Dikunci |
| Export | openpyxl (Excel), CSV bawaan; PDF lihat bagian 12 | Usulan |

react-leaflet 5 membutuhkan React 19 dan Leaflet 1.9 sebagai peer dependency ([npm](https://tessl.io/registry/tessl/npm-react-leaflet)). shadcn `chart` dibangun langsung di atas Recharts tanpa membungkusnya, sehingga komponen Recharts dipakai apa adanya ([shadcn/ui](https://ui.shadcn.com/docs/components/base/chart)).

## 9. Desain database (Supabase Postgres)

Skema berpusat pada `dataset_versions`: setiap angka provinsi dan rekomendasi menempel ke satu versi, dan satu tahun hanya boleh punya satu versi published (dijaga unique index parsial). Data referensi provinsi dipisah karena tidak berubah per tahun.

**Tipe enum**

```sql
create type version_status as enum ('draft', 'published', 'archived');
create type province_status as enum ('surplus', 'balanced', 'defisit');
```

**Tabel**

| Tabel | Kolom penting | Kunci & aturan |
| --- | --- | --- |
| `provinces` | kode\_bps text, kode\_kemendagri text, nama text, pulau text, lat numeric(8,4), lng numeric(8,4), luas\_km2 numeric(12,2) null | PK kode\_bps; unique kode\_kemendagri. 38 baris dari `provinces-reference-serlin.csv` |
| `dataset_versions` | id uuid, tahun int, version\_no int, status version\_status, notes text, validation jsonb, summary jsonb, source\_files jsonb, created\_by uuid, created\_at, published\_by uuid, published\_at | PK id; unique (tahun, version\_no); **unique index (tahun) where status = 'published'** |
| `province_stats` | version\_id uuid, kode\_bps text, penduduk\_jiwa bigint, konsumsi\_kg\_kapita\_tahun numeric(6,2), produksi\_padi\_ton\_gkg numeric(14,2), produksi\_beras\_ton numeric(14,2), kebutuhan\_beras\_ton numeric(14,2), rice\_balance\_ton numeric(14,2), rasio\_swasembada numeric(8,4), status province\_status, is\_edited bool | PK (version\_id, kode\_bps); FK ke versions (on delete cascade) dan provinces; check penduduk > 0, konsumsi > 0, produksi ≥ 0 |
| `province_stat_edits` | id bigint, version\_id, kode\_bps, field text, old\_value numeric, new\_value numeric, reason text, edited\_by uuid, edited\_at | Riwayat edit manual per provinsi |
| `distribution_recommendations` | id bigint, version\_id, urutan int, dari\_kode text, ke\_kode text, ton numeric(14,2), jarak\_km numeric(8,1), explanation text | Unique (version\_id, urutan); FK dari/ke ke provinces; check ton > 0 |
| `data_sources` | id, key text, nama text, instansi text, tabel\_resmi text, tahun int, diperbarui date, url text | Ditampilkan di `/data` |
| `site_content` | key text, title text, body\_md text, updated\_by uuid, updated\_at | PK key (about, sdg2, how\_it\_works, limitations, methodology, hero) |
| `admins` | user\_id uuid, nama text, created\_at | PK user\_id, FK ke `auth.users` |
| `audit_log` | id bigint, actor uuid, action text, entity text, entity\_id text, detail jsonb, created\_at | Insert-only |

`summary` di `dataset_versions` menyimpan agregat nasional (total produksi, kebutuhan, balance, jumlah per status, total dialokasikan) supaya Dashboard dan Landing cukup membaca satu baris. Nilai ini dihitung backend saat draft dibuat/dihitung ulang.

**Storage**: bucket privat `raw-uploads`, path `<tahun>/<version_id>/<nama_file>`. Hanya backend (service role) yang membaca/menulis.

**Transaksi publish** (satu transaksi SQL di backend):

1. Pastikan versi target berstatus draft (publish) atau archived (rollback) dan lulus validasi.
2. `update dataset_versions set status = 'archived' where tahun = :t and status = 'published'`.
3. `update dataset_versions set status = 'published', published_at = now(), published_by = :uid where id = :id`.
4. Insert `audit_log`. Commit, lalu hapus cache API untuk tahun itu.

**Row Level Security**

FE tidak mengakses tabel lewat Supabase client (selain Auth), jadi semua tabel di schema `public` diberi RLS **aktif tanpa policy untuk `anon`/`authenticated`**: akses langsung lewat anon key ditolak. Backend terhubung lewat connection string Postgres (role dengan bypass RLS) atau service role key, yang hanya ada di server. Ini menutup jalur PostgREST yang otomatis aktif di setiap project Supabase.

**Seed awal**: migrasi + skrip seed membuat 38 baris `provinces`, versi 2025 v1 berstatus published dari `dataset_v1.csv`, 27 baris rekomendasi dari `rekomendasi_distribusi_v1.csv`, `data_sources` dari README dataset, dan `site_content` awal.

## 10. Spesifikasi REST API (FastAPI)

Base URL `/api/v1`. Nama field mengikuti kolom dataset P5 (snake\_case Bahasa Indonesia) agar FE, CSV, dan DB memakai istilah yang sama. Parameter `tahun` opsional; jika kosong dipakai tahun published terbaru. Dokumentasi interaktif otomatis di `/docs` (OpenAPI), dan tipe TypeScript FE dibuat dari OpenAPI (`openapi-typescript`).

**Endpoint publik (tanpa login)**

| Method & path | Query / body | Respons | Dipakai di |
| --- | --- | --- | --- |
| `GET /meta/years` | — | Daftar tahun published + version\_id, version\_no, published\_at | Pemilih tahun, footer |
| `GET /summary` | tahun | KPI nasional, jumlah per status, total dialokasikan, Δ tahun sebelumnya (null jika tidak ada) | Landing, Dashboard |
| `GET /provinces` | tahun, status, pulau, q, sort, order | 38 baris provinsi (semua kolom dataset) | Dashboard, Analisis, Peta |
| `GET /provinces/{kode_bps}` | tahun | Satu provinsi + `perhitungan` (langkah rumus terisi) + rekomendasi terkait + `riwayat` (semua tahun) | Detail provinsi, panel peta |
| `GET /rankings` | tahun, by = produksi \| kebutuhan \| surplus \| defisit, limit (default 5) | Daftar terurut | Top Regional Statistics |
| `GET /map/layers` | tahun, layer = status \| produksi \| kebutuhan \| kepadatan | `{values: {kode: nilai}, classes: [{min, max, label, color_token}]}` | Peta, legenda |
| `GET /distribution/overview` | tahun | Daftar surplus (surplus, terpakai, sisa) dan defisit (defisit, terpenuhi, prioritas) | Distribusi |
| `GET /distribution/suppliers/{kode_bps}` | tahun | Pemasok untuk satu provinsi defisit, urut jarak, dengan surplus tersedia | Potential Supplier Ranking |
| `GET /distribution/distance-matrix` | tahun | Matriks jarak km defisit × surplus | Geographic Distance Analysis |
| `GET /recommendations` | tahun | Rekomendasi resmi + ringkasan + penjelasan per baris | Rekomendasi, Distribusi |
| `POST /recommendations/simulate` | body: tahun + parameter skenario (bagian 5.6) | Rekomendasi hasil simulasi + status provinsi setelah skenario + perbandingan dengan resmi | Simulasi |
| `GET /trends` | metric, kode\_bps\[\] (opsional) | Deret per tahun (nasional atau per provinsi) | Tren |
| `GET /compare` | tahun\_a, tahun\_b | Δ per provinsi + provinsi yang berubah status | Tren, peta banding |
| `GET /sources` | — | Daftar sumber data | Landing, Data |
| `GET /content` | keys\[\] (opsional) | Blok konten Markdown | Landing, Data |
| `GET /forecast` | tahun | Prediksi produksi dari model eksternal (§5.10). 503 `AI_UNAVAILABLE` kalau endpoint model belum diisi | Prediksi |
| `GET /validation` | tahun | Hasil validasi versi published | Data |
| `GET /exports/provinces.{csv\|xlsx}` | tahun | File unduhan | Data, Laporan |
| `GET /exports/recommendations.{csv\|xlsx}` | tahun | File unduhan | Rekomendasi, Laporan |
| `GET /exports/raw/{nama_file}` | tahun | File mentah versi published (dari Storage) | Data |

**Endpoint admin** (header `Authorization: Bearer <JWT Supabase>`, wajib terdaftar di `admins`)

| Method & path | Body | Fungsi |
| --- | --- | --- |
| `GET /admin/me` | — | Cek sesi + data admin |
| `GET /admin/versions` | query tahun, status | Daftar versi |
| `POST /admin/versions/validate` | multipart: tahun, file | Dry-run: parse + validasi + hitung, **tidak menyimpan** (langkah 3 wizard) |
| `POST /admin/versions` | multipart: tahun, notes, file | Simpan file ke Storage, buat versi draft, hitung, simpan rekomendasi |
| `GET /admin/versions/{id}` | — | Detail versi + validasi + summary |
| `GET /admin/versions/{id}/provinces` | — | 38 baris versi itu (termasuk draft) |
| `PATCH /admin/versions/{id}/provinces/{kode_bps}` | field input yang diubah + reason | Edit (draft saja) → hitung ulang semua kolom turunan + rekomendasi |
| `POST /admin/versions/{id}/recompute` | — | Hitung ulang penuh |
| `POST /admin/versions/{id}/publish` | — | Transaksi publish (bagian 9) |
| `POST /admin/versions/{id}/rollback` | — | Publish ulang versi archived |
| `POST /admin/versions/{id}/duplicate` | notes | Salin jadi draft baru |
| `DELETE /admin/versions/{id}` | — | Hapus draft saja |
| `GET /admin/content` · `PUT /admin/content/{key}` | title, body\_md | Kelola konten |
| `PUT /admin/sources/{id}` | field sumber | Ubah info sumber data |
| `GET /admin/audit-log` | query action, actor, page | Log aktivitas |

Preview draft: endpoint publik menerima `version_id` opsional, tetapi hanya dihormati jika request membawa JWT admin. Tanpa JWT, parameter ini diabaikan.

**Contoh respons `GET /provinces/31?tahun=2025`** (dipotong)

```json
{
  "tahun": 2025,
  "version": {"id": "7b1c…", "version_no": 1},
  "kode_bps": "31",
  "provinsi": "DKI Jakarta",
  "pulau": "Jawa",
  "penduduk_jiwa": 10724334,
  "konsumsi_kg_kapita_tahun": 80.6,
  "produksi_beras_ton": 877.0,
  "kebutuhan_beras_ton": 864381.32,
  "rice_balance_ton": -863504.32,
  "rasio_swasembada": 0.001,
  "status": "defisit",
  "perhitungan": [
    {"langkah": "kebutuhan", "rumus": "penduduk × konsumsi / 1000", "hasil": 864381.32},
    {"langkah": "balance", "rumus": "produksi beras − kebutuhan", "hasil": -863504.32}
  ],
  "rekomendasi_terkait": [
    {"urutan": 1, "dari_kode": "32", "dari": "Jawa Barat", "ton": 863504.32, "jarak_km": 116.8}
  ],
  "riwayat": [{"tahun": 2025, "produksi_beras_ton": 877.0, "kebutuhan_beras_ton": 864381.32}]
}
```

**Contoh body `POST /recommendations/simulate`**

```json
{
  "tahun": 2025,
  "ambang_swasembada": 0.9,
  "persen_surplus_dilepas": 80,
  "jarak_maks_km": 1500,
  "kecualikan_pemasok": ["95"],
  "kecualikan_penerima": [],
  "perubahan_produksi": {"33": -20},
  "perubahan_konsumsi_persen": 0,
  "mode": "greedy_v1"
}
```

Respons: `{ "rekomendasi": [...], "provinsi": [{kode_bps, status, rice_balance_ton}], "ringkasan": {...}, "banding_resmi": {delta_ton, delta_ton_km, status_berubah: [...], defisit_tidak_tertutup: [...]} }`.

**Format error** (semua endpoint)

```json
{"error": {"code": "VERSION_NOT_EDITABLE", "message": "Versi published tidak bisa diedit", "details": null}}
```

| HTTP | code | Kapan |
| --- | --- | --- |
| 400 | `INVALID_PARAMS` | Query/body tidak valid (Pydantic) |
| 401 | `UNAUTHORIZED` | JWT tidak ada / tidak valid / kedaluwarsa |
| 403 | `FORBIDDEN` | JWT valid tetapi bukan admin |
| 404 | `NOT_FOUND` / `NO_PUBLISHED_VERSION` | Provinsi/versi tidak ada; tahun belum punya versi published |
| 409 | `VERSION_NOT_EDITABLE` | Edit/hapus versi published/archived |
| 422 | `VALIDATION_FAILED` | Upload tidak lulus validasi; `details` berisi daftar aturan yang gagal |
| 413 | `FILE_TOO_LARGE` | File > 2 MB |

## 11. Frontend (React + Vite + shadcn/ui)

FE disusun per fitur: setiap halaman punya folder sendiri berisi komponen, hook data, dan tipe. Komponen shadcn ada di `components/ui` dan tidak diubah langsung kecuali tema.

**Struktur folder `apps/web/src`**

```
src/
├── main.tsx, App.tsx, router.tsx
├── components/
│   ├── ui/                 # hasil `npx shadcn add ...`
│   ├── layout/             # PublicLayout, AdminLayout, Header, YearSelect, Footer, LimitationBanner
│   ├── map/                # BaseMap, ProvinceLayer, FlowLines, MapLegend, ProvinceSearch
│   ├── charts/             # BalanceBarChart, ProdVsDemandChart, IslandShareChart, TrendLineChart
│   └── common/             # StatCard, StatusBadge, NumberCell, EmptyState, ErrorState
├── features/
│   ├── landing/  dashboard/  map/  analysis/  distribution/
│   ├── recommendations/   # termasuk simulation/
│   ├── trends/  data/  reports/
│   └── admin/             # login, versions, version-detail, upload-wizard, content, audit-log
├── lib/
│   ├── api.ts              # fetch wrapper + base URL + token admin + parsing error
│   ├── api-types.ts        # hasil openapi-typescript dari FastAPI
│   ├── supabase.ts         # createClient, hanya untuk Auth
│   ├── format.ts           # formatTon, formatJiwa, formatPersen, formatKm (id-ID)
│   └── status.ts           # label, warna token, ikon per status
├── hooks/                  # useTahun (baca/tulis ?tahun), useAdminSession
└── styles/index.css        # Tailwind v4 + token tema shadcn + token status

public/geo/provinsi-38.min.geojson
```

**Routing** (React Router): `PublicLayout` membungkus 11 route publik; `AdminLayout` membungkus `/admin/*` dengan guard yang mengecek sesi Supabase lalu memanggil `GET /admin/me`. Semua halaman di-lazy-load (`React.lazy`) agar Leaflet dan Recharts hanya dimuat di halaman yang memakainya.

**Data fetching** (TanStack Query)

- Query key selalu memuat tahun dan (jika ada) version\_id: `['provinces', tahun]`, `['province', kode, tahun]`, `['recommendations', tahun]`.
- `staleTime` 5 menit untuk data publik (data hanya berubah saat publish).
- Simulasi memakai `useMutation`, dipicu tombol "Jalankan" (bukan setiap slider bergeser).
- Admin: setelah publish/edit, `invalidateQueries` untuk key tahun terkait.

**State di URL** (agar bisa dibagikan): `?tahun=`, filter tabel analisis, layer peta (`?layer=`), provinsi terpilih (`?prov=`), parameter simulasi.

**Komponen shadcn yang dipasang**

`button card badge table tabs select command popover dialog alert-dialog sheet drawer form input textarea slider switch checkbox label tooltip skeleton alert sonner separator scroll-area dropdown-menu navigation-menu breadcrumb progress chart sidebar` (sidebar untuk layout admin).

**Peta (react-leaflet)**

- `MapContainer` dengan batas Indonesia (`maxBounds`), zoom awal seluruh Indonesia.
- GeoJSON dimuat sekali dari `public/geo` dan di-cache; nilai layer datang terpisah dari `GET /map/layers`. Style dihitung dari `values[kode]` + `classes`, jadi ganti layer tidak memuat ulang poligon.
- Komponen `<GeoJSON>` react-leaflet tidak otomatis menggambar ulang saat `data` berubah; ganti `key` (misal `layer + tahun`) atau set style lewat ref `setStyle` saat layer berubah.
- Garis distribusi: `Polyline` dari centroid ke centroid, ketebalan 2–10 px sesuai ton (skala akar), panah arah memakai plugin dekorator atau marker kecil di ujung.
- Warna status memakai token CSS yang sama dengan `StatusBadge` dan grafik, plus pola/ikon di legenda.

**Grafik (shadcn chart / Recharts)**: setiap grafik memakai `ChartContainer` dengan tinggi tetap (wajib untuk Recharts v3), `ChartTooltip` yang memformat angka id-ID, dan `accessibilityLayer`.

**Token warna status** (didefinisikan di `index.css`, mode terang & gelap): `--status-surplus`, `--status-balanced`, `--status-defisit`, plus skala sekuensial 5 kelas `--seq-1` … `--seq-5` untuk layer produksi/kebutuhan/kepadatan.

**Variabel lingkungan FE**

| Variabel | Isi |
| --- | --- |
| `VITE_API_BASE_URL` | URL FastAPI, misal `https://api.riceguard.example/api/v1` |
| `VITE_SUPABASE_URL` | URL project Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable/anon key (aman di browser karena RLS menolak akses tabel) |

Pemasangan shadcn di Vite memakai `npx shadcn@latest init` setelah Tailwind v4 dan alias `@/*` di `tsconfig` serta `vite.config.ts` terpasang ([shadcn/ui](https://ui.shadcn.com/docs/installation/vite)).

## 12. Backend (FastAPI)

Backend dibagi jadi router (HTTP), service (logika), dan paket `riceguard_calc` (rumus P5). Router tidak boleh berisi rumus; service tidak boleh tahu soal HTTP.

**Struktur folder `apps/api`**

```
apps/api/
├── app/
│   ├── main.py                 # FastAPI(), CORS, router, handler error
│   ├── core/
│   │   ├── config.py           # pydantic-settings: DATABASE_URL, SUPABASE_URL, dll.
│   │   ├── security.py         # verifikasi JWT Supabase (JWKS) + dependency require_admin
│   │   └── errors.py           # AppError + format {error: {code, message, details}}
│   ├── db/
│   │   ├── session.py          # engine SQLAlchemy + get_db()
│   │   └── models.py           # tabel bagian 9
│   ├── schemas/                # Pydantic request/response per fitur
│   ├── routers/
│   │   ├── public/             # meta, summary, provinces, map, distribution, recommendations, trends, data, exports
│   │   └── admin/              # versions, content, sources, audit
│   └── services/
│       ├── versions.py         # resolve versi published, publish, rollback, duplikat
│       ├── ingest.py           # baca file upload → DataFrame + validasi
│       ├── compute.py          # panggil riceguard_calc.build + match, simpan hasil + summary
│       ├── simulation.py       # terapkan skenario + match tanpa simpan
│       ├── explain.py          # kalimat penjelasan rekomendasi
│       ├── map_layers.py       # nilai + kelas legenda per layer
│       ├── exports.py          # CSV / Excel (openpyxl) / PDF
│       ├── storage.py          # Supabase Storage (service role)
│       └── audit.py
├── tests/                      # pytest + httpx TestClient
├── pyproject.toml
└── Dockerfile
```

**Auth admin**

Project Supabase baru menandatangani JWT dengan kunci asimetris, dan kunci publiknya tersedia di endpoint JWKS `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json` sehingga backend bisa memverifikasi token secara lokal ([Supabase](https://supabase.com/docs/guides/auth/signing-keys)). Endpoint ini tidak mengembalikan kunci jika project masih memakai JWT secret lama (HS256) ([Supabase](https://supabase.com/docs/guides/auth/jwts)).

Alur dependency `require_admin`:

1. Ambil token dari header `Authorization: Bearer`.
2. Verifikasi dengan PyJWT + `PyJWKClient` (kunci di-cache), cek `exp`, `iss` = `<SUPABASE_URL>/auth/v1`, dan `aud` = `authenticated`.
3. Ambil `sub` (user id) → cek ada di tabel `admins`; jika tidak → 403.
4. Kembalikan objek admin ke handler; semua aksi tulis mencatat `audit_log` dengan id ini.

Cek di dashboard Supabase apakah project RiceGuard sudah memakai JWT signing keys; jika masih legacy, verifikasi memakai `SUPABASE_JWT_SECRET` (HS256) atau migrasi ke signing keys.

**Service hitung (`compute.py`)**

1. Terima 4 DataFrame (referensi dari tabel `provinces`, produksi, penduduk, konsumsi) + tahun.
2. `riceguard_calc.build(...)` → 38 baris dengan kolom turunan + status (rumus bagian 3).
3. `riceguard_calc.match(...)` → rekomendasi.
4. `explain.py` membuat kalimat per rekomendasi.
5. Hitung `summary` nasional + hasil validasi → simpan semuanya dalam satu transaksi.

Edit per provinsi memakai jalur yang sama: ambil 38 baris input versi draft, ganti nilai yang diedit, jalankan langkah 2–5 ulang. Karena matching bersifat global (satu provinsi berubah bisa mengubah alokasi provinsi lain), rekomendasi selalu dihitung ulang penuh.

**Simulasi (`simulation.py`)**

1. Ambil baris input versi published tahun itu.
2. Terapkan `perubahan_produksi` per provinsi dan `perubahan_konsumsi_persen`.
3. Hitung ulang balance, rasio, dan status dengan `ambang_swasembada`.
4. Surplus tersedia = balance × `persen_surplus_dilepas`.
5. Buang pemasok/penerima yang dikecualikan; jalankan matching dengan `jarak_maks_km`.
6. Bandingkan dengan rekomendasi resmi → `banding_resmi`.

Langkah 3–5 butuh parameter baru di fungsi matching P5 (ambang, persen, jarak maks, daftar kecuali). Nilai default harus menghasilkan output identik dengan v1 (uji regresi). Mode "Optimal" (minimasi total ton-km dengan program linear, misal `scipy.optimize.linprog`) hanya dikerjakan jika tim setuju dan waktu cukup.

**Kalimat penjelasan (`explain.py`)** — template dari data, **tanpa** LLM atau model apa pun. Ini berbeda dari §5.10: prediksi AI tidak pernah menulis kalimat rekomendasi.

> "{dari} dipilih untuk {ke} karena merupakan provinsi surplus ke-{n} terdekat ({jarak} km) dengan sisa surplus {sisa} ton saat giliran {ke}. Alokasi {ton} ton menutup {persen}% defisit {ke}."

**Layer peta (`map_layers.py`)**: layer status memakai 3 kategori tetap. Layer produksi, kebutuhan, dan kepadatan memakai 5 kelas (usulan: kuantil per tahun), dikembalikan bersama legenda agar FE, PDF, dan legenda selalu sama.

**Cache**: respons publik di-cache in-memory per (endpoint, version\_id, query). Cache dikosongkan saat publish/rollback. Header `Cache-Control: public, max-age=300` untuk data publik.

**Export**

- CSV: kolom sama persis dengan `dataset_v1.csv` / `rekomendasi_distribusi_v1.csv`, UTF-8 dengan BOM agar terbuka rapi di Excel.
- Excel: openpyxl, 3 sheet (Provinsi, Rekomendasi, Metadata), format angka ribuan.
- PDF: dua opsi, belum dikunci:

| Opsi | Cara | Kelebihan | Kekurangan |
| --- | --- | --- | --- |
| A. Dari FE | Route cetak di React (`/laporan/cetak/...`) dengan CSS `@media print`, lalu `window.print()` → "Simpan sebagai PDF" | Peta Leaflet dan grafik ikut tercetak apa adanya; tanpa dependency server | Hasil sedikit berbeda antar browser; pengguna menekan dialog cetak |
| B. Dari BE | Template HTML (Jinja2) → WeasyPrint → file PDF | Satu klik unduh, hasil konsisten | Butuh library sistem (Pango) di Docker; peta & grafik harus dibuat ulang jadi gambar statis di server |

**Variabel lingkungan BE**

| Variabel | Isi |
| --- | --- |
| `DATABASE_URL` | Connection string Postgres Supabase (pooler) |
| `SUPABASE_URL` | URL project |
| `SUPABASE_SERVICE_ROLE_KEY` | Untuk Storage; **hanya di server** |
| `SUPABASE_JWT_SECRET` | Hanya jika project masih legacy HS256 |
| `CORS_ORIGINS` | Domain FE, dipisah koma |
| `MAX_UPLOAD_MB` | 2 |
| `AI_ENDPOINT_URL` | URL endpoint model di Hugging Face Space. Kosong = `/forecast` 503 |
| `AI_API_TOKEN` | Token Space kalau privat. Hanya di server |
| `AI_TIMEOUT_DETIK` | Batas tunggu panggilan model, default 20 |

**Testing**

- Unit: 4 tes P5 + tes regresi "upload `raw/` 2025 → hasil identik `dataset_v1.csv` & `rekomendasi_distribusi_v1.csv`" + "simulasi default = resmi".
- API: setiap endpoint publik 200/404; admin 401 tanpa token, 403 non-admin, 409 edit versi published.
- CI GitHub Actions: `pytest` (api + dataset) dan `npm run build` + lint (web) di setiap push.

## 13. Deploy, rencana kerja, risiko, pertanyaan terbuka

### 13.1 Deploy

| Bagian | Tempat | Catatan |
| --- | --- | --- |
| FE (build statis Vite) | Belum dipilih (misal Vercel / Netlify / Cloudflare Pages) | Perlu rewrite SPA: semua path → `index.html` |
| BE (FastAPI, Docker) | Belum dipilih | Lihat risiko cold start di bawah |
| DB, Auth, Storage | Supabase | Migrasi dari `supabase/migrations` |
| Model prediksi (opsional) | Hugging Face Space, dikelola pemilik model | Dipanggil BE lewat `AI_ENDPOINT_URL`. Tidak memuat kode di repo ini (§5.10) |

Catatan hosting BE: web service gratis di Render dimatikan setelah 15 menit tanpa trafik, dan request pertama sesudahnya bisa tertunda sekitar 30 detik atau lebih ([Render](https://render.com/docs/free)). Untuk penjurian, pilih hosting yang tidak tidur atau siapkan cara membangunkan server sebelum juri membuka web.

**Checklist pra-demo**

- [ ] Project Supabase aktif (tidak dijeda).
- [ ] BE merespons `GET /api/v1/meta/years` < 1 detik.
- [ ] Versi 2025 published, 38 provinsi, 27 rekomendasi.
- [ ] Akun admin demo bisa login; satu file contoh siap di-upload untuk demo.
- [ ] Semua kriteria selesai di bagian 5 dan 6 tercentang.

### 13.2 Rencana kerja 25–30 November 2026

Pembagian mengikuti tabel tugas tim (P1 PM & full-stack, P2 FE Dashboard, P3 FE WebGIS, P4 Backend, P5 Data & Algoritma).

| Tanggal | P1 | P2 | P3 | P4 | P5 |
| --- | --- | --- | --- | --- | --- |
| Rab 25 Nov | Monorepo, project Supabase, migrasi skema, CI | Scaffold Vite + Tailwind v4 + shadcn, layout publik, `format.ts` | Sederhanakan GeoJSON, cek 38 kode cocok dengan dataset | Skeleton FastAPI, model DB, seed 2025 | Pisahkan `build()` & `match()` jadi paket `riceguard_calc` |
| Kam 26 Nov | Auth admin (FE login + `require_admin`) | Dashboard + Analisis (daftar & detail) | Halaman Peta: layer, legenda, search, popup | Endpoint publik: meta, summary, provinces, rankings, map/layers, recommendations | Parameter simulasi di matching + uji regresi default = v1 |
| Jum 27 Nov | Wizard upload + detail versi | Landing + Data & Metodologi + Rekomendasi resmi | Halaman Distribusi: garis alur, matriks jarak, ranking pemasok | Endpoint admin: validate, create, patch, recompute, publish, rollback | `explain.py` + `simulation.py` bersama P4 |
| Sab 28 Nov | Konten + log admin; laporan PDF | Halaman Simulasi | Halaman Tren (data dummy 2 tahun) + peta banding | Export CSV/Excel, cache, endpoint tren/compare | Validasi upload (aturan bagian 6.2) |
| Min 29 Nov | Deploy FE + BE, integrasi | QA responsif & aksesibilitas | QA peta di mobile | Tes API 401/403/409, performa | Cek angka web = dataset\_v1 |
| Sen 30 Nov | Freeze, checklist pra-demo, submit | Perbaikan akhir | Perbaikan akhir | Perbaikan akhir | Perbaikan akhir |

Catatan: 30 November 2026 jatuh pada hari Senin. Jam batas pengumpulan belum diketahui.

Fitur prediksi (§5.10) tidak masuk tabel ini karena pemiliknya di luar P1–P5: model dilatih dan di-deploy sendiri di Hugging Face. Integrasinya hanya dikerjakan setelah endpoint model hidup dan kontraknya disetujui; kalau tidak selesai sebelum freeze, fitur tidak dirilis.

### 13.3 Risiko

| Risiko | Dampak | Penanganan |
| --- | --- | --- |
| Semua 9 fitur dalam 6 hari | Fitur setengah jadi saat demo | Urutan kerja mengikuti 14 item MVP dulu (tiga fitur inti: Peta, Analisis, Rekomendasi), sisanya menyusul |
| GeoJSON tidak cocok kodenya | Provinsi abu-abu di peta | P3 cek di hari pertama; tabel pemetaan kode di FE jika perlu |
| Kode BPS ≠ Kemendagri untuk 6 provinsi Papua | Data salah tempel | PK `kode_bps` di semua tabel; join konsumsi pakai Kemendagri hanya saat ingest |
| Server gratis tidur / Supabase dijeda | Juri melihat web lambat/mati | Checklist pra-demo; pertimbangkan paket berbayar sementara |
| Simulasi mengubah perilaku matching v1 | Angka resmi berubah | Uji regresi default = v1 di CI |
| Klaim berlebihan ("stok", "rute") | Dikritik juri | Banner batasan di 4 halaman + bagian metodologi |

### 13.4 Pertanyaan terbuka (perlu jawaban tim)

1. **GeoJSON**: join sudah pasti lewat kode\_bps. Tinggal file GeoJSON Satria dimasukkan ke repo; sudah 38 provinsi?
2. **Layer kepadatan penduduk**: butuh luas wilayah. Pakai data luas resmi BPS (perlu ditambahkan ke `raw/`) atau dihitung dari poligon GeoJSON?
3. **Regional Connectivity Analysis**: tidak ada data jaringan transportasi. Setuju memakai penanda satu pulau / lintas pulau, atau fitur ini dikeluarkan?
4. **Parameter simulasi** di bagian 5.6: semuanya disetujui P5? Mode "Optimal" (program linear) masuk atau tidak?
5. **PDF**: opsi A (dari FE, print) atau B (WeasyPrint di BE)?
6. **Hosting FE dan BE**: layanan apa, dan apakah ada anggaran untuk paket yang tidak tidur selama penjurian?
7. **Bahasa UI**: label menu Bahasa Indonesia, Inggris (seperti rancangan navigasi), atau dua bahasa?
8. **Kelas warna peta**: setuju 5 kelas kuantil untuk layer produksi/kebutuhan/kepadatan?
9. **Pengumpulan lomba**: jam batas 30 Nov, dan apa saja yang dikumpulkan (link web, repo, video, proposal)? Ada kriteria penilaian tertulis?
10. **Repo**: tetap `next-riceguard` atau di-rename karena tidak memakai Next.js?
11. **Supabase**: project sudah memakai JWT signing keys (asimetris) atau masih JWT secret lama?
12. **Navigasi**: Laporan cukup lewat tombol di header, atau jadi menu ke-8?
13. **Nama anggota P1–P5**, untuk diisi di tabel rencana kerja.
14. **Prediksi AI (§5.10)**: tahun target, fitur masukan, Space publik/privat, dan apakah interval keyakinan dilaporkan. Dijawab pemilik model sebelum BE `/forecast` ditulis.
