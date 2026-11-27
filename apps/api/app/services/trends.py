"""Layanan histori multi-tahun, perbandingan dua tahun, dan gating minimal 2 tahun (T7.1–T7.3)."""
from __future__ import annotations

from collections.abc import Iterable
from decimal import Decimal
from typing import cast

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.rounding import bulatkan_ton
from app.db.models import DatasetVersion, Province, ProvinceStat
from app.schemas.trends import (
    CompareNationalSummary,
    CompareProvinceItem,
    CompareResponse,
    CompareStatusChange,
    TrendMetric,
    TrendPoint,
    TrendProvinceMeta,
    TrendsResponse,
)

ALASAN_MIN_DUA_TAHUN = "butuh minimal 2 tahun data"
MAKS_KODE_BPS = 5
METRIC_VALID: tuple[TrendMetric, ...] = ("produksi", "kebutuhan", "balance", "rasio")


def validasi_metric(metric: str) -> TrendMetric:
    if metric not in METRIC_VALID:
        raise AppError(
            "INVALID_PARAMS",
            400,
            "Parameter metric tidak valid",
            {"metric": metric, "pilihan": list(METRIC_VALID)},
        )
    return cast(TrendMetric, metric)


def parse_kode_bps(raw_values: Iterable[str] | None) -> list[str]:
    """Parse kode_bps berulang, bracketed, atau comma-separated; deduplikasi sambil jaga urutan."""
    if not raw_values:
        return []
    terlihat: set[str] = set()
    hasil: list[str] = []
    for raw in raw_values:
        for bagian in raw.split(","):
            kode = bagian.strip()
            if kode and kode not in terlihat:
                terlihat.add(kode)
                hasil.append(kode)
    if len(hasil) > MAKS_KODE_BPS:
        raise AppError(
            "INVALID_PARAMS",
            400,
            f"Maksimal {MAKS_KODE_BPS} kode provinsi diperbolehkan",
            {"kode_bps": hasil, "maksimal": MAKS_KODE_BPS},
        )
    return hasil


def ambil_meta_provinsi(db: Session, codes: list[str]) -> list[TrendProvinceMeta]:
    """Validasi semua kode_bps ada di tabel provinces dan kembalikan metadata terurut sesuai permintaan."""
    if not codes:
        return []
    rows = db.execute(
        select(Province.kode_bps, Province.nama).where(Province.kode_bps.in_(codes))
    ).all()
    nama_by_kode = {kode: nama for kode, nama in rows}
    tidak_dikenal = [kode for kode in codes if kode not in nama_by_kode]
    if tidak_dikenal:
        raise AppError(
            "INVALID_PARAMS",
            400,
            "Kode provinsi tidak dikenal",
            {"kode_bps": tidak_dikenal},
        )
    return [TrendProvinceMeta(kode_bps=kode, nama=nama_by_kode[kode]) for kode in codes]


def _nilai_nasional(agg: tuple[Decimal, Decimal, Decimal], metric: TrendMetric) -> float:
    prod, keb, bal = agg
    if metric == "produksi":
        return bulatkan_ton(prod)
    if metric == "kebutuhan":
        return bulatkan_ton(keb)
    if metric == "balance":
        return bulatkan_ton(bal)
    return round(float(prod) / float(keb), 4) if keb > 0 else 0.0


def _nilai_provinsi(stat: ProvinceStat | None, metric: TrendMetric) -> float | None:
    if stat is None:
        return None
    if metric == "produksi":
        return bulatkan_ton(stat.produksi_beras_ton)
    if metric == "kebutuhan":
        return bulatkan_ton(stat.kebutuhan_beras_ton)
    if metric == "balance":
        return bulatkan_ton(stat.rice_balance_ton)
    return round(float(stat.rasio_swasembada), 4)


