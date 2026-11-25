"""Layanan analisis pasokan, kandidat pemasok, dan matriks jarak distribusi (T5.1–T5.3)."""
from __future__ import annotations

from collections import defaultdict
from decimal import Decimal

from riceguard_calc.matching import haversine_km
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError, not_found_provinsi
from app.core.rounding import bulatkan_ton
from app.db.models import DatasetVersion, DistributionRecommendation, Province, ProvinceStat
from app.schemas.distribution import (
    DistanceMatrixResponse,
    DistributionDeficitItem,
    DistributionOverviewResponse,
    DistributionRecipient,
    DistributionSummary,
    DistributionSupplierItem,
    DistributionSuppliersResponse,
    DistributionSurplusItem,
)
from app.schemas.summary import SummaryVersion


def _version_info(versi: DatasetVersion) -> SummaryVersion:
    return SummaryVersion(id=str(versi.id), version_no=versi.version_no)


def _jarak_km(asal: Province, tujuan: Province) -> float:
    return round(
        haversine_km(float(asal.lat), float(asal.lng), float(tujuan.lat), float(tujuan.lng)),
        1,
    )


def _ambil_provinsi_berstatus(
    db: Session,
    versi: DatasetVersion,
    status: str,
) -> list[tuple[ProvinceStat, Province]]:
    urutan = (
        ProvinceStat.rice_balance_ton.desc()
        if status == "surplus"
        else ProvinceStat.rice_balance_ton.asc()
    )
    stmt = (
        select(ProvinceStat, Province)
        .join(Province, Province.kode_bps == ProvinceStat.kode_bps)
        .where(ProvinceStat.version_id == versi.id, ProvinceStat.status == status)
        .order_by(urutan, ProvinceStat.kode_bps.asc())
    )
    return list(db.execute(stmt).all())


def _ringkas_alokasi(
    db: Session,
    versi: DatasetVersion,
) -> tuple[dict[str, Decimal], dict[str, Decimal], dict[tuple[str, str], Decimal], int]:
    rows = db.execute(
        select(
            DistributionRecommendation.dari_kode,
            DistributionRecommendation.ke_kode,
            DistributionRecommendation.ton,
        ).where(DistributionRecommendation.version_id == versi.id)
    ).all()

    terpakai: dict[str, Decimal] = defaultdict(Decimal)
    terpenuhi: dict[str, Decimal] = defaultdict(Decimal)
    pasangan: dict[tuple[str, str], Decimal] = defaultdict(Decimal)

    for dari_kode, ke_kode, ton in rows:
        ton_dec = Decimal(ton)
        terpakai[dari_kode] += ton_dec
        terpenuhi[ke_kode] += ton_dec
        pasangan[(dari_kode, ke_kode)] += ton_dec

    return terpakai, terpenuhi, pasangan, len(rows)


def bangun_overview(db: Session, versi: DatasetVersion) -> DistributionOverviewResponse:
    """Bangun ringkasan surplus, defisit berprioritas, dan agregat alokasi satu versi."""
    surplus_rows = _ambil_provinsi_berstatus(db, versi, "surplus")
    defisit_rows = _ambil_provinsi_berstatus(db, versi, "defisit")
    terpakai, terpenuhi, _, jumlah_pasangan = _ringkas_alokasi(db, versi)

    surplus_items: list[DistributionSurplusItem] = []
    total_surplus = Decimal(0)
    total_terpakai = Decimal(0)
    for stat, prov in surplus_rows:
        balance = Decimal(stat.rice_balance_ton)
        used = terpakai.get(stat.kode_bps, Decimal(0))
        total_surplus += balance
        total_terpakai += used
        surplus_items.append(
            DistributionSurplusItem(
                kode_bps=stat.kode_bps,
                provinsi=prov.nama,
                pulau=prov.pulau,
                rice_balance_ton=bulatkan_ton(balance),
                terpakai_ton=bulatkan_ton(used),
                sisa_ton=bulatkan_ton(balance - used),
            )
        )

    defisit_items: list[DistributionDeficitItem] = []
    total_defisit = Decimal(0)
    total_terpenuhi = Decimal(0)
    for prioritas, (stat, prov) in enumerate(defisit_rows, start=1):
        balance = Decimal(stat.rice_balance_ton)
        defisit_dec = abs(balance)
        filled_dec = terpenuhi.get(stat.kode_bps, Decimal(0))
        total_defisit += defisit_dec
        total_terpenuhi += filled_dec

        defisit_ton = bulatkan_ton(defisit_dec)
        terpenuhi_ton = bulatkan_ton(filled_dec)
        persen_terpenuhi = round(terpenuhi_ton / defisit_ton * 100, 2) if defisit_ton > 0 else 0.0

        defisit_items.append(
            DistributionDeficitItem(
                kode_bps=stat.kode_bps,
                provinsi=prov.nama,
                pulau=prov.pulau,
                rice_balance_ton=bulatkan_ton(balance),
                defisit_ton=defisit_ton,
                rasio_swasembada=float(stat.rasio_swasembada),
                terpenuhi_ton=terpenuhi_ton,
                persen_terpenuhi=persen_terpenuhi,
                prioritas=prioritas,
            )
        )

    total_defisit_ton = bulatkan_ton(total_defisit)
    total_terpenuhi_ton = bulatkan_ton(total_terpenuhi)
    persen_tertutup = (
        round(total_terpenuhi_ton / total_defisit_ton * 100, 2) if total_defisit_ton > 0 else 0.0
    )

    return DistributionOverviewResponse(
        tahun=versi.tahun,
        version=_version_info(versi),
        surplus=surplus_items,
        defisit=defisit_items,
        ringkasan=DistributionSummary(
            total_surplus_ton=bulatkan_ton(total_surplus),
            total_terpakai_ton=bulatkan_ton(total_terpakai),
            total_sisa_ton=bulatkan_ton(total_surplus - total_terpakai),
            total_defisit_ton=total_defisit_ton,
            total_terpenuhi_ton=total_terpenuhi_ton,
            persen_defisit_tertutup=persen_tertutup,
            jumlah_pasangan=jumlah_pasangan,
        ),
    )


