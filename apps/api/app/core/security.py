"""Verifikasi JWT admin Supabase (JWKS asimetris + fallback HS256 legacy, T10.1)."""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated

import jwt
from fastapi import Depends, Header
from jwt import PyJWKClient, PyJWKClientError, PyJWTError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.db.models import Admin
from app.db.session import get_db

logger = logging.getLogger(__name__)

_JWKS_ALGORITHMS = ("RS256", "RS384", "RS512", "ES256", "ES384", "ES512", "PS256", "PS384", "PS512", "EdDSA")
_hs256_warned = False


@dataclass(frozen=True, slots=True)
class AdminIdentity:
    user_id: uuid.UUID
    nama: str
    email: str | None = None


@lru_cache(maxsize=8)
def _jwks_client(jwks_url: str) -> PyJWKClient:
    return PyJWKClient(jwks_url, cache_keys=True)


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise AppError("UNAUTHORIZED", 401, "Header Authorization Bearer wajib diisi")
    parts = authorization.strip().split()
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1]:
        raise AppError("UNAUTHORIZED", 401, "Format token Authorization tidak valid")
    return parts[1]


def _verify_jwt_payload(token: str, settings: Settings) -> dict:
    global _hs256_warned

    try:
        header = jwt.get_unverified_header(token)
    except PyJWTError as exc:
        raise AppError("UNAUTHORIZED", 401, "Token tidak valid") from exc

    alg = header.get("alg")
    jwks_error: Exception | None = None

    if alg in _JWKS_ALGORITHMS:
        try:
            signing_key = _jwks_client(settings.jwks_url).get_signing_key_from_jwt(token)
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=list(_JWKS_ALGORITHMS),
                audience="authenticated",
                issuer=settings.jwt_issuer,
                options={"require": ["exp", "sub"]},
            )
        except (PyJWKClientError, PyJWTError) as exc:
            jwks_error = exc
    else:
        jwks_error = PyJWTError(f"Algoritma token {alg!r} tidak didukung JWKS")

    if settings.supabase_jwt_secret:
        if not _hs256_warned:
            logger.warning(
                "Verifikasi JWKS gagal (%s); memakai fallback HS256 SUPABASE_JWT_SECRET.",
                jwks_error,
            )
            _hs256_warned = True
        try:
            return jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
                issuer=settings.jwt_issuer,
                options={"require": ["exp", "sub"]},
            )
        except PyJWTError as exc:
            raise AppError("UNAUTHORIZED", 401, "Token tidak valid atau kedaluwarsa") from exc

    raise AppError("UNAUTHORIZED", 401, "Token tidak valid atau kedaluwarsa")


def _authenticate_admin(db: Session, authorization: str | None) -> AdminIdentity:
    token = _extract_bearer_token(authorization)
    settings = get_settings()
    payload = _verify_jwt_payload(token, settings)

    raw_sub = payload.get("sub")
    try:
        user_id = uuid.UUID(str(raw_sub))
    except (ValueError, TypeError, AttributeError) as exc:
        raise AppError("UNAUTHORIZED", 401, "Token tidak memuat identitas pengguna yang valid") from exc

    admin_row = db.scalars(select(Admin).where(Admin.user_id == user_id)).first()
    if admin_row is None:
        raise AppError("FORBIDDEN", 403, "Akun ini tidak memiliki akses admin")

    email = payload.get("email")
    return AdminIdentity(
        user_id=admin_row.user_id,
        nama=admin_row.nama,
        email=str(email) if isinstance(email, str) and email else None,
    )


def require_admin(
    db: Annotated[Session, Depends(get_db)],
    authorization: Annotated[str | None, Header(default=None)] = None,
) -> AdminIdentity:
    """Wajibkan token JWT Supabase yang valid dan terdaftar di tabel `admins`."""
    return _authenticate_admin(db, authorization)


def optional_admin(
    db: Annotated[Session, Depends(get_db)],
    authorization: Annotated[str | None, Header(default=None)] = None,
) -> AdminIdentity | None:
    """Kembalikan identitas admin jika token valid; `None` untuk request publik/non-admin."""
    if not authorization:
        return None
    try:
        return _authenticate_admin(db, authorization)
    except AppError:
        return None
