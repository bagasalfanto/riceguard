"""Skema respons GET /forecast (model AI eksternal, PRD §5.10)."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ForecastItem(BaseModel):
    kode_bps: str
    provinsi: str
    nilai: float
    interval_bawah: float | None = None
    interval_atas: float | None = None


class ForecastModelInfo(BaseModel):
    nama: str
    versi: str | None = None


class ForecastResponse(BaseModel):
    tahun: int
    satuan: str
    items: list[ForecastItem]
    model: ForecastModelInfo | None = None
    details: dict[str, Any] = Field(default_factory=dict)
