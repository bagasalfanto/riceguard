"""Tes siklus hidup versi: publish, rollback, duplicate, delete + invalidasi cache (T10.6)."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import jwt
from app.core.cache import cache
from app.core.config import Settings
from app.db.models import Admin, AuditLog, DatasetVersion, DistributionRecommendation, ProvinceStat
from sqlalchemy import select, text

_SECRET = "rahasia-jwt-admin-lifecycle-32ch"
_ISSUER = "https://contoh.supabase.co/auth/v1"


def _auth_headers(db, monkeypatch) -> tuple[dict[str, str], uuid.UUID]:
    uid = uuid.uuid4()
    db.execute(text("INSERT INTO auth.users (id) VALUES (:uid) ON CONFLICT DO NOTHING"), {"uid": uid})
    db.add(Admin(user_id=uid, nama="Admin Lifecycle"))
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


def test_duplicate_publish_rollback_dan_cache_invalidation(client, db, monkeypatch):
    headers, _ = _auth_headers(db, monkeypatch)
    v1 = db.scalars(
        select(DatasetVersion).where(DatasetVersion.tahun == 2025, DatasetVersion.status == "published")
    ).one()

    # Hangatkan cache publik pada v1
    r_pub_1 = client.get("/api/v1/summary", params={"tahun": 2025})
    assert r_pub_1.status_code == 200
    assert r_pub_1.json()["version"]["id"] == str(v1.id)
    assert len(cache) > 0

    # Duplikat v1 -> v2 (draft)
    r_dup = client.post(
        f"/api/v1/admin/versions/{v1.id}/duplicate",
        headers=headers,
        json={"notes": "Duplikat dari v1"},
    )
    assert r_dup.status_code == 201
    v2_id = r_dup.json()["version"]["id"]
    assert r_dup.json()["version"]["status"] == "draft"
    assert r_dup.json()["version"]["version_no"] == v1.version_no + 1

    # Rollback pada draft harus 409
    r_rb_draft = client.post(f"/api/v1/admin/versions/{v2_id}/rollback", headers=headers)
    assert r_rb_draft.status_code == 409

    # Publish v2 -> v1 jadi archived, v2 jadi published, cache dibersihkan
    r_pub = client.post(f"/api/v1/admin/versions/{v2_id}/publish", headers=headers)
    assert r_pub.status_code == 200
    assert r_pub.json()["version"]["status"] == "published"
    assert len(cache) == 0

    db.expire_all()
    assert db.get(DatasetVersion, v1.id).status == "archived"

    r_pub_2 = client.get("/api/v1/summary", params={"tahun": 2025})
    assert r_pub_2.status_code == 200
    assert r_pub_2.json()["version"]["id"] == v2_id

    # Delete versi published -> 409
    r_del_pub = client.delete(f"/api/v1/admin/versions/{v2_id}", headers=headers)
    assert r_del_pub.status_code == 409

    # Rollback v1 (archived) -> v1 kembali published, v2 jadi archived, cache dibersihkan
    r_rb = client.post(f"/api/v1/admin/versions/{v1.id}/rollback", headers=headers)
    assert r_rb.status_code == 200
    assert r_rb.json()["version"]["status"] == "published"
    assert len(cache) == 0

    db.expire_all()
    assert db.get(DatasetVersion, uuid.UUID(v2_id)).status == "archived"
    r_pub_3 = client.get("/api/v1/summary", params={"tahun": 2025})
    assert r_pub_3.json()["version"]["id"] == str(v1.id)


def test_publish_draft_gagal_validasi_422_dan_delete_draft(client, db, monkeypatch):
    headers, uid = _auth_headers(db, monkeypatch)
    v1 = db.scalars(
        select(DatasetVersion).where(DatasetVersion.tahun == 2025, DatasetVersion.status == "published")
    ).one()

    draft_bad = DatasetVersion(
        tahun=2025,
        version_no=930,
        status="draft",
        notes="Draft gagal validasi",
        validation={"lulus": False, "aturan": []},
        created_by=uid,
    )
    db.add(draft_bad)
    db.flush()

    r_422 = client.post(f"/api/v1/admin/versions/{draft_bad.id}/publish", headers=headers)
    assert r_422.status_code == 422
    assert r_422.json()["error"]["code"] == "VALIDATION_FAILED"

    # Duplikat v1 lalu hapus draft
    r_dup = client.post(
        f"/api/v1/admin/versions/{v1.id}/duplicate",
        headers=headers,
        json={"notes": "Draft untuk dihapus"},
    )
    draft_del_id = uuid.UUID(r_dup.json()["version"]["id"])

    r_del = client.delete(f"/api/v1/admin/versions/{draft_del_id}", headers=headers)
    assert r_del.status_code == 200
    assert r_del.json() == {"deleted": True, "id": str(draft_del_id)}

    assert db.get(DatasetVersion, draft_del_id) is None
    assert db.scalars(select(ProvinceStat).where(ProvinceStat.version_id == draft_del_id)).all() == []
    assert db.scalars(select(DistributionRecommendation).where(DistributionRecommendation.version_id == draft_del_id)).all() == []
    assert db.scalars(
        select(AuditLog).where(AuditLog.action == "hapus_draft", AuditLog.entity_id == str(draft_del_id))
    ).first() is not None
