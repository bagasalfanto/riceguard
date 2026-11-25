"""Layanan audit log insert-only (T10.8)."""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.db.models import Admin, AuditLog


def _parse_uuid(nilai: str | None) -> uuid.UUID | None:
    if not nilai:
        return None
    try:
        return uuid.UUID(nilai.strip())
    except (ValueError, AttributeError, TypeError):
        return None


def catat_audit(
    db: Session,
    *,
    actor: uuid.UUID | None,
    action: str,
    entity: str | None = None,
    entity_id: str | None = None,
    detail: dict[str, Any] | None = None,
) -> AuditLog:
    """Tambahkan entri audit_log baru (insert-only, tidak pernah diubah/dihapus)."""
    entri = AuditLog(
        actor=actor,
        action=action,
        entity=entity,
        entity_id=entity_id,
        detail=detail,
    )
    db.add(entri)
    return entri


def daftar_audit_log(
    db: Session,
    *,
    action: str | None = None,
    actor: str | None = None,
    page: int = 1,
    limit: int = 50,
) -> tuple[list[dict[str, Any]], int]:
    """Ambil daftar audit_log terbaru beserta nama admin, aman dari input non-UUID."""
    stmt = select(AuditLog, Admin.nama).outerjoin(Admin, Admin.user_id == AuditLog.actor)

    if action and action.strip():
        stmt = stmt.where(AuditLog.action == action.strip())

    if actor and actor.strip():
        actor_clean = actor.strip()
        actor_uuid = _parse_uuid(actor_clean)
        if actor_uuid is not None:
            stmt = stmt.where(AuditLog.actor == actor_uuid)
        else:
            pola = actor_clean.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            like_expr = f"%{pola}%"
            stmt = stmt.where(
                or_(
                    Admin.nama.ilike(like_expr, escape="\\"),
                )
            )

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    offset = (page - 1) * limit
    rows = db.execute(
        stmt.order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).limit(limit).offset(offset)
    ).all()

    items = [
        {
            "id": log.id,
            "created_at": log.created_at,
            "actor": str(log.actor) if log.actor is not None else None,
            "actor_nama": actor_nama,
            "action": log.action,
            "entity": log.entity,
            "entity_id": log.entity_id,
            "detail": log.detail,
        }
        for log, actor_nama in rows
    ]
    return items, int(total)
