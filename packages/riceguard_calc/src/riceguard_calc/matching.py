"""Algoritma matching v1 RiceGuard: rekomendasi distribusi beras surplus -> defisit.

Aturan:
1. Urutkan provinsi defisit dari defisit terbesar.
2. Untuk tiap provinsi defisit, cocokkan ke provinsi surplus terdekat
   (jarak haversine antar-titik provinsi), lalu ke surplus terdekat berikutnya.
3. Alokasi = min(sisa defisit, sisa surplus), jadi tidak pernah melebihi keduanya.
Penerima hanya provinsi berstatus "defisit"; pemasok hanya "surplus".
Provinsi "balanced" (memenuhi >= 90% kebutuhan) tidak dijadikan penerima maupun pemasok.

Hasil adalah REKOMENDASI berbasis data tahunan, bukan rencana logistik:
belum memperhitungkan stok, biaya angkut, moda, atau kebijakan.
"""
from __future__ import annotations

import math

RADIUS_BUMI_KM = 6371.0088


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Jarak lingkaran besar antara dua titik (derajat) dalam km."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat, dlng = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlng / 2) ** 2
    return 2 * RADIUS_BUMI_KM * math.asin(math.sqrt(a))


def _status(p: dict) -> str:
    return p.get("status") or (
        "surplus" if p["balance"] > 0 else "defisit" if p["balance"] < 0 else "balanced"
    )


def match(provinsi: list[dict], params=None) -> list[dict]:
    """provinsi: list dict berisi kode, nama, lat, lng, balance (ton), dan opsional status.
    Tanpa 'status', tanda balance yang menentukan (+ surplus, - defisit).

    Mengembalikan list dict: dari_kode, dari, ke_kode, ke, ton, jarak_km, urutan.

    params (skenario simulasi) belum diimplementasikan; lihat docs/tickets/wave-6-recommendation.md.
    """
    if params is not None:
        raise NotImplementedError("parameter skenario simulasi diimplementasikan di wave 6")

    surplus = [p for p in provinsi if _status(p) == "surplus" and p["balance"] > 0]
    defisit = sorted(
        (p for p in provinsi if _status(p) == "defisit" and p["balance"] < 0),
        key=lambda p: p["balance"],  # paling negatif dulu
    )
    sisa_surplus = {p["kode"]: p["balance"] for p in surplus}

    hasil = []
    for d in defisit:
        butuh = -d["balance"]
        kandidat = sorted(
            surplus,
            key=lambda s: (haversine_km(d["lat"], d["lng"], s["lat"], s["lng"]), s["kode"]),
        )
        for s in kandidat:
            if butuh <= 0:
                break
            tersedia = sisa_surplus[s["kode"]]
            if tersedia <= 0:
                continue
            ton = min(butuh, tersedia)
            sisa_surplus[s["kode"]] -= ton
            butuh -= ton
            hasil.append(
                {
                    "urutan": len(hasil) + 1,
                    "dari_kode": s["kode"],
                    "dari": s["nama"],
                    "ke_kode": d["kode"],
                    "ke": d["nama"],
                    "ton": round(ton, 2),
                    "jarak_km": round(haversine_km(d["lat"], d["lng"], s["lat"], s["lng"]), 1),
                }
            )
    return hasil
