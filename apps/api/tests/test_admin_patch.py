"""Tes PATCH /provinces/{kode_bps} dan POST /recompute pada versi draft (T10.5)."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from app.core.config import Settings
from app.db.models import Admin, AuditLog, DatasetVersion, DistributionRecommendation, ProvinceStat, ProvinceStatEdit
from app.schemas.admin import ProvinceStatPatchRequest
from pydantic import ValidationError
from sqlalchemy import select, text

_SECRET = "rahasia-jwt-admin-patch-test-32char"
_ISSUER = "https://contoh.supabase.co/auth/v1"


def _auth_headers(db, monkeypatch) -> tuple[dict[str, str], uuid.UUID]:
    uid = uuid.uuid4()
    db.execute(text("INSERT INTO auth.users (id) VALUES (:uid) ON CONFLICT DO NOTHING"), {"uid": uid})
    db.add(Admin(user_id=uid, nama="Admin Patch"))
    db.flush()

    monkeypatch.setattr(
        "app.core.security.get_settings",
        lambda: Settings(
            database_url="postgresql://x",
            supabase_url="https://contoh.supabase.co",
            supabase_jwt_secret=_SECRET,
        ),
    )
    now = datetime.now(UTC)
    tok = jwt.encode(
        {
            "sub": str(uid),
            "aud": "authenticated",
            "iss": _ISSUER,
            "exp": int((now + timedelta(hours=1)).timestamp()),
        },
        _SECRET,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {tok}"}, uid


def _clone_published_as_draft(db, uid: uuid.UUID, version_no: int = 910) -> DatasetVersion:
    pub = db.scalars(
        select(DatasetVersion).where(DatasetVersion.tahun == 2025, DatasetVersion.status == "published")
    ).one()
    draft = DatasetVersion(
        tahun=2025,
        version_no=version_no,
        status="draft",
        notes="Draft untuk uji patch",
        validation=pub.validation,
        summary=pub.summary,
        source_files=pub.source_files,
        created_by=uid,
    )
    db.add(draft)
    db.flush()

    for s in db.scalars(select(ProvinceStat).where(ProvinceStat.version_id == pub.id)).all():
        db.add(
            ProvinceStat(
                version_id=draft.id,
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
        )
    for r in db.scalars(select(DistributionRecommendation).where(DistributionRecommendation.version_id == pub.id)).all():
        db.add(
            DistributionRecommendation(
                version_id=draft.id,
                urutan=r.urutan,
                dari_kode=r.dari_kode,
                ke_kode=r.ke_kode,
                ton=r.ton,
                jarak_km=r.jarak_km,
                explanation=r.explanation,
            )
        )
    db.flush()
    return draft


def test_unit_patch_schema_tolak_kolom_turunan():
    for forbidden in ("kebutuhan_beras_ton", "rice_balance_ton", "rasio_swasembada", "status"):
        with pytest.raises(ValidationError):
            ProvinceStatPatchRequest(**{forbidden: 123, "reason": "coba"})


def test_patch_published_409_dan_kolom_turunan_400(client, db, monkeypatch):
    headers, uid = _auth_headers(db, monkeypatch)
    pub = db.scalars(
        select(DatasetVersion).where(DatasetVersion.tahun == 2025, DatasetVersion.status == "published")
    ).one()

    r_409 = client.patch(
        f"/api/v1/admin/versions/{pub.id}/provinces/32",
        headers=headers,
        json={"produksi_beras_ton": 5000000, "reason": "Edit published"},
    )
    assert r_409.status_code == 409
    assert r_409.json()["error"]["code"] == "VERSION_NOT_EDITABLE"

    draft = _clone_published_as_draft(db, uid, version_no=911)
    r_400_derived = client.patch(
        f"/api/v1/admin/versions/{draft.id}/provinces/32",
        headers=headers,
        json={"rice_balance_ton": 999999, "reason": "Coba override balance"},
    )
    assert r_400_derived.status_code == 400
    assert r_400_derived.json()["error"]["code"] == "INVALID_PARAMS"

    r_400_reason = client.patch(
        f"/api/v1/admin/versions/{draft.id}/provinces/32",
        headers=headers,
        json={"produksi_beras_ton": 5000000, "reason": "   "},
    )
    assert r_400_reason.status_code == 400
    assert r_400_reason.json()["error"]["code"] == "INVALID_PARAMS"


def test_patch_provinsi_recompute_global_dan_audit(client, db, monkeypatch):
    headers, uid = _auth_headers(db, monkeypatch)
    draft = _clone_published_as_draft(db, uid, version_no=912)

    rek_before = [
        (r.dari_kode, r.ke_kode, float(r.ton))
        for r in db.scalars(
            select(DistributionRecommendation)
            .where(DistributionRecommendation.version_id == draft.id)
            .order_by(DistributionRecommendation.urutan.asc())
        ).all()
    ]

    # Kurangi drastis produksi Jawa Barat (32, pemasok utama Jakarta/Banten) menjadi kecil agar berubah status & memengaruhi matching provinsi lain
    r_patch = client.patch(
        f"/api/v1/admin/versions/{draft.id}/provinces/32",
        headers=headers,
        json={
            "produksi_beras_ton": 500000.0,
            "reason": "Simulasi koreksi angka produksi Jawa Barat",
        },
    )
    assert r_patch.status_code == 200
    body = r_patch.json()
    assert body["edited"] is True

    stat_32 = db.scalars(
        select(ProvinceStat).where(ProvinceStat.version_id == draft.id, ProvinceStat.kode_bps == "32")
    ).one()
    assert stat_32.is_edited is True
    assert stat_32.status == "defisit"

    edits = db.scalars(
        select(ProvinceStatEdit).where(
            ProvinceStatEdit.version_id == draft.id,
            ProvinceStatEdit.kode_bps == "32",
        )
    ).all()
    assert len(edits) == 1
    assert edits[0].field == "produksi_beras_ton"
    assert edits[0].reason == "Simulasi koreksi angka produksi Jawa Barat"
    assert edits[0].edited_by == uid

    rek_after = [
        (r.dari_kode, r.ke_kode, float(r.ton))
        for r in db.scalars(
            select(DistributionRecommendation)
            .where(DistributionRecommendation.version_id == draft.id)
            .order_by(DistributionRecommendation.urutan.asc())
        ).all()
    ]
    assert rek_after != rek_before
    # Ada provinsi penerima selain 32 yang sumber atau alokasinya ikut berubah (matching global)
    assert any(pair[:2] not in {(b[0], b[1]) for b in rek_before} and pair[1] != "32" for pair in rek_after)

    audit_edit = db.scalars(
        select(AuditLog).where(
            AuditLog.action == "edit_provinsi",
            AuditLog.entity_id == f"{draft.id}:32",
        )
    ).one()
    assert audit_edit.detail["reason"] == "Simulasi koreksi angka produksi Jawa Barat"
    assert "before" in audit_edit.detail and "after" in audit_edit.detail

    r_recompute = client.post(f"/api/v1/admin/versions/{draft.id}/recompute", headers=headers)
    assert r_recompute.status_code == 200
    assert "produksi_beras_ton" in r_recompute.json()["ringkasan"]

    audit_rec = db.scalars(
        select(AuditLog).where(
            AuditLog.action == "recompute",
            AuditLog.entity_id == str(draft.id),
        )
    ).one()
    assert audit_rec.actor == uid
