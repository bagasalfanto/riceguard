"""GET /rice-balance — produksi, kebutuhan, dan rice balance per provinsi.

Angka nasional dibaca dari `dataset_versions.summary` (satu sumber dengan Landing dan
Dashboard); daftar provinsi memakai service yang sama dengan `/provinces`, hanya diurut
balance menurun.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.cache import cache
from app.core.security import optional_admin
from app.db.session import get_db
from app.schemas.rice_balance import (
    RiceBalanceItem,
    RiceBalanceNasional,
    RiceBalanceResponse,
)
from app.services.provinces import daftar_provinsi
from app.services.summary import ambil_summary
from app.services.versions import resolve_for_read

router = APIRouter(tags=["rice-balance"])


@router.get("/rice-balance", response_model=RiceBalanceResponse)
def rice_balance(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[object, Depends(optional_admin)],
    tahun: Annotated[int | None, Query()] = None,
    version_id: Annotated[str | None, Query()] = None,
) -> RiceBalanceResponse:
    versi = resolve_for_read(db, tahun=tahun, version_id=version_id, admin=admin)

    kunci = ("rice-balance", str(versi.id), "")
    tersimpan = cache.get(kunci)
    if tersimpan is not None:
        return tersimpan

    summary = ambil_summary(db, versi)
    items, _ = daftar_provinsi(db, versi, sort="balance", order="desc", limit=100)

    hasil = RiceBalanceResponse(
        tahun=versi.tahun,
        version={"id": str(versi.id), "version_no": versi.version_no},
        nasional=RiceBalanceNasional(
            produksi_beras_ton=float(summary["produksi_beras_ton"]),
            kebutuhan_beras_ton=float(summary["kebutuhan_beras_ton"]),
            rice_balance_ton=float(summary["rice_balance_ton"]),
            rasio_swasembada=summary.get("rasio_swasembada"),
            jumlah_status=summary["jumlah_status"],
        ),
        items=[
            RiceBalanceItem(
                kode_bps=i.kode_bps,
                provinsi=i.provinsi,
                pulau=i.pulau,
                produksi_beras_ton=i.produksi_beras_ton,
                kebutuhan_beras_ton=i.kebutuhan_beras_ton,
                rice_balance_ton=i.rice_balance_ton,
                rasio_swasembada=i.rasio_swasembada,
                status=i.status,
            )
            for i in items
        ],
    )
    cache.set(kunci, hasil)
    return hasil
