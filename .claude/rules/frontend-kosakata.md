---
paths:
  - "apps/web/src/**/*.{ts,tsx}"
---

# Berkas Frontend (React + TypeScript)

Baca `docs/KAMUS_KOSAKATA.md` dan `GLOSSARY.md` sebelum menulis **teks apa pun yang dibaca pengguna** —
label, judul halaman, tombol, placeholder, tooltip, `aria-label`, toast, pesan validasi, header
CSV, dan parameter URL. Kata `rute` dilarang di antarmuka; gunakan `alur alokasi` atau `jarak garis lurus`.

- Label, warna, dan pola status provinsi berasal dari `apps/web/src/lib/status.ts` (`tampilanStatus`,
  `SEMUA_STATUS`); jangan menurunkan status dari tanda rice balance di komponen.
- Format angka Bahasa Indonesia (`id-ID`) berasal dari `apps/web/src/lib/format.ts` dengan
  `tabular-nums`. `font-mono` hanya untuk identifier mesin (`kode_bps`, ID versi, token).
- Semua akses API melewati `apps/web/src/lib/api.ts` dan tipe OpenAPI di `apps/web/src/lib/tipe-api.ts`;
  frontend tidak menghitung rumus keseimbangan atau rekomendasi sendiri.
- Data prediksi AI (`/prediksi`) harus tetap terisolasi dari state, cache, dan tampilan dataset resmi.

## Dampak dokumen

Mengubah teks antarmuka atau helper di `apps/web/src/{components,features,lib}/*` mewajibkan
pembaruan `docs/KAMUS_KOSAKATA.md` pada siklus yang sama. Hook akan menolak aksi bila belum.

## Gaya

Lolos `oxlint` dan `tsc -b && vite build` tanpa error maupun warning (`npm run lint:web`,
`npm run build:web`). Rincian: `docs/RULES.md`.
