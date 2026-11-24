"""Bangun dataset_v1.csv RiceGuard (tahun 2025) dengan pandas.

Sumber resmi:
- Produksi padi & beras 2025: BPS, Survei KSA & Ubinan (tabel diperbarui 12 Feb 2026)
- Penduduk 2025: BPS, hasil Survei Penduduk Antar Sensus (SUPAS) 2025
- Konsumsi beras 2025: Bapanas, Rata-rata Konsumsi per Jenis Pangan Penduduk Indonesia
  Provinsi Update Tahun 2025 (komoditas "Beras", kg/kapita/tahun)
- Referensi provinsi (kode BPS & Kemendagri, nama, pulau, centroid lat/lng): tim WebGIS (P3),
  provinces-reference-serlin.csv, sama dengan GeoJSON peta frontend

Rumus:
  kebutuhan (ton) = penduduk x konsumsi_per_kapita (kg) / 1000
  balance (ton)   = produksi_beras - kebutuhan
  rasio           = produksi_beras / kebutuhan
  status          = surplus  jika rasio > 1 (balance > 0)
                    balanced jika 0,90 <= rasio <= 1 (produksi memenuhi >= 90% kebutuhan:
                             kriteria swasembada FAO 1999, tetapi belum surplus)
                    defisit  jika rasio < 0,90

Jalankan dari folder repo:  python scripts/build_dataset.py
Output: dataset_v1.csv dan data/provinces.json (untuk frontend)
"""
from pathlib import Path

import pandas as pd

BASE = Path(__file__).resolve().parent.parent
RAW = BASE / "raw"
TAHUN = 2025
# Batas swasembada FAO (1999): produksi >= 90% kebutuhan
BATAS_SWASEMBADA = 0.90



# Nama di tabel BPS yang berbeda dari nama di referensi peta (P3)
ALIAS_NAMA_BPS = {"DI Yogyakarta": "Daerah Istimewa Yogyakarta"}


def angka_id(s: pd.Series) -> pd.Series:
    """Ubah angka format Indonesia '1.234,56' menjadi float."""
    return s.str.strip().str.replace(".", "", regex=False).str.replace(",", ".", regex=False).astype(float)


def baca_tabel_pipa(nama_file: str, kolom: list[str]) -> pd.DataFrame:
    df = pd.read_csv(RAW / nama_file, sep="|", header=None, names=kolom, dtype=str)
    df["provinsi"] = df["provinsi"].str.strip().replace(ALIAS_NAMA_BPS)
    for k in kolom[1:]:
        df[k] = angka_id(df[k])
    return df


def bangun() -> pd.DataFrame:
    ref = pd.read_csv(RAW / "provinces-reference-serlin.csv", dtype={"kode_bps": str, "kode_kemendagri": str})

    produksi = baca_tabel_pipa(f"produksi_{TAHUN}.txt", ["provinsi", "produksi_padi_ton_gkg", "produksi_beras_ton"])
    penduduk = baca_tabel_pipa("penduduk_supas2025.txt", ["provinsi", "penduduk_jiwa"])
    konsumsi = pd.read_csv(RAW / f"konsumsi_bapanas_{TAHUN}.csv", dtype={"kode_kemendagri": str})
    konsumsi = konsumsi[["kode_kemendagri", "konsumsi_kg_kapita_tahun"]]

    df = (ref.merge(penduduk, on="provinsi", how="left", validate="1:1")
             .merge(konsumsi, on="kode_kemendagri", how="left", validate="1:1")
             .merge(produksi, on="provinsi", how="left", validate="1:1"))
    kosong = df[df.isna().any(axis=1)]
    if not kosong.empty:
        raise ValueError(f"Data tidak lengkap untuk: {kosong['provinsi'].tolist()}")

    df["kebutuhan_beras_ton"] = df["penduduk_jiwa"] * df["konsumsi_kg_kapita_tahun"] / 1000
    df["rice_balance_ton"] = df["produksi_beras_ton"] - df["kebutuhan_beras_ton"]
    df["rasio_swasembada"] = df["produksi_beras_ton"] / df["kebutuhan_beras_ton"]
    df["status"] = "defisit"
    df.loc[df["rasio_swasembada"] >= BATAS_SWASEMBADA, "status"] = "balanced"
    df.loc[df["rice_balance_ton"] > 0, "status"] = "surplus"
    df.insert(0, "tahun", TAHUN)
    df["penduduk_jiwa"] = df["penduduk_jiwa"].round().astype(int)
    for k in ["produksi_padi_ton_gkg", "produksi_beras_ton", "kebutuhan_beras_ton", "rice_balance_ton"]:
        df[k] = df[k].round(2)
    df["rasio_swasembada"] = df["rasio_swasembada"].round(4)

    # Cek terhadap baris "Indonesia" di tabel BPS
    tot_prod = produksi.set_index("provinsi").loc["Indonesia"]
    tot_pend = penduduk.set_index("provinsi").loc["Indonesia", "penduduk_jiwa"]
    print(f"{len(df)} provinsi | beras {df['produksi_beras_ton'].sum():,.0f} (BPS {tot_prod['produksi_beras_ton']:,.0f})"
          f" | penduduk {df['penduduk_jiwa'].sum():,} (BPS {tot_pend:,.0f})")
    print(df["status"].value_counts().to_dict(), f"| balance nasional {df['rice_balance_ton'].sum():,.0f} ton")
    return df


if __name__ == "__main__":
    hasil = bangun()
    keluar = BASE / "dataset_v1.csv"
    hasil.to_csv(keluar, index=False)
    json_dir = BASE / "data"
    json_dir.mkdir(exist_ok=True)
    hasil.to_json(json_dir / "provinces.json", orient="records", indent=2, force_ascii=False)
    print(f"ditulis: {keluar} dan {json_dir / 'provinces.json'}")
