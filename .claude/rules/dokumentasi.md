---
paths:
  - "docs/**/*.md"
  - "AGENTS.md"
  - "CLAUDE.md"
  - "llms.txt"
  - "docs-map.json"
---

# Berkas Dokumentasi

- Satu fakta hidup di **satu** berkas kanonik. Berkas lain hanya menunjuk: `> Kanonik: <path>`.
  Kolom kanoniknya ada di `docs/INDEX.md` bagian 2.
- Tautan relatif saja. Dilarang absolut (`/`) atau berawalan `file://`.
- Setiap berkas `docs/` wajib berfrontmatter: `scope`, `canonical-for`, `sources`, `last-verified`.
- Berkas baru hanya bila berkas kanonik yang ada tidak bisa menampungnya; setelahnya perbarui
  `docs/INDEX.md` bagian 1 dan 2 serta `llms.txt`.
- Batas 400 baris per berkas. Bila memang tak terbagi, naikkan lewat frontmatter `max-lines`
  **beserta alasan**.
- Dokumen usang dipangkas dua fase: `status: deprecated` + `superseded-by`, keluarkan dari peta
  tugas, baru hapus setelah satu rilis tanpa rujukan.
- Dilarang menyalin isi dokumen lain.

## Verifikasi

```bash
npm run docs:check
```
