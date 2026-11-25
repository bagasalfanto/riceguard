"""Daftar, peringkat, dan detail analisis provinsi untuk satu versi dataset."""
from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import AppError, not_found_provinsi
from app.core.rounding import bulatkan_ton
from app.db.models import DatasetVersion, Province, ProvinceStat
from app.schemas.provinces import (
    CalculationStep,
    ProvinceDetailResponse,
    ProvinceHistoryItem,
    ProvinceItem,
    ProvinceRelatedRecommendation,
    RankingItem,
)
from app.services.recommendations import bangun_rekomendasi

SORT_KOLOM = {
    "produksi": ProvinceStat.produksi_beras_ton,
    "kebutuhan": ProvinceStat.kebutuhan_beras_ton,
    "balance": ProvinceStat.rice_balance_ton,
    "rasio": ProvinceStat.rasio_swasembada,
    "peringkat": ProvinceStat.rasio_swasembada,
    "penduduk": ProvinceStat.penduduk_jiwa,
    "provinsi": Province.nama,
}

STATUS_VALID = {"surplus", "balanced", "defisit"}

RANKING_VALID = {"produksi", "kebutuhan", "surplus", "defisit", "balance"}

PROVINCE_FIELDS = set(ProvinceItem.model_fields.keys())


def _invalid(pesan: str, details: dict) -> AppError:
    return AppError("INVALID_PARAMS", 400, pesan, details)


def _kolom(nama: str):
    kolom = SORT_KOLOM.get(nama)
    if kolom is None:
        raise _invalid("Parameter sort tidak dikenal", {"sort": nama, "pilihan": list(SORT_KOLOM)})
    return kolom


def _fmt_id(nilai: float | int, desimal: int = 0) -> str:
    if desimal == 0:
        return f"{nilai:,.0f}".replace(",", ".")
    s = f"{nilai:,.{desimal}f}"
    return s.replace(",", "_").replace(".", ",").replace("_", ".")


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
        konsumsi_kg_kapita_tahun=round(float(stat.konsumsi_kg_kapita_tahun), 2),
        produksi_padi_ton_gkg=bulatkan_ton(stat.produksi_padi_ton_gkg),
        produksi_beras_ton=bulatkan_ton(stat.produksi_beras_ton),
        kebutuhan_beras_ton=bulatkan_ton(stat.kebutuhan_beras_ton),
        rice_balance_ton=bulatkan_ton(stat.rice_balance_ton),
        rasio_swasembada=float(stat.rasio_swasembada),
        status=stat.status,
    )


def parse_fields(fields: str | None) -> list[str] | None:
    if not fields or not fields.strip():
        return None
    daftar = [f.strip() for f in fields.split(",") if f.strip()]
    if not daftar:
        return None
    asing = [f for f in daftar if f not in PROVINCE_FIELDS]
    if asing:
        raise _invalid("Field tidak dikenal", {"fields": asing, "pilihan": sorted(PROVINCE_FIELDS)})
    return daftar


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
        if daftar_pulau:
            dasar = dasar.where(Province.pulau.in_(daftar_pulau))
    if q and q.strip():
        pola = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        like_expr = f"%{pola}%"
        dasar = dasar.where(
            or_(
                Province.nama.ilike(like_expr, escape="\\"),
                ProvinceStat.kode_bps.ilike(like_expr, escape="\\"),
            )
        )

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
    elif by == "defisit":
        dasar = dasar.where(ProvinceStat.status == "defisit").order_by(ProvinceStat.rice_balance_ton.asc())
    else:
        dasar = dasar.order_by(ProvinceStat.rice_balance_ton.desc())

    kolom_nilai = (
        ProvinceStat.kebutuhan_beras_ton
        if by == "kebutuhan"
        else ProvinceStat.rice_balance_ton
        if by in {"surplus", "defisit", "balance"}
        else ProvinceStat.produksi_beras_ton
    )

    baris = db.execute(dasar.limit(limit)).all()
    return [
        RankingItem(
            peringkat=i + 1,
            kode_bps=stat.kode_bps,
            provinsi=prov.nama,
            nilai=bulatkan_ton(getattr(stat, kolom_nilai.key)),
        )
        for i, (stat, prov) in enumerate(baris)
    ]


