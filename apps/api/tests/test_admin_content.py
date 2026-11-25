"""Tes endpoint kelola konten & sumber data admin + invalidasi cache (T10.7)."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import jwt
from app.core.cache import cache
from app.core.config import Settings
from app.db.models import Admin, AuditLog, DataSource
from sqlalchemy import select, text

_SECRET = "rahasia-jwt-admin-content-test-32"
_ISSUER = "https://contoh.supabase.co/auth/v1"


def _auth_headers(db, monkeypatch) -> tuple[dict[str, str], uuid.UUID]:
    uid = uuid.uuid4()
    db.execute(text("INSERT INTO auth.users (id) VALUES (:uid) ON CONFLICT DO NOTHING"), {"uid": uid})
    db.add(Admin(user_id=uid, nama="Admin Konten"))
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


def test_admin_content_get_put_kosong_dan_invalidasi_cache(client, db, monkeypatch):
    headers, uid = _auth_headers(db, monkeypatch)

    r_list = client.get("/api/v1/admin/content", headers=headers)
    assert r_list.status_code == 200
    assert isinstance(r_list.json(), list)

    # Hangatkan cache /content
    r_pub_before = client.get("/api/v1/content", params={"keys": "about"})
    assert r_pub_before.status_code == 200
    assert len(cache) > 0

    # Update key existing dengan body_md baru
    r_put = client.put(
        "/api/v1/admin/content/about",
        headers=headers,
        json={"title": "Tentang RiceGuard Baru", "body_md": "Isi **Markdown** terbarui."},
    )
    assert r_put.status_code == 200
    assert r_put.json()["title"] == "Tentang RiceGuard Baru"
    assert len(cache) == 0

    r_pub_after = client.get("/api/v1/content", params={"keys": "about"})
    assert r_pub_after.json()[0]["title"] == "Tentang RiceGuard Baru"
    assert r_pub_after.json()[0]["body_md"] == "Isi **Markdown** terbarui."

    # Boleh buat key baru dengan body_md kosong
    r_empty = client.put(
        "/api/v1/admin/content/blok_baru_uji",
        headers=headers,
        json={"title": "Blok Baru", "body_md": ""},
    )
    assert r_empty.status_code == 200
    assert r_empty.json()["body_md"] == ""

    log = db.scalars(
        select(AuditLog).where(AuditLog.action == "edit_konten", AuditLog.entity_id == "about")
    ).one()
    assert log.actor == uid
    assert log.detail["after"]["title"] == "Tentang RiceGuard Baru"


def test_admin_sources_put_dan_404(client, db, monkeypatch):
    headers, uid = _auth_headers(db, monkeypatch)
    src = db.scalars(select(DataSource).order_by(DataSource.id.asc())).first()
    assert src is not None

    # Hangatkan cache /sources
    assert client.get("/api/v1/sources").status_code == 200
    assert len(cache) > 0

    r_put = client.put(
        f"/api/v1/admin/sources/{src.id}",
        headers=headers,
        json={"nama": "Sumber Diperbarui", "tahun": 2026},
    )
    assert r_put.status_code == 200
    assert r_put.json()["nama"] == "Sumber Diperbarui"
    assert r_put.json()["tahun"] == 2026
    assert len(cache) == 0

    r_pub = client.get("/api/v1/sources")
    matched = [item for item in r_pub.json() if item["id"] == src.id]
    assert matched[0]["nama"] == "Sumber Diperbarui"

    log = db.scalars(
        select(AuditLog).where(AuditLog.action == "edit_sumber", AuditLog.entity_id == str(src.id))
    ).one()
    assert log.actor == uid
    assert log.detail["before"]["nama"] != log.detail["after"]["nama"]

    r_404 = client.put(
        "/api/v1/admin/sources/9999999",
        headers=headers,
        json={"nama": "Tidak Ada"},
    )
    assert r_404.status_code == 404
    assert r_404.json()["error"]["code"] == "NOT_FOUND"
