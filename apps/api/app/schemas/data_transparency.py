"""Skema respons validasi dataset dan file sumber mentah (T8.1)."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

from app.schemas.summary import SummaryVersion


class ValidationRuleItem(BaseModel):
    kode: str
    label: str
    status: Literal["lulus", "peringatan", "gagal"]
    detail: Any = None


class RawSourceFileItem(BaseModel):
    key: str
    nama_file: str


class ValidationResponse(BaseModel):
    tahun: int
    version: SummaryVersion
    version_no: int
    version_id: str
    published_at: datetime | None = None
    published_by: str | None = None
    published_by_nama: str | None = None
    notes: str | None = None
    lulus: bool
    diperiksa_pada: datetime | None = None
    aturan: list[ValidationRuleItem]
    source_files: list[RawSourceFileItem]
