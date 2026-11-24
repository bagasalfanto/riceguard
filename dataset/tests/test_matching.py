"""3 kasus uji algoritma matching v1. Jalankan:  python -m pytest tests -q"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from matching import haversine_km, rekomendasi_distribusi  # noqa: E402


def prov(kode, lat, lng, balance):
    return {"kode": kode, "nama": kode, "lat": lat, "lng": lng, "balance": balance}


def test_1_surplus_terdekat_dipilih_dulu():
    # D defisit 100; S1 dekat (surplus 60), S2 jauh (surplus 500)
    data = [prov("D", 0, 0, -100), prov("S1", 0, 1, 60), prov("S2", 0, 10, 500)]
    hasil = rekomendasi_distribusi(data)
    assert [(h["dari_kode"], h["ton"]) for h in hasil] == [("S1", 60), ("S2", 40)]


def test_2_defisit_terbesar_dilayani_dulu():
    # Surplus hanya 100. D_besar (-150) dilayani dulu walau D_kecil lebih dekat.
    data = [prov("S", 0, 0, 100), prov("D_kecil", 0, 1, -50), prov("D_besar", 0, 5, -150)]
    hasil = rekomendasi_distribusi(data)
    assert hasil == [{"urutan": 1, "dari_kode": "S", "dari": "S", "ke_kode": "D_besar", "ke": "D_besar",
                      "ton": 100, "jarak_km": round(haversine_km(0, 5, 0, 0), 1)}]


def test_3_alokasi_tidak_melebihi_sisa_surplus_maupun_defisit():
    data = [prov("S1", -6, 107, 300), prov("S2", -7, 112, 50),
            prov("D1", -6.2, 106.8, -200), prov("D2", 0.5, 101.8, -180), prov("D3", -8, 115, -10)]
    hasil = rekomendasi_distribusi(data)
    for p in data:
        keluar = sum(h["ton"] for h in hasil if h["dari_kode"] == p["kode"])
        masuk = sum(h["ton"] for h in hasil if h["ke_kode"] == p["kode"])
        if p["balance"] > 0:
            assert keluar <= p["balance"] and masuk == 0
        else:
            assert masuk <= -p["balance"] and keluar == 0
    # surplus total 350 < defisit total 390, jadi seluruh surplus habis terpakai
    assert sum(h["ton"] for h in hasil) == 350


def test_4_provinsi_balanced_tidak_ikut_dicocokkan():
    data = [prov("S", 0, 0, 100), prov("D", 0, 2, -40),
            {"kode": "B", "nama": "B", "lat": 0, "lng": 1, "balance": -5, "status": "balanced"}]
    hasil = rekomendasi_distribusi(data)
    assert [(h["dari_kode"], h["ke_kode"], h["ton"]) for h in hasil] == [("S", "D", 40)]
