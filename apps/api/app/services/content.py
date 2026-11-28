"""Konten situs dan sumber data (PRD bagian 5.1)."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import DataSource, SiteContent


def daftar_sumber(db: Session) -> list[DataSource]:
    return list(db.scalars(select(DataSource).order_by(DataSource.id.asc())))


def daftar_konten(db: Session, keys: list[str] | None = None) -> list[SiteContent]:
    stmt = select(SiteContent).order_by(SiteContent.key.asc())
    if keys:
        stmt = stmt.where(SiteContent.key.in_(keys))
    return list(db.scalars(stmt))
