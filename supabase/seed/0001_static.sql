-- Seed statis RiceGuard: referensi provinsi, sumber data, dan konten awal.
-- Jalankan setelah supabase/migrations/0001_init.sql.
-- Aman dijalankan ulang: semua insert memakai ON CONFLICT DO NOTHING.

insert into provinces (kode_bps, kode_kemendagri, nama, pulau, lat, lng, luas_km2) values
  ('11', '11', 'Aceh', 'Sumatera', 4.2257, 96.9119, null),
  ('12', '12', 'Sumatera Utara', 'Sumatera', 2.1884, 99.0581, null),
  ('13', '13', 'Sumatera Barat', 'Sumatera', -0.8485, 100.4654, null),
  ('14', '14', 'Riau', 'Sumatera', 0.5087, 101.815, null),
  ('15', '15', 'Jambi', 'Sumatera', -1.6988, 102.7159, null),
  ('16', '16', 'Sumatera Selatan', 'Sumatera', -3.2127, 104.1703, null),
  ('17', '17', 'Bengkulu', 'Sumatera', -3.5563, 102.3425, null),
  ('18', '18', 'Lampung', 'Sumatera', -4.9173, 105.0217, null),
  ('19', '19', 'Kepulauan Bangka Belitung', 'Sumatera', -2.4499, 106.5561, null),
  ('21', '21', 'Kepulauan Riau', 'Sumatera', 1.481, 105.4049, null),
  ('31', '31', 'DKI Jakarta', 'Jawa', -6.199, 106.8344, null),
  ('32', '32', 'Jawa Barat', 'Jawa', -6.9206, 107.6033, null),
  ('33', '33', 'Jawa Tengah', 'Jawa', -7.2594, 110.2015, null),
  ('34', '34', 'Daerah Istimewa Yogyakarta', 'Jawa', -7.8949, 110.4456, null),
  ('35', '35', 'Jawa Timur', 'Jawa', -7.7194, 112.7324, null),
  ('36', '36', 'Banten', 'Jawa', -6.4561, 106.109, null),
  ('51', '51', 'Bali', 'Bali & Nusa Tenggara', -8.3698, 115.1317, null),
  ('52', '52', 'Nusa Tenggara Barat', 'Bali & Nusa Tenggara', -8.6066, 117.5076, null),
  ('53', '53', 'Nusa Tenggara Timur', 'Bali & Nusa Tenggara', -9.2604, 122.1818, null),
  ('61', '61', 'Kalimantan Barat', 'Kalimantan', -0.0865, 111.1208, null),
  ('62', '62', 'Kalimantan Tengah', 'Kalimantan', -1.6062, 113.4163, null),
  ('63', '63', 'Kalimantan Selatan', 'Kalimantan', -3.4843, 114.8339, null),
  ('64', '64', 'Kalimantan Timur', 'Kalimantan', 0.4547, 116.4509, null),
  ('65', '65', 'Kalimantan Utara', 'Kalimantan', 2.915, 116.2457, null),
  ('71', '71', 'Sulawesi Utara', 'Sulawesi', 1.2611, 124.5227, null),
  ('72', '72', 'Sulawesi Tengah', 'Sulawesi', -1.0179, 121.2069, null),
  ('73', '73', 'Sulawesi Selatan', 'Sulawesi', -3.7341, 120.1611, null),
  ('74', '74', 'Sulawesi Tenggara', 'Sulawesi', -4.1365, 122.0746, null),
  ('75', '75', 'Gorontalo', 'Sulawesi', 0.6863, 122.3757, null),
  ('76', '76', 'Sulawesi Barat', 'Sulawesi', -2.4656, 119.3474, null),
  ('81', '81', 'Maluku', 'Maluku', -4.7381, 129.8402, null),
  ('82', '82', 'Maluku Utara', 'Maluku', 0.2116, 127.5421, null),
  ('91', '92', 'Papua Barat', 'Papua', -2.654, 133.6495, null),
  ('92', '96', 'Papua Barat Daya', 'Papua', -1.1238, 131.9547, null),
  ('94', '91', 'Papua', 'Papua', -2.6179, 138.5322, null),
  ('95', '93', 'Papua Selatan', 'Papua', -6.6801, 139.547, null),
  ('96', '94', 'Papua Tengah', 'Papua', -3.9033, 136.6442, null),
  ('97', '95', 'Papua Pegunungan', 'Papua', -4.2694, 139.4986, null)
