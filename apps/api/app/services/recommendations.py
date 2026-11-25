"""Rekomendasi distribusi resmi satu versi dataset (T6.3).

Angka dibaca dari `distribution_recommendations`; tidak ada matching di sini.
"""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session, aliased

from app.db.models import DatasetVersion, DistributionRecommendation, Province, ProvinceStat
from app.schemas.recommendations import (
    RecommendationItem,
    RecommendationsResponse,
    RecommendationSummary,
)
from app.services.explain import kalimat_rekomendasi


def _persen(ton: float, kebutuhan: float | None) -> float | None:
    if not kebutuhan:
        return None
    return round(ton / kebutuhan * 100, 2)


def bangun_rekomendasi(
    db: Session,
    versi: DatasetVersion,
    *,
    dari_kode: str | None = None,
    ke_kode: str | None = None,
) -> RecommendationsResponse:
    asal = aliased(Province)
    tujuan = aliased(Province)

    stmt = (
        select(DistributionRecommendation, asal.nama, asal.pulau, tujuan.nama, tujuan.pulau)
        .join(asal, asal.kode_bps == DistributionRecommendation.dari_kode)
        .join(tujuan, tujuan.kode_bps == DistributionRecommendation.ke_kode)
        .where(DistributionRecommendation.version_id == versi.id)
        .order_by(DistributionRecommendation.urutan.asc())
    )
    if dari_kode:
        stmt = stmt.where(DistributionRecommendation.dari_kode == dari_kode)
    if ke_kode:
        stmt = stmt.where(DistributionRecommendation.ke_kode == ke_kode)

    baris = db.execute(stmt).all()

    kebutuhan = dict(
        db.execute(
            select(ProvinceStat.kode_bps, ProvinceStat.kebutuhan_beras_ton).where(
                ProvinceStat.version_id == versi.id
            )
        ).all()
    )

    items: list[RecommendationItem] = []
    total_ton = 0.0
    total_ton_km = 0.0

    for rec, dari_nama, dari_pulau, ke_nama, ke_pulau in baris:
        ton = float(rec.ton)
        jarak = float(rec.jarak_km)
        persen = _persen(ton, float(kebutuhan[rec.ke_kode]) if rec.ke_kode in kebutuhan else None)

        total_ton += ton
        total_ton_km += ton * jarak

        items.append(
            RecommendationItem(
                urutan=rec.urutan,
                dari_kode=rec.dari_kode,
                dari=dari_nama,
                ke_kode=rec.ke_kode,
                ke=ke_nama,
                ton=ton,
                jarak_km=jarak,
                persen_kebutuhan_penerima=persen,
                satu_pulau=dari_pulau == ke_pulau,
                explanation=rec.explanation
                or kalimat_rekomendasi(
                    dari=dari_nama,
                    ke=ke_nama,
                    ton=ton,
                    jarak_km=jarak,
                    persen_kebutuhan=persen,
                ),
            )
        )

    total_defisit = db.scalar(
        select(func.coalesce(func.sum(func.abs(ProvinceStat.rice_balance_ton)), 0)).where(
            ProvinceStat.version_id == versi.id,
            ProvinceStat.status == "defisit",
            ProvinceStat.kode_bps.in_({rec.ke_kode for rec, *_ in baris} or {""}),
        )
    )

    return RecommendationsResponse(
        tahun=versi.tahun,
        version={"id": str(versi.id), "version_no": versi.version_no},
        ringkasan=RecommendationSummary(
            total_dialokasikan_ton=round(total_ton, 2),
            persen_defisit_tertutup=(
                round(total_ton / float(total_defisit) * 100, 2) if float(total_defisit) else None
            ),
            jumlah_pasangan=len(items),
            rata_jarak_tertimbang_ton=round(total_ton_km / total_ton, 2) if total_ton else None,
            total_ton_km=round(total_ton_km, 2),
        ),
        items=items,
    )
