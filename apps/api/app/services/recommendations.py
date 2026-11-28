"""Rekomendasi distribusi resmi dan simulasi skenario on-the-fly (T6.2, T6.3, T6.4)."""
from __future__ import annotations

from riceguard_calc import MatchParams, match_detail
from sqlalchemy import func, select
from sqlalchemy.orm import Session, aliased

from app.core.errors import AppError
from app.core.rounding import bulatkan_ton
from app.db.models import DatasetVersion, DistributionRecommendation, Province, ProvinceStat
from app.schemas.recommendations import (
    RecommendationItem,
    RecommendationsResponse,
    RecommendationSummary,
    SimulatedProvinceItem,
    SimulationComparison,
    SimulationRequest,
    SimulationResponse,
    StatusChangeItem,
    UnmetDeficitItem,
)
from app.services.explain import kalimat_rekomendasi


def _persen(ton: float, kebutuhan: float | None) -> float | None:
    if not kebutuhan:
        return None
    return round(ton / kebutuhan * 100, 2)


def _muat_stat_provinsi(db: Session, versi: DatasetVersion) -> list[tuple[ProvinceStat, Province]]:
    stmt = (
        select(ProvinceStat, Province)
        .join(Province, Province.kode_bps == ProvinceStat.kode_bps)
        .where(ProvinceStat.version_id == versi.id)
        .order_by(ProvinceStat.kode_bps.asc())
    )
    return list(db.execute(stmt).all())


def _ke_masukan_matching(rows: list[tuple[ProvinceStat, Province]]) -> list[dict]:
    return [
        {
            "kode": stat.kode_bps,
            "nama": prov.nama,
            "pulau": prov.pulau,
            "lat": float(prov.lat),
            "lng": float(prov.lng),
            "penduduk_jiwa": int(stat.penduduk_jiwa),
            "konsumsi_kg_kapita_tahun": float(stat.konsumsi_kg_kapita_tahun),
            "produksi_beras_ton": float(stat.produksi_beras_ton),
            "kebutuhan_beras_ton": float(stat.kebutuhan_beras_ton),
            "balance": float(stat.rice_balance_ton),
            "rasio_swasembada": float(stat.rasio_swasembada),
            "status": stat.status,
        }
        for stat, prov in rows
    ]


def _ringkasan_rekomendasi(
    items: list[RecommendationItem],
    total_defisit: float,
) -> RecommendationSummary:
    total_ton = sum(item.ton for item in items)
    total_ton_km = sum(item.ton * item.jarak_km for item in items)
    return RecommendationSummary(
        total_dialokasikan_ton=bulatkan_ton(total_ton),
        persen_defisit_tertutup=(
            round(total_ton / total_defisit * 100, 2) if total_defisit else None
        ),
        jumlah_pasangan=len(items),
        rata_jarak_tertimbang_ton=round(total_ton_km / total_ton, 2) if total_ton else None,
        total_ton_km=bulatkan_ton(total_ton_km),
    )


def validasi_mode_simulasi(mode: str) -> None:
    if mode == "optimal":
        raise AppError(
            "INVALID_PARAMS",
            400,
            "Mode optimal belum diimplementasikan",
            {"alasan": "mode optimal belum diimplementasikan"},
        )
    if mode != "greedy_v1":
        raise AppError(
            "INVALID_PARAMS",
            400,
            "Mode algoritma tidak dikenal",
            {"mode": mode, "pilihan": ["greedy_v1"]},
        )


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

    meta_replay: dict[tuple[str, str], dict] = {}
    if any(not rec.explanation for rec, *_ in baris):
        stat_rows = _muat_stat_provinsi(db, versi)
        detail_rows, _ = match_detail(_ke_masukan_matching(stat_rows))
        meta_replay = {(m["dari_kode"], m["ke_kode"]): m for m in detail_rows}

    items: list[RecommendationItem] = []
    for rec, dari_nama, dari_pulau, ke_nama, ke_pulau in baris:
        ton = bulatkan_ton(rec.ton)
        jarak = round(float(rec.jarak_km), 1)
        persen = _persen(ton, float(kebutuhan[rec.ke_kode]) if rec.ke_kode in kebutuhan else None)

        explanation = rec.explanation
        if not explanation:
            meta = meta_replay.get((rec.dari_kode, rec.ke_kode))
            if meta is not None:
                explanation = kalimat_rekomendasi(
                    dari=dari_nama,
                    ke=ke_nama,
                    ton=ton,
                    jarak_km=jarak,
                    persen_kebutuhan=persen,
                    n=meta["peringkat_jarak"],
                    sisa_sebelum=meta["sisa_sebelum"],
                    defisit_penerima=meta["defisit_penerima"],
                )
            else:
                explanation = kalimat_rekomendasi(
                    dari=dari_nama,
                    ke=ke_nama,
                    ton=ton,
                    jarak_km=jarak,
                    persen_kebutuhan=persen,
                )

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
                explanation=explanation,
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
        ringkasan=_ringkasan_rekomendasi(items, float(total_defisit or 0)),
        items=items,
    )


