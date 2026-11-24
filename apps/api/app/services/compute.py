"""Hitung dan simpan hasil turunan dari satu set baris provinsi."""
from __future__ import annotations

import pandas as pd


def summary_nasional(df: pd.DataFrame, rekomendasi: list[dict]) -> dict:
    """Agregat nasional untuk dataset_versions.summary; Dashboard dan Landing cukup baca ini."""
    produksi = float(df["produksi_beras_ton"].sum())
    kebutuhan = float(df["kebutuhan_beras_ton"].sum())
    balance = float(df["rice_balance_ton"].sum())
    jumlah = df["status"].value_counts().to_dict()
    return {
        "produksi_beras_ton": round(produksi, 2),
        "kebutuhan_beras_ton": round(kebutuhan, 2),
        "rice_balance_ton": round(balance, 2),
        "rasio_swasembada": round(produksi / kebutuhan, 4) if kebutuhan else None,
        "jumlah_status": {
            "surplus": int(jumlah.get("surplus", 0)),
            "balanced": int(jumlah.get("balanced", 0)),
            "defisit": int(jumlah.get("defisit", 0)),
        },
        "total_dialokasikan_ton": round(sum(r["ton"] for r in rekomendasi), 2),
        "jumlah_pasangan": len(rekomendasi),
    }
