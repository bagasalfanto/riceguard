"""Tes endpoint baca admin: daftar versi, detail, provinsi, rekomendasi (T10.2)."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import jwt
from app.core.config import Settings
from app.db.models import Admin, DatasetVersion, ProvinceStatEdit
from sqlalchemy import select, text

_SECRET = "rahasia-jwt-admin-versions-test-32c"
_ISSUER = "https://contoh.supabase.co/auth/v1"


def _auth_headers(db, monkeypatch) -> tuple[dict[str, str], uuid.UUID]:
    uid = uuid.uuid4()
    db.execute(text("INSERT INTO auth.users (id) VALUES (:uid) ON CONFLICT DO NOTHING"), {"uid": uid})
    db.add(Admin(user_id=uid, nama="Admin Versi"))
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
            "email": "versi@riceguard.id",
        },
        _SECRET,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {tok}"}, uid


def test_admin_versions_list_dan_filter(client, db, monkeypatch):
    headers, uid = _auth_headers(db, monkeypatch)
    draft = DatasetVersion(
        tahun=2025,
        version_no=901,
        status="draft",
        notes="Draft uji",
        validation={"lulus": True, "aturan": []},
        created_by=uid,
    )
    db.add(draft)
    db.flush()

    r_all = client.get("/api/v1/admin/versions", headers=headers)
    assert r_all.status_code == 200
    items = r_all.json()["items"]
    assert any(i["status"] == "published" and i["tahun"] == 2025 for i in items)
    assert any(i["id"] == str(draft.id) and i["status"] == "draft" for i in items)

    r_draft = client.get("/api/v1/admin/versions", params={"tahun": 2025, "status": "draft"}, headers=headers)
    assert r_draft.status_code == 200
    assert all(i["status"] == "draft" and i["tahun"] == 2025 for i in r_draft.json()["items"])

    r_bad_status = client.get("/api/v1/admin/versions", params={"status": "tidak_ada"}, headers=headers)
    assert r_bad_status.status_code == 400
    assert r_bad_status.json()["error"]["code"] == "INVALID_PARAMS"


def test_admin_version_detail_provinces_recommendations_dan_404(client, db, monkeypatch):
    headers, uid = _auth_headers(db, monkeypatch)
    versi = db.scalars(
        select(DatasetVersion).where(DatasetVersion.tahun == 2025, DatasetVersion.status == "published")
    ).one()

    t1 = datetime.now(UTC) - timedelta(minutes=10)
    t2 = datetime.now(UTC) - timedelta(minutes=1)
    db.add_all(
        [
            ProvinceStatEdit(
                version_id=versi.id,
                kode_bps="32",
                field="produksi_beras_ton",
                old_value=100,
                new_value=110,
                reason="Edit lama",
                edited_by=uid,
                edited_at=t1,
            ),
            ProvinceStatEdit(
                version_id=versi.id,
                kode_bps="32",
                field="produksi_beras_ton",
                old_value=110,
                new_value=120,
                reason="Edit terbaru",
                edited_by=uid,
                edited_at=t2,
            ),
        ]
    )
    db.flush()

    r_det = client.get(f"/api/v1/admin/versions/{versi.id}", headers=headers)
    assert r_det.status_code == 200
    body = r_det.json()
    assert body["version"]["id"] == str(versi.id)
    assert body["validasi"]["lulus"] is True
    assert "produksi_beras_ton" in body["ringkasan"]
    assert len(body["source_files"]) == 4
    assert [e["reason"] for e in body["edits"][:2]] == ["Edit terbaru", "Edit lama"]
    assert body["edits"][0]["edited_by_nama"] == "Admin Versi"

    r_prov = client.get(f"/api/v1/admin/versions/{versi.id}/provinces", headers=headers)
    assert r_prov.status_code == 200
    prov_body = r_prov.json()
    assert prov_body["version_id"] == str(versi.id)
    assert len(prov_body["items"]) == 38
    assert "is_edited" in prov_body["items"][0]

    r_rek = client.get(f"/api/v1/admin/versions/{versi.id}/recommendations", headers=headers)
    assert r_rek.status_code == 200
    rek_body = r_rek.json()
    assert len(rek_body["items"]) == 27
    assert rek_body["items"][0]["urutan"] == 1
    assert rek_body["items"][0]["explanation"]

    r_bad_uuid = client.get("/api/v1/admin/versions/bukan-uuid", headers=headers)
    assert r_bad_uuid.status_code == 404
    assert r_bad_uuid.json()["error"]["code"] == "NOT_FOUND"

    r_missing = client.get("/api/v1/admin/versions/00000000-0000-4000-8000-000000000000", headers=headers)
    assert r_missing.status_code == 404
    assert r_missing.json()["error"]["code"] == "NOT_FOUND"
