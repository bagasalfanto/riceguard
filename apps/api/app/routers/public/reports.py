"""GET /api/v1/reports/{jenis}.pdf — unduh laporan PDF A4 portrait (T9.3)."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
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
from app.services.pdf import render_pdf_bytes, render_report_html

router = APIRouter(tags=["reports"])

JENIS_VALID = {"nasional", "provinsi", "surplus-defisit", "rekomendasi"}


@router.get("/reports/{jenis}.pdf")
def download_report_pdf(
    jenis: str,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[object, Depends(optional_admin)],
    tahun: Annotated[int | None, Query()] = None,
    kode_bps: Annotated[str | None, Query()] = None,
    version_id: Annotated[str | None, Query()] = None,
) -> Response:
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
        data = laporan_provinsi(db, tahun, kode_bps.strip(), version_id=version_id, admin=admin)
    elif jenis == "nasional":
        data = laporan_nasional(db, tahun, version_id=version_id, admin=admin)
    elif jenis == "surplus-defisit":
        data = laporan_surplus_defisit(db, tahun, version_id=version_id, admin=admin)
    else:
        data = laporan_rekomendasi(db, tahun, version_id=version_id, admin=admin)

    html = render_report_html(data)
    pdf_bytes = render_pdf_bytes(html)

    meta = data["metadata"]
    filename = f"riceguard-laporan-{jenis}-{meta['tahun']}-v{meta['version_no']}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
