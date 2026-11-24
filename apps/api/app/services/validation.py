"""Aturan validasi versi dataset (PRD bagian 6.2 langkah 3)."""
from __future__ import annotations

import pandas as pd

TOLERANSI_TOTAL = 0.001  # 0,1%
AMBANG_PERUBAHAN_BESAR = 0.30


def _aturan(kode: str, label: str, status: str, detail) -> dict:
    return {"kode": kode, "label": label, "status": status, "detail": detail}


def _cek_total(kode: str, label: str, nilai: float, acuan: float | None) -> dict:
    if acuan in (None, 0):
        return _aturan(kode, label, "peringatan", "baris Indonesia tidak ada di file sumber")
    selisih = abs(nilai - acuan) / acuan
    status = "lulus" if selisih <= TOLERANSI_TOTAL else "gagal"
    return _aturan(
        kode,
        label,
        status,
        {"nilai": round(nilai, 2), "acuan_bps": round(acuan, 2), "selisih_persen": round(selisih * 100, 4)},
    )


def validasi(hasil: pd.DataFrame, acuan_indonesia: dict, sebelumnya: pd.DataFrame | None = None) -> dict:
    """acuan_indonesia dari ingest.total_indonesia(). sebelumnya = DataFrame versi published lama."""
    aturan = []

    n = len(hasil)
    aturan.append(
        _aturan("jumlah_provinsi", "Tepat 38 provinsi dan cocok referensi",
                "lulus" if n == 38 else "gagal", {"jumlah": n})
    )

    salah = hasil[
        (hasil["penduduk_jiwa"] <= 0)
        | (hasil["konsumsi_kg_kapita_tahun"] <= 0)
        | (hasil["produksi_beras_ton"] < 0)
        | (hasil["produksi_padi_ton_gkg"] < 0)
    ]
    aturan.append(
        _aturan("nilai_positif", "Tidak ada nilai kosong, nol, atau negatif",
                "lulus" if salah.empty else "gagal",
                {"provinsi": salah["provinsi"].tolist()})
    )

    aturan.append(
        _cek_total("total_produksi", "Total produksi provinsi sama dengan baris Indonesia BPS",
                   float(hasil["produksi_beras_ton"].sum()), acuan_indonesia.get("produksi_beras_ton"))
    )
    aturan.append(
        _cek_total("total_penduduk", "Total penduduk provinsi sama dengan baris Indonesia BPS",
                   float(hasil["penduduk_jiwa"].sum()), acuan_indonesia.get("penduduk_jiwa"))
    )

    if sebelumnya is None:
        aturan.append(_aturan("perubahan_besar", "Perubahan > 30% dibanding versi sebelumnya", "lulus",
                              "tidak ada versi pembanding"))
    else:
        gabung = hasil[["kode_bps", "produksi_beras_ton"]].merge(
            sebelumnya[["kode_bps", "produksi_beras_ton"]], on="kode_bps", suffixes=("", "_lama")
        )
        berubah = []
        for r in gabung.itertuples():
            if r.produksi_beras_ton_lama:
                delta = abs(r.produksi_beras_ton - r.produksi_beras_ton_lama) / r.produksi_beras_ton_lama
                if delta > AMBANG_PERUBAHAN_BESAR:
                    berubah.append({"kode_bps": r.kode_bps, "perubahan_persen": round(delta * 100, 2)})
        aturan.append(
            _aturan("perubahan_besar", "Perubahan > 30% dibanding versi sebelumnya",
                    "peringatan" if berubah else "lulus", {"provinsi": berubah})
        )

    return {"lulus": all(a["status"] != "gagal" for a in aturan), "aturan": aturan}
