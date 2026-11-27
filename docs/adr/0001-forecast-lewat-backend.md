---
scope: adr
canonical-for: ["keputusan arsitektur proxy forecast AI"]
sources: ["apps/api/app/routers/public/forecast.py", "apps/api/app/services/forecast.py", "apps/api/app/core/config.py"]
last-verified: 2026-11-27
---

# Prediksi AI dipanggil lewat backend, bukan dari frontend

Model prediksi produksi dilatih dan di-deploy di Hugging Face Space oleh pemilik model, di luar repo ini. Frontend memanggil `GET /api/v1/forecast` di backend, dan backend yang meneruskan permintaan ke endpoint model.

Alasan: token Space (kalau privat) tidak boleh masuk bundle frontend, CORS Hugging Face tidak diandalkan, dan backend perlu menyeragamkan bentuk respons serta menandai bahwa angka prediksi bukan bagian dataset resmi. Konsekuensinya, `/forecast` bisa membalas 503 saat endpoint model belum dikonfigurasi, dan fitur ini harus bisa dimatikan hanya dengan mengosongkan `AI_ENDPOINT_URL` tanpa menyentuh kode.

Status: dataset resmi saat ini hanya berisi tahun 2025 sebagai data aktual, dan repo ini tidak memuat kode latih, bobot, maupun dataset latih. Proyeksi produksi–kebutuhan 2026 dan seterusnya masih rencana fitur; sampai model tersedia, `/forecast` tetap membalas 503 dan menu `Prediksi` tidak dirender.
