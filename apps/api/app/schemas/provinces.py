"""Skema respons daftar provinsi dan peringkat (PRD bagian 5.2)."""
from __future__ import annotations

from pydantic import BaseModel

from app.schemas.summary import SummaryVersion


class ProvinceItem(BaseModel):
    tahun: int
    kode_bps: str
    kode_kemendagri: str
    provinsi: str
    pulau: str
    lat: float
    lng: float
    penduduk_jiwa: int
    konsumsi_kg_kapita_tahun: float
    produksi_padi_ton_gkg: float
    produksi_beras_ton: float
    kebutuhan_beras_ton: float
    rice_balance_ton: float
    rasio_swasembada: float
    status: str


class ProvincesResponse(BaseModel):
    tahun: int
    version: SummaryVersion
    items: list[ProvinceItem]
    total: int


class RankingItem(BaseModel):
    peringkat: int
    kode_bps: str
    provinsi: str
    nilai: float


class RankingsResponse(BaseModel):
    by: str
    tahun: int
    items: list[RankingItem]
