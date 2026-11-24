"""Verifikasi JWT admin. Implementasi penuh ada di docs/tickets/wave-10-admin.md (T10.1)."""
from __future__ import annotations

from fastapi import Header

from app.core.errors import AppError


async def optional_admin(authorization: str | None = Header(default=None)):
    """Belum ada verifikasi: request publik selalu tanpa admin."""
    return None


async def require_admin(authorization: str | None = Header(default=None)):
    raise AppError("UNAUTHORIZED", 401, "Endpoint admin belum aktif")
