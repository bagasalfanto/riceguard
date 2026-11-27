# CLAUDE.md — Claude Code

@AGENTS.md

## Claude Code

Protokol dokumen ada di `AGENTS.md` bagian 0 (diimpor di atas dan berlaku penuh).
Berkas ini hanya menambahkan penegakan yang tidak bisa diabaikan.

### Yang menegakkan, bukan sekadar menyarankan

`AGENTS.md` dan `.claude/rules/` adalah instruksi; Claude boleh memilih untuk tidak mematuhinya.
Yang deterministik adalah hook di `.claude/settings.json`:

- `SessionStart` dan `UserPromptSubmit` → menyuntik peta kode-ke-dokumen ke konteks setiap giliran.
- `PreToolUse` untuk `Edit`, `Write`, dan `Bash` → **menolak** aksi saat drift dokumen terdeteksi,
  dengan alasan yang menyebut berkas dokumen yang belum diselaraskan.
- `SubagentStart` / `Agent` → ikut memeriksa drift sebelum subagen dijalankan.
- `Stop` → menahan penghentian selama drift masih ada, maksimum tiga kali per sesi, lalu melepas
  agar sesi tidak menggantung.

Bila hook menolak aksimu: perbarui dokumen yang disebut, lalu ulangi aksi yang sama. Jangan
mencari akal untuk melewatinya.

### Aturan per jenis berkas

Aturan di bawah `.claude/rules/` dimuat hanya saat Claude menyentuh berkas yang cocok, sehingga
konteks tetap ramping. Rujuk berkasnya bila ragu.

### Jangan dilumpuhkan

Jangan memindahkan atau menonaktifkan hook di `.claude/settings.local.json` atau lewat
`disableAllHooks`; itu melewati seluruh lapis penegakan lokal untuk mesinmu, dan CI akan
menolaknya di ujung.

### Verifikasi

```bash
npm run docs:check
npm run docs:drift
```
