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
from dataclasses import dataclass, field
from decimal import ROUND_DOWN, ROUND_HALF_UP, Decimal

from riceguard_calc.build import klasifikasi

RADIUS_BUMI_KM = 6371.0088
_EPSILON = 1e-9
_KUNCI_V1 = ("urutan", "dari_kode", "dari", "ke_kode", "ke", "ton", "jarak_km")


@dataclass(frozen=True)
class MatchParams:
    """Parameter skenario simulasi untuk algoritma matching distribusi."""

    ambang_swasembada: float = 0.90
    persen_surplus_dilepas: float = 100.0
    jarak_maks_km: float | None = None
    kecualikan_pemasok: tuple[str, ...] = ()
    kecualikan_penerima: tuple[str, ...] = ()
    perubahan_produksi: dict[str, float] = field(default_factory=dict)
    perubahan_konsumsi_persen: float = 0.0


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Jarak lingkaran besar antara dua titik (derajat) dalam km."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat, dlng = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlng / 2) ** 2
    return 2 * RADIUS_BUMI_KM * math.asin(math.sqrt(a))


def _status_dari_minimal(p: dict, balance: float, ambang: float) -> str:
    rasio = p.get("rasio_swasembada") if p.get("rasio_swasembada") is not None else p.get("rasio")
    if rasio is not None:
        return klasifikasi(float(rasio), balance, ambang)
    if p.get("status") is not None:
        return p["status"]
    return "surplus" if balance > 0 else "defisit" if balance < 0 else "balanced"


