"""Skema request & response untuk seluruh endpoint panel admin (T10.1–T10.8)."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.data_transparency import RawSourceFileItem
from app.schemas.provinces import ProvinceItem
from app.schemas.recommendations import RecommendationItem, RecommendationSummary


class AdminMeResponse(BaseModel):
    user_id: uuid.UUID
    nama: str
    email: str | None = None


class AdminVersionItem(BaseModel):
    id: str
    tahun: int
    version_no: int
    status: Literal["draft", "published", "archived"]
    notes: str | None = None
    created_by: str | None = None
    created_at: datetime
    published_by: str | None = None
    published_by_nama: str | None = None
    published_at: datetime | None = None
    lulus_validasi: bool


class AdminVersionListResponse(BaseModel):
    items: list[AdminVersionItem]


class AdminEditHistoryItem(BaseModel):
    id: int
    kode_bps: str
    provinsi: str
    field: str
    old_value: float | None = None
    new_value: float | None = None
    reason: str
    edited_by: str | None = None
    edited_by_nama: str | None = None
    edited_at: datetime


class AdminVersionDetailResponse(BaseModel):
    version: AdminVersionItem
    validasi: dict[str, Any]
    ringkasan: dict[str, Any]
    source_files: list[RawSourceFileItem]
    edits: list[AdminEditHistoryItem]


class AdminProvinceStatItem(ProvinceItem):
    is_edited: bool = False


class AdminVersionProvincesResponse(BaseModel):
    version_id: str
    tahun: int
    status: Literal["draft", "published", "archived"]
    items: list[AdminProvinceStatItem]


class AdminVersionRecommendationsResponse(BaseModel):
    version_id: str
    tahun: int
    ringkasan: RecommendationSummary
    items: list[RecommendationItem]


class AdminValidateResponse(BaseModel):
    validasi: dict[str, Any]
    pratinjau: list[AdminProvinceStatItem]
    ringkasan: dict[str, Any]
    rekomendasi: list[RecommendationItem]


class AdminCreateVersionResponse(BaseModel):
    version: AdminVersionItem
    validasi: dict[str, Any]
    ringkasan: dict[str, Any]


class ProvinceStatPatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    penduduk_jiwa: int | None = Field(default=None, gt=0)
    konsumsi_kg_kapita_tahun: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    produksi_padi_ton_gkg: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    produksi_beras_ton: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    reason: str = Field(min_length=1)

    @field_validator("reason")
    @classmethod
    def _reason_tidak_kosong(cls, nilai: str) -> str:
        bersih = nilai.strip()
        if not bersih:
            raise ValueError("Alasan perubahan wajib diisi")
        return bersih


class AdminPatchProvinceResponse(BaseModel):
    edited: bool
    version: AdminVersionItem
    validasi: dict[str, Any]
    ringkasan: dict[str, Any]


class AdminRecomputeResponse(BaseModel):
    version: AdminVersionItem
    validasi: dict[str, Any]
    ringkasan: dict[str, Any]


class AdminVersionActionResponse(BaseModel):
    version: AdminVersionItem


class DuplicateVersionRequest(BaseModel):
    notes: str = Field(min_length=1)

    @field_validator("notes")
    @classmethod
    def _notes_tidak_kosong(cls, nilai: str) -> str:
        bersih = nilai.strip()
        if not bersih:
            raise ValueError("Catatan duplikasi wajib diisi")
        return bersih


class AdminDeleteVersionResponse(BaseModel):
    deleted: bool
    id: str


class ContentUpdateRequest(BaseModel):
    title: str = Field(min_length=1)
    body_md: str = ""

    @field_validator("title")
    @classmethod
    def _title_tidak_kosong(cls, nilai: str) -> str:
        bersih = nilai.strip()
        if not bersih:
            raise ValueError("Judul konten wajib diisi")
        return bersih


class SourceUpdateRequest(BaseModel):
    nama: str | None = None
    instansi: str | None = None
    tabel_resmi: str | None = None
    tahun: int | None = Field(default=None, ge=1900, le=2100)
    diperbarui: date | None = None
    url: str | None = None

    @field_validator("nama", "instansi")
    @classmethod
    def _tidak_kosong_jika_ada(cls, nilai: str | None) -> str | None:
        if nilai is None:
            return None
        bersih = nilai.strip()
        if not bersih:
            raise ValueError("Nilai tidak boleh kosong")
        return bersih


class AuditLogItem(BaseModel):
    id: int
    created_at: datetime
    actor: str | None = None
    actor_nama: str | None = None
    action: str
    entity: str | None = None
    entity_id: str | None = None
    detail: dict[str, Any] | None = None


class AuditLogListResponse(BaseModel):
    items: list[AuditLogItem]
    total: int
    page: int
    limit: int
