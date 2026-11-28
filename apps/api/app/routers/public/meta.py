from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.cache import cache
from app.db.session import get_db
from app.schemas.meta import MetaYears, TahunPublished
from app.services.versions import list_published_years

router = APIRouter(tags=["meta"])


@router.get("/meta/years", response_model=MetaYears)
def meta_years(db: Annotated[Session, Depends(get_db)]) -> MetaYears:
    kunci = ("meta-years", None, "")
    tersimpan = cache.get(kunci)
    if tersimpan is not None:
        return tersimpan

    versi = list_published_years(db)
    daftar = [
        TahunPublished(
            tahun=v.tahun,
            version_id=str(v.id),
            version_no=v.version_no,
            published_at=v.published_at,
        )
        for v in versi
    ]
    hasil = MetaYears(
        tahun=daftar,
        jumlah_tahun=len(daftar),
        butuh_minimal_2_tahun=len(daftar) < 2,
        tahun_terbaru=daftar[-1].tahun if daftar else None,
    )
    cache.set(kunci, hasil)
    return hasil
