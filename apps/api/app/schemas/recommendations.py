"""Skema respons rekomendasi distribusi (PRD bagian 5.6, tiket T6.3)."""
from __future__ import annotations

from pydantic import BaseModel

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
