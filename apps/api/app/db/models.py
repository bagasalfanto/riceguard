"""Model SQLAlchemy untuk skema PRD bagian 9. Nama kolom = nama di database."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


version_status = Enum("draft", "published", "archived", name="version_status", create_type=False)
province_status = Enum("surplus", "balanced", "defisit", name="province_status", create_type=False)


class Province(Base):
    __tablename__ = "provinces"

    kode_bps: Mapped[str] = mapped_column(String, primary_key=True)
    kode_kemendagri: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    nama: Mapped[str] = mapped_column(String, nullable=False)
    pulau: Mapped[str] = mapped_column(String, nullable=False)
    lat: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False)
    lng: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False)
    luas_km2: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))


class DatasetVersion(Base):
    __tablename__ = "dataset_versions"
    __table_args__ = (UniqueConstraint("tahun", "version_no", name="dataset_versions_tahun_version_no_key"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tahun: Mapped[int] = mapped_column(Integer, nullable=False)
    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(version_status, nullable=False, default="draft")
    notes: Mapped[str | None] = mapped_column(Text)
    validation: Mapped[dict | None] = mapped_column(JSONB)
    summary: Mapped[dict | None] = mapped_column(JSONB)
    source_files: Mapped[dict | None] = mapped_column(JSONB)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    published_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ProvinceStat(Base):
    __tablename__ = "province_stats"

    version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dataset_versions.id", ondelete="CASCADE"), primary_key=True
    )
    kode_bps: Mapped[str] = mapped_column(String, ForeignKey("provinces.kode_bps"), primary_key=True)
    penduduk_jiwa: Mapped[int] = mapped_column(BigInteger, nullable=False)
    konsumsi_kg_kapita_tahun: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    produksi_padi_ton_gkg: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    produksi_beras_ton: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    kebutuhan_beras_ton: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    rice_balance_ton: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    rasio_swasembada: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False)
    status: Mapped[str] = mapped_column(province_status, nullable=False)
    is_edited: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class ProvinceStatEdit(Base):
    __tablename__ = "province_stat_edits"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dataset_versions.id", ondelete="CASCADE"), nullable=False
    )
    kode_bps: Mapped[str] = mapped_column(String, ForeignKey("provinces.kode_bps"), nullable=False)
    field: Mapped[str] = mapped_column(Text, nullable=False)
    old_value: Mapped[Decimal | None] = mapped_column(Numeric)
    new_value: Mapped[Decimal | None] = mapped_column(Numeric)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    edited_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    edited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class DistributionRecommendation(Base):
    __tablename__ = "distribution_recommendations"
    __table_args__ = (UniqueConstraint("version_id", "urutan", name="distribution_recommendations_version_id_urutan_key"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dataset_versions.id", ondelete="CASCADE"), nullable=False
    )
    urutan: Mapped[int] = mapped_column(Integer, nullable=False)
    dari_kode: Mapped[str] = mapped_column(String, ForeignKey("provinces.kode_bps"), nullable=False)
    ke_kode: Mapped[str] = mapped_column(String, ForeignKey("provinces.kode_bps"), nullable=False)
    ton: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    jarak_km: Mapped[Decimal] = mapped_column(Numeric(8, 1), nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text)


class DataSource(Base):
    __tablename__ = "data_sources"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    nama: Mapped[str] = mapped_column(Text, nullable=False)
    instansi: Mapped[str] = mapped_column(Text, nullable=False)
    tabel_resmi: Mapped[str | None] = mapped_column(Text)
    tahun: Mapped[int | None] = mapped_column(Integer)
    diperbarui: Mapped[date | None] = mapped_column(Date)
    url: Mapped[str | None] = mapped_column(Text)


class SiteContent(Base):
    __tablename__ = "site_content"

    key: Mapped[str] = mapped_column(Text, primary_key=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    body_md: Mapped[str] = mapped_column(Text, nullable=False, default="")
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Admin(Base):
    __tablename__ = "admins"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    nama: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    actor: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    action: Mapped[str] = mapped_column(Text, nullable=False)
    entity: Mapped[str | None] = mapped_column(Text)
    entity_id: Mapped[str | None] = mapped_column(Text)
    detail: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
