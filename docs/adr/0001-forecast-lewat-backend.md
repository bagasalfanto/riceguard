# Prediksi AI dipanggil lewat backend, bukan dari frontend

Model prediksi produksi dilatih dan di-deploy di Hugging Face Space oleh pemilik model, di luar repo ini. Frontend memanggil `GET /api/v1/forecast` di backend, dan backend yang meneruskan permintaan ke endpoint model.

Alasan: token Space (kalau privat) tidak boleh masuk bundle frontend, CORS Hugging Face tidak diandalkan, dan backend perlu menyeragamkan bentuk respons serta menandai bahwa angka prediksi bukan bagian dataset resmi. Konsekuensinya, `/forecast` bisa membalas 503 saat endpoint model belum dikonfigurasi, dan fitur ini harus bisa dimatikan hanya dengan mengosongkan `AI_ENDPOINT_URL` tanpa menyentuh kode.
