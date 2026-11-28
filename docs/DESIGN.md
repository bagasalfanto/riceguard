---
scope: design
canonical-for: ["token tema OKLCH", "komponen layout publik & admin", "komponen peta & grafik", "desain cetak PDF", "aksesibilitas & responsif"]
sources: ["apps/web/src/styles/index.css", "apps/web/src/components/", "apps/web/src/features/reports/", "apps/api/app/templates/reports/laporan.html"]
last-verified: 2026-11-27
---

# Spesifikasi Desain UI RiceGuard

> Berkas kanonik untuk token tema, arsitektur layout publik & admin, desain komponen peta/grafik, state UI standar, dan standar aksesibilitas. Seluruh teks antarmuka mengikuti `KAMUS_KOSAKATA.md`.

## 1. Prinsip Desain & Keterbacaan

- **Fokus ketahanan pangan berbasis data:** antarmuka memprioritaskan kejelasan angka, peta spasial 38 provinsi, dan jejak keterlacakan data tanpa ornamen berlebihan.
- **Redundansi non-warna wajib:** status (`surplus`, `balanced`, `defisit`) **tidak pernah** mengandalkan warna semata — selalu disertai label teks, ikon arah (`ArrowUpRight`, `Minus`, `ArrowDownRight`), pola CSS di legenda peta (`solid`, `garis`, `titik`), serta simbol `[+]`, `[=]`, `[-]` dan arsiran Matplotlib (`///`, `...`, `xxx`) pada laporan PDF.
- **Integritas angka:** angka bisnis memakai `tabular-nums` dan pemformat `id-ID` (`src/lib/format.ts`); `font-mono` hanya untuk `kode_bps`, UUID, atau JSON detail audit.

## 2. Sistem Token Warna & Tema (`apps/web/src/styles/index.css`)

Tailwind CSS v4 dikonfigurasi dengan custom variant `@custom-variant dark (&:is(.dark *));` dan pemetaan `@theme inline`. Mode terang (`:root`) dan mode gelap (`.dark`) dikelola oleh `TemaProvider` (`src/hooks/useTema.tsx`, tersimpan di `localStorage` kunci `riceguard-tema`).

| Kelompok Token | Token CSS | Kegunaan |
|---|---|---|
| Permukaan & Teks | `--background`, `--foreground`, `--card`, `--popover`, `--muted`, `--accent`, `--border`, `--ring` | Latar kanvas, kartu, overlay Leaflet, fokus `:focus-visible` |
| Aksen Primer & Bahaya | `--primary` (`oklch(0.45 0.12 150)` terang / `oklch(0.72 0.14 150)` gelap), `--destructive` | Tombol utama, status aktif navigasi, alert error |
| Status Provinsi | `--status-surplus`, `--status-balanced`, `--status-defisit` | Poligon peta, grafik divergen, badge status (`lib/status.ts`) |
| Skala Sekuensial (5 kelas) | `--seq-1`, `--seq-2`, `--seq-3`, `--seq-4`, `--seq-5` | Layer peta `produksi` / `kebutuhan` (kuantil) dan grafik pulau |

> Hindari warna hex hardcode di komponen TSX; rujuk kelas semantic Tailwind (`bg-card`, `text-muted-foreground`, `border-status-surplus/40`) atau variabel CSS `var(--status-*)` / `var(--seq-*)`.

## 3. Arsitektur Layout & Komponen

### 3.1 Shell Publik (`PublicLayout.tsx`)

- **`Header.tsx`:** sticky header `h-14` (`backdrop-blur`), logo `RiceGuard` → `/`, separator + navigasi desktop (`xl:flex`, menyembunyikan `Historical Trends` bila `butuh_minimal_2_tahun` = `true` dan hanya menampilkan `Prediksi` bila `GET /forecast` sukses `200`), `YearSelect` (teks statis `"Data {tahun}"` bila hanya 1 tahun, `<select>` bila >= 2 tahun), tombol `Unduh laporan` → `/laporan`, toggle tema, dan `Sheet` drawer pada `< xl`.
- **`LimitationBanner.tsx`:** alert satu baris wajib tampil di atas `/dashboard`, `/peta`, `/distribusi`, dan `/rekomendasi` dengan tautan langsung ke `/data#batasan`.
- **`Footer.tsx`:** ringkasan sumber data (BPS, Bapanas, tim WebGIS RiceGuard), tautan ke `/data` (`Metodologi`), dan tautan repositori.

### 3.2 Shell Admin (`AdminLayout.tsx`)