def _siapkan_provinsi(provinsi: list[dict], params: MatchParams) -> list[dict]:
    hasil: list[dict] = []
    kons_pct = float(params.perubahan_konsumsi_persen)

    for p in provinsi:
        kode = p["kode"]
        nama = p["nama"]
        lat = float(p["lat"])
        lng = float(p["lng"])
        pulau = p.get("pulau")
        prod_pct = float(params.perubahan_produksi.get(kode, 0.0))

        punya_produksi = p.get("produksi_beras_ton") is not None
        punya_penduduk_konsumsi = (
            p.get("penduduk_jiwa") is not None and p.get("konsumsi_kg_kapita_tahun") is not None
        )
        punya_kebutuhan = p.get("kebutuhan_beras_ton") is not None

        if punya_produksi and (punya_penduduk_konsumsi or punya_kebutuhan):
            if prod_pct == 0.0 and kons_pct == 0.0:
                produksi = float(p["produksi_beras_ton"])
                if punya_kebutuhan:
                    kebutuhan = float(p["kebutuhan_beras_ton"])
                else:
                    keb_dec = (
                        Decimal(str(p["penduduk_jiwa"]))
                        * Decimal(str(p["konsumsi_kg_kapita_tahun"]))
                        / Decimal("1000")
                    )
                    kebutuhan = float(keb_dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

                if p.get("balance") is not None:
                    balance = float(p["balance"])
                elif p.get("rice_balance_ton") is not None:
                    balance = float(p["rice_balance_ton"])
                else:
                    balance = float(
                        (Decimal(str(produksi)) - Decimal(str(kebutuhan))).quantize(
                            Decimal("0.01"), rounding=ROUND_HALF_UP
                        )
                    )

                if p.get("rasio_swasembada") is not None:
                    rasio = float(p["rasio_swasembada"])
                elif p.get("rasio") is not None:
                    rasio = float(p["rasio"])
                elif kebutuhan > 0:
                    rasio = float(
                        (Decimal(str(produksi)) / Decimal(str(kebutuhan))).quantize(
                            Decimal("0.0001"), rounding=ROUND_HALF_UP
                        )
                    )
                else:
                    rasio = 0.0
            else:
                prod_exact = Decimal(str(p["produksi_beras_ton"])) * (
                    Decimal("1") + Decimal(str(prod_pct)) / Decimal("100")
                )
                if punya_penduduk_konsumsi:
                    keb_exact = (
                        Decimal(str(p["penduduk_jiwa"]))
                        * Decimal(str(p["konsumsi_kg_kapita_tahun"]))
                        * (Decimal("1") + Decimal(str(kons_pct)) / Decimal("100"))
                        / Decimal("1000")
                    )
                else:
                    keb_exact = Decimal(str(p["kebutuhan_beras_ton"])) * (
                        Decimal("1") + Decimal(str(kons_pct)) / Decimal("100")
                    )
                produksi = float(prod_exact.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
                kebutuhan = float(keb_exact.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
                balance = float((prod_exact - keb_exact).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
                rasio = (
                    float((prod_exact / keb_exact).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP))
                    if keb_exact > 0
                    else 0.0
                )

            status = klasifikasi(rasio, balance, params.ambang_swasembada)
        else:
            produksi = float(p["produksi_beras_ton"]) if punya_produksi else None
            kebutuhan = float(p["kebutuhan_beras_ton"]) if punya_kebutuhan else None
            balance = float(p["balance"] if "balance" in p else p["rice_balance_ton"])
            rasio_raw = (
                p.get("rasio_swasembada")
                if p.get("rasio_swasembada") is not None
                else p.get("rasio")
            )
            rasio = float(rasio_raw) if rasio_raw is not None else None
            status = _status_dari_minimal(p, balance, params.ambang_swasembada)

        entri = {
            "kode": kode,
            "nama": nama,
            "lat": lat,
            "lng": lng,
            "produksi_beras_ton": produksi,
            "kebutuhan_beras_ton": kebutuhan,
            "balance": balance,
            "rice_balance_ton": balance,
            "rasio_swasembada": rasio,
            "status": status,
        }
        if pulau is not None:
            entri["pulau"] = pulau
        hasil.append(entri)

    return hasil


def match_detail(
    provinsi: list[dict],
    params: MatchParams | None = None,
) -> tuple[list[dict], list[dict]]:
    """Jalankan matching dengan parameter skenario dan kembalikan metadata alokasi + status simulasi."""
    aktif = params or MatchParams()
    simulasi = _siapkan_provinsi(provinsi, aktif)

    kecuali_pemasok = set(aktif.kecualikan_pemasok)
    kecuali_penerima = set(aktif.kecualikan_penerima)

    surplus = [
        p
        for p in simulasi
        if p["status"] == "surplus" and p["balance"] > 0 and p["kode"] not in kecuali_pemasok
    ]
    defisit = sorted(
        (
            p
            for p in simulasi
            if p["status"] == "defisit" and p["balance"] < 0 and p["kode"] not in kecuali_penerima
        ),
        key=lambda p: p["balance"],  # paling negatif dulu
    )

    sisa_surplus = {
        p["kode"]: (
            p["balance"]
            if aktif.persen_surplus_dilepas == 100.0
            else float(
                (
                    Decimal(str(p["balance"]))
                    * Decimal(str(aktif.persen_surplus_dilepas))
                    / Decimal("100")
                ).quantize(Decimal("0.01"), rounding=ROUND_DOWN)
            )
        )
        for p in surplus
    }

    hasil: list[dict] = []
    for d in defisit:
        defisit_total = -d["balance"]
        butuh = defisit_total
        kandidat = sorted(
            surplus,
            key=lambda s: (haversine_km(d["lat"], d["lng"], s["lat"], s["lng"]), s["kode"]),
        )
        for peringkat_jarak, s in enumerate(kandidat, start=1):
            if butuh <= _EPSILON:
                break
            tersedia = sisa_surplus[s["kode"]]
            if tersedia <= _EPSILON:
                continue
            jarak_km = round(haversine_km(d["lat"], d["lng"], s["lat"], s["lng"]), 1)
            if aktif.jarak_maks_km is not None and jarak_km > aktif.jarak_maks_km:
                continue
            ton = min(butuh, tersedia)
            sisa_sebelum = round(tersedia, 2)
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
                    "jarak_km": jarak_km,
                    "peringkat_jarak": peringkat_jarak,
                    "sisa_sebelum": sisa_sebelum,
                    "defisit_penerima": round(defisit_total, 2),
                }
            )
    return hasil, simulasi


def match(provinsi: list[dict], params: MatchParams | None = None) -> list[dict]:
    """provinsi: list dict berisi kode, nama, lat, lng, balance (ton), dan opsional status.
    Tanpa 'status', tanda balance yang menentukan (+ surplus, - defisit).

    Mengembalikan list dict: urutan, dari_kode, dari, ke_kode, ke, ton, jarak_km.
    """
    detail, _ = match_detail(provinsi, params)
    return [{k: r[k] for k in _KUNCI_V1} for r in detail]
