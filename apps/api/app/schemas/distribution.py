"""Skema respons analisis pasokan dan distribusi beras (Wave 5, T5.1–T5.3)."""
from __future__ import annotations

from pydantic import BaseModel

from app.schemas.summary import SummaryVersion


class DistributionSurplusItem(BaseModel):
    kode_bps: str
    provinsi: str
    pulau: str
    rice_balance_ton: float
    terpakai_ton: float
    sisa_ton: float


class DistributionDeficitItem(BaseModel):
    kode_bps: str
    provinsi: str
    pulau: str
    rice_balance_ton: float
    defisit_ton: float
    rasio_swasembada: float
    terpenuhi_ton: float
    persen_terpenuhi: float
    prioritas: int


class DistributionSummary(BaseModel):
    total_surplus_ton: float
    total_terpakai_ton: float
    total_sisa_ton: float
    total_defisit_ton: float
    total_terpenuhi_ton: float
    persen_defisit_tertutup: float
    jumlah_pasangan: int


class DistributionOverviewResponse(BaseModel):
    tahun: int
    version: SummaryVersion
    surplus: list[DistributionSurplusItem]
    defisit: list[DistributionDeficitItem]
    ringkasan: DistributionSummary


class DistributionRecipient(BaseModel):
    kode_bps: str
    provinsi: str
    pulau: str
    defisit_ton: float
    terpenuhi_ton: float


class DistributionSupplierItem(BaseModel):
    kode_bps: str
    provinsi: str
    pulau: str
    surplus_ton: float
    terpakai_ton: float
    sisa_ton: float
    jarak_km: float
    satu_pulau: bool
    dipakai_di_rekomendasi: bool
    alokasi_ton: float


class DistributionSuppliersResponse(BaseModel):
    tahun: int
    version: SummaryVersion
    penerima: DistributionRecipient
    items: list[DistributionSupplierItem]


class DistanceMatrixResponse(BaseModel):
    tahun: int
    version: SummaryVersion
    baris: list[str]
    kolom: list[str]
    jarak_km: list[list[float]]
    satuan: str = "km"
