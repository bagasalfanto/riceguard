---
trigger: model_decision
description: "Cara menulis dan memelihara dokumen: aturan kanonik, tautan relatif, frontmatter wajib, batas baris, dan pemangkasan dua fase."
---

# Menulis dan Memelihara Dokumentasi

- **Satu fakta, satu berkas kanonik.** Kolom kanoniknya `docs/INDEX.md` bagian 2. Bila satu fakta
  muncul di dua berkas, satu harus menjadi penunjuk: `> Kanonik: <path>`.
- **Tautan relatif saja** — terhadap direktori berkas atau akar repo. Dilarang absolut atau
  berawalan `file://`.
- **Frontmatter wajib** pada setiap berkas `docs/`: `scope`, `canonical-for`, `sources`,
  `last-verified`.
- **Batas 400 baris.** Bila sebuah berkas memang tak terbagi, naikkan lewat frontmatter
  `max-lines` beserta alasannya.
- **Berkas baru** hanya bila berkas kanonik yang ada tidak bisa menampungnya. Setelah menambah,
  perbarui `docs/INDEX.md` bagian 1 dan 2 serta `llms.txt`.

## Pemangkasan dua fase (anti kontaminasi konteks)

Dokumen usang tidak dihapus buta:

1. Tandai frontmatter `status: deprecated` dan `superseded-by: <path>`, lalu keluarkan barisnya
   dari peta tugas `docs/INDEX.md` bagian 1 dan dari `llms.txt`.
2. Baru hapus setelah satu rilis tanpa rujukan. Bila ada tautan luar, sisakan stub penunjuk.

Dilarang menautkan dokumen berstatus deprecated dari `AGENTS.md`, `docs/INDEX.md`, atau `llms.txt`.

## Verifikasi

```bash
npm run docs:check
```
