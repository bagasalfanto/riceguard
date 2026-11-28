"""GET /api/v1/reports/{jenis}.html — laporan A4 siap-cetak browser (T9.3)."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.security import optional_admin
from app.db.session import get_db
from app.services.exports import (
    laporan_nasional,
    laporan_provinsi,
    laporan_rekomendasi,
    laporan_surplus_defisit,
)
from app.services.pdf import render_report_html

router = APIRouter(tags=["reports"])

JENIS_VALID = {"nasional", "provinsi", "surplus-defisit", "rekomendasi"}


def _susun_data(
    db: Session,
    jenis: str,
    tahun: int | None,
    kode_bps: str | None,
    version_id: str | None,
    admin: object,
) -> dict:
    if jenis not in JENIS_VALID:
        raise AppError(
            "INVALID_PARAMS",
            400,
            "Jenis laporan tidak dikenal",
            {"jenis": jenis, "pilihan": sorted(JENIS_VALID)},
        )

    if jenis == "provinsi":
        if not kode_bps or not kode_bps.strip():
            raise AppError(
                "INVALID_PARAMS",
                400,
                "Parameter kode_bps wajib diisi untuk laporan provinsi",
                {"jenis": jenis},
            )
        return laporan_provinsi(db, tahun, kode_bps.strip(), version_id=version_id, admin=admin)
    if jenis == "nasional":
        return laporan_nasional(db, tahun, version_id=version_id, admin=admin)
    if jenis == "surplus-defisit":
        return laporan_surplus_defisit(db, tahun, version_id=version_id, admin=admin)
    return laporan_rekomendasi(db, tahun, version_id=version_id, admin=admin)


@router.get("/reports/{jenis}.html", response_class=HTMLResponse)
def laporan_cetak(
    jenis: str,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[object, Depends(optional_admin)],
    tahun: Annotated[int | None, Query()] = None,
    kode_bps: Annotated[str | None, Query()] = None,
    version_id: Annotated[str | None, Query()] = None,
) -> HTMLResponse:
    data = _susun_data(db, jenis, tahun, kode_bps, version_id, admin)
    return HTMLResponse(render_report_html(data))
