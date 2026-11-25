"""GET /recommendations — rekomendasi distribusi resmi satu versi (T6.3)."""
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.cache import cache
from app.core.security import optional_admin
from app.db.session import get_db
from app.schemas.recommendations import RecommendationsResponse
from app.services.recommendations import bangun_rekomendasi
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
