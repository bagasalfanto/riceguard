"""Parser file mentah RiceGuard (upload admin maupun file di dataset/raw).

Setiap fungsi menerima bytes, teks, atau path. Format angka Indonesia `1.615.200,00`
dan alias nama BPS ditangani di sini, supaya build() hanya melihat angka bersih.
"""
from __future__ import annotations

import io
from pathlib import Path

import pandas as pd

# Nama di tabel BPS yang berbeda dari nama di referensi peta (P3)
ALIAS_NAMA_BPS = {"DI Yogyakarta": "Daerah Istimewa Yogyakarta"}

KOLOM_REFERENSI = ["kode_bps", "kode_kemendagri", "provinsi", "pulau", "lat", "lng"]
KOLOM_PRODUKSI = ["provinsi", "produksi_padi_ton_gkg", "produksi_beras_ton"]
KOLOM_PENDUDUK = ["provinsi", "penduduk_jiwa"]
KOLOM_KONSUMSI = ["kode_kemendagri", "provinsi", "konsumsi_kg_kapita_tahun"]


def _sumber(source) -> io.IOBase | Path:
    """bytes/str isi file -> buffer; str path -> Path."""
    if isinstance(source, bytes):
        return io.BytesIO(source)
    if isinstance(source, str) and ("\n" in source or "|" in source):
        return io.StringIO(source)
    return Path(source)


def angka_id(s: pd.Series) -> pd.Series:
    """Ubah angka format Indonesia '1.234,56' menjadi float."""
    return (
        s.astype(str)
        .str.strip()
        .str.replace(".", "", regex=False)
        .str.replace(",", ".", regex=False)
        .astype(float)
    )


def _baca_pipa(source, kolom: list[str]) -> pd.DataFrame:
    df = pd.read_csv(
        _sumber(source), sep="|", header=None, names=kolom, dtype=str, encoding="utf-8-sig"
    )
    df["provinsi"] = df["provinsi"].str.strip().replace(ALIAS_NAMA_BPS)
    for k in kolom[1:]:
        df[k] = angka_id(df[k])
    return df


def parse_referensi(source) -> pd.DataFrame:
    """CSV berheader: kode_bps, kode_kemendagri, provinsi, pulau, lat, lng."""
    df = pd.read_csv(
        _sumber(source),
        dtype={"kode_bps": str, "kode_kemendagri": str},
        encoding="utf-8-sig",
    )
    return df[KOLOM_REFERENSI]


def parse_produksi(source) -> pd.DataFrame:
    """Pipa tanpa header: provinsi | produksi padi (ton GKG) | produksi beras (ton)."""
    return _baca_pipa(source, KOLOM_PRODUKSI)


def parse_penduduk(source) -> pd.DataFrame:
    """Pipa tanpa header: provinsi | jumlah penduduk."""
    return _baca_pipa(source, KOLOM_PENDUDUK)


def parse_konsumsi(source) -> pd.DataFrame:
    """CSV berheader: kode_kemendagri, provinsi, konsumsi_kg_kapita_tahun."""
    df = pd.read_csv(_sumber(source), dtype={"kode_kemendagri": str}, encoding="utf-8-sig")
    return df[KOLOM_KONSUMSI]


def total_indonesia(produksi: pd.DataFrame, penduduk: pd.DataFrame) -> dict:
    """Ambil baris total 'Indonesia' dari tabel BPS untuk keperluan validasi.

    Mengembalikan dict berisi produksi_beras_ton / produksi_padi_ton_gkg / penduduk_jiwa;
    nilai yang tidak ada di file menjadi None, bukan error.
    """
    hasil = {"produksi_beras_ton": None, "produksi_padi_ton_gkg": None, "penduduk_jiwa": None}

    prod = produksi.loc[produksi["provinsi"] == "Indonesia"]
    if not prod.empty:
        hasil["produksi_beras_ton"] = float(prod["produksi_beras_ton"].iloc[0])
        hasil["produksi_padi_ton_gkg"] = float(prod["produksi_padi_ton_gkg"].iloc[0])

    pend = penduduk.loc[penduduk["provinsi"] == "Indonesia"]
    if not pend.empty:
        hasil["penduduk_jiwa"] = float(pend["penduduk_jiwa"].iloc[0])

    return hasil
