---
scope: adr
canonical-for: ["keputusan arsitektur pembuatan laporan cetak"]
sources: ["apps/api/app/routers/public/reports.py", "apps/api/app/services/pdf.py", "apps/api/app/templates/reports/laporan.html", "apps/web/src/features/reports/reportsData.ts"]
last-verified: 2026-11-27
---

# 0003 — Laporan dicetak dari browser, bukan dirender PDF di backend

## Status

Accepted. Menggantikan `0002-pdf-generation.md`.

## Context

ADR `0002` memilih WeasyPrint di backend untuk menghasilkan `application/pdf` satu klik. Konsekuensinya, `apps/api` bergantung pada pustaka native Pango/GObject/HarfBuzz, sehingga:

- Image Docker harus memasang paket `apt` tambahan, dan CI job `api` juga.
- Host tanpa Pango (Windows, dan runtime serverless seperti Vercel) hanya bisa membalas `503 PDF_UNAVAILABLE`.
- Matplotlib (~80 MB RAM) termuat di level modul, membebani host kecil meski tidak ada yang meminta laporan.

Kebutuhan sebenarnya adalah laporan A4 yang bisa disimpan sebagai PDF dan terbaca saat dicetak hitam-putih. Dialog cetak browser memenuhi itu tanpa satu pun dependensi native.

## Decision

Laporan dibuat backend sebagai **HTML siap-cetak** lewat `GET /api/v1/reports/{jenis}.html`, lalu browser pengguna menyimpan PDF lewat dialog cetak.

Alur:

1. `services/exports.py` menyusun data laporan dari service yang sama dengan API publik (tidak ada perhitungan ganda).
2. `services/pdf.py` merender peta choropleth dan grafik sebagai PNG Matplotlib (`Agg`, pola `hatch` ramah grayscale), lalu menyisipkannya ke template Jinja2 sebagai data-URI. Matplotlib di-import di dalam fungsi agar tidak membebani proses saat laporan belum diminta.
3. Template `laporan.html` memakai `@page { size: A4 portrait }`, `@media print` untuk footer berulang (`position: fixed`) dan menyembunyikan toolbar cetak, serta `<script>window.print()</script>` untuk membuka dialog otomatis. Tombol `Cetak / Simpan PDF` di halaman menjadi cadangan bila dialog diblokir.
4. Frontend membuka endpoint itu di tab baru; CSV dan Excel tetap diunduh lewat endpoint ekspor yang sudah ada (`openpyxl` murni Python, tidak butuh pustaka sistem).

## Consequences

- **Tanpa dependensi native:** `weasyprint` dan seluruh paket Pango dihapus dari `pyproject.toml`, `Dockerfile`, dan CI. Image lebih kecil dan API bisa berjalan di host mana pun.
- **Nomor halaman hilang:** margin box `@page` (`@bottom-right { content: counter(page) }`) hanya didukung WeasyPrint/Prince, tidak oleh Chrome/Firefox. Laporan tidak lagi menampilkan `Halaman X / Y`. Footer teks (versi, tanggal cetak, batasan klaim) tetap muncul di setiap halaman lewat `position: fixed`.
- **Paginasi milik browser:** jaminan "laporan nasional ≤ 4 halaman" tidak bisa dipaksakan lagi; hasil bisa berbeda antar browser.
- **Bukan lagi satu klik tanpa dialog:** pengguna melewati dialog cetak dan memilih *Save as PDF*. Nama berkas bawaan diambil dari `<title>` (`riceguard-laporan-{jenis}-{tahun}-v{version_no}`).
- **Pratinjau draft admin tidak didukung di tombol cetak:** tab baru tidak membawa header `Authorization`, sehingga `?version_id=` tidak dihormati. Endpoint tetap menerima `version_id` untuk pemakaian langsung.

## Alternatives

| Opsi | Cara | Kelebihan | Kekurangan |
| --- | --- | --- | --- |
| **A. Cetak HTML backend (Dipilih)** | Jinja2 → HTML A4 → dialog cetak browser | Tanpa dependensi native, satu template untuk web & cetak | Nomor halaman hilang, pengguna lewat dialog cetak |
| B. WeasyPrint (ADR 0002) | Jinja2 → WeasyPrint → PDF | Satu klik, paginasi & nomor halaman terkendali | Butuh Pango di Docker/CI, mati di host tanpa pustaka native |
| C. Cetak halaman React | CSS `@media print` di FE | Tanpa endpoint baru | Layout & peta milik browser, angka tidak dijamin identik |

Opsi B ditolak karena biaya dependensi sistemnya tidak sepadan dengan satu-satunya keuntungan yang hilang (nomor halaman). Opsi C ditolak karena komposisi laporan akan terduplikasi di frontend dan melanggar aturan "frontend tidak menghitung".
