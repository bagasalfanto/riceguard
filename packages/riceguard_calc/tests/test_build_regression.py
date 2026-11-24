"""Regresi: output build() harus identik dengan dataset_v1.csv yang sudah dipublikasi."""
from pathlib import Path

import pandas as pd
import pytest

from riceguard_calc import build, parse_konsumsi, parse_penduduk, parse_produksi, parse_referensi

ROOT = Path(__file__).resolve().parents[3]
RAW = ROOT / "dataset" / "raw"
TAHUN = 2025
TOLERANSI = 0.01


@pytest.fixture(scope="module")
def hasil() -> pd.DataFrame:
    return build(
        parse_referensi(RAW / "provinces-reference-serlin.csv"),
        parse_produksi(RAW / f"produksi_{TAHUN}.txt"),
        parse_penduduk(RAW / "penduduk_supas2025.txt"),
        parse_konsumsi(RAW / f"konsumsi_bapanas_{TAHUN}.csv"),
        TAHUN,
    )


@pytest.fixture(scope="module")
def acuan() -> pd.DataFrame:
    return pd.read_csv(ROOT / "dataset" / "dataset_v1.csv", dtype={"kode_bps": str, "kode_kemendagri": str})


def test_urutan_kolom_sama(hasil, acuan):
    assert list(hasil.columns) == list(acuan.columns)


def test_jumlah_dan_urutan_provinsi_sama(hasil, acuan):
    assert len(hasil) == 38
    assert list(hasil["kode_bps"]) == list(acuan["kode_bps"])


def test_nilai_sama_per_kolom(hasil, acuan):
    kolom_teks = ["kode_bps", "kode_kemendagri", "provinsi", "pulau", "status"]
    for k in kolom_teks:
        assert list(hasil[k]) == list(acuan[k]), k

    for k in ["lat", "lng", "penduduk_jiwa", "konsumsi_kg_kapita_tahun"]:
        assert (hasil[k] - acuan[k]).abs().max() <= TOLERANSI, k

    for k in ["produksi_padi_ton_gkg", "produksi_beras_ton", "kebutuhan_beras_ton",
              "rice_balance_ton", "rasio_swasembada"]:
        assert (hasil[k] - acuan[k]).abs().max() <= TOLERANSI, k


def test_ringkasan_nasional(hasil):
    assert round(hasil["produksi_beras_ton"].sum()) == 34_690_959
    assert round(hasil["kebutuhan_beras_ton"].sum()) == 24_819_269
    assert round(hasil["rice_balance_ton"].sum()) == 9_871_690
    assert hasil["status"].value_counts().to_dict() == {"defisit": 20, "surplus": 17, "balanced": 1}


def test_kalimantan_barat_balanced_walau_balance_negatif(hasil):
    kalteng = hasil.loc[hasil["provinsi"] == "Kalimantan Barat"].iloc[0]
    assert kalteng["status"] == "balanced"
    assert kalteng["rice_balance_ton"] < 0
    assert 0.90 <= kalteng["rasio_swasembada"] <= 1.0


def test_data_tidak_lengkap_menimbulkan_error():
    ref = pd.DataFrame({"kode_bps": ["11"], "kode_kemendagri": ["11"], "provinsi": ["Aceh"],
                        "pulau": ["Sumatera"], "lat": [4.2], "lng": [96.9]})
    produksi = pd.DataFrame({"provinsi": ["Aceh"], "produksi_padi_ton_gkg": [1.0], "produksi_beras_ton": [0.5]})
    penduduk = pd.DataFrame({"provinsi": [], "penduduk_jiwa": []})
    konsumsi = pd.DataFrame({"kode_kemendagri": [], "konsumsi_kg_kapita_tahun": []})
    with pytest.raises(ValueError, match="tidak lengkap"):
        build(ref, produksi, penduduk, konsumsi, 2025)
