"""Regresi: match() harus identik dengan rekomendasi_distribusi_v1.csv."""
from pathlib import Path

import pandas as pd
import pytest
from riceguard_calc import build, match, parse_konsumsi, parse_penduduk, parse_produksi, parse_referensi

ROOT = Path(__file__).resolve().parents[3]
RAW = ROOT / "dataset" / "raw"


@pytest.fixture(scope="module")
def rekomendasi() -> list[dict]:
    df = build(
        parse_referensi(RAW / "provinces-reference-serlin.csv"),
        parse_produksi(RAW / "produksi_2025.txt"),
        parse_penduduk(RAW / "penduduk_supas2025.txt"),
        parse_konsumsi(RAW / "konsumsi_bapanas_2025.csv"),
        2025,
    )
    provinsi = [
        {"kode": r.kode_bps, "nama": r.provinsi, "lat": r.lat, "lng": r.lng,
         "balance": r.rice_balance_ton, "status": r.status}
        for r in df.itertuples()
    ]
    return match(provinsi)


@pytest.fixture(scope="module")
def acuan() -> pd.DataFrame:
    return pd.read_csv(ROOT / "dataset" / "rekomendasi_distribusi_v1.csv", dtype={"dari_kode": str, "ke_kode": str})


def test_jumlah_pasangan_dan_total_ton(rekomendasi, acuan):
    assert len(rekomendasi) == 27
    assert sum(r["ton"] for r in rekomendasi) == pytest.approx(acuan["ton"].sum(), abs=0.01)
    assert round(sum(r["ton"] for r in rekomendasi)) == 2_889_188


def test_urutan_dan_pasangan_sama(rekomendasi, acuan):
    assert [r["urutan"] for r in rekomendasi] == list(acuan["urutan"])
    assert [r["dari_kode"] for r in rekomendasi] == list(acuan["dari_kode"])
    assert [r["ke_kode"] for r in rekomendasi] == list(acuan["ke_kode"])
    assert [r["dari"] for r in rekomendasi] == list(acuan["dari"])
    assert [r["ke"] for r in rekomendasi] == list(acuan["ke"])


def test_ton_dan_jarak_sama(rekomendasi, acuan):
    for r, a in zip(rekomendasi, acuan.itertuples(), strict=True):
        assert r["ton"] == pytest.approx(a.ton, abs=0.01)
        assert r["jarak_km"] == pytest.approx(a.jarak_km, abs=0.05)


def test_tidak_melebihi_surplus_maupun_defisit(rekomendasi):
    keluar: dict[str, float] = {}
    masuk: dict[str, float] = {}
    for r in rekomendasi:
        keluar[r["dari_kode"]] = keluar.get(r["dari_kode"], 0) + r["ton"]
        masuk[r["ke_kode"]] = masuk.get(r["ke_kode"], 0) + r["ton"]
    assert all(v > 0 for v in keluar.values())
    assert all(v > 0 for v in masuk.values())
