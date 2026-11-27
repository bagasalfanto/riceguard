"""Skema respons histori multi-tahun dan perbandingan antar-tahun (Wave 7, T7.1–T7.3)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

TrendMetric = Literal["produksi", "kebutuhan", "balance", "rasio"]


class TrendPoint(BaseModel):
    tahun: int
    nasional: float
    per_provinsi: dict[str, float | None]


class TrendProvinceMeta(BaseModel):
    kode_bps: str
    nama: str


class TrendsResponse(BaseModel):
    metric: TrendMetric
    butuh_minimal_2_tahun: bool
    alasan: str | None = None
    tahun_tersedia: list[int]
    deret: list[TrendPoint]
    provinsi_meta: list[TrendProvinceMeta]


class CompareNationalSummary(BaseModel):
    produksi_a: float
    produksi_b: float
    delta_produksi: float
    delta_produksi_persen: float | None = None
    kebutuhan_a: float
    kebutuhan_b: float
    delta_kebutuhan: float
    balance_a: float
    balance_b: float
    delta_balance: float
    surplus_count_a: int
    surplus_count_b: int
    defisit_count_a: int
    defisit_count_b: int
    balanced_count_a: int
    balanced_count_b: int


class CompareProvinceItem(BaseModel):
    kode_bps: str
    nama: str
    pulau: str
    status_a: str | None = None
    status_b: str | None = None
    produksi_a: float | None = None
    produksi_b: float | None = None
    delta_produksi: float | None = None
    delta_produksi_persen: float | None = None
    kebutuhan_a: float | None = None
    kebutuhan_b: float | None = None
    delta_kebutuhan: float | None = None
    balance_a: float | None = None
    balance_b: float | None = None
    delta_balance: float | None = None
    rasio_a: float | None = None
    rasio_b: float | None = None
    delta_rasio: float | None = None


class CompareStatusChange(BaseModel):
    kode_bps: str
    nama: str
    status_a: str
    status_b: str
    delta_produksi: float
    delta_balance: float


class CompareResponse(BaseModel):
    tahun_a: int | None = None
    tahun_b: int | None = None
    butuh_minimal_2_tahun: bool
    alasan: str | None = None
    nasional: CompareNationalSummary | None = None
    items: list[CompareProvinceItem]
    status_berubah: list[CompareStatusChange]
