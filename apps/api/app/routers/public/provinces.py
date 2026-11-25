"""GET /provinces dan GET /rankings (PRD bagian 5.2)."""
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import optional_admin
from app.db.session import get_db
from app.schemas.provinces import ProvincesResponse, RankingsResponse
from app.services.provinces import daftar_provinsi, peringkat
from app.services.versions import resolve_for_read

router = APIRouter(tags=["provinces"])


@router.get("/provinces", response_model=ProvincesResponse)
def provinces(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[object, Depends(optional_admin)],
    tahun: Annotated[int | None, Query()] = None,
    version_id: Annotated[str | None, Query()] = None,
    status: Annotated[str | None, Query()] = None,
    pulau: Annotated[str | None, Query()] = None,
    q: Annotated[str | None, Query()] = None,
    sort: Annotated[str, Query()] = "provinsi",
    order: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ProvincesResponse:
    versi = resolve_for_read(db, tahun=tahun, version_id=version_id, admin=admin)
    items, total = daftar_provinsi(
        db,
        versi,
        status=status,
        pulau=pulau,
        q=q,
        sort=sort,
        order=order,
        limit=limit,
        offset=offset,
    )
    return ProvincesResponse(
        tahun=versi.tahun,
        version={"id": str(versi.id), "version_no": versi.version_no},
        items=items,
        total=total,
    )


@router.get("/rankings", response_model=RankingsResponse)
def rankings(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[object, Depends(optional_admin)],
    by: Annotated[str, Query()] = "produksi",
    tahun: Annotated[int | None, Query()] = None,
    version_id: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query()] = 5,
) -> RankingsResponse:
    versi = resolve_for_read(db, tahun=tahun, version_id=version_id, admin=admin)
    return RankingsResponse(by=by, tahun=versi.tahun, items=peringkat(db, versi, by, limit))
