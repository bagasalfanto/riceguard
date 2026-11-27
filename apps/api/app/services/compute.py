"""Hitung dan simpan hasil turunan dari satu set baris provinsi."""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

import pandas as pd
from riceguard_calc import build, match_detail
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.rounding import bulatkan_ton
from app.db.models import (
    DatasetVersion,
    DistributionRecommendation,
    Province,
    ProvinceStat,
)
from app.services.explain import kalimat_rekomendasi
from app.services.ingest import referensi_from_db
from app.services.validation import validasi


@dataclass(slots=True)
class ComputedDataset:
    df: pd.DataFrame
    recommendations: list[dict[str, Any]]
    validation: dict[str, Any]
    summary: dict[str, Any]


def _pulau_breakdown_df(df: pd.DataFrame) -> list[dict[str, Any]]:
    if "pulau" not in df.columns or df.empty:
        return []
    total_produksi = float(df["produksi_beras_ton"].sum())
    total_kebutuhan = float(df["kebutuhan_beras_ton"].sum())
    grouped = (
        df.groupby("pulau", as_index=False)
        .agg(
            produksi_beras_ton=("produksi_beras_ton", "sum"),
            kebutuhan_beras_ton=("kebutuhan_beras_ton", "sum"),
            jumlah_provinsi=("kode_bps", "count"),
        )
        .sort_values("produksi_beras_ton", ascending=False)
    )
    hasil: list[dict[str, Any]] = []
    for r in grouped.itertuples():
        prod = float(r.produksi_beras_ton)
        keb = float(r.kebutuhan_beras_ton)
        hasil.append(
            {
                "pulau": r.pulau,
                "produksi_beras_ton": round(prod, 2),
                "kebutuhan_beras_ton": round(keb, 2),
                "porsi_produksi": round(prod / total_produksi, 4) if total_produksi else 0.0,
                "porsi_kebutuhan": round(keb / total_kebutuhan, 4) if total_kebutuhan else 0.0,
                "jumlah_provinsi": int(r.jumlah_provinsi),
            }
        )
    return hasil


def summary_nasional(df: pd.DataFrame, rekomendasi: list[dict]) -> dict:
    """Agregat nasional untuk dataset_versions.summary; Dashboard dan Landing cukup baca ini."""
    produksi = float(df["produksi_beras_ton"].sum())
    kebutuhan = float(df["kebutuhan_beras_ton"].sum())
    balance = float(df["rice_balance_ton"].sum())
    jumlah = df["status"].value_counts().to_dict()
    return {
        "produksi_beras_ton": round(produksi, 2),
        "kebutuhan_beras_ton": round(kebutuhan, 2),
        "rice_balance_ton": round(balance, 2),
        "rasio_swasembada": round(produksi / kebutuhan, 4) if kebutuhan else None,
        "jumlah_status": {
            "surplus": int(jumlah.get("surplus", 0)),
            "balanced": int(jumlah.get("balanced", 0)),
            "defisit": int(jumlah.get("defisit", 0)),
        },
        "total_dialokasikan_ton": round(sum(r["ton"] for r in rekomendasi), 2),
        "jumlah_pasangan": len(rekomendasi),
        "pulau_breakdown": _pulau_breakdown_df(df),
    }


def latest_published_frame(db: Session, tahun: int) -> pd.DataFrame | None:
    """Ambil baris produksi versi published untuk tahun sama sebagai pembanding rule 5."""
    versi_lama = db.scalars(
        select(DatasetVersion).where(
            DatasetVersion.tahun == tahun,
            DatasetVersion.status == "published",
        )
    ).first()
    if versi_lama is None:
        return None
    rows = db.execute(
        select(ProvinceStat.kode_bps, ProvinceStat.produksi_beras_ton).where(
            ProvinceStat.version_id == versi_lama.id
        )
    ).all()
    if not rows:
        return None
    return pd.DataFrame(
        [{"kode_bps": kode, "produksi_beras_ton": float(prod)} for kode, prod in rows]
    )