def bangun_trends(
    db: Session,
    published: list[DatasetVersion],
    metric: TrendMetric,
    codes: list[str],
    meta: list[TrendProvinceMeta],
) -> TrendsResponse:
    """Bangun deret tren nasional dan per provinsi across seluruh tahun published urut naik."""
    tahun_tersedia = [v.tahun for v in published]
    if len(published) < 2:
        return TrendsResponse(
            metric=metric,
            butuh_minimal_2_tahun=True,
            alasan=ALASAN_MIN_DUA_TAHUN,
            tahun_tersedia=tahun_tersedia,
            deret=[],
            provinsi_meta=[],
        )

    version_ids = [v.id for v in published]
    agg_rows = db.execute(
        select(
            ProvinceStat.version_id,
            func.coalesce(func.sum(ProvinceStat.produksi_beras_ton), 0),
            func.coalesce(func.sum(ProvinceStat.kebutuhan_beras_ton), 0),
            func.coalesce(func.sum(ProvinceStat.rice_balance_ton), 0),
        )
        .where(ProvinceStat.version_id.in_(version_ids))
        .group_by(ProvinceStat.version_id)
    ).all()
    agg_by_version = {
        vid: (Decimal(prod), Decimal(keb), Decimal(bal))
        for vid, prod, keb, bal in agg_rows
    }

    stat_by_key: dict[tuple, ProvinceStat] = {}
    if codes:
        stats = db.scalars(
            select(ProvinceStat).where(
                ProvinceStat.version_id.in_(version_ids),
                ProvinceStat.kode_bps.in_(codes),
            )
        ).all()
        stat_by_key = {(s.version_id, s.kode_bps): s for s in stats}

    nol = (Decimal(0), Decimal(0), Decimal(0))
    deret = [
        TrendPoint(
            tahun=v.tahun,
            nasional=_nilai_nasional(agg_by_version.get(v.id, nol), metric),
            per_provinsi={
                kode: _nilai_provinsi(stat_by_key.get((v.id, kode)), metric)
                for kode in codes
            },
        )
        for v in published
    ]

    return TrendsResponse(
        metric=metric,
        butuh_minimal_2_tahun=False,
        alasan=None,
        tahun_tersedia=tahun_tersedia,
        deret=deret,
        provinsi_meta=meta,
    )


def _delta_persen(delta: float, base: float) -> float | None:
    if base == 0:
        return None
    return round((delta / base) * 100, 2)


def _ringkas_tahun(stats: Iterable[ProvinceStat]) -> tuple[Decimal, Decimal, Decimal, dict[str, int]]:
    prod = Decimal(0)
    keb = Decimal(0)
    bal = Decimal(0)
    counts = {"surplus": 0, "defisit": 0, "balanced": 0}
    for s in stats:
        prod += Decimal(s.produksi_beras_ton)
        keb += Decimal(s.kebutuhan_beras_ton)
        bal += Decimal(s.rice_balance_ton)
        if s.status in counts:
            counts[s.status] += 1
    return prod, keb, bal, counts


def compare_gating_response() -> CompareResponse:
    return CompareResponse(
        tahun_a=None,
        tahun_b=None,
        butuh_minimal_2_tahun=True,
        alasan=ALASAN_MIN_DUA_TAHUN,
        nasional=None,
        items=[],
        status_berubah=[],
    )


