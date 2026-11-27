"""Tes POST /api/v1/admin/versions (simpan draft + Storage + audit upload, T10.4)."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import jwt
from app.core.config import Settings
from app.db.models import Admin, AuditLog, DatasetVersion, DistributionRecommendation, ProvinceStat
from sqlalchemy import select, text

REPO = Path(__file__).resolve().parents[3]
RAW = REPO / "dataset" / "raw"
_SECRET = "rahasia-jwt-admin-create-test-32ch"
_ISSUER = "https://contoh.supabase.co/auth/v1"


def _auth_headers(db, monkeypatch) -> tuple[dict[str, str], uuid.UUID]:
    uid = uuid.uuid4()
    db.execute(text("INSERT INTO auth.users (id) VALUES (:uid) ON CONFLICT DO NOTHING"), {"uid": uid})
    db.add(Admin(user_id=uid, nama="Admin Upload"))
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
        "referensi": (
            "provinces-reference-serlin.csv",
            (RAW / "provinces-reference-serlin.csv").read_bytes(),
            "text/csv",
        ),
    }


def test_create_version_draft_sukses_mock_storage_publik_tetap_v1(client, db, monkeypatch):
    headers, uid = _auth_headers(db, monkeypatch)
    uploaded: list[tuple[str, int, str | None]] = []

    def fake_upload(object_path: str, content: bytes, *, content_type: str | None = None):
        uploaded.append((object_path, len(content), content_type))

    monkeypatch.setattr("app.routers.admin.versions.upload_raw_object", fake_upload)

    pub_before = client.get("/api/v1/summary", params={"tahun": 2025}).json()["version"]

    r = client.post(
        "/api/v1/admin/versions",
        headers=headers,
        data={"tahun": "2025", "notes": "Upload draft uji coba"},
        files=_raw_files(),
    )
    assert r.status_code == 201
    body = r.json()
    ver = body["version"]
    assert ver["status"] == "draft"
    assert ver["version_no"] > pub_before["version_no"]
    assert ver["created_by"] == str(uid)
    assert body["validasi"]["lulus"] is True

    vid = uuid.UUID(ver["id"])
    assert len(uploaded) == 4
    assert all(path.startswith(f"2025/{vid}/") for path, _, _ in uploaded)

    stats = db.scalars(select(ProvinceStat).where(ProvinceStat.version_id == vid)).all()
    recs = db.scalars(select(DistributionRecommendation).where(DistributionRecommendation.version_id == vid)).all()
    assert len(stats) == 38
    assert len(recs) == 27
    assert all(rec.explanation for rec in recs)

    log = db.scalars(
        select(AuditLog).where(AuditLog.action == "upload", AuditLog.entity_id == str(vid))
    ).one()
    assert log.actor == uid
    assert log.detail["notes"] == "Upload draft uji coba"

    # Publik tetap melihat versi published v1
    pub_after = client.get("/api/v1/summary", params={"tahun": 2025}).json()["version"]
    assert pub_after["id"] == pub_before["id"]


def test_create_version_notes_kosong_400_dan_gagal_validasi_tidak_upload_storage(client, db, monkeypatch):
    headers, _ = _auth_headers(db, monkeypatch)
    called = []
    monkeypatch.setattr(
        "app.routers.admin.versions.upload_raw_object",
        lambda *a, **kw: called.append(a),
    )

    r_blank = client.post(
        "/api/v1/admin/versions",
        headers=headers,
        data={"tahun": "2025", "notes": "   "},
        files=_raw_files(),
    )
    assert r_blank.status_code == 400
    assert r_blank.json()["error"]["code"] == "INVALID_PARAMS"
    assert called == []

    prod_lines = (RAW / "produksi_2025.txt").read_text(encoding="utf-8").splitlines()
    prod_bad = "\n".join([line for line in prod_lines if line.split("|")[0].strip() != "Aceh"])
    files_bad = _raw_files()
    files_bad["produksi"] = ("produksi_bad.txt", prod_bad.encode("utf-8"), "text/plain")
    versions_before = len(db.scalars(select(DatasetVersion)).all())

    r_422 = client.post(
        "/api/v1/admin/versions",
        headers=headers,
        data={"tahun": "2025", "notes": "Harusnya gagal validasi"},
        files=files_bad,
    )
    assert r_422.status_code == 422
    assert r_422.json()["error"]["code"] == "VALIDATION_FAILED"
    assert called == []
    assert len(db.scalars(select(DatasetVersion)).all()) == versions_before
