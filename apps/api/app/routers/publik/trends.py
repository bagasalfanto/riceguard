"""GET /trends dan GET /compare — histori multi-tahun serta gating minimal 2 tahun (T7.1–T7.3)."""
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.cache import cache
from app.core.errors import AppError
from app.db.session import get_db
from app.schemas.trends import CompareResponse, TrendsResponse
from app.services.trends import (
    ambil_meta_provinsi,
    bangun_compare,
    bangun_trends,
    compare_gating_response,
    parse_kode_bps,
    validasi_metric,
)
from app.services.versions import list_published_years, resolve_for_read

router = APIRouter(tags=["trends"])


@router.get("/trends", response_model=TrendsResponse)
def trends(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    metric: Annotated[str, Query()] = "produksi",
    kode_bps: Annotated[list[str] | None, Query()] = None,
) -> TrendsResponse:
    valid_metric = validasi_metric(metric)

    # Terima ?kode_bps=32&kode_bps=31, ?kode_bps[]=32&kode_bps[]=31, dan ?kode_bps=32,31.
    raw_codes = [v for k, v in request.query_params.multi_items() if k in ("kode_bps", "kode_bps[]")]
    if not raw_codes and kode_bps:
        raw_codes = list(kode_bps)
    codes = parse_kode_bps(raw_codes)
    meta = ambil_meta_provinsi(db, codes)

    published = list_published_years(db)
    version_key = ",".join(str(v.id) for v in published)
    kunci = ("trends", version_key, f"{valid_metric}|{','.join(codes)}")
    tersimpan = cache.get(kunci)
    if tersimpan is not None:
        return tersimpan

    hasil = bangun_trends(db, published, valid_metric, codes, meta)
    cache.set(kunci, hasil)
    return hasil


@router.get("/compare", response_model=CompareResponse)
def compare(
    db: Annotated[Session, Depends(get_db)],
    tahun_a: Annotated[int | None, Query()] = None,
    tahun_b: Annotated[int | None, Query()] = None,
) -> CompareResponse:
    if tahun_a is not None and tahun_b is not None and tahun_a >= tahun_b:
        raise AppError(
            "INVALID_PARAMS",
            400,
            "tahun_a harus lebih kecil dari tahun_b",
            {"tahun_a": tahun_a, "tahun_b": tahun_b},
        )

    published = list_published_years(db)
    if len(published) < 2:
        if tahun_a is None or tahun_b is None:
            kunci = ("compare", ",".join(str(v.id) for v in published), "gating")
            tersimpan = cache.get(kunci)
            if tersimpan is not None:
                return tersimpan
            hasil = compare_gating_response()
            cache.set(kunci, hasil)
            return hasil
        versi_a = resolve_for_read(db, tahun=tahun_a)
        versi_b = resolve_for_read(db, tahun=tahun_b)
    else:
        if tahun_a is None and tahun_b is None:
            versi_a = published[-2]
            versi_b = published[-1]
        elif tahun_a is None or tahun_b is None:
            raise AppError(
                "INVALID_PARAMS",
                400,
                "Parameter tahun_a dan tahun_b harus diisi keduanya atau dikosongkan keduanya",
                {"tahun_a": tahun_a, "tahun_b": tahun_b},
            )
        else:
            versi_a = resolve_for_read(db, tahun=tahun_a)
            versi_b = resolve_for_read(db, tahun=tahun_b)

    kunci = ("compare", f"{versi_a.id}:{versi_b.id}", "")
    tersimpan = cache.get(kunci)
    if tersimpan is not None:
        return tersimpan

    hasil = bangun_compare(db, versi_a, versi_b)
    cache.set(kunci, hasil)
    return hasil
