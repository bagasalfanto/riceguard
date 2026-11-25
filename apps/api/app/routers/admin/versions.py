"""Router admin: auth, baca versi, validasi, upload, edit, dan siklus versi (T10.1–T10.6)."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.cache import cache
from app.core.errors import AppError, not_found_provinsi
from app.core.rounding import bulatkan_ton
from app.core.security import AdminIdentity, require_admin
from app.db.models import (
    Admin,
    DatasetVersion,
    DistributionRecommendation,
    Province,
    ProvinceStat,
    ProvinceStatEdit,
)
from app.db.session import get_db
from app.schemas.admin import (
    AdminCreateVersionResponse,
    AdminDeleteVersionResponse,
    AdminEditHistoryItem,
    AdminMeResponse,
    AdminPatchProvinceResponse,
    AdminProvinceStatItem,
    AdminRecomputeResponse,
    AdminValidateResponse,
    AdminVersionActionResponse,
    AdminVersionDetailResponse,
    AdminVersionItem,
    AdminVersionListResponse,
    AdminVersionProvincesResponse,
    AdminVersionRecommendationsResponse,
    DuplicateVersionRequest,
    ProvinceStatPatchRequest,
)
from app.schemas.recommendations import RecommendationItem
from app.services.audit import catat_audit
from app.services.compute import (
    latest_published_frame,
    recompute_draft_version,
    run_dataset_pipeline,
    upsert_provinces_from_ref,
)
from app.services.exports import extract_source_files
from app.services.ingest import parse_uploaded_bundle
from app.services.recommendations import bangun_rekomendasi
from app.services.storage import content_type_untuk_file, upload_raw_object

router = APIRouter(prefix="/admin", tags=["admin"])

_VALID_STATUSES = {"draft", "published", "archived"}
_EDITABLE_FIELDS = (
    "penduduk_jiwa",
    "konsumsi_kg_kapita_tahun",
    "produksi_padi_ton_gkg",
    "produksi_beras_ton",
)


def _get_version_or_404(db: Session, version_id: str) -> DatasetVersion:
    try:
        parsed = uuid.UUID(version_id)
    except (ValueError, AttributeError, TypeError) as exc:
        raise AppError("NOT_FOUND", 404, "Versi dataset tidak ditemukan", {"id": version_id}) from exc
    versi = db.get(DatasetVersion, parsed)
    if versi is None:
        raise AppError("NOT_FOUND", 404, "Versi dataset tidak ditemukan", {"id": version_id})
    return versi


def _admin_names_map(db: Session, user_ids: set[uuid.UUID]) -> dict[uuid.UUID, str]:
    if not user_ids:
        return {}
    rows = db.execute(select(Admin.user_id, Admin.nama).where(Admin.user_id.in_(user_ids))).all()
    return {uid: nama for uid, nama in rows}


def _to_version_item(
    versi: DatasetVersion,
    admin_names: dict[uuid.UUID, str] | None = None,
) -> AdminVersionItem:
    pub_nama = None
    if versi.published_by is not None and admin_names is not None:
        pub_nama = admin_names.get(versi.published_by)
    val = versi.validation if isinstance(versi.validation, dict) else {}
    return AdminVersionItem(
        id=str(versi.id),
        tahun=int(versi.tahun),
        version_no=int(versi.version_no),
        status=versi.status,
        notes=versi.notes,
        created_by=str(versi.created_by) if versi.created_by is not None else None,
        created_at=versi.created_at,
        published_by=str(versi.published_by) if versi.published_by is not None else None,
        published_by_nama=pub_nama,
        published_at=versi.published_at,
        lulus_validasi=bool(val.get("lulus", False)),
    )


def _preview_rows_from_df(df: pd.DataFrame) -> list[AdminProvinceStatItem]:
    return [
        AdminProvinceStatItem(
            tahun=int(r.tahun),
            kode_bps=r.kode_bps,
            kode_kemendagri=r.kode_kemendagri,
            provinsi=r.provinsi,
            pulau=r.pulau,
            lat=float(r.lat),
            lng=float(r.lng),
            penduduk_jiwa=int(r.penduduk_jiwa),
            konsumsi_kg_kapita_tahun=round(float(r.konsumsi_kg_kapita_tahun), 2),
            produksi_padi_ton_gkg=bulatkan_ton(r.produksi_padi_ton_gkg),
            produksi_beras_ton=bulatkan_ton(r.produksi_beras_ton),
            kebutuhan_beras_ton=bulatkan_ton(r.kebutuhan_beras_ton),
            rice_balance_ton=bulatkan_ton(r.rice_balance_ton),
            rasio_swasembada=float(r.rasio_swasembada),
            status=r.status,
            is_edited=False,
        )
        for r in df.itertuples()
    ]


def _validate_tahun(tahun: int) -> None:
    if tahun < 1900 or tahun > 2100:
        raise AppError("INVALID_PARAMS", 400, "Tahun tidak valid", {"tahun": tahun})


@router.get("/me", response_model=AdminMeResponse)
def admin_me(admin: Annotated[AdminIdentity, Depends(require_admin)]) -> AdminMeResponse:
    return AdminMeResponse(user_id=admin.user_id, nama=admin.nama, email=admin.email)


@router.get("/versions", response_model=AdminVersionListResponse)
def list_versions(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[AdminIdentity, Depends(require_admin)],
    tahun: Annotated[int | None, Query()] = None,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
) -> AdminVersionListResponse:
    stmt = select(DatasetVersion)
    if tahun is not None:
        stmt = stmt.where(DatasetVersion.tahun == tahun)
    if status_filter is not None and status_filter.strip():
        clean_status = status_filter.strip()
        if clean_status not in _VALID_STATUSES:
            raise AppError(
                "INVALID_PARAMS",
                400,
                "Parameter status tidak valid",
                {"status": clean_status, "pilihan": sorted(_VALID_STATUSES)},
            )
        stmt = stmt.where(DatasetVersion.status == clean_status)

    versions = list(
        db.scalars(stmt.order_by(DatasetVersion.tahun.desc(), DatasetVersion.version_no.desc()))
    )
    pub_ids = {v.published_by for v in versions if v.published_by is not None}
    admin_names = _admin_names_map(db, pub_ids)
    return AdminVersionListResponse(items=[_to_version_item(v, admin_names) for v in versions])


@router.get("/versions/{version_id}", response_model=AdminVersionDetailResponse)
def get_version_detail(
    version_id: str,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[AdminIdentity, Depends(require_admin)],
) -> AdminVersionDetailResponse:
    versi = _get_version_or_404(db, version_id)
    pub_names = _admin_names_map(db, {versi.published_by} if versi.published_by else set())

    edit_rows = db.execute(
        select(ProvinceStatEdit, Province.nama)
        .join(Province, Province.kode_bps == ProvinceStatEdit.kode_bps)
        .where(ProvinceStatEdit.version_id == versi.id)
        .order_by(ProvinceStatEdit.edited_at.desc(), ProvinceStatEdit.id.desc())
    ).all()
    editor_ids = {e.edited_by for e, _ in edit_rows if e.edited_by is not None}
    editor_names = _admin_names_map(db, editor_ids)

    edits = [
        AdminEditHistoryItem(
            id=e.id,
            kode_bps=e.kode_bps,
            provinsi=prov_nama,
            field=e.field,
            old_value=float(e.old_value) if e.old_value is not None else None,
            new_value=float(e.new_value) if e.new_value is not None else None,
            reason=e.reason,
            edited_by=str(e.edited_by) if e.edited_by is not None else None,
            edited_by_nama=editor_names.get(e.edited_by) if e.edited_by is not None else None,
            edited_at=e.edited_at,
        )
        for e, prov_nama in edit_rows
    ]

    return AdminVersionDetailResponse(
        version=_to_version_item(versi, pub_names),
        validasi=versi.validation if isinstance(versi.validation, dict) else {"lulus": False, "aturan": []},
        ringkasan=versi.summary if isinstance(versi.summary, dict) else {},
        source_files=extract_source_files(versi.source_files),
        edits=edits,
    )


@router.get("/versions/{version_id}/provinces", response_model=AdminVersionProvincesResponse)
def get_version_provinces(
    version_id: str,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[AdminIdentity, Depends(require_admin)],
) -> AdminVersionProvincesResponse:
    versi = _get_version_or_404(db, version_id)
    rows = db.execute(
        select(ProvinceStat, Province)
        .join(Province, Province.kode_bps == ProvinceStat.kode_bps)
        .where(ProvinceStat.version_id == versi.id)
        .order_by(ProvinceStat.kode_bps.asc())
    ).all()

    items = [
        AdminProvinceStatItem(
            tahun=int(versi.tahun),
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
            is_edited=bool(stat.is_edited),
        )
        for stat, prov in rows
    ]
    return AdminVersionProvincesResponse(
        version_id=str(versi.id),
        tahun=int(versi.tahun),
        status=versi.status,
        items=items,
    )


@router.get("/versions/{version_id}/recommendations", response_model=AdminVersionRecommendationsResponse)
def get_version_recommendations(
    version_id: str,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[AdminIdentity, Depends(require_admin)],
) -> AdminVersionRecommendationsResponse:
    versi = _get_version_or_404(db, version_id)
    rek = bangun_rekomendasi(db, versi)
    return AdminVersionRecommendationsResponse(
        version_id=str(versi.id),
        tahun=int(versi.tahun),
        ringkasan=rek.ringkasan,
        items=rek.items,
    )


@router.post("/versions/validate", response_model=AdminValidateResponse)
def validate_version_upload(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[AdminIdentity, Depends(require_admin)],
    tahun: Annotated[int, Form()],
    produksi: Annotated[UploadFile, File()],
    penduduk: Annotated[UploadFile, File()],
    konsumsi: Annotated[UploadFile, File()],
    referensi: Annotated[UploadFile | None, File()] = None,
) -> AdminValidateResponse:
    """Dry-run validasi + perhitungan penuh tanpa menulis DB atau Storage."""
    _validate_tahun(tahun)
    bundle = parse_uploaded_bundle(
        db,
        produksi=produksi,
        penduduk=penduduk,
        konsumsi=konsumsi,
        referensi=referensi,
    )
    sebelumnya_df = latest_published_frame(db, tahun)
    computed = run_dataset_pipeline(
        bundle.ref_df,
        bundle.produksi_df,
        bundle.penduduk_df,
        bundle.konsumsi_df,
        tahun,
        bundle.acuan_indonesia,
        sebelumnya_df=sebelumnya_df,
    )
    if not computed.validation.get("lulus"):
        raise AppError(
            "VALIDATION_FAILED",
            422,
            "Validasi dataset gagal",
            {"validasi": computed.validation},
        )

    return AdminValidateResponse(
        validasi=computed.validation,
        pratinjau=_preview_rows_from_df(computed.df),
        ringkasan=computed.summary,
        rekomendasi=[RecommendationItem(**rec) for rec in computed.recommendations],
    )


@router.post(
    "/versions",
    response_model=AdminCreateVersionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_version_draft(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[AdminIdentity, Depends(require_admin)],
    tahun: Annotated[int, Form()],
    notes: Annotated[str, Form()],
    produksi: Annotated[UploadFile, File()],
    penduduk: Annotated[UploadFile, File()],
    konsumsi: Annotated[UploadFile, File()],
    referensi: Annotated[UploadFile | None, File()] = None,
) -> AdminCreateVersionResponse:
    """Validasi upload, simpan file mentah ke Storage, dan buat versi draft baru."""
    _validate_tahun(tahun)
    clean_notes = notes.strip()
    if not clean_notes:
        raise AppError("INVALID_PARAMS", 400, "Catatan perubahan (notes) wajib diisi", {"field": "notes"})

    bundle = parse_uploaded_bundle(
        db,
        produksi=produksi,
        penduduk=penduduk,
        konsumsi=konsumsi,
        referensi=referensi,
    )
    sebelumnya_df = latest_published_frame(db, tahun)
    computed = run_dataset_pipeline(
        bundle.ref_df,
        bundle.produksi_df,
        bundle.penduduk_df,
        bundle.konsumsi_df,
        tahun,
        bundle.acuan_indonesia,
        sebelumnya_df=sebelumnya_df,
    )
    if not computed.validation.get("lulus"):
        raise AppError(
            "VALIDATION_FAILED",
            422,
            "Validasi dataset gagal",
            {"validasi": computed.validation},
        )

    version_id = uuid.uuid4()
    for raw_file in bundle.files:
        object_path = f"{tahun}/{version_id}/{raw_file.filename}"
        upload_raw_object(
            object_path,
            raw_file.content,
            content_type=content_type_untuk_file(raw_file.filename),
        )

    if bundle.has_custom_referensi:
        upsert_provinces_from_ref(db, bundle.ref_df)

    next_version_no = (
        db.scalar(select(func.max(DatasetVersion.version_no)).where(DatasetVersion.tahun == tahun)) or 0
    ) + 1

    versi = DatasetVersion(
        id=version_id,
        tahun=tahun,
        version_no=next_version_no,
        status="draft",
        notes=clean_notes,
        validation=computed.validation,
        summary=computed.summary,
        source_files=bundle.source_files,
        created_by=admin.user_id,
    )
    db.add(versi)
    db.flush()

    db.add_all(
        [
            ProvinceStat(
                version_id=versi.id,
                kode_bps=r.kode_bps,
                penduduk_jiwa=int(r.penduduk_jiwa),
                konsumsi_kg_kapita_tahun=Decimal(str(r.konsumsi_kg_kapita_tahun)),
                produksi_padi_ton_gkg=Decimal(str(r.produksi_padi_ton_gkg)),
                produksi_beras_ton=Decimal(str(r.produksi_beras_ton)),
                kebutuhan_beras_ton=Decimal(str(r.kebutuhan_beras_ton)),
                rice_balance_ton=Decimal(str(r.rice_balance_ton)),
                rasio_swasembada=Decimal(str(r.rasio_swasembada)),
                status=r.status,
            )
            for r in computed.df.itertuples()
        ]
    )
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
    catat_audit(
        db,
        actor=admin.user_id,
        action="upload",
        entity="dataset_version",
        entity_id=str(versi.id),
        detail={
            "tahun": tahun,
            "version_no": next_version_no,
            "notes": clean_notes,
            "source_files": bundle.source_files,
        },
    )
    db.commit()
    db.refresh(versi)

    return AdminCreateVersionResponse(
        version=_to_version_item(versi),
        validasi=computed.validation,
        ringkasan=computed.summary,
    )


@router.patch("/versions/{version_id}/provinces/{kode_bps}", response_model=AdminPatchProvinceResponse)
def patch_draft_province(
    version_id: str,
    kode_bps: str,
    payload: ProvinceStatPatchRequest,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[AdminIdentity, Depends(require_admin)],
) -> AdminPatchProvinceResponse:
    versi = _get_version_or_404(db, version_id)
    if versi.status != "draft":
        raise AppError(
            "VERSION_NOT_EDITABLE",
            409,
            "Hanya versi draft yang dapat diedit",
            {"status": versi.status},
        )

    provided_fields = [f for f in _EDITABLE_FIELDS if getattr(payload, f) is not None]
    if not provided_fields:
        raise AppError(
            "INVALID_PARAMS",
            400,
            "Minimal satu field input harus diisi",
            {"editable_fields": list(_EDITABLE_FIELDS)},
        )

    stat = db.scalars(
        select(ProvinceStat).where(
            ProvinceStat.version_id == versi.id,
            ProvinceStat.kode_bps == kode_bps,
        )
    ).first()
    if stat is None:
        raise not_found_provinsi(kode_bps)

    before: dict[str, int | float] = {}
    after: dict[str, int | float] = {}
    changed_count = 0

    for field_name in provided_fields:
        raw_new = getattr(payload, field_name)
        if field_name == "penduduk_jiwa":
            old_num = int(stat.penduduk_jiwa)
            new_num = int(raw_new)
            old_db_val: int | Decimal = old_num
            new_db_val: int | Decimal = new_num
            old_audit_val: int | float = old_num
            new_audit_val: int | float = new_num
        else:
            old_dec = Decimal(str(getattr(stat, field_name)))
            new_dec = Decimal(f"{float(raw_new):.2f}")
            old_db_val = old_dec
            new_db_val = new_dec
            old_audit_val = float(old_dec)
            new_audit_val = float(new_dec)

        before[field_name] = old_audit_val
        after[field_name] = new_audit_val
        if new_db_val != old_db_val:
            changed_count += 1
            setattr(stat, field_name, new_db_val)
            db.add(
                ProvinceStatEdit(
                    version_id=versi.id,
                    kode_bps=kode_bps,
                    field=field_name,
                    old_value=Decimal(str(old_db_val)),
                    new_value=Decimal(str(new_db_val)),
                    reason=payload.reason,
                    edited_by=admin.user_id,
                )
            )

    if changed_count > 0:
        stat.is_edited = True
        db.flush()

    computed = recompute_draft_version(db, versi)
    catat_audit(
        db,
        actor=admin.user_id,
        action="edit_provinsi",
        entity="province_stat",
        entity_id=f"{versi.id}:{kode_bps}",
        detail={
            "version_id": str(versi.id),
            "kode_bps": kode_bps,
            "reason": payload.reason,
            "before": before,
            "after": after,
        },
    )
    db.commit()
    db.refresh(versi)

    return AdminPatchProvinceResponse(
        edited=changed_count > 0,
        version=_to_version_item(versi),
        validasi=computed.validation,
        ringkasan=computed.summary,
    )


@router.post("/versions/{version_id}/recompute", response_model=AdminRecomputeResponse)
def recompute_version(
    version_id: str,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[AdminIdentity, Depends(require_admin)],
) -> AdminRecomputeResponse:
    versi = _get_version_or_404(db, version_id)
    if versi.status != "draft":
        raise AppError(
            "VERSION_NOT_EDITABLE",
            409,
            "Hanya versi draft yang dapat dihitung ulang",
            {"status": versi.status},
        )

    computed = recompute_draft_version(db, versi)
    catat_audit(
        db,
        actor=admin.user_id,
        action="recompute",
        entity="dataset_version",
        entity_id=str(versi.id),
        detail={
            "tahun": int(versi.tahun),
            "version_no": int(versi.version_no),
            "summary": computed.summary,
        },
    )
    db.commit()
    db.refresh(versi)

    return AdminRecomputeResponse(
        version=_to_version_item(versi),
        validasi=computed.validation,
        ringkasan=computed.summary,
    )


def _swap_published_version(
    db: Session,
    target: DatasetVersion,
    admin: AdminIdentity,
    *,
    action: str,
) -> DatasetVersion:
    old_published = db.scalars(
        select(DatasetVersion).where(
            DatasetVersion.tahun == target.tahun,
            DatasetVersion.status == "published",
            DatasetVersion.id != target.id,
        )
    ).first()
    if old_published is not None:
        old_published.status = "archived"
        db.flush()

    target.status = "published"
    target.published_at = datetime.now(UTC)
    target.published_by = admin.user_id

    catat_audit(
        db,
        actor=admin.user_id,
        action=action,
        entity="dataset_version",
        entity_id=str(target.id),
        detail={
            "tahun": int(target.tahun),
            "before": (
                {"version_id": str(old_published.id), "version_no": int(old_published.version_no)}
                if old_published is not None
                else None
            ),
            "after": {"version_id": str(target.id), "version_no": int(target.version_no)},
        },
    )
    db.commit()
    db.refresh(target)
    cache.clear_all()
    return target


@router.post("/versions/{version_id}/publish", response_model=AdminVersionActionResponse)
def publish_version(
    version_id: str,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[AdminIdentity, Depends(require_admin)],
) -> AdminVersionActionResponse:
    versi = _get_version_or_404(db, version_id)
    if versi.status != "draft":
        raise AppError(
            "VERSION_NOT_EDITABLE",
            409,
            "Hanya versi draft yang dapat dipublikasi",
            {"status": versi.status},
        )
    val = versi.validation if isinstance(versi.validation, dict) else {}
    if not val.get("lulus"):
        raise AppError(
            "VALIDATION_FAILED",
            422,
            "Versi belum lulus validasi dan tidak dapat dipublikasi",
            {"validasi": val},
        )

    published = _swap_published_version(db, versi, admin, action="publish")
    return AdminVersionActionResponse(
        version=_to_version_item(published, {admin.user_id: admin.nama})
    )


@router.post("/versions/{version_id}/rollback", response_model=AdminVersionActionResponse)
def rollback_version(
    version_id: str,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[AdminIdentity, Depends(require_admin)],
) -> AdminVersionActionResponse:
    versi = _get_version_or_404(db, version_id)
    if versi.status != "archived":
        raise AppError(
            "VERSION_NOT_EDITABLE",
            409,
            "Hanya versi archived yang dapat di-rollback",
            {"status": versi.status},
        )

    published = _swap_published_version(db, versi, admin, action="rollback")
    return AdminVersionActionResponse(
        version=_to_version_item(published, {admin.user_id: admin.nama})
    )


@router.post(
    "/versions/{version_id}/duplicate",
    response_model=AdminVersionActionResponse,
    status_code=status.HTTP_201_CREATED,
)
def duplicate_version(
    version_id: str,
    payload: DuplicateVersionRequest,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[AdminIdentity, Depends(require_admin)],
) -> AdminVersionActionResponse:
    sumber = _get_version_or_404(db, version_id)
    next_version_no = (
        db.scalar(select(func.max(DatasetVersion.version_no)).where(DatasetVersion.tahun == sumber.tahun))
        or 0
    ) + 1

    new_id = uuid.uuid4()
    salinan = DatasetVersion(
        id=new_id,
        tahun=sumber.tahun,
        version_no=next_version_no,
        status="draft",
        notes=payload.notes,
        validation=sumber.validation,
        summary=sumber.summary,
        source_files=sumber.source_files,
        created_by=admin.user_id,
        published_by=None,
        published_at=None,
    )
    db.add(salinan)
    db.flush()

    stats = list(
        db.scalars(
            select(ProvinceStat)
            .where(ProvinceStat.version_id == sumber.id)
            .order_by(ProvinceStat.kode_bps.asc())
        )
    )
    db.add_all(
        [
            ProvinceStat(
                version_id=new_id,
                kode_bps=s.kode_bps,
                penduduk_jiwa=s.penduduk_jiwa,
                konsumsi_kg_kapita_tahun=s.konsumsi_kg_kapita_tahun,
                produksi_padi_ton_gkg=s.produksi_padi_ton_gkg,
                produksi_beras_ton=s.produksi_beras_ton,
                kebutuhan_beras_ton=s.kebutuhan_beras_ton,
                rice_balance_ton=s.rice_balance_ton,
                rasio_swasembada=s.rasio_swasembada,
                status=s.status,
                is_edited=False,
            )
            for s in stats
        ]
    )

    recs = list(
        db.scalars(
            select(DistributionRecommendation)
            .where(DistributionRecommendation.version_id == sumber.id)
            .order_by(DistributionRecommendation.urutan.asc())
        )
    )
    db.add_all(
        [
            DistributionRecommendation(
                version_id=new_id,
                urutan=r.urutan,
                dari_kode=r.dari_kode,
                ke_kode=r.ke_kode,
                ton=r.ton,
                jarak_km=r.jarak_km,
                explanation=r.explanation,
            )
            for r in recs
        ]
    )

    catat_audit(
        db,
        actor=admin.user_id,
        action="duplicate",
        entity="dataset_version",
        entity_id=str(new_id),
        detail={
            "tahun": int(sumber.tahun),
            "source_version_id": str(sumber.id),
            "source_version_no": int(sumber.version_no),
            "new_version_no": next_version_no,
            "notes": payload.notes,
        },
    )
    db.commit()
    db.refresh(salinan)
    return AdminVersionActionResponse(version=_to_version_item(salinan))


@router.delete("/versions/{version_id}", response_model=AdminDeleteVersionResponse)
def delete_draft_version(
    version_id: str,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[AdminIdentity, Depends(require_admin)],
) -> AdminDeleteVersionResponse:
    versi = _get_version_or_404(db, version_id)
    if versi.status != "draft":
        raise AppError(
            "VERSION_NOT_EDITABLE",
            409,
            "Hanya versi draft yang dapat dihapus",
            {"status": versi.status},
        )

    catat_audit(
        db,
        actor=admin.user_id,
        action="hapus_draft",
        entity="dataset_version",
        entity_id=str(versi.id),
        detail={
            "tahun": int(versi.tahun),
            "version_no": int(versi.version_no),
            "notes": versi.notes,
            "source_files": versi.source_files,
        },
    )
    deleted_id = str(versi.id)
    db.delete(versi)
    db.commit()
    return AdminDeleteVersionResponse(deleted=True, id=deleted_id)
