"""Parser file mentah: format angka Indonesia, alias nama, baris total Indonesia."""
from pathlib import Path

import pandas as pd
import pytest
from riceguard_calc import ALIAS_NAMA_BPS, parse_konsumsi, parse_penduduk, parse_produksi, total_indonesia
from riceguard_calc.ingest import angka_id

ROOT = Path(__file__).resolve().parents[3]
RAW = ROOT / "dataset" / "raw"


def test_angka_id_membaca_format_indonesia():
    hasil = angka_id(pd.Series(["1.615.200,00", " 930.489,00 ", "877,0"]))
    assert list(hasil) == [1_615_200.0, 930_489.0, 877.0]


def test_parse_produksi_dari_bytes():
    isi = b"Aceh | 1.615.200,00 | 930.489,00\nIndonesia | 34.690.959,00 | 19.000.000,00\n"
    df = parse_produksi(isi)
    assert list(df.columns) == ["provinsi", "produksi_padi_ton_gkg", "produksi_beras_ton"]
    assert df.loc[df["provinsi"] == "Aceh", "produksi_beras_ton"].iloc[0] == 930_489.0


def test_alias_di_yogyakarta_dipetakan():
    isi = b"DI Yogyakarta | 1.000,00 | 500,00\n"
    df = parse_produksi(isi)
    assert df["provinsi"].iloc[0] == ALIAS_NAMA_BPS["DI Yogyakarta"]
    assert df["provinsi"].iloc[0] == "Daerah Istimewa Yogyakarta"


def test_parse_penduduk_dan_konsumsi_dari_path():
    penduduk = parse_penduduk(RAW / "penduduk_supas2025.txt")
    konsumsi = parse_konsumsi(RAW / "konsumsi_bapanas_2025.csv")
    assert len(penduduk) == 39
    assert len(konsumsi) == 38
    assert pd.api.types.is_string_dtype(konsumsi["kode_kemendagri"])


def test_total_indonesia_dibaca_untuk_validasi():
    acuan = total_indonesia(
        parse_produksi(RAW / "produksi_2025.txt"),
        parse_penduduk(RAW / "penduduk_supas2025.txt"),
    )
    assert acuan["produksi_beras_ton"] == pytest.approx(34_690_959.0)
    assert acuan["penduduk_jiwa"] == pytest.approx(284_667_253.0)
