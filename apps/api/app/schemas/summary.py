"""Skema respons agregat nasional (PRD bagian 5.1, 5.2)."""
from __future__ import annotations

from pydantic import BaseModel


class SummaryVersion(BaseModel):
    id: str
    version_no: int


class SummaryStatus(BaseModel):
    surplus: int
    balanced: int
    defisit: int


class DeltaSummary(BaseModel):
    tahun: int
    produksi_persen: float | None = None
    kebutuhan_persen: float | None = None
    balance_ton: float | None = None
    balance_persen: float | None = None


class PulauBreakdown(BaseModel):
    pulau: str
    produksi_beras_ton: float
    kebutuhan_beras_ton: float
    porsi_produksi: float
    porsi_kebutuhan: float
    jumlah_provinsi: int


class SummaryResponse(BaseModel):
    tahun: int
    version: SummaryVersion
    produksi_beras_ton: float
    kebutuhan_beras_ton: float
    rice_balance_ton: float
    rasio_swasembada: float | None = None
    jumlah_status: SummaryStatus
    total_dialokasikan_ton: float
    delta_tahun_sebelumnya: DeltaSummary | None = None
    pulau_breakdown: list[PulauBreakdown] = []