def bangun_compare(
    db: Session,
    versi_a: DatasetVersion,
    versi_b: DatasetVersion,
) -> CompareResponse:
    """Bandingkan agregat nasional, metrik 38 provinsi, dan perubahan status antara versi_a dan versi_b."""
    rows = db.execute(
        select(ProvinceStat, Province)
        .join(Province, Province.kode_bps == ProvinceStat.kode_bps)
        .where(ProvinceStat.version_id.in_([versi_a.id, versi_b.id]))
    ).all()

    stats_a: dict[str, ProvinceStat] = {}
    stats_b: dict[str, ProvinceStat] = {}
    prov_map: dict[str, Province] = {}
    for stat, prov in rows:
        prov_map[stat.kode_bps] = prov
        if stat.version_id == versi_a.id:
            stats_a[stat.kode_bps] = stat
        else:
            stats_b[stat.kode_bps] = stat

    prod_a_dec, keb_a_dec, bal_a_dec, counts_a = _ringkas_tahun(stats_a.values())
    prod_b_dec, keb_b_dec, bal_b_dec, counts_b = _ringkas_tahun(stats_b.values())

    produksi_a_nat = bulatkan_ton(prod_a_dec)
    produksi_b_nat = bulatkan_ton(prod_b_dec)
    delta_produksi_nat = bulatkan_ton(prod_b_dec - prod_a_dec)
    nasional = CompareNationalSummary(
        produksi_a=produksi_a_nat,
        produksi_b=produksi_b_nat,
        delta_produksi=delta_produksi_nat,
        delta_produksi_persen=_delta_persen(delta_produksi_nat, produksi_a_nat),
        kebutuhan_a=bulatkan_ton(keb_a_dec),
        kebutuhan_b=bulatkan_ton(keb_b_dec),
        delta_kebutuhan=bulatkan_ton(keb_b_dec - keb_a_dec),
        balance_a=bulatkan_ton(bal_a_dec),
        balance_b=bulatkan_ton(bal_b_dec),
        delta_balance=bulatkan_ton(bal_b_dec - bal_a_dec),
        surplus_count_a=counts_a["surplus"],
        surplus_count_b=counts_b["surplus"],
        defisit_count_a=counts_a["defisit"],
        defisit_count_b=counts_b["defisit"],
        balanced_count_a=counts_a["balanced"],
        balanced_count_b=counts_b["balanced"],
    )

    semua_kode = sorted(prov_map, key=lambda kode: (prov_map[kode].nama.lower(), kode))
    items: list[CompareProvinceItem] = []
    status_berubah: list[CompareStatusChange] = []

    for kode in semua_kode:
        prov = prov_map[kode]
        sa = stats_a.get(kode)
        sb = stats_b.get(kode)

        prod_a = bulatkan_ton(sa.produksi_beras_ton) if sa is not None else None
        prod_b = bulatkan_ton(sb.produksi_beras_ton) if sb is not None else None
        keb_a = bulatkan_ton(sa.kebutuhan_beras_ton) if sa is not None else None
        keb_b = bulatkan_ton(sb.kebutuhan_beras_ton) if sb is not None else None
        bal_a = bulatkan_ton(sa.rice_balance_ton) if sa is not None else None
        bal_b = bulatkan_ton(sb.rice_balance_ton) if sb is not None else None
        rasio_a = round(float(sa.rasio_swasembada), 4) if sa is not None else None
        rasio_b = round(float(sb.rasio_swasembada), 4) if sb is not None else None

        delta_prod: float | None = None
        delta_prod_persen: float | None = None
        delta_keb: float | None = None
        delta_bal: float | None = None
        delta_rasio: float | None = None

        if sa is not None and sb is not None and prod_a is not None:
            delta_prod = bulatkan_ton(Decimal(sb.produksi_beras_ton) - Decimal(sa.produksi_beras_ton))
            delta_prod_persen = _delta_persen(delta_prod, prod_a)
            delta_keb = bulatkan_ton(Decimal(sb.kebutuhan_beras_ton) - Decimal(sa.kebutuhan_beras_ton))
            delta_bal = bulatkan_ton(Decimal(sb.rice_balance_ton) - Decimal(sa.rice_balance_ton))
            delta_rasio = round(float(Decimal(sb.rasio_swasembada) - Decimal(sa.rasio_swasembada)), 4)

            if sa.status != sb.status:
                status_berubah.append(
                    CompareStatusChange(
                        kode_bps=kode,
                        nama=prov.nama,
                        status_a=sa.status,
                        status_b=sb.status,
                        delta_produksi=delta_prod,
                        delta_balance=delta_bal,
                    )
                )

        items.append(
            CompareProvinceItem(
                kode_bps=kode,
                nama=prov.nama,
                pulau=prov.pulau,
                status_a=sa.status if sa is not None else None,
                status_b=sb.status if sb is not None else None,
                produksi_a=prod_a,
                produksi_b=prod_b,
                delta_produksi=delta_prod,
                delta_produksi_persen=delta_prod_persen,
                kebutuhan_a=keb_a,
                kebutuhan_b=keb_b,
                delta_kebutuhan=delta_keb,
                balance_a=bal_a,
                balance_b=bal_b,
                delta_balance=delta_bal,
                rasio_a=rasio_a,
                rasio_b=rasio_b,
                delta_rasio=delta_rasio,
            )
        )

    return CompareResponse(
        tahun_a=versi_a.tahun,
        tahun_b=versi_b.tahun,
        butuh_minimal_2_tahun=False,
        alasan=None,
        nasional=nasional,
        items=items,
        status_berubah=status_berubah,
    )
