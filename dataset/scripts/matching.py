"""Algoritma matching v1 RiceGuard: rekomendasi distribusi beras surplus -> defisit.

Aturan (sesuai timeline task 17):
1. Urutkan provinsi defisit dari defisit terbesar.
2. Untuk tiap provinsi defisit, cocokkan ke provinsi surplus terdekat
   (jarak haversine antar-titik provinsi), lalu ke surplus terdekat berikutnya.
3. Alokasi = min(sisa defisit, sisa surplus), jadi tidak pernah melebihi keduanya.
Penerima hanya provinsi berstatus "defisit"; pemasok hanya "surplus".
Provinsi "balanced" (memenuhi >= 90% kebutuhan) tidak dijadikan penerima maupun pemasok.

Hasil adalah REKOMENDASI berbasis data tahunan, bukan rencana logistik:
belum memperhitungkan stok, biaya angkut, moda, atau kebijakan.

Pakai:
    from matching import rekomendasi_distribusi
    rekomendasi = rekomendasi_distribusi(provinsi)   # list[dict] -> list[dict]
Jalankan pada dataset:  python scripts/matching.py
"""
from __future__ import annotations

import math
from pathlib import Path

RADIUS_BUMI_KM = 6371.0088


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Jarak lingkaran besar antara dua titik (derajat) dalam km."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat, dlng = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlng / 2) ** 2
    return 2 * RADIUS_BUMI_KM * math.asin(math.sqrt(a))


def rekomendasi_distribusi(provinsi: list[dict]) -> list[dict]:
    """provinsi: list dict berisi kode, nama, lat, lng, balance (ton), dan opsional status.
    Tanpa 'status', tanda balance yang menentukan (+ surplus, - defisit).

    Mengembalikan list dict: dari_kode, dari, ke_kode, ke, ton, jarak_km, urutan.
    """
    def status(p):
        return p.get("status") or ("surplus" if p["balance"] > 0 else "defisit" if p["balance"] < 0 else "balanced")

    surplus = [p for p in provinsi if status(p) == "surplus" and p["balance"] > 0]
    defisit = sorted((p for p in provinsi if status(p) == "defisit" and p["balance"] < 0),
                     key=lambda p: p["balance"])  # paling negatif dulu
    sisa_surplus = {p["kode"]: p["balance"] for p in surplus}

    hasil = []
    for d in defisit:
        butuh = -d["balance"]
        kandidat = sorted(surplus, key=lambda s: (haversine_km(d["lat"], d["lng"], s["lat"], s["lng"]), s["kode"]))
        for s in kandidat:
            if butuh <= 0:
                break
            tersedia = sisa_surplus[s["kode"]]
            if tersedia <= 0:
                continue
            ton = min(butuh, tersedia)
            sisa_surplus[s["kode"]] -= ton
            butuh -= ton
            hasil.append({
                "urutan": len(hasil) + 1,
                "dari_kode": s["kode"], "dari": s["nama"],
                "ke_kode": d["kode"], "ke": d["nama"],
                "ton": round(ton, 2),
                "jarak_km": round(haversine_km(d["lat"], d["lng"], s["lat"], s["lng"]), 1),
            })
    return hasil


def dari_dataset(path: Path) -> list[dict]:
    import pandas as pd
    df = pd.read_csv(path, dtype={"kode_bps": str})
    return [
        {"kode": r.kode_bps, "nama": r.provinsi, "lat": r.lat, "lng": r.lng,
         "balance": r.rice_balance_ton, "status": r.status}
        for r in df.itertuples()
    ]


if __name__ == "__main__":
    import pandas as pd

    base = Path(__file__).resolve().parent.parent
    prov = dari_dataset(base / "dataset_v1.csv")
    rek = pd.DataFrame(rekomendasi_distribusi(prov))
    keluar = base / "rekomendasi_distribusi_v1.csv"
    rek.to_csv(keluar, index=False)
    (base / "data").mkdir(exist_ok=True)
    rek.to_json(base / "data" / "distribution.json", orient="records", indent=2, force_ascii=False)

    # Validasi: tidak ada surplus/defisit yang terlampaui
    bal = {p["kode"]: p["balance"] for p in prov}
    keluar_per_surplus = rek.groupby("dari_kode")["ton"].sum()
    masuk_per_defisit = rek.groupby("ke_kode")["ton"].sum()
    assert all(keluar_per_surplus[k] <= bal[k] + 0.05 for k in keluar_per_surplus.index)
    assert all(masuk_per_defisit[k] <= -bal[k] + 0.05 for k in masuk_per_defisit.index)
    total_surplus = sum(p["balance"] for p in prov if p["status"] == "surplus")
    total_defisit = -sum(p["balance"] for p in prov if p["status"] == "defisit")
    print(f"{len(rek)} rekomendasi | dialokasikan {rek['ton'].sum():,.0f} ton"
          f" | total defisit {total_defisit:,.0f} | total surplus {total_surplus:,.0f}")
    print(f"ditulis: {keluar} dan data/distribution.json")