def detail_provinsi(db: Session, versi: DatasetVersion, kode_bps: str) -> ProvinceDetailResponse:
    row = db.execute(
        select(ProvinceStat, Province)
        .join(Province, Province.kode_bps == ProvinceStat.kode_bps)
        .where(ProvinceStat.version_id == versi.id, ProvinceStat.kode_bps == kode_bps)
    ).first()
    if row is None:
        raise not_found_provinsi(kode_bps)

    stat, prov = row
    item = _item(versi.tahun, stat, prov)

    produksi = bulatkan_ton(stat.produksi_beras_ton)
    kebutuhan = bulatkan_ton(stat.kebutuhan_beras_ton)
    balance = bulatkan_ton(stat.rice_balance_ton)
    konsumsi = float(stat.konsumsi_kg_kapita_tahun)
    rasio = float(stat.rasio_swasembada)

    perhitungan = [
        CalculationStep(
            langkah="kebutuhan",
            rumus=f"{_fmt_id(item.penduduk_jiwa)} × {_fmt_id(konsumsi, 1)} kg / 1.000",
            hasil=kebutuhan,
        ),
        CalculationStep(
            langkah="balance",
            rumus=f"{_fmt_id(produksi, 2)} − {_fmt_id(kebutuhan, 2)}",
            hasil=balance,
        ),
        CalculationStep(
            langkah="rasio",
            rumus=f"{_fmt_id(produksi, 2)} / {_fmt_id(kebutuhan, 2)}",
            hasil=rasio,
        ),
        CalculationStep(
            langkah="klasifikasi",
            rumus="ambang swasembada 0,90–1,00 (surplus > 1,00; balanced 0,90–1,00; defisit < 0,90)",
            hasil=stat.status,
        ),
    ]

    catatan: str | None = None
    rekomendasi_terkait: list[ProvinceRelatedRecommendation] = []
    if stat.status == "defisit":
        rek = bangun_rekomendasi(db, versi, ke_kode=kode_bps)
        rekomendasi_terkait = [
            ProvinceRelatedRecommendation(**r.model_dump()) for r in rek.items
        ]
    elif stat.status == "surplus":
        rek = bangun_rekomendasi(db, versi, dari_kode=kode_bps)
        rekomendasi_terkait = [
            ProvinceRelatedRecommendation(**r.model_dump()) for r in rek.items
        ]
    else:
        catatan = "Provinsi kategori balanced (rasio 0,90–1,00) tidak ikut matching distribusi."

    riwayat_rows = db.execute(
        select(DatasetVersion.tahun, ProvinceStat)
        .join(ProvinceStat, ProvinceStat.version_id == DatasetVersion.id)
        .where(DatasetVersion.status == "published", ProvinceStat.kode_bps == kode_bps)
        .order_by(DatasetVersion.tahun.asc())
    ).all()

    riwayat = [
        ProvinceHistoryItem(
            tahun=tahun_row,
            produksi_beras_ton=bulatkan_ton(stat_row.produksi_beras_ton),
            kebutuhan_beras_ton=bulatkan_ton(stat_row.kebutuhan_beras_ton),
            rice_balance_ton=bulatkan_ton(stat_row.rice_balance_ton),
            rasio_swasembada=float(stat_row.rasio_swasembada),
            status=stat_row.status,
        )
        for tahun_row, stat_row in riwayat_rows
    ]

    return ProvinceDetailResponse(
        **item.model_dump(),
        version={"id": str(versi.id), "version_no": versi.version_no},
        perhitungan=perhitungan,
        rekomendasi_terkait=rekomendasi_terkait,
        catatan=catatan,
        riwayat=riwayat,
    )
