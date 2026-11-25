"""GET /map/layers — nilai dan kelas legenda untuk satu layer peta."""
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import optional_admin
from app.db.session import get_db
from app.schemas.map_layers import MapLayerResponse
from app.services.map_layers import bangun_layer
from app.services.versions import resolve_for_read

router = APIRouter(tags=["map"])


@router.get("/map/layers", response_model=MapLayerResponse)
def map_layers(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[object, Depends(optional_admin)],
    layer: Annotated[str, Query()] = "status",
    tahun: Annotated[int | None, Query()] = None,
    version_id: Annotated[str | None, Query()] = None,
) -> MapLayerResponse:
    versi = resolve_for_read(db, tahun=tahun, version_id=version_id, admin=admin)
    return MapLayerResponse(**bangun_layer(db, versi, layer))
