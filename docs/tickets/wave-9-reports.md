---
scope: tickets/wave-9
canonical-for: ["spesifikasi tiket wave 9 laporan & ekspor PDF"]
sources: ["docs/tickets/README.md", "docs/adr/0002-pdf-generation.md", "docs/RiceGuard — PRD & Dokumen Teknis (FE + BE).md"]
last-verified: 2026-11-26
---

# Wave 9 — Fitur 9: Report & Export (`/laporan`)

Kriteria selesai PRD §5.9: PDF A4 portrait, maksimal 4 halaman untuk laporan nasional,
terbaca saat dicetak hitam-putih; angka di PDF sama dengan halaman web untuk versi yang sama.

**Blocker:** PRD pertanyaan terbuka #5 (PDF dari FE vs BE) harus dijawab di T9.1.

---

## T9.1 — ADR: opsi PDF (A: cetak dari FE, B: WeasyPrint di BE)

**Blocked by:** —

**Scope**
- Tulis `docs/adr/0002-pdf-generation.md` (penomoran `0002` karena `0001` sudah dipakai ADR forecast) dengan format ADR (Status, Context, Decision, Consequences, Alternatives).
- Isi trade-off persis PRD §12 tabel baris 858–861.
- Keputusan final ADR memilih **Opsi B: WeasyPrint + Jinja2 + Matplotlib static PNGs** (disimpan di `docs/adr/0002-pdf-generation.md`, dengan dependency sistem `libpango-1.0-0`, `libpangoft2-1.0-0`, `libharfbuzz-subset0` di `apps/api/Dockerfile` dan `.github/workflows/ci.yml`).

**Acceptance**
- ADR diterima (status `Accepted`) sebelum T9.3 dikerjakan.
- Kalau Opsi B dipilih, catat dependency sistem (`libpango`) dan dampaknya ke Dockerfile.

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
  Untuk Opsi B: `GET /reports/{jenis}.pdf?tahun=&kode_bps=` (dibuat di T9.3).
- `metadata.batasan` = satu kalimat dari `site_content.limitations`.

**Acceptance**
- Keempat komposisi memuat versi + tanggal cetak + sumber + batasan (tidak bisa lupa).
- Angka tiap komposisi = endpoint sumbernya (tes bandingkan).

**Tes:** `test_reports_data.py` (4 jenis, metadata lengkap, angka sama dengan `/summary` & `/recommendations`).

---

## T9.3 — Implementasi PDF

**Blocked by:** T9.1, T9.2

**Scope (Opsi A — default)**
- Route cetak `src/features/reports/print/`: `/laporan/cetak/nasional`, `/laporan/cetak/provinsi/:kode`,
  `/laporan/cetak/surplus-defisit`, `/laporan/cetak/rekomendasi`.
- `@media print` CSS: A4 portrait, margin 12 mm, peta & grafik skala cetak, hitam-putih terbaca
  (garis & pola, bukan hanya warna), footer tiap halaman berisi versi/tanggal/sumber/batasan.
- Tombol "Unduh PDF" → `window.print()`.

**Scope (Opsi B — hanya kalau ADR memilih B)**
- `GET /reports/{jenis}.pdf`, Jinja2 → WeasyPrint; peta dirender jadi PNG statis server-side
  (matplotlib) dan grafik jadi PNG; `Dockerfile` menambah `libpango-1.0-0 libpangoft2-1.0-0`.

**Acceptance**
- Laporan nasional ≤ 4 halaman A4 portrait.
- Cetak hitam-putih: status masih bisa dibedakan (pola/label).
- Angka = halaman web untuk versi & tahun yang sama.
- Footer lengkap di setiap halaman.

**Tes:** cetak manual ke PDF (Chrome), hitung halaman, cek grayscale.

---

## T9.4 — Halaman Laporan (FE)

**Blocked by:** T9.3

**Scope**
- `/laporan`: pilih jenis laporan (4), tahun, provinsi (hanya untuk laporan wilayah) →
  tombol PDF/CSV/Excel sesuai matriks PRD §5.9.
- CSV/Excel memakai endpoint T8.2/T8.3 (jangan duplikasi logika).
- Tampilkan versi dataset yang akan tercetak sebelum tombol aktif.

**Acceptance**
- Keempat jenis bisa diunduh di format yang diizinkan matriks.
- Laporan wilayah tanpa provinsi → tombol disabled + pesan.
- Versi yang tercetak sama dengan yang tampil di footer situs.

**Tes:** `npm run build`, cek manual 4 jenis.
