"""Tes GET /api/v1/admin/audit-log: 9 aksi, filter, paginasi, dan insert-only (T10.8)."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import jwt
from app.core.config import Settings
from app.db.models import Admin, DatasetVersion, DataSource
from sqlalchemy import select, text

REPO = Path(__file__).resolve().parents[3]
RAW = REPO / "dataset" / "raw"
_SECRET = "rahasia-jwt-admin-audit-test-32ch"
_ISSUER = "https://contoh.supabase.co/auth/v1"

ALL_NINE_ACTIONS = {
    "upload",
    "edit_provinsi",
    "recompute",
    "publish",
    "rollback",
    "duplicate",
    "hapus_draft",
    "edit_konten",
    "edit_sumber",
}


def _auth_headers(db, monkeypatch) -> tuple[dict[str, str], uuid.UUID]:
    uid = uuid.uuid4()
    db.execute(text("INSERT INTO auth.users (id) VALUES (:uid) ON CONFLICT DO NOTHING"), {"uid": uid})
    db.add(Admin(user_id=uid, nama="Admin Audit"))
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


def _raw_files() -> dict[str, tuple[str, bytes, str]]:
    return {
        "produksi": ("produksi_2025.txt", (RAW / "produksi_2025.txt").read_bytes(), "text/plain"),
        "penduduk": ("penduduk_supas2025.txt", (RAW / "penduduk_supas2025.txt").read_bytes(), "text/plain"),
        "konsumsi": ("konsumsi_bapanas_2025.csv", (RAW / "konsumsi_bapanas_2025.csv").read_bytes(), "text/csv"),
    }


def test_semua_9_aksi_tercatat_filter_dan_insert_only(client, db, monkeypatch):
    headers, uid = _auth_headers(db, monkeypatch)
    monkeypatch.setattr("app.routers.admin.versions.upload_raw_object", lambda *a, **kw: None)

    v1 = db.scalars(
        select(DatasetVersion).where(DatasetVersion.tahun == 2025, DatasetVersion.status == "published")
    ).one()
    src = db.scalars(select(DataSource).order_by(DataSource.id.asc())).first()

    # 1. upload
    r_up = client.post(
        "/api/v1/admin/versions",
        headers=headers,
        data={"tahun": "2025", "notes": "Audit upload"},
        files=_raw_files(),
    )
    assert r_up.status_code == 201
    v2_id = r_up.json()["version"]["id"]

    # 2. edit_provinsi
    assert (
        client.patch(
            f"/api/v1/admin/versions/{v2_id}/provinces/32",
            headers=headers,
            json={"konsumsi_kg_kapita_tahun": 95.0, "reason": "Uji audit edit"},
        ).status_code
        == 200
    )

    # 3. recompute
    assert client.post(f"/api/v1/admin/versions/{v2_id}/recompute", headers=headers).status_code == 200

    # 4. publish (v2 -> published, v1 -> archived)
    assert client.post(f"/api/v1/admin/versions/{v2_id}/publish", headers=headers).status_code == 200

    # 5. rollback (v1 -> published)
    assert client.post(f"/api/v1/admin/versions/{v1.id}/rollback", headers=headers).status_code == 200

    # 6. duplicate -> draft baru untuk dihapus
    r_dup = client.post(
        f"/api/v1/admin/versions/{v1.id}/duplicate",
        headers=headers,
        json={"notes": "Duplikat audit"},
    )
    assert r_dup.status_code == 201
    v_del_id = r_dup.json()["version"]["id"]

    # 7. hapus_draft
    assert client.delete(f"/api/v1/admin/versions/{v_del_id}", headers=headers).status_code == 200

    # 8. edit_konten
    assert (
        client.put(
            "/api/v1/admin/content/about",
            headers=headers,
            json={"title": "Audit Konten", "body_md": "Teks baru"},
        ).status_code
        == 200
    )

    # 9. edit_sumber
    assert (
        client.put(
            f"/api/v1/admin/sources/{src.id}",
            headers=headers,
            json={"nama": "Sumber Audit"},
        ).status_code
        == 200
    )

    # Cek semua 9 aksi muncul dan filter berjalan
    r_all = client.get("/api/v1/admin/audit-log", headers=headers, params={"actor": str(uid), "limit": 50})
    assert r_all.status_code == 200
    body = r_all.json()
    assert body["total"] >= 9
    actions_found = {item["action"] for item in body["items"]}
    assert ALL_NINE_ACTIONS <= actions_found
    assert all(item["actor_nama"] == "Admin Audit" for item in body["items"])

    for action in ALL_NINE_ACTIONS:
        r_act = client.get(
            "/api/v1/admin/audit-log",
            headers=headers,
            params={"action": action, "actor": str(uid)},
        )
        assert r_act.status_code == 200
        assert len(r_act.json()["items"]) >= 1
        assert all(it["action"] == action for it in r_act.json()["items"])

    # Invalid UUID di actor tidak menyebabkan Postgres DataError
    r_bad_actor = client.get("/api/v1/admin/audit-log", headers=headers, params={"actor": "bukan-uuid"})
    assert r_bad_actor.status_code == 200
    assert r_bad_actor.json()["items"] == []

    # Batas limit > 200 ditolak 400
    r_over = client.get("/api/v1/admin/audit-log", headers=headers, params={"limit": 201})
    assert r_over.status_code == 400

    # Insert-only: tidak ada endpoint PUT/PATCH/DELETE di audit-log
    for method in (client.put, client.patch, client.delete):
        r_mut = method("/api/v1/admin/audit-log", headers=headers)
        assert r_mut.status_code in {404, 405}
