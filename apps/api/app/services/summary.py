"""Agregat nasional per versi dataset.

`dataset_versions.summary` adalah sumber utama: Landing dan Dashboard tidak boleh
mengagregasi ulang 38 baris di setiap request (PRD bagian 9). Kalau kolom itu kosong
atau belum memuat bagian yang diminta, agregat dihitung dari `province_stats` lalu
disimpan supaya PDF, grafik, dan API memakai angka yang sama.
"""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.rounding import bulatkan_ton
from app.db.models import (
    DatasetVersion,
    DistributionRecommendation,
    Province,
    ProvinceStat,
)
from app.schemas.summary import DeltaSummary, PulauBreakdown, SummaryResponse


def _persen(baru: float, lama: float) -> float | None:
    """Perubahan relatif. Pembagian nol -> None, bukan Infinity."""
    if lama == 0:
        return None
    return round((baru - lama) / abs(lama) * 100, 2)


def _pulau_breakdown(db: Session, version_id) -> list[dict]:
    total_produksi, total_kebutuhan = db.execute(
        select(
            func.coalesce(func.sum(ProvinceStat.produksi_beras_ton), 0),
            func.coalesce(func.sum(ProvinceStat.kebutuhan_beras_ton), 0),
        ).where(ProvinceStat.version_id == version_id)
    ).one()

    baris = db.execute(
        select(
            Province.pulau,
            func.sum(ProvinceStat.produksi_beras_ton),
            func.sum(ProvinceStat.kebutuhan_beras_ton),
            func.count(ProvinceStat.kode_bps),
        )
        .join(Province, Province.kode_bps == ProvinceStat.kode_bps)
        .where(ProvinceStat.version_id == version_id)
        .group_by(Province.pulau)
        .order_by(func.sum(ProvinceStat.produksi_beras_ton).desc())
    ).all()

    hasil = []
    for pulau, produksi, kebutuhan, jumlah in baris:
        produksi = float(produksi)
        kebutuhan = float(kebutuhan)
        hasil.append(
            {
                "pulau": pulau,
                "produksi_beras_ton": round(produksi, 2),
                "kebutuhan_beras_ton": round(kebutuhan, 2),
                "porsi_produksi": round(produksi / float(total_produksi), 4) if total_produksi else 0.0,
                "porsi_kebutuhan": round(kebutuhan / float(total_kebutuhan), 4) if total_kebutuhan else 0.0,
                "jumlah_provinsi": int(jumlah),
            }
        )
    return hasil


def _hitung_summary(db: Session, versi: DatasetVersion) -> dict:
    """Hitung ulang seluruh agregat dari `province_stats` + rekomendasi versi ini."""
    produksi, kebutuhan, balance = db.execute(
        select(
            func.coalesce(func.sum(ProvinceStat.produksi_beras_ton), 0),
            func.coalesce(func.sum(ProvinceStat.kebutuhan_beras_ton), 0),
            func.coalesce(func.sum(ProvinceStat.rice_balance_ton), 0),
        ).where(ProvinceStat.version_id == versi.id)
    ).one()

    status = dict(
        db.execute(
            select(ProvinceStat.status, func.count())
            .where(ProvinceStat.version_id == versi.id)
            .group_by(ProvinceStat.status)
        ).all()
    )
    dialokasikan = db.execute(
        select(func.coalesce(func.sum(DistributionRecommendation.ton), 0)).where(
            DistributionRecommendation.version_id == versi.id
        )
    ).scalar_one()
    pasangan = db.execute(
        select(func.count()).select_from(DistributionRecommendation).where(
            DistributionRecommendation.version_id == versi.id
        )
    ).scalar_one()

    produksi = float(produksi)
    kebutuhan = float(kebutuhan)
    return {
        "produksi_beras_ton": round(produksi, 2),
        "kebutuhan_beras_ton": round(kebutuhan, 2),
        "rice_balance_ton": round(float(balance), 2),
        "rasio_swasembada": round(produksi / kebutuhan, 4) if kebutuhan else None,
        "jumlah_status": {
            "surplus": int(status.get("surplus", 0)),
            "balanced": int(status.get("balanced", 0)),
            "defisit": int(status.get("defisit", 0)),
        },
        "total_dialokasikan_ton": round(float(dialokasikan), 2),
        "jumlah_pasangan": int(pasangan),
        "pulau_breakdown": _pulau_breakdown(db, versi.id),
    }


def ambil_summary(db: Session, versi: DatasetVersion) -> dict:
    """Baca `summary` tersimpan; lengkapi yang kosong lalu simpan sekali."""
    tersimpan = dict(versi.summary or {})
    wajib = {"produksi_beras_ton", "kebutuhan_beras_ton", "rice_balance_ton", "jumlah_status"}
    if not wajib <= tersimpan.keys() or "pulau_breakdown" not in tersimpan:
        tersimpan = _hitung_summary(db, versi)
        versi.summary = tersimpan
        db.commit()
    return tersimpan


def delta_tahun_sebelumnya(db: Session, versi: DatasetVersion, summary: dict) -> DeltaSummary | None:
    """Bandingkan dengan tahun published `tahun - 1`; tidak berurutan -> None."""
    sebelumnya = db.scalars(
        select(DatasetVersion).where(
            DatasetVersion.status == "published",
            DatasetVersion.tahun == versi.tahun - 1,
        )
    ).first()
    if sebelumnya is None:
        return None

    lama = dict(sebelumnya.summary or {}) or _hitung_summary(db, sebelumnya)
    produksi_lama = float(lama["produksi_beras_ton"])
    kebutuhan_lama = float(lama["kebutuhan_beras_ton"])
    balance_lama = float(lama["rice_balance_ton"])
    balance_baru = float(summary["rice_balance_ton"])

    return DeltaSummary(
        tahun=sebelumnya.tahun,
        produksi_persen=_persen(float(summary["produksi_beras_ton"]), produksi_lama),
        kebutuhan_persen=_persen(float(summary["kebutuhan_beras_ton"]), kebutuhan_lama),
        balance_ton=round(balance_baru - balance_lama, 2),
        balance_persen=_persen(balance_baru, balance_lama),
    )


def bangun_respons(db: Session, versi: DatasetVersion) -> SummaryResponse:
    summary = ambil_summary(db, versi)
    return SummaryResponse(
        tahun=versi.tahun,
        version={"id": str(versi.id), "version_no": versi.version_no},
        produksi_beras_ton=bulatkan_ton(summary["produksi_beras_ton"]),
        kebutuhan_beras_ton=bulatkan_ton(summary["kebutuhan_beras_ton"]),
        rice_balance_ton=bulatkan_ton(summary["rice_balance_ton"]),
        rasio_swasembada=summary.get("rasio_swasembada"),
        jumlah_status=summary["jumlah_status"],
        total_dialokasikan_ton=bulatkan_ton(summary["total_dialokasikan_ton"]),
        delta_tahun_sebelumnya=delta_tahun_sebelumnya(db, versi, summary),
        pulau_breakdown=[PulauBreakdown(**p) for p in summary.get("pulau_breakdown", [])],
    )
