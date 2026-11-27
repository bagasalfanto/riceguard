"""Proxy prediksi produksi AI ke endpoint eksternal (PRD §5.10, ADR 0001)."""
from __future__ import annotations

from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import AppError, no_published_version
from app.core.rounding import bulatkan_ton
from app.db.models import DatasetVersion, Province, ProvinceStat
from app.schemas.forecast import ForecastItem, ForecastModelInfo, ForecastResponse
from app.services.versions import resolve_for_read, resolve_published


def _resolve_basis_versi(
    db: Session,
    *,
    tahun: int | None,
    version_id: str | None,
    admin: Any,
) -> tuple[DatasetVersion, int]:
    """Tentukan versi dataset sumber fitur dan tahun target prediksi.

    Jika `tahun` lebih besar dari tahun published terbaru (misalnya 2026 saat
    data resmi baru sampai 2025), fitur diambil dari versi published terbaru.
    """
    if version_id and admin is not None:
        versi = resolve_for_read(db, tahun=tahun, version_id=version_id, admin=admin)
        target_tahun = tahun if tahun is not None else versi.tahun + 1
        return versi, target_tahun

    if tahun is None:
        versi = resolve_published(db, tahun=None)
        return versi, versi.tahun + 1

    try:
        versi = resolve_published(db, tahun=tahun)
    except AppError:
        terbaru = resolve_published(db, tahun=None)
        if tahun > terbaru.tahun:
            return terbaru, tahun
        raise no_published_version(tahun) from None
    return versi, tahun


def _bangun_payload(
    db: Session, versi: DatasetVersion, target_tahun: int
) -> tuple[dict[str, Any], list[str], dict[str, str]]:
    rows = db.execute(
        select(ProvinceStat, Province)
        .join(Province, Province.kode_bps == ProvinceStat.kode_bps)
        .where(ProvinceStat.version_id == versi.id)
        .order_by(ProvinceStat.kode_bps.asc())
    ).all()

    provinsi_payload: list[dict[str, Any]] = []
    official_codes: list[str] = []
    official_names: dict[str, str] = {}

    for stat, prov in rows:
        official_codes.append(stat.kode_bps)
        official_names[stat.kode_bps] = prov.nama
        provinsi_payload.append(
            {
                "kode_bps": stat.kode_bps,
                "provinsi": prov.nama,
                "penduduk_jiwa": int(stat.penduduk_jiwa),
                "konsumsi_kg_kapita_tahun": round(float(stat.konsumsi_kg_kapita_tahun), 2),
                "produksi_beras_ton": bulatkan_ton(stat.produksi_beras_ton),
                "kebutuhan_beras_ton": bulatkan_ton(stat.kebutuhan_beras_ton),
            }
        )

    return {"tahun": target_tahun, "provinsi": provinsi_payload}, official_codes, official_names


def _upstream_error() -> AppError:
    return AppError(
        "AI_UPSTREAM_ERROR",
        502,
        "Endpoint prediksi model gagal merespons",
    )


def _parse_upstream_response(
    raw: Any,
    *,
    target_tahun: int,
    official_codes: list[str],
    official_names: dict[str, str],
) -> ForecastResponse:
    if not isinstance(raw, dict) or not isinstance(raw.get("items"), list):
        raise _upstream_error()

    try:
        resp_tahun = int(raw.get("tahun", target_tahun))
    except (TypeError, ValueError) as exc:
        raise _upstream_error() from exc

    satuan_raw = raw.get("satuan")
    satuan = str(satuan_raw).strip() if satuan_raw else "ton"

    items: list[ForecastItem] = []
    for entry in raw["items"]:
        if not isinstance(entry, dict) or "kode_bps" not in entry or "nilai" not in entry:
            raise _upstream_error()
        kode_bps = str(entry["kode_bps"]).strip()
        if not kode_bps:
            raise _upstream_error()
        try:
            nilai = float(entry["nilai"])
            interval_bawah = (
                float(entry["interval_bawah"]) if entry.get("interval_bawah") is not None else None
            )
            interval_atas = (
                float(entry["interval_atas"]) if entry.get("interval_atas") is not None else None
            )
        except (TypeError, ValueError) as exc:
            raise _upstream_error() from exc

        provinsi = str(entry.get("provinsi") or official_names.get(kode_bps, ""))
        items.append(
            ForecastItem(
                kode_bps=kode_bps,
                provinsi=provinsi,
                nilai=nilai,
                interval_bawah=interval_bawah,
                interval_atas=interval_atas,
            )
        )

    model_info: ForecastModelInfo | None = None
    model_raw = raw.get("model")
    if isinstance(model_raw, dict) and model_raw.get("nama"):
        versi_raw = model_raw.get("versi")
        model_info = ForecastModelInfo(
            nama=str(model_raw["nama"]),
            versi=str(versi_raw) if versi_raw is not None else None,
        )

    details: dict[str, Any] = {}
    returned_codes = {item.kode_bps for item in items}
    missing_codes = [code for code in official_codes if code not in returned_codes]
    if missing_codes:
        details["kode_tanpa_prediksi"] = missing_codes

    tahun_tersedia = raw.get("tahun_tersedia")
    if tahun_tersedia is None and isinstance(raw.get("details"), dict):
        tahun_tersedia = raw["details"].get("tahun_tersedia")
    if tahun_tersedia is None and isinstance(raw.get("metadata"), dict):
        tahun_tersedia = raw["metadata"].get("tahun_tersedia")
    if isinstance(tahun_tersedia, list):
        try:
            details["tahun_tersedia"] = [int(t) for t in tahun_tersedia]
        except (TypeError, ValueError):
            pass

    return ForecastResponse(
        tahun=resp_tahun,
        satuan=satuan,
        items=items,
        model=model_info,
        details=details,
    )


def ambil_forecast(
    db: Session,
    *,
    tahun: int | None = None,
    version_id: str | None = None,
    admin: Any = None,
    settings: Settings | None = None,
    transport: httpx.BaseTransport | None = None,
) -> ForecastResponse:
    cfg = settings or get_settings()
    endpoint = cfg.ai_endpoint_url.strip()
    if not endpoint:
        raise AppError(
            "AI_UNAVAILABLE",
            503,
            "Prediksi AI belum tersedia",
            {"alasan": "endpoint model belum dikonfigurasi"},
        )

    versi, target_tahun = _resolve_basis_versi(
        db, tahun=tahun, version_id=version_id, admin=admin
    )
    payload, official_codes, official_names = _bangun_payload(db, versi, target_tahun)

    headers = {"Accept": "application/json"}
    token = cfg.ai_api_token.strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        with httpx.Client(timeout=cfg.ai_timeout_detik, transport=transport) as client:
            resp = client.post(endpoint, json=payload, headers=headers)
    except httpx.HTTPError as exc:
        raise _upstream_error() from exc

    if resp.status_code != 200:
        raise _upstream_error()

    try:
        raw = resp.json()
    except ValueError as exc:
        raise _upstream_error() from exc

    return _parse_upstream_response(
        raw,
        target_tahun=target_tahun,
        official_codes=official_codes,
        official_names=official_names,
    )
