"""Skema GET /rice-balance — neraca beras per provinsi plus total nasional."""
from __future__ import annotations

from pydantic import BaseModel

from app.schemas.summary import SummaryStatus, SummaryVersion


class RiceBalanceItem(BaseModel):
    kode_bps: str
    provinsi: str
    pulau: str
    produksi_beras_ton: float
    kebutuhan_beras_ton: float
    rice_balance_ton: float
    rasio_swasembada: float
    status: str


class RiceBalanceNasional(BaseModel):
    produksi_beras_ton: float
    kebutuhan_beras_ton: float
    rice_balance_ton: float
    rasio_swasembada: float | None = None
    jumlah_status: SummaryStatus


class RiceBalanceResponse(BaseModel):
    tahun: int
    version: SummaryVersion
    nasional: RiceBalanceNasional
    items: list[RiceBalanceItem]
