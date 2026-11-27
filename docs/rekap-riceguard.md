---
scope: rekap-trello
canonical-for: ["status task tim per PIC (snapshot Trello)"]
sources: ["https://trello.com/b/0shGg35d/24-nov-task-list-riceguard"]
last-verified: 2026-11-27
---

# Rekap Task RiceGuard — SEVENT X Software Development (Website · Zero Hunger / SDG 2)

> Sumber: Trello board **24 Nov Task List – RiceGuard** (https://trello.com/b/0shGg35d/24-nov-task-list-riceguard)  
> Diambil: Jum 27 Nov 2026, 21:44 WIB · Semua jam dalam WIB.  
> Deadline resmi: **30 Nov** · Target internal submit: **Jum 27 Nov sore**

## Ringkasan

- Total task terjadwal: **74** · ✅ Selesai: **32** · ⏳ Belum & sudah lewat due: **34** · ⬜ Belum & akan datang: **8**
- ⚠️ **Status = centang di Trello.** Update terakhir centang ada di Kam 26 Nov ±12:49 WIB. Task Hari 4 (sisa) dan seluruh Hari 5 belum pernah dicentang, jadi bisa jadi sebenarnya sudah dikerjakan tapi belum diupdate di board.
- Board kedua, **RiceGuard — SEVENT X Software Development**, adalah versi rencana awal (74 kartu, tidak ada yang dicentang). Isinya sama dengan board 24 Nov, jadi rekap ini pakai board 24 Nov sebagai acuan status.

### Tim & peran

| Kode | Nama | Peran |
|---|---|---|
| P1 | Nadira | Project Manager & Full-Stack (repo, kontrak API, integrasi, deploy, koordinasi) |
| P2 | Shellyn | Frontend Dashboard (dashboard, grafik, halaman distribusi, landing page, metodologi) |
| P3 | Satria | Frontend WebGIS (peta Leaflet, choropleth, analisis wilayah) |
| P4 | Bagas | Backend (FastAPI, PostgreSQL, endpoint) — juga Ketua Tim |
| P5 | Serlin | Data Analyst & Algorithm (data BPS/Bapanas, rice balance, algoritma distribusi) |

### Progres per orang

| PIC | Total | ✅ Selesai | ⏳ Belum (lewat due) | ⬜ Belum (akan datang) |
|---|---|---|---|---|
| P1 Nadira | 19 | 5 | 9 | 5 |
| P2 Shellyn | 13 | 6 | 6 | 1 |
| P3 Satria | 10 | 5 | 4 | 1 |
| P4 Bagas | 11 | 6 | 3 | 2 |
| P5 Serlin | 12 | 7 | 4 | 1 |
| Semua tim | 13 | 3 | 9 | 1 |

_Task bersama (mis. "P2 + P3") dihitung ke masing-masing orang._

---

## Rekap per tanggal

### Sen, 23 Nov 2026 — Hari 1 — Fondasi  (12/14 selesai)

| # | Jam | Task | PIC | Status | Output (DoD) |
|---|---|---|---|---|---|
| [#1](https://trello.com/c/5JAikWQz) | 16:00 | Kick-off: tetapkan keputusan awal proyek | Semua tim | ✅ Selesai | Keputusan tertulis 1 halaman. |
| [#2](https://trello.com/c/6KObTIV4) | 16:00 | Notulen keputusan & board tugas | P1 Nadira | ✅ Selesai | Notulen + board berisi tugas semua PIC. |
| [#3](https://trello.com/c/Nz4TyUiz) | 17:00 | Berkas individu di sevent.zetech.id | Semua tim | ⏳ Belum (lewat due) | Semua anggota lengkap. |
| [#4](https://trello.com/c/lew5wcV0) | 17:00 | Daftarkan tim Software Development & bayar | Ketua Bagas | ⏳ Belum (lewat due) | Tim terdaftar, bukti bayar terunggah. |
| [#5](https://trello.com/c/Hrwc9sgv) | 17:00 | Template proposal & surat orisinalitas | P1 Nadira | ✅ Selesai | Template di tangan, pembagian bab jelas. |
| [#6](https://trello.com/c/fOhtvKsA) | 19:00 | Kontrak API (endpoint + contoh JSON) | P1 Nadira | ✅ Selesai | Dokumen endpoint dikunci dan dibagikan ke P2, P3, P4. |
| [#8](https://trello.com/c/xqT87XZ9) | 19:00 | Setup project, routing & layout MVP | P2 Shellyn | ✅ Selesai | Semua halaman bisa dibuka (isi placeholder). |
| [#12](https://trello.com/c/IQ3Hzugw) | 21:00 | Data BPS & Bapanas → dataset_v1.csv | P5 Serlin | ✅ Selesai | dataset_v1.csv (minimal 1 tahun lengkap) diserahkan ke P4 Bagas. |
| [#13](https://trello.com/c/yEA9Vrny) | 21:00 | Dokumen rumus kebutuhan & balance | P5 Serlin | ✅ Selesai | Dokumen rumus disetujui tim. |
| [#14](https://trello.com/c/ejYYgiy6) | 21:30 | Cek progres Hari 1 (checkpoint) | Semua tim | ✅ Selesai | Checkpoint: peta dasar tampil, API dummy hidup, dataset v1 ada, pendaftaran tim beres. |
| [#7](https://trello.com/c/M5GD3D6U) | 22:00 | Repo GitHub publik + kerangka deploy | Ketua Bagas + P1 Nadira | ✅ Selesai | Repo publik di akun ketua siap, semua anggota punya akses, link deploy kosong hidup. |
| [#9](https://trello.com/c/db9B1qQ4) | 22:00 | Komponen kartu statistik & grafik (data mock) | P2 Shellyn | ✅ Selesai | Komponen tampil dengan data dummy. |
| [#10](https://trello.com/c/o8Pt1cSk) | 22:00 | Setup Leaflet & GeoJSON provinsi | P3 Satria | ✅ Selesai | Peta tampil, kode provinsi konsisten. |
| [#11](https://trello.com/c/XRSFVDD0) | 22:00 | Setup FastAPI + PostgreSQL, skema & endpoint dummy | P4 Bagas | ✅ Selesai | Swagger bisa dicoba tim. |

### Sel, 24 Nov 2026 — Hari 2 — Fitur Inti  (9/13 selesai)

| # | Jam | Task | PIC | Status | Output (DoD) |
|---|---|---|---|---|---|
| [#15](https://trello.com/c/2wG9q60A) | 08:15 | Standup pagi 08:00 | Semua tim | ⏳ Belum (lewat due) | Blocker terdata. |
| [#16](https://trello.com/c/W8aCSYW1) | 12:00 | Hitung kebutuhan, rice balance & klasifikasi (pandas) | P5 Serlin | ✅ Selesai | CSV hasil + script di repo. |
| [#18](https://trello.com/c/bDCXqcMv) | 12:00 | Import dataset ke PostgreSQL & endpoint inti | P4 Bagas | ✅ Selesai | Endpoint mengembalikan data asli. |
| [#20](https://trello.com/c/3EOgxai0) | 12:00 | Dashboard: kartu statistik tersambung API | P2 Shellyn | ✅ Selesai | Kartu menampilkan data asli. |
| [#22](https://trello.com/c/x6jCgtMI) | 12:00 | Peta choropleth surplus/defisit/balanced + legend | P3 Satria | ✅ Selesai | Peta berwarna dari data asli. |
| [#17](https://trello.com/c/2rvtdqKh) | 17:00 | Algoritma matching v1 surplus–defisit (haversine) | P5 Serlin | ✅ Selesai | Fungsi + 3 kasus uji lolos. |
| [#19](https://trello.com/c/EMw0MgaH) | 17:00 | Endpoint /ranking, CORS, error handling, muat hasil P5 | P4 Bagas | ✅ Selesai | Endpoint ranking jalan di staging. |
| [#21](https://trello.com/c/4P4eMopR) | 17:00 | Grafik produksi vs kebutuhan, top 5, filter tahun | P2 Shellyn | ✅ Selesai | Grafik + filter tahun berfungsi. |
| [#23](https://trello.com/c/E0i2eURk) | 17:00 | Popup detail provinsi & layer toggle | P3 Satria | ✅ Selesai | Popup detail berfungsi. |
| [#24](https://trello.com/c/k7feYfvI) | 17:00 | Review PR, merge ke dev, deploy staging, sambung FE-BE | P1 Nadira | ✅ Selesai | Staging bisa diakses seluruh tim. |
| [#25](https://trello.com/c/MXRVZhKR) | 20:00 | Draft bab proposal: latar belakang & urgensi masalah | P5 Serlin | ⏳ Belum (lewat due) | Draft bab latar belakang. |
| [#26](https://trello.com/c/dH5P8iKK) | 20:00 | Draft bab proposal: tujuan, SDG 2 & rencana pengembangan | P1 Nadira | ⏳ Belum (lewat due) | Draft bab tujuan dan tema. |
| [#27](https://trello.com/c/MWiQqHTM) | 21:30 | Cek progres Hari 2 + putuskan identitas tim | Semua tim | ⏳ Belum (lewat due) | Checkpoint: Dashboard dan Peta jalan dengan data asli di staging; identitas tim diputuskan. |

### Rab, 25 Nov 2026 — Hari 3 — Lengkapi & Feature Freeze  (9/14 selesai)

| # | Jam | Task | PIC | Status | Output (DoD) |
|---|---|---|---|---|---|
| [#28](https://trello.com/c/zKOYUL4L) | 08:15 | Standup pagi 08:00 | Semua tim | ⏳ Belum (lewat due) | Blocker terdata. |
| [#29](https://trello.com/c/of7ayy41) | 12:00 | Endpoint /distribution/recommendation | P4 Bagas | ✅ Selesai | Endpoint mengembalikan rekomendasi. |
| [#30](https://trello.com/c/VadFK3Ba) | 12:00 | Validasi hasil rekomendasi distribusi | P5 Serlin | ✅ Selesai | Catatan validasi. |
| [#33](https://trello.com/c/jCZ3zEfm) | 13:00 | Halaman Distribusi: tabel rekomendasi | P2 Shellyn | ✅ Selesai | Tabel tersambung ke API. |
| [#31](https://trello.com/c/Pxf41K8B) | 14:00 | Halaman Analisis Wilayah | P3 Satria | ✅ Selesai | Halaman berfungsi. |
| [#32](https://trello.com/c/cCNqNafV) | 15:00 | Teks penjelasan metrik & klasifikasi | P5 Serlin | ✅ Selesai | Teks dipakai di halaman. |
| [#34](https://trello.com/c/AhNtOFL5) | 17:00 | Halaman Data & Metodologi + landing page | P2 Shellyn | ✅ Selesai | Dua halaman jadi. |
| [#35](https://trello.com/c/wJbk0epX) | 17:00 | Garis hubungan surplus → defisit di peta (opsional) | P3 Satria | ✅ Selesai | Garis tampil di peta. |
| [#36](https://trello.com/c/zP9wdB9c) | 17:00 | Perbaiki bug backend, optimasi query, seed ulang DB produksi | P4 Bagas | ✅ Selesai | Database siap dipindah ke produksi. |
| [#39](https://trello.com/c/KlcS8cdg) | 18:00 | Draft bab proposal: metodologi data | P5 Serlin | ⏳ Belum (lewat due) | Draft bab metodologi. |
| [#38](https://trello.com/c/wgLjqaOz) | 19:00 | Draft bab proposal: arsitektur & teknologi | P4 Bagas | ⏳ Belum (lewat due) | Draft bab arsitektur. |
| [#37](https://trello.com/c/DHzgxzXf) | 20:00 | Integrasi modul, QA lintas modul, naskah video demo | P1 Nadira | ⏳ Belum (lewat due) | Daftar bug berprioritas + naskah video siap. |
| [#40](https://trello.com/c/utt2ACHF) | 20:00 | Draft bab proposal: desain UI/UX & fitur | P2 Shellyn + P3 Satria | ⏳ Belum (lewat due) | Draft bab desain dan fitur. |
| [#41](https://trello.com/c/CW4I2Put) | 21:30 | Feature freeze: cek 14 fitur MVP | Semua tim | ✅ Selesai | Semua fitur MVP tercentang, tidak ada fitur baru setelahnya. |

### Kam, 26 Nov 2026 — Hari 4 — Polish, Deploy, Rekam  (2/13 selesai)

| # | Jam | Task | PIC | Status | Output (DoD) |
|---|---|---|---|---|---|
| [#42](https://trello.com/c/lOBGX6PB) | 08:15 | Standup & pembagian bug | Semua tim | ⏳ Belum (lewat due) | Bug terbagi per PIC. |
| [#43](https://trello.com/c/d58zEJai) | 10:00 | Tampilan responsif HP/tablet, loading & error state | P2 Shellyn | ⏳ Belum (lewat due) | Semua halaman nyaman di HP. |
| [#44](https://trello.com/c/K0nhiq8H) | 12:00 | Audit aksesibilitas & performa (Lighthouse) | P2 Shellyn | ⏳ Belum (lewat due) | Skor dan perbaikan prioritas tercatat. |
| [#45](https://trello.com/c/0672oYpF) | 12:00 | Performa & aksesibilitas peta, perbaikan bug peta | P3 Satria | ⏳ Belum (lewat due) | Peta cepat, stabil, dan aksesibel. |
| [#46](https://trello.com/c/4DQkFM9a) | 12:00 | Perbaikan bug backend & samakan data dengan staging | P4 Bagas | ✅ Selesai | Backend stabil. |
| [#47](https://trello.com/c/D9P1oMU5) | 12:00 | Cek ulang angka & klasifikasi terhadap sumber | P5 Serlin | ✅ Selesai | Angka dan metodologi konsisten. |
| [#48](https://trello.com/c/wgZBSc6a) | 12:00 | Triage bug sisa, putuskan yang di-skip | P1 Nadira | ⏳ Belum (lewat due) | Daftar bug final. |
| [#49](https://trello.com/c/GQb1fF1F) | 14:00 | Deploy final (frontend, backend, database) | P1 Nadira | ⏳ Belum (lewat due) | URL final aktif; setelah ini hanya bug kritis yang boleh diubah. |
| [#50](https://trello.com/c/Bt5oQ1fZ) | 15:00 | Latihan alur demo sesuai naskah video | Semua tim | ⏳ Belum (lewat due) | Alur demo lancar tanpa error. |
| [#52](https://trello.com/c/P5HtfDUa) | 17:00 | Angka & poin data untuk narasi video | P5 Serlin | ⏳ Belum (lewat due) | Daftar angka final untuk narasi. |
| [#53](https://trello.com/c/lQfPy4kq) | 17:00 | Rapikan repo GitHub (README, .env.example, hapus secret) | P4 Bagas | ⏳ Belum (lewat due) | Repo publik siap dinilai. |
| [#51](https://trello.com/c/dAkapUYJ) | 18:00 | Rekam layar mengikuti naskah | P2 Shellyn + P3 Satria | ⏳ Belum (lewat due) | Rekaman mentah semua bagian. |
| [#54](https://trello.com/c/iyLyTK1G) | 19:00 | Rekam narasi (voiceover) sesuai naskah | P1 Nadira | ⏳ Belum (lewat due) | File audio narasi. |

### Jum, 27 Nov 2026 — Hari 5 — Edit & Submit  (0/12 selesai)

| # | Jam | Task | PIC | Status | Output (DoD) |
|---|---|---|---|---|---|
| [#55](https://trello.com/c/SdAeSLP2) | 08:15 | Standup & pembagian tugas akhir | Semua tim | ⏳ Belum (lewat due) | Tugas Hari 5 terbagi. |
| [#61](https://trello.com/c/LsojM8ga) | 10:00 | Cek website dari jaringan lain + pemantau uptime | P4 Bagas | ⏳ Belum (lewat due) | Website aktif dan terpantau. |
| [#57](https://trello.com/c/l7pwrBCi) | 11:00 | Gabungkan semua bab proposal ke template | P1 Nadira | ⏳ Belum (lewat due) | Proposal lengkap. |
| [#60](https://trello.com/c/5guB9Tdx) | 11:00 | Poster di Canva (mockup → final) | P3 Satria | ⏳ Belum (lewat due) | Poster PNG/PDF final. |
| [#58](https://trello.com/c/EV0vqPA2) | 12:00 | Isi & tanda tangani surat pernyataan orisinalitas | P1 Nadira | ⏳ Belum (lewat due) | Surat siap diunggah. |
| [#59](https://trello.com/c/mz61QciA) | 12:00 | Proofread proposal (angka, sumber, daftar pustaka) | P5 Serlin | ⏳ Belum (lewat due) | Proposal bersih dan konsisten. |
| [#56](https://trello.com/c/18XfLPCo) | 14:00 | Edit video demo (draft v1) | P2 Shellyn | ⏳ Belum (lewat due) | Draft video v1. |
| [#62](https://trello.com/c/jKwpwr1H) | 15:00 | Review silang video v1 & proposal | Semua tim | ⏳ Belum (lewat due) | Daftar revisi. |
| [#63](https://trello.com/c/2YJlHCEd) | 17:00 | Revisi & export video final | P2 Shellyn | ⏳ Belum (lewat due) | File video final. |
| [#64](https://trello.com/c/LnU9b3uM) | 17:00 | Upload video ke YouTube | P1 Nadira | ⏳ Belum (lewat due) | Link YouTube valid. |
| [#65](https://trello.com/c/g3RTC2mK) | 17:30 | Cek akhir 5 komponen wajib | Semua tim | ⏳ Belum (lewat due) | Semua komponen siap. |
| [#66](https://trello.com/c/RXgFcDIE) | 18:00 | SUBMIT semua komponen di sevent.zetech.id | P1 Nadira | ⏳ Belum (lewat due) | Bukti submit (screenshot). |

### Min, 29 Nov 2026 — Cadangan & Pasca-Submit  (0/1 selesai)

| # | Jam | Task | PIC | Status | Output (DoD) |
|---|---|---|---|---|---|
| [#67](https://trello.com/c/jrU8NpBc) | 23:59 | Cadangan: perbaikan darurat / submit bila belum | P1 Nadira | ⬜ Belum (akan datang) | Berkas terkirim. |

### Sen, 30 Nov 2026 — Cadangan & Pasca-Submit  (0/1 selesai)

| # | Jam | Task | PIC | Status | Output (DoD) |
|---|---|---|---|---|---|
| [#68](https://trello.com/c/KD5W3e9L) | 23:59 | Cadangan: hari terakhir pendaftaran & submission (30 Nov) | P1 Nadira | ⬜ Belum (akan datang) |  |

### Jum, 4 Des 2026 — Cadangan & Pasca-Submit  (0/1 selesai)

| # | Jam | Task | PIC | Status | Output (DoD) |
|---|---|---|---|---|---|
| [#69](https://trello.com/c/H3ARaYM0) | 23:59 | Pasca-submit: jaga website & repo tetap aktif | P1 Nadira + P4 Bagas | ⬜ Belum (akan datang) | Website dan repo tetap hidup. |

### Sab, 5 Des 2026 — Cadangan & Pasca-Submit  (0/1 selesai)

| # | Jam | Task | PIC | Status | Output (DoD) |
|---|---|---|---|---|---|
| [#70](https://trello.com/c/gMl2fJes) | 10:00 | Cek pengumuman finalis & technical meeting | P1 Nadira | ⬜ Belum (akan datang) | Status finalis dan jadwal final jelas. |

### Rab, 9 Des 2026 — Cadangan & Pasca-Submit  (0/3 selesai)

| # | Jam | Task | PIC | Status | Output (DoD) |
|---|---|---|---|---|---|
| [#71](https://trello.com/c/k1L1VpOZ) | 23:59 | Slide presentasi final (jika lolos finalis) | P1 Nadira | ⬜ Belum (akan datang) | Slide final. |
| [#72](https://trello.com/c/Ivoo7EEL) | 23:59 | Latihan simulasi karya (demo langsung) | P2 Shellyn + P3 Satria | ⬜ Belum (akan datang) | Simulasi lancar. |
| [#73](https://trello.com/c/0qvq5AOR) | 23:59 | Siapkan jawaban Q&A (teknis & data) | P4 Bagas + P5 Serlin | ⬜ Belum (akan datang) | Daftar tanya-jawab. |

### Kam, 10 Des 2026 — Cadangan & Pasca-Submit  (0/1 selesai)

| # | Jam | Task | PIC | Status | Output (DoD) |
|---|---|---|---|---|---|
| [#74](https://trello.com/c/6BP0f2HI) | 23:59 | Final lomba & awarding (jika lolos finalis) | Semua tim | ⬜ Belum (akan datang) | Presentasi, simulasi, dan Q&A. |

---

## Yang masih terbuka dan sudah lewat due (prioritas cek)

| # | Due | Task | PIC |
|---|---|---|---|
| [#3](https://trello.com/c/Nz4TyUiz) | Sen 23 Nov 17:00 | Berkas individu di sevent.zetech.id | Semua tim |
| [#4](https://trello.com/c/lew5wcV0) | Sen 23 Nov 17:00 | Daftarkan tim Software Development & bayar | Ketua Bagas |
| [#15](https://trello.com/c/2wG9q60A) | Sel 24 Nov 08:15 | Standup pagi 08:00 | Semua tim |
| [#25](https://trello.com/c/MXRVZhKR) | Sel 24 Nov 20:00 | Draft bab proposal: latar belakang & urgensi masalah | P5 Serlin |
| [#26](https://trello.com/c/dH5P8iKK) | Sel 24 Nov 20:00 | Draft bab proposal: tujuan, SDG 2 & rencana pengembangan | P1 Nadira |
| [#27](https://trello.com/c/MWiQqHTM) | Sel 24 Nov 21:30 | Cek progres Hari 2 + putuskan identitas tim | Semua tim |
| [#28](https://trello.com/c/zKOYUL4L) | Rab 25 Nov 08:15 | Standup pagi 08:00 | Semua tim |
| [#39](https://trello.com/c/KlcS8cdg) | Rab 25 Nov 18:00 | Draft bab proposal: metodologi data | P5 Serlin |
| [#38](https://trello.com/c/wgLjqaOz) | Rab 25 Nov 19:00 | Draft bab proposal: arsitektur & teknologi | P4 Bagas |
| [#37](https://trello.com/c/DHzgxzXf) | Rab 25 Nov 20:00 | Integrasi modul, QA lintas modul, naskah video demo | P1 Nadira |
| [#40](https://trello.com/c/utt2ACHF) | Rab 25 Nov 20:00 | Draft bab proposal: desain UI/UX & fitur | P2 Shellyn + P3 Satria |
| [#42](https://trello.com/c/lOBGX6PB) | Kam 26 Nov 08:15 | Standup & pembagian bug | Semua tim |
| [#43](https://trello.com/c/d58zEJai) | Kam 26 Nov 10:00 | Tampilan responsif HP/tablet, loading & error state | P2 Shellyn |
| [#44](https://trello.com/c/K0nhiq8H) | Kam 26 Nov 12:00 | Audit aksesibilitas & performa (Lighthouse) | P2 Shellyn |
| [#45](https://trello.com/c/0672oYpF) | Kam 26 Nov 12:00 | Performa & aksesibilitas peta, perbaikan bug peta | P3 Satria |
| [#48](https://trello.com/c/wgZBSc6a) | Kam 26 Nov 12:00 | Triage bug sisa, putuskan yang di-skip | P1 Nadira |
| [#49](https://trello.com/c/GQb1fF1F) | Kam 26 Nov 14:00 | Deploy final (frontend, backend, database) | P1 Nadira |
| [#50](https://trello.com/c/Bt5oQ1fZ) | Kam 26 Nov 15:00 | Latihan alur demo sesuai naskah video | Semua tim |
| [#52](https://trello.com/c/P5HtfDUa) | Kam 26 Nov 17:00 | Angka & poin data untuk narasi video | P5 Serlin |
| [#53](https://trello.com/c/lQfPy4kq) | Kam 26 Nov 17:00 | Rapikan repo GitHub (README, .env.example, hapus secret) | P4 Bagas |
| [#51](https://trello.com/c/dAkapUYJ) | Kam 26 Nov 18:00 | Rekam layar mengikuti naskah | P2 Shellyn + P3 Satria |
| [#54](https://trello.com/c/iyLyTK1G) | Kam 26 Nov 19:00 | Rekam narasi (voiceover) sesuai naskah | P1 Nadira |
| [#55](https://trello.com/c/SdAeSLP2) | Jum 27 Nov 08:15 | Standup & pembagian tugas akhir | Semua tim |
| [#61](https://trello.com/c/LsojM8ga) | Jum 27 Nov 10:00 | Cek website dari jaringan lain + pemantau uptime | P4 Bagas |
| [#57](https://trello.com/c/l7pwrBCi) | Jum 27 Nov 11:00 | Gabungkan semua bab proposal ke template | P1 Nadira |
| [#60](https://trello.com/c/5guB9Tdx) | Jum 27 Nov 11:00 | Poster di Canva (mockup → final) | P3 Satria |
| [#58](https://trello.com/c/EV0vqPA2) | Jum 27 Nov 12:00 | Isi & tanda tangani surat pernyataan orisinalitas | P1 Nadira |
| [#59](https://trello.com/c/mz61QciA) | Jum 27 Nov 12:00 | Proofread proposal (angka, sumber, daftar pustaka) | P5 Serlin |
| [#56](https://trello.com/c/18XfLPCo) | Jum 27 Nov 14:00 | Edit video demo (draft v1) | P2 Shellyn |
| [#62](https://trello.com/c/jKwpwr1H) | Jum 27 Nov 15:00 | Review silang video v1 & proposal | Semua tim |
| [#63](https://trello.com/c/2YJlHCEd) | Jum 27 Nov 17:00 | Revisi & export video final | P2 Shellyn |
| [#64](https://trello.com/c/LnU9b3uM) | Jum 27 Nov 17:00 | Upload video ke YouTube | P1 Nadira |
| [#65](https://trello.com/c/g3RTC2mK) | Jum 27 Nov 17:30 | Cek akhir 5 komponen wajib | Semua tim |
| [#66](https://trello.com/c/RXgFcDIE) | Jum 27 Nov 18:00 | SUBMIT semua komponen di sevent.zetech.id | P1 Nadira |

> #3 (berkas individu sevent.zetech.id) dan #4 (daftar tim + bayar Rp 80.000) ditandai di board sebagai "belum dikonfirmasi". Batas pendaftaran **30 Nov**.

---

## Referensi dari board

**6 komponen wajib:** (1) pendaftaran tim — Bagas + semua; (2) URL website — Nadira + Bagas; (3) repo GitHub publik — Bagas; (4) proposal maks. 25 hal — Nadira + semua; (5) surat orisinalitas — Nadira; (6) video demo maks. 5 menit di YouTube — Shellyn (edit), Nadira (upload).

**Kriteria penilaian:** fungsionalitas 30% (Bagas + Nadira) · kesesuaian tema 25% (Nadira + Serlin) · inovasi 20% (Serlin) · urgensi masalah 15% (Serlin) · UI/UX & accessibility 10% (Shellyn + Satria).

**Fitur cadangan (hanya jika 14 MVP beres):** historical trends — Shellyn · export CSV — Bagas · simulasi skenario distribusi — Serlin · export PDF — Nadira.

**Aturan main:** standup 08:00, cek progres 21:00, kontrak API dikunci Hari 1, feature freeze Rab 25 Nov, deploy final & rekam Kam 26 Nov, edit video & submit Jum 27 Nov.