def extract_acuan_from_validation(validation_data: dict | None) -> dict[str, float | None]:
    """Pertahankan acuan baris 'Indonesia' BPS dari hasil validasi versi yang sudah tersimpan."""
    acuan: dict[str, float | None] = {
        "produksi_beras_ton": None,
        "produksi_padi_ton_gkg": None,
        "penduduk_jiwa": None,
    }
    if not isinstance(validation_data, dict):
        return acuan
    for rule in validation_data.get("aturan") or []:
        if not isinstance(rule, dict):
            continue
        detail = rule.get("detail")
        if not isinstance(detail, dict) or "acuan_bps" not in detail:
            continue
        kode = rule.get("kode")
        if kode == "total_produksi" and detail["acuan_bps"] is not None:
            acuan["produksi_beras_ton"] = float(detail["acuan_bps"])
        elif kode == "total_penduduk" and detail["acuan_bps"] is not None:
            acuan["penduduk_jiwa"] = float(detail["acuan_bps"])
    return acuan


def upsert_provinces_from_ref(db: Session, referensi: pd.DataFrame) -> None:
    """Upsert referensi provinsi ke tabel `provinces`."""
    baris = [
        {
            "kode_bps": r.kode_bps,
            "kode_kemendagri": r.kode_kemendagri,
            "nama": r.provinsi,
            "pulau": r.pulau,
            "lat": Decimal(str(r.lat)),
            "lng": Decimal(str(r.lng)),
        }
        for r in referensi.itertuples()
    ]
    stmt = insert(Province).values(baris)
    stmt = stmt.on_conflict_do_update(
        index_elements=["kode_bps"],
        set_={
            "kode_kemendagri": stmt.excluded.kode_kemendagri,
            "nama": stmt.excluded.nama,
            "pulau": stmt.excluded.pulau,
            "lat": stmt.excluded.lat,
            "lng": stmt.excluded.lng,
        },
    )
    db.execute(stmt)


def run_dataset_pipeline(
    ref_df: pd.DataFrame,
    produksi_df: pd.DataFrame,
    penduduk_df: pd.DataFrame,
    konsumsi_df: pd.DataFrame,
    tahun: int,
    acuan_indonesia: dict,
    *,
    sebelumnya_df: pd.DataFrame | None = None,
) -> ComputedDataset:
    """Jalankan pipeline penuh: build() -> match_detail() -> explain -> validasi -> summary."""
    try:
        df = build(ref_df, produksi_df, penduduk_df, konsumsi_df, tahun)
    except (ValueError, ArithmeticError) as exc:
        val_fail = {
            "lulus": False,
            "aturan": [
                {
                    "kode": "jumlah_provinsi",
                    "label": "Tepat 38 provinsi dan cocok referensi",
                    "status": "gagal",
                    "detail": {"pesan": str(exc)},
                }
            ],
        }
        raise AppError(
            "VALIDATION_FAILED",
            422,
            "Validasi dataset gagal",
            {"validasi": val_fail},
        ) from exc

    df = df.sort_values("kode_bps").reset_index(drop=True)
    pulau_map = {r.kode_bps: r.pulau for r in df.itertuples()}
    kebutuhan_map = {r.kode_bps: float(r.kebutuhan_beras_ton) for r in df.itertuples()}

    masukan_matching = [
        {
            "kode": r.kode_bps,
            "nama": r.provinsi,
            "pulau": r.pulau,
            "lat": float(r.lat),
            "lng": float(r.lng),
            "penduduk_jiwa": int(r.penduduk_jiwa),
            "konsumsi_kg_kapita_tahun": float(r.konsumsi_kg_kapita_tahun),
            "produksi_beras_ton": float(r.produksi_beras_ton),
            "kebutuhan_beras_ton": float(r.kebutuhan_beras_ton),
            "balance": float(r.rice_balance_ton),
            "rasio_swasembada": float(r.rasio_swasembada),
            "status": r.status,
        }
        for r in df.itertuples()
    ]
    detail_rows, _ = match_detail(masukan_matching)

    recommendations: list[dict[str, Any]] = []
    for row in detail_rows:
        ton = bulatkan_ton(row["ton"])
        jarak = round(float(row["jarak_km"]), 1)
        ke_keb = kebutuhan_map.get(row["ke_kode"])
        persen = round(ton / ke_keb * 100, 2) if ke_keb else None
        explanation = kalimat_rekomendasi(
            dari=row["dari"],
            ke=row["ke"],
            ton=ton,
            jarak_km=jarak,
            persen_kebutuhan=persen,
            n=row["peringkat_jarak"],
            sisa_sebelum=row["sisa_sebelum"],
            defisit_penerima=row["defisit_penerima"],
        )
        recommendations.append(
            {
                "urutan": row["urutan"],
                "dari_kode": row["dari_kode"],
                "dari": row["dari"],
                "ke_kode": row["ke_kode"],
                "ke": row["ke"],
                "ton": ton,
                "jarak_km": jarak,
                "persen_kebutuhan_penerima": persen,
                "satu_pulau": pulau_map[row["dari_kode"]] == pulau_map[row["ke_kode"]],
                "explanation": explanation,
            }
        )

    val_result = validasi(df, acuan_indonesia, sebelumnya=sebelumnya_df)
    ringkasan = summary_nasional(df, detail_rows)

    return ComputedDataset(
        df=df,
        recommendations=recommendations,
        validation=val_result,
        summary=ringkasan,
    )


