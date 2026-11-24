"""Hitung kebutuhan, rice balance, rasio, dan status per provinsi.

Fungsi murni: menerima DataFrame, bukan path, supaya bisa dipakai API dengan file hasil upload.
"""
from __future__ import annotations

import pandas as pd

# Batas swasembada FAO (1999): produksi >= 90% kebutuhan
BATAS_SWASEMBADA = 0.90

KOLOM = [
    "tahun",
    "kode_bps",
    "kode_kemendagri",
    "provinsi",
    "pulau",
    "lat",
    "lng",
    "penduduk_jiwa",
    "konsumsi_kg_kapita_tahun",
    "produksi_padi_ton_gkg",
    "produksi_beras_ton",
    "kebutuhan_beras_ton",
    "rice_balance_ton",
    "rasio_swasembada",
    "status",
]

_KOLOM_TON = [
    "produksi_padi_ton_gkg",
    "produksi_beras_ton",
    "kebutuhan_beras_ton",
    "rice_balance_ton",
]


def klasifikasi(rasio: float, balance: float, ambang: float = BATAS_SWASEMBADA) -> str:
    """surplus jika balance > 0; balanced jika rasio >= ambang; selain itu defisit."""
    if balance > 0:
        return "surplus"
    return "balanced" if rasio >= ambang else "defisit"


def build(
    ref: pd.DataFrame,
    produksi: pd.DataFrame,
    penduduk: pd.DataFrame,
    konsumsi: pd.DataFrame,
    tahun: int,
    ambang: float = BATAS_SWASEMBADA,
) -> pd.DataFrame:
    """Gabungkan referensi provinsi dengan produksi, penduduk, konsumsi lalu hitung kolom turunan.

    produksi dan penduduk di-join lewat nama provinsi; konsumsi lewat kode_kemendagri.
    Baris dengan provinsi yang tidak lengkap datanya memunculkan ValueError, bukan NaN diam-diam.
    """
    df = (
        ref.merge(penduduk, on="provinsi", how="left", validate="1:1")
        .merge(konsumsi[["kode_kemendagri", "konsumsi_kg_kapita_tahun"]], on="kode_kemendagri", how="left", validate="1:1")
        .merge(produksi, on="provinsi", how="left", validate="1:1")
    )
    kosong = df[df.isna().any(axis=1)]
    if not kosong.empty:
        raise ValueError(f"Data tidak lengkap untuk: {kosong['provinsi'].tolist()}")

    df["kebutuhan_beras_ton"] = df["penduduk_jiwa"] * df["konsumsi_kg_kapita_tahun"] / 1000
    df["rice_balance_ton"] = df["produksi_beras_ton"] - df["kebutuhan_beras_ton"]
    df["rasio_swasembada"] = df["produksi_beras_ton"] / df["kebutuhan_beras_ton"]
    df["status"] = [
        klasifikasi(r, b, ambang)
        for r, b in zip(df["rasio_swasembada"], df["rice_balance_ton"])
    ]
    df.insert(0, "tahun", tahun)

    df["penduduk_jiwa"] = df["penduduk_jiwa"].round().astype("int64")
    for k in _KOLOM_TON:
        df[k] = df[k].round(2)
    df["rasio_swasembada"] = df["rasio_swasembada"].round(4)

    return df[KOLOM]
