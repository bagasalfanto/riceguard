"""Endpoint analisis pasokan & distribusi: overview, pemasok, dan matriks jarak (T5.1–T5.3)."""
from collections.abc import Callable
from typing import Annotated, TypeVar

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.cache import cache
from app.core.security import optional_admin
from app.db.session import get_db
from app.schemas.distribution import (
    DistanceMatrixResponse,
    DistributionOverviewResponse,
    DistributionSuppliersResponse,
)
from app.services.distribution import bangun_overview, daftar_pemasok, matriks_jarak
from app.services.versions import resolve_for_read

router = APIRouter(prefix="/distribution", tags=["distribution"])

_T = TypeVar("_T")


def _cached(kunci: tuple[str, str, str], hitung: Callable[[], _T]) -> _T:
    tersimpan = cache.get(kunci)
    if tersimpan is not None:
        return tersimpan
    hasil = hitung()
    cache.set(kunci, hasil)
    return hasil


@router.get("/overview", response_model=DistributionOverviewResponse)
def distribution_overview(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[object, Depends(optional_admin)],
    tahun: Annotated[int | None, Query()] = None,
    version_id: Annotated[str | None, Query()] = None,
) -> DistributionOverviewResponse:
    versi = resolve_for_read(db, tahun=tahun, version_id=version_id, admin=admin)
    return _cached(
        ("distribution-overview", str(versi.id), ""),
        lambda: bangun_overview(db, versi),
    )


@router.get("/suppliers/{kode_bps}", response_model=DistributionSuppliersResponse)
def distribution_suppliers(
    kode_bps: str,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[object, Depends(optional_admin)],
    tahun: Annotated[int | None, Query()] = None,
    version_id: Annotated[str | None, Query()] = None,
) -> DistributionSuppliersResponse:
    versi = resolve_for_read(db, tahun=tahun, version_id=version_id, admin=admin)
    return _cached(
        ("distribution-suppliers", str(versi.id), kode_bps),
        lambda: daftar_pemasok(db, versi, kode_bps),
    )


@router.get("/distance-matrix", response_model=DistanceMatrixResponse)
def distribution_distance_matrix(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[object, Depends(optional_admin)],
    tahun: Annotated[int | None, Query()] = None,
    version_id: Annotated[str | None, Query()] = None,
) -> DistanceMatrixResponse:
    versi = resolve_for_read(db, tahun=tahun, version_id=version_id, admin=admin)
    return _cached(
        ("distribution-distance-matrix", str(versi.id), ""),
        lambda: matriks_jarak(db, versi),
    )
