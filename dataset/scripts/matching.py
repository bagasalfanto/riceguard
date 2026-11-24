"""CLI tipis: rekomendasi distribusi dari dataset_v1.csv. Logika ada di paket riceguard_calc.

Jalankan dari folder repo:  python dataset/scripts/matching.py
Output: dataset/rekomendasi_distribusi_v1.csv dan dataset/data/distribution.json
"""
from __future__ import annotations

import sys
from pathlib import Path

_SRC = Path(__file__).resolve().parents[2] / "packages" / "riceguard_calc" / "src"
if _SRC.is_dir() and str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from riceguard_calc.matching import haversine_km  # noqa: E402,F401
from riceguard_calc.matching import match as rekomendasi_distribusi  # noqa: E402

BASE = Path(__file__).resolve().parent.parent


def dari_dataset(path: Path) -> list[dict]:
    import pandas as pd

    df = pd.read_csv(path, dtype={"kode_bps": str})
    return [
        {
            "kode": r.kode_bps,
            "nama": r.provinsi,
            "lat": r.lat,
            "lng": r.lng,
            "balance": r.rice_balance_ton,
            "status": r.status,
        }
        for r in df.itertuples()
    ]


def main() -> None:
    import pandas as pd

    prov = dari_dataset(BASE / "dataset_v1.csv")
    rek = pd.DataFrame(rekomendasi_distribusi(prov))
    keluar = BASE / "rekomendasi_distribusi_v1.csv"
    rek.to_csv(keluar, index=False, lineterminator="\n")
    (BASE / "data").mkdir(exist_ok=True)
    rek.to_json(BASE / "data" / "distribution.json", orient="records", indent=2, force_ascii=False)

    # Validasi: tidak ada surplus/defisit yang terlampaui
    bal = {p["kode"]: p["balance"] for p in prov}
    keluar_per_surplus = rek.groupby("dari_kode")["ton"].sum()
    masuk_per_defisit = rek.groupby("ke_kode")["ton"].sum()
    assert all(keluar_per_surplus[k] <= bal[k] + 0.05 for k in keluar_per_surplus.index)
    assert all(masuk_per_defisit[k] <= -bal[k] + 0.05 for k in masuk_per_defisit.index)

    total_surplus = sum(p["balance"] for p in prov if p["status"] == "surplus")
    total_defisit = -sum(p["balance"] for p in prov if p["status"] == "defisit")
    print(
        f"{len(rek)} rekomendasi | dialokasikan {rek['ton'].sum():,.0f} ton"
        f" | total defisit {total_defisit:,.0f} | total surplus {total_surplus:,.0f}"
    )
    print(f"ditulis: {keluar} dan data/distribution.json")


if __name__ == "__main__":
    main()
