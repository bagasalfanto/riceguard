---
scope: adr
canonical-for: ["keputusan arsitektur pembuatan PDF backend"]
sources: ["apps/api/app/services/pdf.py", "apps/api/app/routers/publik/reports.py", "apps/api/app/templates/reports/laporan.html", "apps/api/Dockerfile", ".github/workflows/ci.yml"]
last-verified: 2026-11-27
status: superseded
superseded-by: docs/adr/0003-laporan-pdf-dicetak-browser.md
---

# 0002 — Pembuatan Laporan PDF di Backend (WeasyPrint + Jinja2 + Matplotlib)

> **Digantikan oleh:** `0003-laporan-pdf-dicetak-browser.md`. WeasyPrint dan pustaka Pango sudah dihapus dari repo; laporan kini berupa HTML siap-cetak yang disimpan PDF oleh browser. Dokumen ini disimpan sebagai catatan keputusan lama.

## Status

Accepted

## Context

Fitur Report & Export (`/laporan`) menyediakan empat jenis laporan yang dapat diunduh sebagai PDF A4 portrait:

1. National Rice Security Report (`nasional`) — maksimal 4 halaman A4, memuat KPI nasional, peta surplus–defisit, top-5, dan batasan klaim.
2. Regional Analysis Report (`provinsi`) — detail satu provinsi beserta rumus terisi dan rekomendasi distribusi terkait.
3. Surplus-Deficit Report (`surplus-defisit`) — daftar 38 provinsi dikelompokkan per status serta peta.
4. Distribution Recommendation Report (`rekomendasi`) — seluruh pasangan rekomendasi distribusi, penjelasan, dan peta alur garis.

Kriteria selesai mewajibkan:

- PDF berukuran A4 portrait (maksimal 4 halaman untuk laporan nasional).
- Tetap terbaca saat dicetak hitam-putih (pola/simbol status, bukan warna semata).
- Angka di PDF identik dengan tampilan web untuk versi dataset dan tahun yang sama.
- Footer setiap halaman dan blok metadata mencantumkan versi dataset, tanggal cetak, sumber data, dan batasan klaim.

Dua kandidat arsitektur (Opsi A dari frontend vs Opsi B dari backend) dibandingkan sebelum implementasi T9.3.

## Decision

Dipilih **Opsi B: Pembuatan PDF di backend (Jinja2 + WeasyPrint + Matplotlib static PNGs)** melalui endpoint `GET /api/v1/reports/{jenis}.pdf`.

Alur rendering:

1. Komposisi data laporan di `apps/api/app/services/exports.py` memanggil service sumber yang sama dengan API publik (`/summary`, `/provinces`, `/provinces/{kode_bps}`, `/recommendations`, `/map/layers`) sehingga tidak ada duplikasi perhitungan.
2. Peta choropleth 38 provinsi (memakai `dataset/geo/provinsi-38.min.geojson`), peta alur distribusi, dan grafik batang dirender server-side sebagai PNG statis menggunakan Matplotlib (`Agg` backend) dengan pola arsiran (`hatch`) yang tetap terbaca pada cetakan grayscale/hitam-putih.
3. Template Jinja2 (`apps/api/app/templates/reports/laporan.html`) menyusun layout `@page` A4 portrait dengan margin cetak, header/footer bernomor halaman, dan metadata lengkap, lalu WeasyPrint mengonversinya menjadi `application/pdf`.

## Consequences

- **Satu klik unduh & konsistensi lintas browser**: Pengguna langsung menerima file `.pdf` siap simpan tanpa bergantung pada dialog cetak browser atau perbedaan rendering engine Chrome/Firefox/Safari.
- **Kesamaan angka terjamin**: Data PDF berasal langsung dari fungsi komposisi backend untuk `version_id` / `tahun` yang diminta.
- **Dependency sistem pada container & CI**: WeasyPrint membutuhkan pustaka native Pango/GObject/HarfBuzz (`libpango-1.0-0`, `libpangoft2-1.0-0`, `libharfbuzz-subset0`) di Ubuntu/Debian.
  - `apps/api/Dockerfile` harus menginstal paket sistem tersebut bersama `libffi-dev` dan `shared-mime-info`.
  - `.github/workflows/ci.yml` pada job `api` harus menginstal `libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz-subset0` sebelum menjalankan `pytest`.
- **Kompatibilitas lokal non-Linux**: Pada host pengembangan tanpa library native GTK/Pango (misalnya Windows), import `weasyprint` di-defer (lazy import) ke dalam fungsi render PDF sehingga seluruh endpoint lain dan unit test komposisi/template/chart tetap berjalan, dan endpoint PDF membalas `503 PDF_UNAVAILABLE` secara terstruktur apabila pustaka native tidak tersedia.
- **Maintenance visual**: Peta dan grafik pada PDF dibuat terpisah di server dengan Matplotlib, bukan screenshot komponen Leaflet/Recharts di browser.

## Alternatives

Perbandingan opsi cetak PDF:

| Opsi | Cara | Kelebihan | Kekurangan |
| --- | --- | --- | --- |
| **A. Dari FE** | Route cetak di React (`/laporan/cetak/...`) dengan CSS `@media print`, lalu `window.print()` → "Simpan sebagai PDF" | Peta Leaflet dan grafik ikut tercetak apa adanya; tanpa dependency server | Hasil sedikit berbeda antar browser; pengguna menekan dialog cetak |
| **B. Dari BE (Dipilih)** | Template HTML (Jinja2) → WeasyPrint → file PDF | Satu klik unduh, hasil konsisten | Butuh library sistem (Pango) di Docker; peta & grafik harus dibuat ulang jadi gambar statis di server |

Opsi A ditolak karena hasil cetak dan pagination `@page` bergantung pada browser pengguna serta memerlukan interaksi manual dialog cetak untuk menyimpan PDF, sedangkan Opsi B menjamin format A4 portrait, batas halaman nasional (`<= 4` halaman), dan konsistensi output lintas platform.