on conflict (kode_bps) do nothing;

insert into data_sources (key, nama, instansi, tabel_resmi, tahun, diperbarui, url) values
  ('produksi', 'Produksi Padi dan Beras Menurut Provinsi', 'BPS', 'Survei KSA & Ubinan', 2025, '2026-02-12', null),
  ('penduduk', 'Jumlah Penduduk menurut Provinsi', 'BPS', 'SUPAS 2025', 2025, null, null),
  ('konsumsi', 'Rata-rata Konsumsi per Jenis Pangan Penduduk Indonesia Provinsi', 'Bapanas', 'Komoditas Beras (kg/kapita/tahun)', 2025, null, null),
  ('referensi', 'Referensi provinsi dan titik pusat', 'Tim WebGIS RiceGuard', 'provinces-reference-serlin.csv', 2025, null, null)
on conflict (key) do nothing;

insert into site_content (key, title, body_md) values
  ('hero', 'RiceGuard', 'Beras surplus secara nasional, tetapi tidak merata. RiceGuard memetakan keseimbangan produksi dan kebutuhan beras 38 provinsi, lalu menunjukkan dari mana kekurangan bisa ditutup.'),
  ('about', 'Tentang RiceGuard', 'RiceGuard menggabungkan data produksi BPS, penduduk BPS, dan konsumsi Bapanas menjadi satu angka kebutuhan beras per provinsi. Hasilnya tampil di peta: provinsi mana yang surplus dan mana yang defisit. Untuk setiap provinsi defisit, sistem menawarkan provinsi surplus terdekat sebagai calon pemasok.'),
  ('sdg2', 'SDG 2 — Tanpa Kelaparan', 'RiceGuard mendukung SDG 2 (Zero Hunger) dengan menyoroti ketersediaan pangan pokok per wilayah sebagai dasar analisis ketahanan pangan.'),
  ('how_it_works', 'Cara Kerja', '1. Data mentah BPS dan Bapanas diunggah dan digabung per provinsi.
2. Kebutuhan beras dihitung dari penduduk dikali konsumsi per kapita, lalu dibandingkan dengan produksi beras.
3. Setiap provinsi diberi status surplus, balanced, atau defisit dan dipetakan ke 38 provinsi.
4. Provinsi defisit dicocokkan dengan provinsi surplus terdekat, dengan alokasi sebesar kekurangan yang tersisa.'),
  ('limitations', 'Batasan Klaim', 'Balance = produksi beras dikurangi estimasi konsumsi. Ini bukan stok beras aktual: stok Bulog, cadangan, impor, dan perdagangan antarwilayah tidak dihitung. Jarak adalah garis lurus antar-titik pusat provinsi, bukan jarak jalan atau rute laut. Rekomendasi bersifat potensial berbasis data tahunan, bukan rencana logistik: biaya angkut, moda, dan kebijakan belum dihitung. Kebutuhan memakai konsumsi rumah tangga per kapita, sehingga kebutuhan industri, hotel/restoran, dan susut tidak termasuk. Jika fitur prediksi AI diaktifkan, angka prediksi berasal dari model eksternal di luar dataset resmi dan tidak pernah dipakai untuk menghitung status provinsi maupun rekomendasi distribusi.'),
  ('methodology', 'Metodologi', 'Kebutuhan beras (ton) = penduduk x konsumsi per kapita (kg) / 1000.

Rice balance (ton) = produksi beras - kebutuhan beras.

Rasio swasembada = produksi beras / kebutuhan beras.

Status: surplus jika rasio > 1; balanced jika 0,90 <= rasio <= 1 (kriteria swasembada FAO 1999); defisit jika rasio < 0,90. Status mengikuti kolom status, bukan tanda balance.

Rekomendasi distribusi: provinsi defisit diurutkan dari defisit terbesar, lalu dipenuhi dari provinsi surplus terdekat (jarak haversine antar-titik pusat provinsi). Alokasi = min(sisa defisit, sisa surplus). Provinsi balanced tidak menjadi pemasok maupun penerima.')
on conflict (key) do nothing;
