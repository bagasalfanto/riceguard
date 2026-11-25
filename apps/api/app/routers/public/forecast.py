"""GET /forecast — proxy prediksi produksi ke model eksternal (T11.1)."""
from __future__ import annotations

from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.security import optional_admin
from app.db.session import get_db
from app.schemas.forecast import ForecastResponse
from app.services.forecast import ambil_forecast

router = APIRouter(tags=["forecast"])


def get_forecast_transport() -> httpx.BaseTransport | None:
    return None


@router.get("/forecast", response_model=ForecastResponse)
def forecast(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[object, Depends(optional_admin)],
    settings: Annotated[Settings, Depends(get_settings)],
    transport: Annotated[httpx.BaseTransport | None, Depends(get_forecast_transport)],
    tahun: Annotated[int | None, Query()] = None,
    version_id: Annotated[str | None, Query()] = None,
) -> ForecastResponse:
    return ambil_forecast(
        db,
        tahun=tahun,
        version_id=version_id,
        admin=admin,
        settings=settings,
        transport=transport,
    )
