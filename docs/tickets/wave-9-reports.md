---
scope: tickets/wave-9
canonical-for: ["spesifikasi tiket wave 9 laporan & ekspor cetak"]
sources: ["docs/tickets/README.md", "docs/adr/0003-laporan-pdf-dicetak-browser.md", "docs/RiceGuard — PRD & Dokumen Teknis (FE + BE).md"]
last-verified: 2026-11-27
---

# Wave 9 — Fitur 9: Report & Export (`/laporan`)

Kriteria selesai PRD §5.9: laporan A4 portrait, terbaca saat dicetak hitam-putih, angka di laporan
sama dengan halaman web untuk versi yang sama.

**Status:** selesai. Keputusan cetak berubah dari WeasyPrint (ADR `0002`) menjadi HTML siap-cetak
browser (ADR `0003`); WeasyPrint dan pustaka Pango sudah dihapus dari repo.

---

## T9.1 — ADR: cara membuat laporan cetak

**Blocked by:** —

**Scope**
- Tulis `docs/adr/0002-pdf-generation.md` (penomoran `0002` karena `0001` sudah dipakai ADR forecast) dengan format ADR (Status, Context, Decision, Consequences, Alternatives).
- Isi trade-off persis PRD §12 tabel baris 858–861.
- Keputusan awal memilih Opsi B (WeasyPrint). **Dibatalkan oleh `docs/adr/0003-laporan-pdf-dicetak-browser.md`**: laporan kini HTML siap-cetak, tanpa dependensi native.

**Acceptance**
- ADR diterima (status `Accepted`) sebelum T9.3 dikerjakan.
- ADR pengganti mencatat konsekuensi yang hilang (nomor halaman, paginasi browser).

**Tes:** review dokumen.

---

## T9.2 — Komposisi data laporan

**Blocked by:** T1.1, T2.3, T6.3, T8.1

**Scope**
- `app/services/exports.py`: fungsi `laporan_nasional(db, tahun)`,
  `laporan_provinsi(db, tahun, kode_bps)`, `laporan_surplus_defisit(db, tahun)`,
  `laporan_rekomendasi(db, tahun)` — masing-masing mengembalikan satu struktur siap-render
  (KPI, daftar, ringkasan, `metadata: {versi, tanggal_cetak, sumber, batasan}`).
- Tidak ada endpoint HTTP baru untuk Opsi A: FE merakit halaman cetak dari endpoint yang sudah ada.
  Implementasi akhir: `GET /reports/{jenis}.html?tahun=&kode_bps=` (dibuat di T9.3).
- `metadata.batasan` = satu kalimat dari `site_content.limitations`.

**Acceptance**
- Keempat komposisi memuat versi + tanggal cetak + sumber + batasan (tidak bisa lupa).
- Angka tiap komposisi = endpoint sumbernya (tes bandingkan).

**Tes:** `test_reports_data.py` (4 jenis, metadata lengkap, angka sama dengan `/summary` & `/recommendations`).

---

## T9.3 — Implementasi laporan cetak

**Blocked by:** T9.1, T9.2

**Scope (final — ADR 0003)**
- `GET /reports/{jenis}.html`: Jinja2 merender HTML A4; peta & grafik jadi PNG statis server-side
  (Matplotlib `Agg`, di-import lazy) sebagai data-URI.
- `@media print` CSS: A4 portrait, margin 12 mm, footer teks berulang (`position: fixed`),
  toolbar `Cetak / Simpan PDF` disembunyikan saat cetak, `window.print()` otomatis.
- Tombol FE `Cetak / Simpan PDF` membuka endpoint di tab baru; browser yang menyimpan PDF.
- `weasyprint` dan seluruh paket Pango tidak dipakai lagi (dihapus dari `pyproject.toml`,
  `Dockerfile`, dan CI).

**Acceptance**
- Keempat jenis laporan menghasilkan HTML A4 dengan metadata, peta, grafik, dan footer batasan.
- Cetak hitam-putih: status masih bisa dibedakan (pola/label).
- Angka = halaman web untuk versi & tahun yang sama.
- Tidak ada `503 PDF_UNAVAILABLE`; endpoint tidak bergantung pustaka native.

**Tes:** `test_reports_html.py` (render chart, template siap-cetak, validasi route) + cetak manual ke PDF (Chrome).

---

## T9.4 — Halaman Laporan (FE)

**Blocked by:** T9.3

**Scope**
- `/laporan`: pilih jenis laporan (4), tahun, provinsi (hanya untuk laporan wilayah) →
  tombol `Cetak / Simpan PDF`, `Unduh CSV`, `Unduh Excel` sesuai matriks PRD §5.9.
- CSV/Excel memakai endpoint T8.2/T8.3 (jangan duplikasi logika).
- Tampilkan versi dataset yang akan tercetak sebelum tombol aktif.

**Acceptance**
- Keempat jenis bisa diunduh di format yang diizinkan matriks.
- Laporan wilayah tanpa provinsi → tombol disabled + pesan.
- Versi yang tercetak sama dengan yang tampil di footer situs.

**Tes:** `npm run build`, cek manual 4 jenis.
