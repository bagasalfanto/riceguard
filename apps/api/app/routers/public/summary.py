"""GET /summary — agregat nasional untuk Landing dan Dashboard."""
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import optional_admin
from app.db.session import get_db
from app.schemas.summary import SummaryResponse
from app.services.summary import bangun_respons
from app.services.versions import resolve_for_read

router = APIRouter(tags=["summary"])


@router.get("/summary", response_model=SummaryResponse)
def summary(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[object, Depends(optional_admin)],
    tahun: Annotated[int | None, Query()] = None,
    version_id: Annotated[str | None, Query()] = None,
) -> SummaryResponse:
    versi = resolve_for_read(db, tahun=tahun, version_id=version_id, admin=admin)
    return bangun_respons(db, versi)
