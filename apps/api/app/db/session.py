"""Sesi database. Engine dibuat malas supaya /health tetap jalan tanpa DATABASE_URL."""
from __future__ import annotations

from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings


@lru_cache
def get_engine():
    url = get_settings().database_url
    if not url:
        raise RuntimeError("DATABASE_URL belum diisi (apps/api/.env)")
    return create_engine(url, pool_pre_ping=True, future=True)


@lru_cache
def get_sessionmaker() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), expire_on_commit=False, future=True)


def get_db() -> Iterator[Session]:
    with get_sessionmaker()() as db:
        yield db
