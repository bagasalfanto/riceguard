"""Entry point seed: python -m app.seed"""
from __future__ import annotations

import argparse
import json

from app.db.session import get_sessionmaker
from app.services.seed import TAHUN_SEED, seed


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed versi dataset awal RiceGuard")
    parser.add_argument("--tahun", type=int, default=TAHUN_SEED)
    args = parser.parse_args()

    with get_sessionmaker()() as db:
        hasil = seed(db, args.tahun)
    print(json.dumps(hasil, indent=2, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
