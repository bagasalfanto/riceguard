"""Resolusi versi dataset. Publik hanya melihat versi published."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError, no_published_version
from app.db.models import DatasetVersion


def _uuid_valid(nilai: str) -> bool:
    try:
        uuid.UUID(nilai)
    except (ValueError, AttributeError, TypeError):
        return False
    return True


def list_published_years(db: Session) -> list[DatasetVersion]:
    stmt = (
        select(DatasetVersion)
        .where(DatasetVersion.status == "published")
        .order_by(DatasetVersion.tahun.asc())
    )
    return list(db.scalars(stmt))


def resolve_published(db: Session, tahun: int | None = None) -> DatasetVersion:
    """tahun None = tahun published terbaru. Tidak ada hasil -> 404 NO_PUBLISHED_VERSION."""
    stmt = select(DatasetVersion).where(DatasetVersion.status == "published")
    if tahun is not None:
        stmt = stmt.where(DatasetVersion.tahun == tahun)
    stmt = stmt.order_by(DatasetVersion.tahun.desc()).limit(1)
    versi = db.scalars(stmt).first()
    if versi is None:
        raise no_published_version(tahun)
    return versi


def resolve_for_read(
    db: Session, tahun: int | None = None, version_id: str | None = None, admin=None
) -> DatasetVersion:
    """Preview draft hanya dihormati kalau request membawa identitas admin (PRD bagian 10).

    version_id datang dari query string, jadi bentuknya diperiksa dulu: nilai non-UUID
    akan ditolak Postgres dengan DataError dan transaksi ikut batal.
    """
    if version_id and admin is not None:
        if not _uuid_valid(version_id):
            raise AppError("NOT_FOUND", 404, "Versi dataset tidak ditemukan", {"version_id": version_id})
        versi = db.get(DatasetVersion, uuid.UUID(version_id))
        if versi is None:
            raise AppError("NOT_FOUND", 404, "Versi dataset tidak ditemukan", {"version_id": version_id})
        return versi
    return resolve_published(db, tahun)
