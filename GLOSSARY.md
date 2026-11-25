# RiceGuard

Istilah domain untuk keseimbangan produksi–kebutuhan beras 38 provinsi dan alokasi dari provinsi surplus ke provinsi defisit. Satu konteks, satu glossary.

## Bahasa

**Versi dataset**:
Satu set angka 38 provinsi untuk satu tahun, dengan nomor versi dan status. Publik hanya membaca versi yang sedang published.
_Avoid_: snapshot, batch, rilis

**Published / draft / archived**:
Status versi dataset. Published = dibaca publik dan dipakai semua fitur; draft = masih bisa diedit admin dan hanya terlihat lewat preview admin; archived = versi lama yang bisa dipulihkan lewat rollback.
_Avoid_: aktif, final, terbit

**Kebutuhan beras**:
Jumlah beras yang dibutuhkan penduduk satu wilayah dalam setahun, dihitung dari penduduk dikali konsumsi per kapita.
_Avoid_: demand, konsumsi nasional

**Rice balance**:
Produksi beras dikurangi kebutuhan beras. Nilainya bisa negatif. Ini **bukan** stok beras.
_Avoid_: stok, saldo, surplus (untuk kolom ini)

**Rasio swasembada**:
Produksi beras dibagi kebutuhan beras.
_Avoid_: rasio produksi, self-sufficiency

**Surplus / balanced / defisit**:
Kategori status satu provinsi. Surplus jika rasio di atas 1; balanced jika rasio antara 0,90 dan 1; defisit jika rasio di bawah 0,90. Status mengikuti kolom `status`, bukan tanda rice balance.
_Avoid_: untung/rugi, lebih/kurang

**Rekomendasi distribusi**:
Pasangan pemasok–penerima beserta jumlah ton yang dialokasikan, dihasilkan algoritma matching dari data satu versi dataset. Rekomendasi bersifat potensial, bukan rencana logistik.
_Avoid_: rute, jadwal kirim, order

**Alur alokasi**:
Sebutan untuk garis di peta yang menghubungkan titik pusat provinsi pemasok dan penerima pada satu rekomendasi distribusi.
_Avoid_: rute, jalur logistik

**Jarak garis lurus**:
Jarak haversine antar-titik pusat provinsi. Bukan jarak jalan, bukan jarak laut.
_Avoid_: jarak tempuh, jarak rute

**Simulasi**:
Perhitungan ulang rekomendasi dengan parameter skenario (ambang, persen surplus dilepas, perubahan produksi, jarak maksimum) tanpa menyimpan apa pun ke database.
_Avoid_: what-if, prediksi

**Prediksi**:
Keluaran model statistik/ML eksternal tentang produksi beras pada tahun yang belum punya data. Bukan bagian dataset resmi, tidak dipakai untuk rekomendasi distribusi, dan selalu diberi penanda non-resmi.
_Avoid_: proyeksi resmi, angka dataset, simulasi

**Batasan klaim**:
Daftar hal yang **tidak** diklaim oleh RiceGuard (bukan stok, bukan rencana logistik, bukan kebutuhan industri). Wajib tampil di UI dan laporan.
_Avoid_: disclaimer, catatan kaki
