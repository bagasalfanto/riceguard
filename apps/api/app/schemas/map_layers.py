"""Skema respons layer peta (PRD bagian 5.3)."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class MapLayerClass(BaseModel):
    min: float | None = None
    max: float | None = None
    label: str
    color_token: str
    key: str | None = None
    pola: str | None = None


class MapLayerResponse(BaseModel):
    layer: str
    tahun: int
    satuan: str
    values: dict[str, Any]
    classes: list[MapLayerClass]
    min: float | None = None
    max: float | None = None
    details: dict[str, Any] | None = None
