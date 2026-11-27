"""Skema respons rekomendasi distribusi & simulasi skenario (PRD bagian 5.6, tiket T6.3 & T6.4)."""
from __future__ import annotations

import math

from pydantic import BaseModel, Field, field_validator

from app.schemas.summary import SummaryVersion


class RecommendationItem(BaseModel):
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


class RecommendationSummary(BaseModel):
    total_dialokasikan_ton: float
    persen_defisit_tertutup: float | None = None
    jumlah_pasangan: int
    rata_jarak_tertimbang_ton: float | None = None
    total_ton_km: float


class RecommendationsResponse(BaseModel):
    tahun: int
    version: SummaryVersion
    ringkasan: RecommendationSummary
    items: list[RecommendationItem]


class SimulationRequest(BaseModel):
    tahun: int | None = None
    ambang_swasembada: float = Field(default=0.90, ge=0.80, le=1.00, allow_inf_nan=False)
    persen_surplus_dilepas: float = Field(default=100.0, ge=10.0, le=100.0, allow_inf_nan=False)
    jarak_maks_km: float | None = Field(default=None, ge=100.0, le=4000.0, allow_inf_nan=False)
    kecualikan_pemasok: list[str] = Field(default_factory=list)
    kecualikan_penerima: list[str] = Field(default_factory=list)
    perubahan_produksi: dict[str, float] = Field(default_factory=dict)
    perubahan_konsumsi_persen: float = Field(default=0.0, ge=-20.0, le=20.0, allow_inf_nan=False)
    mode: str = "greedy_v1"

    @field_validator("perubahan_produksi")
    @classmethod
    def _validasi_perubahan_produksi(cls, nilai: dict[str, float]) -> dict[str, float]:
        for kode, persen in nilai.items():
            if not math.isfinite(persen) or persen < -50.0 or persen > 50.0:
                raise ValueError(
                    f"Perubahan produksi untuk provinsi {kode} harus di antara -50 dan 50"
                )
        return nilai


class SimulatedProvinceItem(BaseModel):
    kode_bps: str
    provinsi: str
    pulau: str
    status: str
    produksi_beras_ton: float
    kebutuhan_beras_ton: float
    rice_balance_ton: float
    rasio_swasembada: float


class StatusChangeItem(BaseModel):
    kode_bps: str
    provinsi: str
    dari: str
    ke: str


class UnmetDeficitItem(BaseModel):
    kode_bps: str
    provinsi: str
    defisit_ton: float
    terpenuhi_ton: float
    sisa_defisit_ton: float


class SimulationComparison(BaseModel):
    delta_ton: float
    delta_ton_km: float
    status_berubah: list[StatusChangeItem]
    defisit_tidak_tertutup: list[UnmetDeficitItem]


class SimulationResponse(BaseModel):
    tahun: int
    version: SummaryVersion
    rekomendasi: list[RecommendationItem]
    provinsi: list[SimulatedProvinceItem]
    ringkasan: RecommendationSummary
    banding_resmi: SimulationComparison