def simulasi_rekomendasi(
    db: Session,
    versi: DatasetVersion,
    req: SimulationRequest,
) -> SimulationResponse:
    """Hitung rekomendasi skenario simulasi tanpa menulis ke database maupun cache."""
    validasi_mode_simulasi(req.mode)

    stat_rows = _muat_stat_provinsi(db, versi)
    params = MatchParams(
        ambang_swasembada=req.ambang_swasembada,
        persen_surplus_dilepas=req.persen_surplus_dilepas,
        jarak_maks_km=req.jarak_maks_km,
        kecualikan_pemasok=tuple(req.kecualikan_pemasok),
        kecualikan_penerima=tuple(req.kecualikan_penerima),
        perubahan_produksi=dict(req.perubahan_produksi),
        perubahan_konsumsi_persen=req.perubahan_konsumsi_persen,
    )
    detail_rows, sim_provs = match_detail(_ke_masukan_matching(stat_rows), params)

    pulau_map = {stat.kode_bps: prov.pulau for stat, prov in stat_rows}
    sim_map = {sp["kode"]: sp for sp in sim_provs}

    rekomendasi: list[RecommendationItem] = []
    terpenuhi: dict[str, float] = {}
    for row in detail_rows:
        ton = bulatkan_ton(row["ton"])
        jarak = round(float(row["jarak_km"]), 1)
        ke_keb = sim_map[row["ke_kode"]]["kebutuhan_beras_ton"]
        persen = _persen(ton, ke_keb)
        terpenuhi[row["ke_kode"]] = terpenuhi.get(row["ke_kode"], 0.0) + ton

        rekomendasi.append(
            RecommendationItem(
                urutan=row["urutan"],
                dari_kode=row["dari_kode"],
                dari=row["dari"],
                ke_kode=row["ke_kode"],
                ke=row["ke"],
                ton=ton,
                jarak_km=jarak,
                persen_kebutuhan_penerima=persen,
                satu_pulau=pulau_map[row["dari_kode"]] == pulau_map[row["ke_kode"]],
                explanation=kalimat_rekomendasi(
                    dari=row["dari"],
                    ke=row["ke"],
                    ton=ton,
                    jarak_km=jarak,
                    persen_kebutuhan=persen,
                    n=row["peringkat_jarak"],
                    sisa_sebelum=row["sisa_sebelum"],
                    defisit_penerima=row["defisit_penerima"],
                ),
            )
        )

    provinsi_items = [
        SimulatedProvinceItem(
            kode_bps=sp["kode"],
            provinsi=sp["nama"],
            pulau=sp.get("pulau") or pulau_map[sp["kode"]],
            status=sp["status"],
            produksi_beras_ton=bulatkan_ton(sp["produksi_beras_ton"]),
            kebutuhan_beras_ton=bulatkan_ton(sp["kebutuhan_beras_ton"]),
            rice_balance_ton=bulatkan_ton(sp["rice_balance_ton"]),
            rasio_swasembada=float(sp["rasio_swasembada"]),
        )
        for sp in sim_provs
    ]

    total_defisit_sim = sum(
        abs(sp["rice_balance_ton"]) for sp in sim_provs if sp["status"] == "defisit"
    )
    ringkasan = _ringkasan_rekomendasi(rekomendasi, total_defisit_sim)

    resmi_rows = db.execute(
        select(DistributionRecommendation.ton, DistributionRecommendation.jarak_km).where(
            DistributionRecommendation.version_id == versi.id
        )
    ).all()
    resmi_ton = sum(bulatkan_ton(ton) for ton, _ in resmi_rows)
    resmi_ton_km = sum(bulatkan_ton(ton) * round(float(jarak), 1) for ton, jarak in resmi_rows)

    status_berubah = [
        StatusChangeItem(
            kode_bps=stat.kode_bps,
            provinsi=prov.nama,
            dari=stat.status,
            ke=sim_map[stat.kode_bps]["status"],
        )
        for stat, prov in stat_rows
        if sim_map[stat.kode_bps]["status"] != stat.status
    ]

    defisit_tidak_tertutup: list[UnmetDeficitItem] = []
    for sp in sim_provs:
        if sp["status"] != "defisit":
            continue
        defisit_ton = bulatkan_ton(abs(sp["rice_balance_ton"]))
        terpenuhi_ton = bulatkan_ton(terpenuhi.get(sp["kode"], 0.0))
        sisa_defisit_ton = bulatkan_ton(max(0.0, defisit_ton - terpenuhi_ton))
        if sisa_defisit_ton > 0:
            defisit_tidak_tertutup.append(
                UnmetDeficitItem(
                    kode_bps=sp["kode"],
                    provinsi=sp["nama"],
                    defisit_ton=defisit_ton,
                    terpenuhi_ton=terpenuhi_ton,
                    sisa_defisit_ton=sisa_defisit_ton,
                )
            )
    defisit_tidak_tertutup.sort(key=lambda item: (-item.sisa_defisit_ton, item.kode_bps))

    return SimulationResponse(
        tahun=versi.tahun,
        version={"id": str(versi.id), "version_no": versi.version_no},
        rekomendasi=rekomendasi,
        provinsi=provinsi_items,
        ringkasan=ringkasan,
        banding_resmi=SimulationComparison(
            delta_ton=bulatkan_ton(ringkasan.total_dialokasikan_ton - resmi_ton),
            delta_ton_km=bulatkan_ton(ringkasan.total_ton_km - resmi_ton_km),
            status_berubah=status_berubah,
            defisit_tidak_tertutup=defisit_tidak_tertutup,
        ),
    )
