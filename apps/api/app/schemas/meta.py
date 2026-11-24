"""Skema respons endpoint meta."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class TahunPublished(BaseModel):
    tahun: int
    version_id: str
    version_no: int
    published_at: datetime | None = None


class MetaYears(BaseModel):
    tahun: list[TahunPublished]
    jumlah_tahun: int
    butuh_minimal_2_tahun: bool
    tahun_terbaru: int | None = None