def daftar_pemasok(
    db: Session,
    versi: DatasetVersion,
    kode_bps: str,
) -> DistributionSuppliersResponse:
    """Daftar seluruh provinsi surplus urut jarak garis lurus untuk satu provinsi defisit."""
    row = db.execute(
        select(ProvinceStat, Province)
        .join(Province, Province.kode_bps == ProvinceStat.kode_bps)
        .where(ProvinceStat.version_id == versi.id, ProvinceStat.kode_bps == kode_bps)
    ).first()
    if row is None:
        raise not_found_provinsi(kode_bps)

    stat, prov = row
    if stat.status != "defisit":
        raise AppError(
            "INVALID_PARAMS",
            400,
            "Provinsi bukan kategori defisit",
            {"kode_bps": kode_bps, "alasan": "bukan provinsi defisit"},
        )

    surplus_rows = _ambil_provinsi_berstatus(db, versi, "surplus")
    terpakai, terpenuhi, pasangan, _ = _ringkas_alokasi(db, versi)

    penerima = DistributionRecipient(
        kode_bps=stat.kode_bps,
        provinsi=prov.nama,
        pulau=prov.pulau,
        defisit_ton=bulatkan_ton(abs(Decimal(stat.rice_balance_ton))),
        terpenuhi_ton=bulatkan_ton(terpenuhi.get(stat.kode_bps, Decimal(0))),
    )

    items: list[DistributionSupplierItem] = []
    for s_stat, s_prov in surplus_rows:
        bal = Decimal(s_stat.rice_balance_ton)
        used = terpakai.get(s_stat.kode_bps, Decimal(0))
        alok = pasangan.get((s_stat.kode_bps, kode_bps), Decimal(0))
        items.append(
            DistributionSupplierItem(
                kode_bps=s_stat.kode_bps,
                provinsi=s_prov.nama,
                pulau=s_prov.pulau,
                surplus_ton=bulatkan_ton(bal),
                terpakai_ton=bulatkan_ton(used),
                sisa_ton=bulatkan_ton(bal - used),
                jarak_km=_jarak_km(prov, s_prov),
                satu_pulau=prov.pulau == s_prov.pulau,
                dipakai_di_rekomendasi=(s_stat.kode_bps, kode_bps) in pasangan,
                alokasi_ton=bulatkan_ton(alok),
            )
        )

    items.sort(key=lambda item: (item.jarak_km, item.kode_bps))

    return DistributionSuppliersResponse(
        tahun=versi.tahun,
        version=_version_info(versi),
        penerima=penerima,
        items=items,
    )


def matriks_jarak(db: Session, versi: DatasetVersion) -> DistanceMatrixResponse:
    """Matriks jarak garis lurus (km, 1 desimal) antara provinsi defisit dan surplus."""
    defisit_rows = _ambil_provinsi_berstatus(db, versi, "defisit")
    surplus_rows = _ambil_provinsi_berstatus(db, versi, "surplus")

    return DistanceMatrixResponse(
        tahun=versi.tahun,
        version=_version_info(versi),
        baris=[stat.kode_bps for stat, _ in defisit_rows],
        kolom=[stat.kode_bps for stat, _ in surplus_rows],
        jarak_km=[
            [_jarak_km(d_prov, s_prov) for _, s_prov in surplus_rows]
            for _, d_prov in defisit_rows
        ],
        satuan="km",
    )
