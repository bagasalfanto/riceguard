---
trigger: glob
globs: "apps/web/src/**/*.ts, apps/web/src/**/*.tsx"
description: "Aturan berkas frontend React/TypeScript: kosakata antarmuka, pemformatan angka, dan isolasi kalkulasi."
---

# Berkas Frontend

- Teks yang dibaca pengguna wajib mengikuti `docs/KAMUS_KOSAKATA.md` dan `GLOSSARY.md` — label,
  judul halaman, tombol, placeholder, tooltip, `aria-label`, toast, pesan validasi, header CSV,
  dan parameter URL. Kata `rute` dilarang pada antarmuka; gunakan `alur alokasi` atau `jarak garis lurus`.
- Label dan pola status provinsi diambil dari `apps/web/src/lib/status.ts` (`tampilanStatus`,
  `SEMUA_STATUS`); jangan menurunkan status dari tanda rice balance di frontend.
- Pemformatan angka memakai helper di `apps/web/src/lib/format.ts` (`id-ID`) dan kelas
  `tabular-nums`. `font-mono` hanya untuk identifier mesin (`kode_bps`, ID versi, token).
- Seluruh panggilan API melalui `apps/web/src/lib/api.ts` dengan tipe OpenAPI di
  `apps/web/src/lib/tipe-api.ts`; frontend dilarang menghitung rumus keseimbangan atau matching.
- Halaman `/prediksi` dan data model AI eksternal harus tetap terisolasi dari data resmi.

Mengubah komponen, fitur, atau helper antarmuka mewajibkan pembaruan `docs/KAMUS_KOSAKATA.md`
pada siklus yang sama.
