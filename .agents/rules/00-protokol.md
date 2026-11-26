---
trigger: always_on
description: "Protokol dokumen wajib: baca docs/INDEX.md sebelum aksi tulis, selaraskan dokumen pada siklus yang sama, akhiri dengan blok konfirmasi."
---

# Protokol Dokumen

Berlaku penuh dari `AGENTS.md` bagian 0 di akar repo. Ringkasnya:

1. Baca `docs/INDEX.md` bagian 1 sebelum aksi tulis atau perintah pertama.
2. Baca berkas dokumen yang ditunjuk baris tugas itu.
3. Setelah mengubah kode, selaraskan dokumen pendamping pada siklus yang sama.

Peta mesin kode-ke-dokumen: `docs-map.json`. Verifikasi: `npm run docs:check`.

Hook `PreToolUse` akan menolak aksi tulis selama drift dokumen terdeteksi. Bila itu terjadi,
selesaikan dokumen yang disebut alasan penolakan, lalu ulangi aksi yang sama.
