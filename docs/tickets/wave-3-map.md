---
scope: tickets/wave-3
canonical-for: ["spesifikasi tiket wave 3 peta interaktif"]
sources: ["docs/tickets/README.md", "docs/RiceGuard — PRD & Dokumen Teknis (FE + BE).md"]
last-verified: 2026-11-26
---

# Wave 3 — Fitur 3: Interactive Rice Map (`/peta`)

Kriteria selesai PRD §5.3: 38 poligon terwarnai tanpa abu-abu; ganti layer < 200 ms tanpa
request ulang GeoJSON; bisa dipakai keyboard; warna disertai pola/label.

**Blocker:** B5 (file GeoJSON) dan B6 (`luas_km2`) di `README.md`.

---

## T3.1 — `GET /map/layers` (layer status + kontrak legenda)

**Blocked by:** T0.6, T2.2

**Scope**
- `?tahun=&layer=status|produksi|kebutuhan|kepadatan`.
- Respons: `{layer, tahun, satuan, values: {"11": ..., ...}, classes: [{min, max, label, color_token}],
  min, max}`.
- `layer=status`: `values[kode]` = `"surplus"|"balanced"|"defisit"`, `classes` = 3 kategori tetap
  (`--status-surplus`, `--status-balanced`, `--status-defisit`).
- Kontrak: `values` selalu 38 kunci `kode_bps` bertipe string, termasuk yang nilainya `null`.

**Acceptance**
- `layer=status` → 38 kunci, 17/1/20.
- `color_token` memakai nama token CSS PRD §11 (bukan hex), supaya FE/PDF/legenda sama.
- Layer tidak dikenal → 400 `INVALID_PARAMS`.

**Tes:** `test_map_layers.py`.

---

## T3.2 — 5 kelas kuantil untuk produksi & kebutuhan

**Blocked by:** T3.1

**Scope**
- `app/services/map_layers.py`: `quantile_classes(series, n=5)` → batas kelas unik
  (nilai kembar digabung, jadi bisa < 5 kelas; laporkan apa adanya, jangan paksa 5).
- Label kelas: `"< 1.234 ton"` / `"1.234 – 5.678 ton"` dst., format `id-ID`.
- `satuan` = `"ton"`.

**Acceptance**
- `layer=produksi` → kelas monoton naik, tanpa tumpang tindih, `min` kelas 1 = min data,
  `max` kelas terakhir = max data.
- Provinsi dengan produksi 0 masuk kelas pertama (bukan `null`).

**Tes:** `test_map_layers_quantile.py` (termasuk kasus nilai kembar).

---

## T3.3 — Layer kepadatan penduduk + `luas_km2`

**Blocked by:** T3.2, B6

**Scope**
- Kalau semua `provinces.luas_km2` `null`: `GET /map/layers?layer=kepadatan` → **409**
  `{"code": "LAYER_UNAVAILABLE", "details": {"alasan": "luas_km2 belum tersedia"}}`.
- Kalau sebagian terisi: hitung yang ada, sisanya `null` di `values`, dan
  `details.kode_tanpa_luas: [...]` di respons sukses.
- `satuan` = `"jiwa/km²"`.

**Acceptance**
- Tanpa `luas_km2`: 409 dengan kode di atas (bukan 500, bukan 200 berisi kosong).
- Dengan `luas_km2` terisi 38 baris: 38 nilai, kelas kuantil 5.

**Tes:** `test_map_layers_density.py` (dua kondisi).

---

## T3.4 — Halaman Peta (FE)

**Blocked by:** T3.1, T3.2

**Scope**
- `src/components/map/`: `BaseMap` (Leaflet + OSM/CARTO Positron, atribusi wajib, `maxBounds` Indonesia),
  `ProvinceLayer` (`<GeoJSON>` dimuat sekali dari `public/geo/provinsi-38.min.geojson`, style dari
  `values` + `classes`, ganti `key` = `layer+tahun` saat layer berubah), `MapLegend`, `ProvinceSearch`
  (`Command` combobox), `FlowLines` (dipakai Wave 5).
- Panel kanan (desktop) / `Drawer` (mobile): ringkasan provinsi + tombol "Analisis lengkap".
- Radio 4 layer; layer `kepadatan` disabled + tooltip alasan bila API 409.
- Nilai di centroid opsional (`Switch`), default mati.
- `?layer=` dan `?prov=` di URL.
- Aksesibilitas: `aria-label` di peta, pencarian bisa keyboard (Enter membuka panel),
  legenda memakai pola/ikon selain warna.

**Acceptance**
- 38 poligon terwarnai, tidak ada abu-abu.
- Ganti layer < 200 ms (devtools network: tidak ada request GeoJSON ulang).
- Tab → search → ketik → Enter membuka panel provinsi.

**Tes:** `npm run build`; cek manual keyboard + network.

---

## T3.5 — Mode banding tahun

**Blocked by:** T3.4, T7.1

**Scope**
- Tampil hanya bila `meta/years.butuh_minimal_2_tahun === false`.
- Dua `MapContainer` berdampingan, zoom/pan tersinkron (event `move` → set view peta lain, dengan guard).
- Sumber nilai: dua panggilan `/map/layers?tahun=A|B`.

**Acceptance**
- Dengan 2 tahun seed: kedua peta menampilkan angka berbeda untuk tahun berbeda.
- Dengan 1 tahun: tombol tidak dirender.

**Tes:** cek manual dengan seed 2 tahun.
