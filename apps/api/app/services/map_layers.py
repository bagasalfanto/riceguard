"""Nilai + kelas legenda per layer peta (PRD bagian 5.3, 12).

Satu tempat untuk membagi kelas supaya peta, legenda, dan PDF selalu memakai
batas yang sama. `color_token` selalu nama token CSS, bukan hex.
"""
from __future__ import annotations

import math

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models import DatasetVersion, Province, ProvinceStat

LAYER_VALID = ("status", "produksi", "kebutuhan", "kepadatan")

SEQ_TOKENS = ["--seq-1", "--seq-2", "--seq-3", "--seq-4", "--seq-5"]

STATUS_TOKEN = {
    "surplus": "--status-surplus",
    "balanced": "--status-balanced",
    "defisit": "--status-defisit",
}

STATUS_POLA = {"surplus": "solid", "balanced": "garis", "defisit": "titik"}

STATUS_LABEL = {"surplus": "Surplus", "balanced": "Balanced", "defisit": "Defisit"}


def _angka(nilai: float) -> str:
    """Format id-ID tanpa desimal: 1234.5 -> '1.235'."""
    return f"{nilai:,.0f}".replace(",", ".")


def _kuantil(terurut: list[float], q: float) -> float:
    if len(terurut) == 1:
        return terurut[0]
    posisi = q * (len(terurut) - 1)
    bawah, atas = math.floor(posisi), math.ceil(posisi)
    if bawah == atas:
        return terurut[bawah]
    pecahan = posisi - bawah
    return terurut[bawah] * (1 - pecahan) + terurut[atas] * pecahan


def quantile_classes(seri: list[float], n: int = 5) -> list[dict]:
    """Batas kelas unik; nilai kembar digabung jadi kelas lebih sedikit dari `n`."""
    if not seri:
        return []

    terurut = sorted(seri)
    potongan: list[float] = []
    for i in range(n + 1):
        batas = round(_kuantil(terurut, i / n), 2)
        if not potongan or batas > potongan[-1]:
            potongan.append(batas)

    if len(potongan) == 1:
        hanya = potongan[0]
        return [
            {
                "min": hanya,
                "max": hanya,
                "label": f"{_angka(hanya)} ton",
                "color_token": SEQ_TOKENS[-1],
            }
        ]

    jumlah = len(potongan) - 1
    classes = []
    for i in range(jumlah):
        bawah, atas = potongan[i], potongan[i + 1]
        indeks_token = min(
            len(SEQ_TOKENS) - 1,
            round((i / max(1, jumlah - 1)) * (len(SEQ_TOKENS) - 1)),
        )
        label = f"< {_angka(atas)} ton" if i == 0 else f"{_angka(bawah)} – {_angka(atas)} ton"
        classes.append(
            {
                "min": bawah,
                "max": atas,
                "label": label,
                "color_token": SEQ_TOKENS[indeks_token],
            }
        )
    return classes


def _stats(db: Session, versi: DatasetVersion) -> list[tuple[ProvinceStat, Province]]:
    baris = db.execute(
        select(ProvinceStat, Province)
        .join(Province, Province.kode_bps == ProvinceStat.kode_bps)
        .where(ProvinceStat.version_id == versi.id)
        .order_by(ProvinceStat.kode_bps.asc())
    ).all()
    return [(stat, prov) for stat, prov in baris]


def _layer_status(baris) -> dict:
    values = {stat.kode_bps: stat.status for stat, _ in baris}
    classes = [
        {
            "min": None,
            "max": None,
            "key": kunci,
            "label": STATUS_LABEL[kunci],
            "color_token": STATUS_TOKEN[kunci],
            "pola": STATUS_POLA[kunci],
        }
        for kunci in ("surplus", "balanced", "defisit")
    ]
    return {"satuan": "kategori", "values": values, "classes": classes, "min": None, "max": None}


def _layer_ton(baris, atribut: str, satuan: str = "ton") -> dict:
    values = {stat.kode_bps: float(getattr(stat, atribut)) for stat, _ in baris}
    seri = list(values.values())
    classes = quantile_classes(seri)
    return {
        "satuan": satuan,
        "values": values,
        "classes": classes,
        "min": min(seri) if seri else None,
        "max": max(seri) if seri else None,
    }


def _layer_kepadatan(baris) -> dict:
    values: dict[str, float | None] = {}
    tanpa_luas: list[str] = []
    seri: list[float] = []

    for stat, prov in baris:
        luas = prov.luas_km2
        if luas is None or float(luas) <= 0:
            values[stat.kode_bps] = None
            tanpa_luas.append(stat.kode_bps)
            continue
        nilai = round(int(stat.penduduk_jiwa) / float(luas), 2)
        values[stat.kode_bps] = nilai
        seri.append(nilai)

    if not seri:
        raise AppError(
            "LAYER_UNAVAILABLE",
            409,
            "Layer kepadatan penduduk belum tersedia",
            {"alasan": "luas_km2 belum tersedia"},
        )

    hasil = {
        "satuan": "jiwa/km²",
        "values": values,
        "classes": quantile_classes(seri),
        "min": min(seri),
        "max": max(seri),
    }
    if tanpa_luas:
        hasil["details"] = {"kode_tanpa_luas": tanpa_luas}
    return hasil


def bangun_layer(db: Session, versi: DatasetVersion, layer: str) -> dict:
    if layer not in LAYER_VALID:
        raise AppError(
            "INVALID_PARAMS",
            400,
            "Layer tidak dikenal",
            {"layer": layer, "pilihan": list(LAYER_VALID)},
        )

    baris = _stats(db, versi)

    if layer == "status":
        isi = _layer_status(baris)
    elif layer == "produksi":
        isi = _layer_ton(baris, "produksi_beras_ton")
    elif layer == "kebutuhan":
        isi = _layer_ton(baris, "kebutuhan_beras_ton")
    else:
        isi = _layer_kepadatan(baris)

    return {"layer": layer, "tahun": versi.tahun, **isi}
