"""Router admin: kelola konten situs dan sumber data (T10.7)."""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.cache import cache
from app.core.errors import AppError
from app.core.security import AdminIdentity, require_admin
from app.db.models import DataSource, SiteContent
from app.db.session import get_db
from app.schemas.admin import ContentUpdateRequest, SourceUpdateRequest
from app.schemas.content import ContentItem, SourceItem
from app.services.audit import catat_audit
from app.services.content import daftar_konten

router = APIRouter(prefix="/admin", tags=["admin-content"])


@router.get("/content", response_model=list[ContentItem])
def list_admin_content(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[AdminIdentity, Depends(require_admin)],
) -> list[ContentItem]:
    return [
        ContentItem(key=c.key, title=c.title, body_md=c.body_md, updated_at=c.updated_at)
        for c in daftar_konten(db)
    ]


@router.put("/content/{key}", response_model=ContentItem)
def upsert_admin_content(
    key: str,
    payload: ContentUpdateRequest,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[AdminIdentity, Depends(require_admin)],
) -> ContentItem:
    clean_key = key.strip()
    if not clean_key:
        raise AppError("INVALID_PARAMS", 400, "Key konten tidak boleh kosong", {"key": key})

    existing = db.get(SiteContent, clean_key)
    before = (
        {"title": existing.title, "body_md": existing.body_md}
        if existing is not None
        else None
    )
    now = datetime.now(UTC)

    if existing is None:
        item = SiteContent(
            key=clean_key,
            title=payload.title,
            body_md=payload.body_md,
            updated_by=admin.user_id,
            updated_at=now,
        )
        db.add(item)
    else:
        item = existing
        item.title = payload.title
        item.body_md = payload.body_md
        item.updated_by = admin.user_id
        item.updated_at = now

    catat_audit(
        db,
        actor=admin.user_id,
        action="edit_konten",
        entity="site_content",
        entity_id=clean_key,
        detail={
            "before": before,
            "after": {"title": payload.title, "body_md": payload.body_md},
        },
    )
    db.commit()
    db.refresh(item)
    cache.clear_all()
    return ContentItem(
        key=item.key,
        title=item.title,
        body_md=item.body_md,
        updated_at=item.updated_at,
    )


def _serialize_source(src: DataSource) -> dict:
    return {
        "nama": src.nama,
        "instansi": src.instansi,
        "tabel_resmi": src.tabel_resmi,
        "tahun": src.tahun,
        "diperbarui": src.diperbarui.isoformat() if src.diperbarui is not None else None,
        "url": src.url,
    }


@router.put("/sources/{source_id}", response_model=SourceItem)
def update_admin_source(
    source_id: int,
    payload: SourceUpdateRequest,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[AdminIdentity, Depends(require_admin)],
) -> SourceItem:
    src = db.get(DataSource, source_id)
    if src is None:
        raise AppError("NOT_FOUND", 404, "Sumber data tidak ditemukan", {"id": source_id})

    fields = payload.model_fields_set
    if not fields:
        raise AppError("INVALID_PARAMS", 400, "Minimal satu field sumber data harus dikirim")

    for req_field in ("nama", "instansi"):
        if req_field in fields and getattr(payload, req_field) is None:
            raise AppError(
                "INVALID_PARAMS",
                400,
                f"Field {req_field} tidak boleh null",
                {"field": req_field},
            )

    before = _serialize_source(src)
    for field_name in fields:
        setattr(src, field_name, getattr(payload, field_name))
    after = _serialize_source(src)

    catat_audit(
        db,
        actor=admin.user_id,
        action="edit_sumber",
        entity="data_source",
        entity_id=str(src.id),
        detail={"key": src.key, "before": before, "after": after},
    )
    db.commit()
    db.refresh(src)
    cache.clear_all()

    return SourceItem(
        id=src.id,
        key=src.key,
        nama=src.nama,
        instansi=src.instansi,
        tabel_resmi=src.tabel_resmi,
        tahun=src.tahun,
        diperbarui=src.diperbarui,
        url=src.url,
    )
