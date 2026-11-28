"""Skema respons konten situs dan sumber data (PRD bagian 5.1)."""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel


class SourceItem(BaseModel):
    id: int
    key: str
    nama: str
    instansi: str
    tabel_resmi: str | None = None
    tahun: int | None = None
    diperbarui: date | None = None
    url: str | None = None


class ContentItem(BaseModel):
    key: str
    title: str
    body_md: str
    updated_at: datetime
