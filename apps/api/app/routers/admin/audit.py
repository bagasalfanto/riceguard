"""Router admin: baca audit log insert-only (T10.8)."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import AdminIdentity, require_admin
from app.db.session import get_db
from app.schemas.admin import AuditLogItem, AuditLogListResponse
from app.services.audit import daftar_audit_log

router = APIRouter(prefix="/admin", tags=["admin-audit"])


@router.get("/audit-log", response_model=AuditLogListResponse)
def get_audit_log(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[AdminIdentity, Depends(require_admin)],
    action: Annotated[str | None, Query()] = None,
    actor: Annotated[str | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> AuditLogListResponse:
    items, total = daftar_audit_log(db, action=action, actor=actor, page=page, limit=limit)
    return AuditLogListResponse(
        items=[AuditLogItem(**row) for row in items],
        total=total,
        page=page,
        limit=limit,
    )