- Sidebar kiri persisten `w-64` pada layar `lg+` (`Ringkasan`, `Versi Dataset`, `Upload Versi Baru`, `Konten & Sumber`, `Log Aktivitas`), badge `Admin`, kartu identitas admin (`nama` & `email`), tautan `Lihat Situs Publik`, toggle tema, dan tombol `Keluar`.
- Header sticky + `Sheet` navigasi pada `< lg`.
- State transisi sesi: `Skeleton` saat memverifikasi token, redirect ke `/admin/login` saat `401`/belum login, dan layar `Alert` destruktif `403 Forbidden` dengan tombol keluar saat akun non-admin.

### 3.3 Peta WebGIS (`apps/web/src/components/map/`)

- **`BaseMap.tsx`:** Leaflet `MapContainer` dibatasi `INDONESIA_BOUNDS` (`[-13, 92]` hingga `[10, 144]`), `minZoom={4}`, `maxZoom={10}`, `MapAutoResize` (`ResizeObserver`), `MapFlyController`, `MapSyncController` (untuk mode banding 2 tahun), tombol reset `Seluruh Indonesia`, serta 4 tile basemap (`satellite`, `esri-light`, `esri-dark`, `osm`) + mode `minimal` tanpa tile eksternal.
- **`ProvinceLayer.tsx`:** memuat `public/geo/provinsi-38.min.geojson` sekali lalu di-cache React Query; mewarnai 38 poligon berdasarkan `values[kode_bps]` + `classes` dari API; mendukung tooltip hover, popup detail, dan label nilai opsional di centroid.
- **`FlowLines.tsx`:** `Polyline` dari centroid pemasok ke penerima dengan ketebalan proporsional akar (`2–10 px`) serta penanda panah arah SVG (`riceguard-flow-arrow`).
- **`MapLegend.tsx` & `ProvinceSearch.tsx`:** legenda collapsible dengan swatch pola CSS; combobox pencarian keyboard (`ArrowUp`, `ArrowDown`, `Enter`, `Escape`) dengan atribut `aria-activedescendant`.

### 3.4 Grafik (`apps/web/src/components/charts/`)

- **`ChartContainer.tsx`:** membungkus grafik Recharts v3 dengan tinggi eksplisit tetap (`height` px) dan atribut aksesibilitas `<figure role="group" aria-label={label}>`.
- Grafik 38 provinsi di `DashboardPage.tsx` memakai wrapper `overflow-x-auto` (`min-width >= 680 px`) agar tetap terbaca pada layar mobile `375 px`.
- **`TrendLineChart.tsx`:** grafik garis multi-tahun (`metric` + hingga 5 provinsi) dengan garis putus bersih untuk nilai `null`.

### 3.5 Komponen Primitif (`apps/web/src/components/ui/`)

Memakai komponen shadcn/ui (Radix UI + Tailwind v4): `alert`, `alert-dialog`, `badge`, `button`, `card`, `dialog`, `dropdown-menu`, `input`, `label`, `progress`, `separator`, `sheet`, `skeleton`, `slider`, `sonner`, `switch`, `table`, `tabs`, `textarea`, `tooltip`.

## 4. State UI Standar & Desain Cetak Laporan

- **Loading:** `Skeleton` berdimensi sesuai kartu, tabel, atau peta target.
- **Error:** `Alert` (`variant="destructive"`) berisi pesan `ApiError` terstruktur + tombol `"Coba lagi"`.
- **Kosong / Gating:** halaman `/tren` menampilkan pesan `"Butuh minimal 2 tahun data"` saat tahun published < 2; halaman `/prediksi` menampilkan `"Prediksi belum tersedia"` + alasan dari `details.alasan` saat `503` (tanpa angka pengganti).
- **Cetak laporan A4 (`laporan.html` & `services/pdf.py`):** ukuran `@page { size: A4 portrait; margin: 12mm 12mm 18mm 12mm; }`, toolbar `Cetak / Simpan PDF` yang disembunyikan saat `@media print`, footer teks persisten (versi dataset, tanggal cetak, batasan klaim) lewat `position: fixed`, grafik/peta PNG Matplotlib `Agg` berarsir, dan `window.print()` otomatis saat halaman dibuka. Nomor halaman `Halaman X / Y` tidak dipakai karena margin box `@page` tidak didukung browser.

## 5. Target Responsif, Performa & Aksesibilitas

- **Viewport sasaran:** `375 px` (mobile), `768 px` (tablet), `1280 px` (desktop).
- **Lazy loading:** seluruh halaman di `router.tsx` memakai `React.lazy()` + `Suspense` agar Leaflet, Recharts, dan modul admin terpisah dari bundle awal (target `< 400 KB` gzip).
- **Aksesibilitas:** `:focus-visible` `2px solid var(--ring)` pada semua kontrol interaktif, `aria-label` pada peta/grafik/tombol ikon, navigasi keyboard penuh pada `ProvinceSearch` dan `Sheet`/`Dialog`/`AlertDialog`.
