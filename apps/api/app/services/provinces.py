"""Daftar dan peringkat provinsi untuk satu versi dataset."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models import DatasetVersion, Province, ProvinceStat
from app.schemas.provinces import ProvinceItem, RankingItem

SORT_KOLOM = {
    "produksi": ProvinceStat.produksi_beras_ton,
    "kebutuhan": ProvinceStat.kebutuhan_beras_ton,
    "balance": ProvinceStat.rice_balance_ton,
    "rasio": ProvinceStat.rasio_swasembada,
    "penduduk": ProvinceStat.penduduk_jiwa,
    "provinsi": Province.nama,
}

STATUS_VALID = {"surplus", "balanced", "defisit"}

RANKING_VALID = {"produksi", "kebutuhan", "surplus", "defisit"}


def _invalid(pesan: str, details: dict) -> AppError:
    return AppError("INVALID_PARAMS", 400, pesan, details)


def _kolom(nama: str):
    kolom = SORT_KOLOM.get(nama)
    if kolom is None:
        raise _invalid("Parameter sort tidak dikenal", {"sort": nama, "pilihan": list(SORT_KOLOM)})
    return kolom


def _item(tahun: int, stat: ProvinceStat, prov: Province) -> ProvinceItem:
    return ProvinceItem(
        tahun=tahun,
        kode_bps=stat.kode_bps,
        kode_kemendagri=prov.kode_kemendagri,
        provinsi=prov.nama,
        pulau=prov.pulau,
        lat=float(prov.lat),
        lng=float(prov.lng),
        penduduk_jiwa=int(stat.penduduk_jiwa),
        konsumsi_kg_kapita_tahun=float(stat.konsumsi_kg_kapita_tahun),
        produksi_padi_ton_gkg=float(stat.produksi_padi_ton_gkg),
        produksi_beras_ton=float(stat.produksi_beras_ton),
        kebutuhan_beras_ton=float(stat.kebutuhan_beras_ton),
        rice_balance_ton=float(stat.rice_balance_ton),
        rasio_swasembada=float(stat.rasio_swasembada),
        status=stat.status,
    )


def daftar_provinsi(
    db: Session,
    versi: DatasetVersion,
    *,
    status: str | None = None,
    pulau: str | None = None,
    q: str | None = None,
    sort: str = "provinsi",
    order: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[ProvinceItem], int]:
    kolom_sort = _kolom(sort)

    if order is None:
        order = "asc" if sort == "provinsi" else "desc"
    if order not in {"asc", "desc"}:
        raise _invalid("Parameter order harus asc atau desc", {"order": order})

    filter_status: list[str] = []
    if status:
        filter_status = [s.strip() for s in status.split(",") if s.strip()]
        asing = [s for s in filter_status if s not in STATUS_VALID]
        if asing:
            raise _invalid("Nilai status tidak dikenal", {"status": asing, "pilihan": sorted(STATUS_VALID)})

    dasar = (
        select(ProvinceStat, Province)
        .join(Province, Province.kode_bps == ProvinceStat.kode_bps)
        .where(ProvinceStat.version_id == versi.id)
    )
    if filter_status:
        dasar = dasar.where(ProvinceStat.status.in_(filter_status))
    if pulau:
        daftar_pulau = [p.strip() for p in pulau.split(",") if p.strip()]
        dasar = dasar.where(Province.pulau.in_(daftar_pulau))
    if q:
        pola = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        dasar = dasar.where(Province.nama.ilike(f"%{pola}%"))

    total = db.scalar(select(func.count()).select_from(dasar.subquery())) or 0

    arah = kolom_sort.asc() if order == "asc" else kolom_sort.desc()
    baris = db.execute(dasar.order_by(arah).limit(limit).offset(offset)).all()

    return [_item(versi.tahun, stat, prov) for stat, prov in baris], int(total)


def peringkat(db: Session, versi: DatasetVersion, by: str, limit: int = 5) -> list[RankingItem]:
    if by not in RANKING_VALID:
        raise _invalid("Parameter by tidak dikenal", {"by": by, "pilihan": sorted(RANKING_VALID)})

    limit = max(1, min(int(limit), 38))

    dasar = (
        select(ProvinceStat, Province)
        .join(Province, Province.kode_bps == ProvinceStat.kode_bps)
        .where(ProvinceStat.version_id == versi.id)
    )

    if by == "produksi":
        dasar = dasar.order_by(ProvinceStat.produksi_beras_ton.desc())
    elif by == "kebutuhan":
        dasar = dasar.order_by(ProvinceStat.kebutuhan_beras_ton.desc())
    elif by == "surplus":
        dasar = dasar.where(ProvinceStat.status == "surplus").order_by(ProvinceStat.rice_balance_ton.desc())
    else:
        dasar = dasar.where(ProvinceStat.status == "defisit").order_by(ProvinceStat.rice_balance_ton.asc())

    kolom_nilai = (
        ProvinceStat.kebutuhan_beras_ton if by == "kebutuhan" else
        ProvinceStat.rice_balance_ton if by in {"surplus", "defisit"} else
        ProvinceStat.produksi_beras_ton
    )

    baris = db.execute(dasar.limit(limit)).all()
    return [
        RankingItem(
            peringkat=i + 1,
            kode_bps=stat.kode_bps,
            provinsi=prov.nama,
            nilai=float(getattr(stat, kolom_nilai.key)),
        )
        for i, (stat, prov) in enumerate(baris)
    ]
