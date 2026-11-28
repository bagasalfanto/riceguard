"""Skema respons daftar, peringkat, dan detail provinsi (PRD bagian 5.2 & 5.4)."""
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


class CalculationStep(BaseModel):
    langkah: str
    rumus: str
    hasil: float | str


class ProvinceRelatedRecommendation(BaseModel):
    urutan: int
    dari_kode: str
    dari: str
    ke_kode: str
    ke: str
    ton: float
    jarak_km: float
    persen_kebutuhan_penerima: float | None = None
    satu_pulau: bool
    explanation: str


class ProvinceHistoryItem(BaseModel):
    tahun: int
    produksi_beras_ton: float
    kebutuhan_beras_ton: float
    rice_balance_ton: float
    rasio_swasembada: float
    status: str


class ProvinceDetailResponse(ProvinceItem):
    version: SummaryVersion
    perhitungan: list[CalculationStep]
    rekomendasi_terkait: list[ProvinceRelatedRecommendation]
    catatan: str | None = None
    riwayat: list[ProvinceHistoryItem]
