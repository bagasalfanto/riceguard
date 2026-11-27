"""GET /validation dan GET /exports/* — laporan validasi serta ekspor CSV/XLSX/raw (T8.1–T8.4)."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.core.cache import cache
from app.core.security import optional_admin
from app.db.session import get_db
from app.schemas.data_transparency import ValidationResponse
from app.services.exports import (
    ambil_file_mentah,
    bangun_validasi,
    ekspor_provinsi_csv,
    ekspor_rekomendasi_csv,
    ekspor_workbook_xlsx,
)
from app.services.storage import content_type_untuk_file
from app.services.versions import resolve_for_read, resolve_published

router = APIRouter(tags=["data-exports"])

_XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get("/validation", response_model=ValidationResponse)
def validation_report(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[object, Depends(optional_admin)],
    tahun: Annotated[int | None, Query()] = None,
    version_id: Annotated[str | None, Query()] = None,
) -> ValidationResponse:
    versi = resolve_for_read(db, tahun=tahun, version_id=version_id, admin=admin)

    kunci = ("validation", str(versi.id), "")
    tersimpan = cache.get(kunci)
    if tersimpan is not None:
        return tersimpan

    hasil = bangun_validasi(db, versi)
    cache.set(kunci, hasil)
    return hasil


@router.get("/exports/provinces.csv")
def export_provinces_csv(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[object, Depends(optional_admin)],
    tahun: Annotated[int | None, Query()] = None,
    version_id: Annotated[str | None, Query()] = None,
) -> Response:
    versi = resolve_for_read(db, tahun=tahun, version_id=version_id, admin=admin)
    konten = ekspor_provinsi_csv(db, versi)
    filename = f"riceguard-provinsi-{versi.tahun}-v{versi.version_no}.csv"
    return Response(
        content=konten,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/exports/recommendations.csv")
def export_recommendations_csv(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[object, Depends(optional_admin)],
    tahun: Annotated[int | None, Query()] = None,
    version_id: Annotated[str | None, Query()] = None,
) -> Response:
    versi = resolve_for_read(db, tahun=tahun, version_id=version_id, admin=admin)
    konten = ekspor_rekomendasi_csv(db, versi)
    filename = f"riceguard-rekomendasi-{versi.tahun}-v{versi.version_no}.csv"
    return Response(
        content=konten,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/exports/provinces.xlsx")
def export_provinces_xlsx(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[object, Depends(optional_admin)],
    tahun: Annotated[int | None, Query()] = None,
    version_id: Annotated[str | None, Query()] = None,
) -> Response:
    versi = resolve_for_read(db, tahun=tahun, version_id=version_id, admin=admin)
    konten = ekspor_workbook_xlsx(db, versi, active_sheet="Provinsi")
    filename = f"riceguard-provinsi-{versi.tahun}-v{versi.version_no}.xlsx"
    return Response(
        content=konten,
        media_type=_XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/exports/recommendations.xlsx")
def export_recommendations_xlsx(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[object, Depends(optional_admin)],
    tahun: Annotated[int | None, Query()] = None,
    version_id: Annotated[str | None, Query()] = None,
) -> Response:
    versi = resolve_for_read(db, tahun=tahun, version_id=version_id, admin=admin)
    konten = ekspor_workbook_xlsx(db, versi, active_sheet="Rekomendasi")
    filename = f"riceguard-rekomendasi-{versi.tahun}-v{versi.version_no}.xlsx"
    return Response(
        content=konten,
        media_type=_XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/exports/raw/{nama_file:path}")
def export_raw_file(
    nama_file: str,
    db: Annotated[Session, Depends(get_db)],
    tahun: Annotated[int | None, Query()] = None,
) -> Response:
    """Unduh file sumber mentah dari versi published saja (draft tidak pernah diekspos)."""
    versi = resolve_published(db, tahun=tahun)
    aman_nama, konten = ambil_file_mentah(versi, nama_file)
    return Response(
        content=konten,
        media_type=content_type_untuk_file(aman_nama),
        headers={"Content-Disposition": f'attachment; filename="{aman_nama}"'},
    )
