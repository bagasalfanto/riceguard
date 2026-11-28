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


@router.get("/_diag/render", response_class=HTMLResponse)
def diag_render(
    db: Annotated[Session, Depends(get_db)],
    tahun: Annotated[int | None, Query()] = None,
) -> HTMLResponse:
    import os
    import traceback
    from pathlib import Path as _Path

    akar = _Path(__file__).resolve().parents[2]
    jejak = [f"cwd={os.getcwd()}", f"akar={akar}"]
    for rel in ("assets/fonts", "templates/reports"):
        p = akar / rel
        jejak.append(f"{rel}: {sorted(os.listdir(p)) if p.is_dir() else 'TIDAK ADA'}")
    try:
        data = laporan_nasional(db, tahun)
        html = render_report_html(data)
        jejak.append(f"render ok: {len(html)} char")
        return HTMLResponse("<pre>" + "\n".join(jejak) + "</pre>")
    except Exception:
        jejak.append(traceback.format_exc())
        return HTMLResponse("<pre>" + "\n".join(jejak) + "</pre>", status_code=500)


@router.get("/_diag/report", response_class=HTMLResponse)
def diag_report(
    db: Annotated[Session, Depends(get_db)],
    tahun: Annotated[int | None, Query()] = None,
) -> HTMLResponse:
    import traceback

    try:
        data = laporan_nasional(db, tahun)
        return HTMLResponse(f"<pre>data ok: {sorted(data)}</pre>")
    except Exception:
        return HTMLResponse(f"<pre>{traceback.format_exc()}</pre>", status_code=500)


@router.get("/_diag/render", response_class=HTMLResponse)
def diag_render(
    db: Annotated[Session, Depends(get_db)],
    tahun: Annotated[int | None, Query()] = None,
) -> HTMLResponse:
    import os
    import traceback

    jejak: list[str] = [f"MPLCONFIGDIR={os.environ.get('MPLCONFIGDIR')}", f"cwd={os.getcwd()}"]
    try:
        import matplotlib
        from matplotlib import font_manager

        data_dir = matplotlib.get_data_path()
        ttf = os.path.join(data_dir, "fonts", "ttf")
        jejak.append(f"data_path={data_dir}")
        jejak.append(f"ttf_exists={os.path.isdir(ttf)}")
        jejak.append(f"ttf_files={sorted(os.listdir(ttf))[:12] if os.path.isdir(ttf) else 'NA'}")
        cfg = os.environ.get("MPLCONFIGDIR") or ""
        jejak.append(f"cfg_list={sorted(os.listdir(cfg)) if cfg and os.path.isdir(cfg) else 'NA'}")
        jejak.append(f"fonts_terdaftar={len(font_manager.fontManager.ttflist)}")
        from app.services.pdf import _load_geojson, _mpl

        jejak.append(f"mpl={_mpl().__version__}")
        jejak.append(f"geojson={len(_load_geojson().get('features', []))} fitur")
        data = laporan_nasional(db, tahun)
        html = render_report_html(data)
        jejak.append(f"render ok: {len(html)} char")
        return HTMLResponse("<pre>" + "\n".join(jejak) + "</pre>")
    except Exception:
        jejak.append(traceback.format_exc())
        return HTMLResponse("<pre>" + "\n".join(jejak) + "</pre>", status_code=500)
