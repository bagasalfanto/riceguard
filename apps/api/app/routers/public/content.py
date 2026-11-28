"""GET /sources dan GET /content — teks Landing berasal dari DB, bukan hardcode."""
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.cache import cache
from app.db.session import get_db
from app.schemas.content import ContentItem, SourceItem
from app.services.content import daftar_konten, daftar_sumber

router = APIRouter(tags=["content"])


@router.get("/sources", response_model=list[SourceItem])
def sources(db: Annotated[Session, Depends(get_db)]) -> list[SourceItem]:
    kunci = ("sources", None, "")
    tersimpan = cache.get(kunci)
    if tersimpan is not None:
        return tersimpan
    items = [
        SourceItem(
            id=s.id,
            key=s.key,
            nama=s.nama,
            instansi=s.instansi,
            tabel_resmi=s.tabel_resmi,
            tahun=s.tahun,
            diperbarui=s.diperbarui,
            url=s.url,
        )
        for s in daftar_sumber(db)
    ]
    cache.set(kunci, items)
    return items


@router.get("/content", response_model=list[ContentItem])
def content(
    db: Annotated[Session, Depends(get_db)],
    keys: Annotated[list[str] | None, Query()] = None,
) -> list[ContentItem]:
    """`?keys=about&keys=sdg2` atau `?keys=about,sdg2`. Key tak dikenal diabaikan."""
    diminta = [k.strip() for nilai in (keys or []) for k in nilai.split(",") if k.strip()]
    kunci = ("content", None, ",".join(sorted(diminta)))
    tersimpan = cache.get(kunci)
    if tersimpan is not None:
        return tersimpan

    items = [
        ContentItem(key=c.key, title=c.title, body_md=c.body_md, updated_at=c.updated_at)
        for c in daftar_konten(db, diminta or None)
    ]
    cache.set(kunci, items)
    return items
