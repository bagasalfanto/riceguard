"""Seed versi 2025 v1 (published) dari dataset/ yang sudah ada.

Idempoten: kalau tahun itu sudah punya versi published, tidak menulis apa pun.
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from riceguard_calc import build, match, parse_konsumsi, parse_penduduk, parse_produksi, parse_referensi, total_indonesia

from app.db.models import (
    DatasetVersion,
    DistributionRecommendation,
    Province,
    ProvinceStat,
)
from app.services.compute import summary_nasional
from app.services.validation import validasi

TAHUN_SEED = 2025


def repo_root() -> Path:
    """Cari folder repo dari lokasi file ini (dataset/dataset_v1.csv sebagai penanda)."""
    for parent in Path(__file__).resolve().parents:
        if (parent / "dataset" / "dataset_v1.csv").is_file():
            return parent
    raise RuntimeError("folder repo (berisi dataset/dataset_v1.csv) tidak ditemukan")


def _upsert_provinsi(db: Session, referensi: pd.DataFrame) -> None:
    baris = [
        {
            "kode_bps": r.kode_bps,
            "kode_kemendagri": r.kode_kemendagri,
            "nama": r.provinsi,
            "pulau": r.pulau,
            "lat": Decimal(str(r.lat)),
            "lng": Decimal(str(r.lng)),
        }
        for r in referensi.itertuples()
    ]
    stmt = insert(Province).values(baris)
    stmt = stmt.on_conflict_do_update(
        index_elements=["kode_bps"],
        set_={
            "kode_kemendagri": stmt.excluded.kode_kemendagri,
            "nama": stmt.excluded.nama,
            "pulau": stmt.excluded.pulau,
            "lat": stmt.excluded.lat,
            "lng": stmt.excluded.lng,
        },
    )
    db.execute(stmt)


def seed(db: Session, tahun: int = TAHUN_SEED) -> dict:
    sudah = db.scalars(
        select(DatasetVersion).where(DatasetVersion.tahun == tahun, DatasetVersion.status == "published")
    ).first()
    if sudah is not None:
        return {"status": "dilewati", "alasan": f"tahun {tahun} sudah punya versi published", "version_id": str(sudah.id)}

    root = repo_root()
    raw = root / "dataset" / "raw"
    referensi = parse_referensi(raw / "provinces-reference-serlin.csv")
    produksi = parse_produksi(raw / f"produksi_{tahun}.txt")
    penduduk = parse_penduduk(raw / "penduduk_supas2025.txt")
    konsumsi = parse_konsumsi(raw / f"konsumsi_bapanas_{tahun}.csv")

    df = build(referensi, produksi, penduduk, konsumsi, tahun)
    rekomendasi = match(
        [
            {"kode": r.kode_bps, "nama": r.provinsi, "lat": float(r.lat), "lng": float(r.lng),
             "balance": float(r.rice_balance_ton), "status": r.status}
            for r in df.itertuples()
        ]
    )

    _upsert_provinsi(db, referensi)

    version_no = (db.scalar(select(func.max(DatasetVersion.version_no)).where(DatasetVersion.tahun == tahun)) or 0) + 1
    versi = DatasetVersion(
        tahun=tahun,
        version_no=version_no,
        status="published",
        notes="Seed awal dari dataset_v1.csv",
        summary=summary_nasional(df, rekomendasi),
        validation=validasi(df, total_indonesia(produksi, penduduk)),
        source_files={
            "produksi": f"produksi_{tahun}.txt",
            "penduduk": "penduduk_supas2025.txt",
            "konsumsi": f"konsumsi_bapanas_{tahun}.csv",
            "referensi": "provinces-reference-serlin.csv",
        },
        published_at=datetime.now(timezone.utc),
    )
    db.add(versi)
    db.flush()

    db.add_all(
        [
            ProvinceStat(
                version_id=versi.id,
                kode_bps=r.kode_bps,
                penduduk_jiwa=int(r.penduduk_jiwa),
                konsumsi_kg_kapita_tahun=Decimal(str(r.konsumsi_kg_kapita_tahun)),
                produksi_padi_ton_gkg=Decimal(str(r.produksi_padi_ton_gkg)),
                produksi_beras_ton=Decimal(str(r.produksi_beras_ton)),
                kebutuhan_beras_ton=Decimal(str(r.kebutuhan_beras_ton)),
                rice_balance_ton=Decimal(str(r.rice_balance_ton)),
                rasio_swasembada=Decimal(str(r.rasio_swasembada)),
                status=r.status,
            )
            for r in df.itertuples()
        ]
    )
    db.add_all(
        [
            DistributionRecommendation(
                version_id=versi.id,
                urutan=r["urutan"],
                dari_kode=r["dari_kode"],
                ke_kode=r["ke_kode"],
                ton=Decimal(str(r["ton"])),
                jarak_km=Decimal(str(r["jarak_km"])),
            )
            for r in rekomendasi
        ]
    )
    db.commit()

    return {
        "status": "ok",
        "version_id": str(versi.id),
        "tahun": tahun,
        "version_no": version_no,
        "provinsi": len(df),
        "rekomendasi": len(rekomendasi),
        "summary": versi.summary,
    }
