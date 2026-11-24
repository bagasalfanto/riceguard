"""CLI tipis: bangun dataset_v1.csv dari folder raw/. Logika ada di paket riceguard_calc.

Jalankan dari folder repo:  python dataset/scripts/build_dataset.py
Output: dataset/dataset_v1.csv dan dataset/data/provinces.json
"""
from __future__ import annotations

import sys
from pathlib import Path

_SRC = Path(__file__).resolve().parents[2] / "packages" / "riceguard_calc" / "src"
if _SRC.is_dir() and str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from riceguard_calc import build, parse_konsumsi, parse_penduduk, parse_produksi, parse_referensi, total_indonesia  # noqa: E402

BASE = Path(__file__).resolve().parent.parent
RAW = BASE / "raw"
TAHUN = 2025


def main() -> None:
    referensi = parse_referensi(RAW / "provinces-reference-serlin.csv")
    produksi = parse_produksi(RAW / f"produksi_{TAHUN}.txt")
    penduduk = parse_penduduk(RAW / "penduduk_supas2025.txt")
    konsumsi = parse_konsumsi(RAW / f"konsumsi_bapanas_{TAHUN}.csv")

    hasil = build(referensi, produksi, penduduk, konsumsi, TAHUN)

    acuan = total_indonesia(produksi, penduduk)
    print(
        f"{len(hasil)} provinsi | beras {hasil['produksi_beras_ton'].sum():,.0f}"
        f" (BPS {acuan['produksi_beras_ton']:,.0f})"
        f" | penduduk {hasil['penduduk_jiwa'].sum():,} (BPS {acuan['penduduk_jiwa']:,.0f})"
    )
    print(
        hasil["status"].value_counts().to_dict(),
        f"| balance nasional {hasil['rice_balance_ton'].sum():,.0f} ton",
    )

    keluar = BASE / "dataset_v1.csv"
    hasil.to_csv(keluar, index=False, lineterminator="\n")
    json_dir = BASE / "data"
    json_dir.mkdir(exist_ok=True)
    hasil.to_json(json_dir / "provinces.json", orient="records", indent=2, force_ascii=False)
    print(f"ditulis: {keluar} dan {json_dir / 'provinces.json'}")


if __name__ == "__main__":
    main()