def recompute_draft_version(db: Session, versi: DatasetVersion) -> ComputedDataset:
    """Hitung ulang penuh seluruh 38 provinsi + rekomendasi + ringkasan + validasi untuk draft."""
    ref_df = referensi_from_db(db)
    rows = db.execute(
        select(ProvinceStat, Province)
        .join(Province, Province.kode_bps == ProvinceStat.kode_bps)
        .where(ProvinceStat.version_id == versi.id)
        .order_by(ProvinceStat.kode_bps.asc())
    ).all()

    produksi_df = pd.DataFrame(
        [
            {
                "provinsi": prov.nama,
                "produksi_padi_ton_gkg": float(stat.produksi_padi_ton_gkg),
                "produksi_beras_ton": float(stat.produksi_beras_ton),
            }
            for stat, prov in rows
        ]
    )
    penduduk_df = pd.DataFrame(
        [{"provinsi": prov.nama, "penduduk_jiwa": int(stat.penduduk_jiwa)} for stat, prov in rows]
    )
    konsumsi_df = pd.DataFrame(
        [
            {
                "kode_kemendagri": prov.kode_kemendagri,
                "provinsi": prov.nama,
                "konsumsi_kg_kapita_tahun": float(stat.konsumsi_kg_kapita_tahun),
            }
            for stat, prov in rows
        ]
    )

    acuan = extract_acuan_from_validation(versi.validation)
    sebelumnya_df = latest_published_frame(db, versi.tahun)
    computed = run_dataset_pipeline(
        ref_df,
        produksi_df,
        penduduk_df,
        konsumsi_df,
        versi.tahun,
        acuan,
        sebelumnya_df=sebelumnya_df,
    )

    stat_by_kode = {stat.kode_bps: stat for stat, _ in rows}
    for r in computed.df.itertuples():
        stat = stat_by_kode[r.kode_bps]
        stat.kebutuhan_beras_ton = Decimal(str(r.kebutuhan_beras_ton))
        stat.rice_balance_ton = Decimal(str(r.rice_balance_ton))
        stat.rasio_swasembada = Decimal(str(r.rasio_swasembada))
        stat.status = r.status

    db.execute(
        delete(DistributionRecommendation).where(DistributionRecommendation.version_id == versi.id)
    )
    db.flush()

    db.add_all(
        [
            DistributionRecommendation(
                version_id=versi.id,
                urutan=rec["urutan"],
                dari_kode=rec["dari_kode"],
                ke_kode=rec["ke_kode"],
                ton=Decimal(str(rec["ton"])),
                jarak_km=Decimal(str(rec["jarak_km"])),
                explanation=rec["explanation"],
            )
            for rec in computed.recommendations
        ]
    )

    versi.summary = computed.summary
    versi.validation = computed.validation
    db.flush()
    return computed
