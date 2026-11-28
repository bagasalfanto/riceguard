"""GET /recommendations dan POST /recommendations/simulate (T6.3 & T6.4)."""
from typing import Annotated

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy.orm import Session

from app.core.cache import cache
from app.core.security import optional_admin
from app.db.session import get_db
from app.schemas.recommendations import (
    RecommendationsResponse,
    SimulationRequest,
    SimulationResponse,
)
from app.services.recommendations import (
    bangun_rekomendasi,
    simulasi_rekomendasi,
    validasi_mode_simulasi,
)
from app.services.versions import resolve_for_read

router = APIRouter(tags=["recommendations"])


@router.get("/recommendations", response_model=RecommendationsResponse)
def recommendations(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[object, Depends(optional_admin)],
    tahun: Annotated[int | None, Query()] = None,
    version_id: Annotated[str | None, Query()] = None,
    dari_kode: Annotated[str | None, Query()] = None,
    ke_kode: Annotated[str | None, Query()] = None,
) -> RecommendationsResponse:
    versi = resolve_for_read(db, tahun=tahun, version_id=version_id, admin=admin)

    kunci = ("recommendations", str(versi.id), f"{dari_kode}|{ke_kode}")
    tersimpan = cache.get(kunci)
    if tersimpan is not None:
        return tersimpan

    hasil = bangun_rekomendasi(db, versi, dari_kode=dari_kode, ke_kode=ke_kode)
    cache.set(kunci, hasil)
    return hasil


@router.post("/recommendations/simulate", response_model=SimulationResponse)
def simulate_recommendations(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[object, Depends(optional_admin)],
    req: Annotated[SimulationRequest | None, Body()] = None,
    version_id: Annotated[str | None, Query()] = None,
) -> SimulationResponse:
    """Simulasi skenario distribusi on-the-fly; tidak menulis DB maupun cache."""
    payload = req or SimulationRequest()
    validasi_mode_simulasi(payload.mode)
    versi = resolve_for_read(db, tahun=payload.tahun, version_id=version_id, admin=admin)
    return simulasi_rekomendasi(db, versi, payload)
