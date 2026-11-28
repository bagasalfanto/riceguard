"""Tes autentikasi JWT Supabase admin & dependency optional_admin (T10.1)."""
from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import jwt
import pytest
from app.core.config import Settings
from app.core.errors import AppError
from app.core.security import _extract_bearer_token, optional_admin, require_admin
from app.db.models import Admin, DatasetVersion
from cryptography.hazmat.primitives.asymmetric import rsa
from sqlalchemy import text

_ISSUER = "https://contoh.supabase.co/auth/v1"


def _gen_rsa_pair():
    priv = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return priv, priv.public_key()


def _make_rs256_token(priv_key, sub: str, *, exp_delta: timedelta = timedelta(hours=1), aud: str = "authenticated", iss: str = _ISSUER, email: str | None = "admin@riceguard.id", kid: str = "k1") -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": sub,
        "aud": aud,
        "iss": iss,
        "exp": int((now + exp_delta).timestamp()),
        "iat": int(now.timestamp()),
    }
    if email is not None:
        payload["email"] = email
    return jwt.encode(payload, priv_key, algorithm="RS256", headers={"kid": kid})


def _make_hs256_token(secret: str, sub: str, *, exp_delta: timedelta = timedelta(hours=1), email: str | None = "legacy@riceguard.id") -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": sub,
        "aud": "authenticated",
        "iss": _ISSUER,
        "exp": int((now + exp_delta).timestamp()),
        "iat": int(now.timestamp()),
    }
    if email is not None:
        payload["email"] = email
    return jwt.encode(payload, secret, algorithm="HS256")


def _seed_admin(db, user_id: uuid.UUID, nama: str = "Admin Uji") -> Admin:
    db.execute(
        text("INSERT INTO auth.users (id) VALUES (:uid) ON CONFLICT DO NOTHING"),
        {"uid": user_id},
    )
    adm = Admin(user_id=user_id, nama=nama)
    db.add(adm)
    db.flush()
    return adm


def test_unit_extract_bearer_token_valid_dan_gagal():
    assert _extract_bearer_token("Bearer abc.def.ghi") == "abc.def.ghi"
    assert _extract_bearer_token("bearer tok123") == "tok123"

    for bad in (None, "", "Basic abc", "Bearer", "Bearer   ", "abc def ghi"):
        with pytest.raises(AppError) as err:
            _extract_bearer_token(bad)
        assert err.value.status_code == 401
        assert err.value.code == "UNAUTHORIZED"


def test_auth_tanpa_header_atau_token_rusak_401(client):
    r_none = client.get("/api/v1/admin/me")
    assert r_none.status_code == 401
    assert r_none.json()["error"]["code"] == "UNAUTHORIZED"

    r_bad = client.get("/api/v1/admin/me", headers={"Authorization": "Bearer bukan-jwt"})
    assert r_bad.status_code == 401
    assert r_bad.json()["error"]["code"] == "UNAUTHORIZED"


def test_auth_rs256_jwks_admin_200_non_admin_403_expired_401(client, db, monkeypatch):
    priv, pub = _gen_rsa_pair()
    admin_uid = uuid.uuid4()
    non_admin_uid = uuid.uuid4()
    _seed_admin(db, admin_uid, "Admin JWKS")

    monkeypatch.setattr(
        "app.core.security.get_settings",
        lambda: Settings(
            database_url="postgresql://x",
            supabase_url="https://contoh.supabase.co",
            supabase_jwt_secret="",
        ),
    )

    class _FakeJwks:
        def get_signing_key_from_jwt(self, token):
            return SimpleNamespace(key=pub)

    monkeypatch.setattr("app.core.security._jwks_client", lambda url: _FakeJwks())

    tok_admin = _make_rs256_token(priv, str(admin_uid), email="admin@riceguard.id")
    r_ok = client.get("/api/v1/admin/me", headers={"Authorization": f"Bearer {tok_admin}"})
    assert r_ok.status_code == 200
    assert r_ok.json() == {
        "user_id": str(admin_uid),
        "nama": "Admin JWKS",
        "email": "admin@riceguard.id",
    }

    tok_non_admin = _make_rs256_token(priv, str(non_admin_uid), email="user@riceguard.id")
    r_403 = client.get("/api/v1/admin/me", headers={"Authorization": f"Bearer {tok_non_admin}"})
    assert r_403.status_code == 403
    assert r_403.json()["error"]["code"] == "FORBIDDEN"

    tok_expired = _make_rs256_token(priv, str(admin_uid), exp_delta=timedelta(minutes=-5))
    r_exp = client.get("/api/v1/admin/me", headers={"Authorization": f"Bearer {tok_expired}"})
    assert r_exp.status_code == 401

    tok_wrong_aud = _make_rs256_token(priv, str(admin_uid), aud="anon")
    r_aud = client.get("/api/v1/admin/me", headers={"Authorization": f"Bearer {tok_wrong_aud}"})
    assert r_aud.status_code == 401


def test_auth_hs256_fallback_log_sekali(client, db, monkeypatch, caplog):
    secret = "rahasia-jwt-legacy-test-min-32-chars"
    admin_uid = uuid.uuid4()
    _seed_admin(db, admin_uid, "Admin Legacy")

    monkeypatch.setattr("app.core.security._hs256_warned", False)
    monkeypatch.setattr(
        "app.core.security.get_settings",
        lambda: Settings(
            database_url="postgresql://x",
            supabase_url="https://contoh.supabase.co",
            supabase_jwt_secret=secret,
        ),
    )

    tok = _make_hs256_token(secret, str(admin_uid))
    with caplog.at_level(logging.WARNING, logger="app.core.security"):
        r1 = client.get("/api/v1/admin/me", headers={"Authorization": f"Bearer {tok}"})
        r2 = client.get("/api/v1/admin/me", headers={"Authorization": f"Bearer {tok}"})

    assert r1.status_code == 200
    assert r2.status_code == 200
    warnings = [rec for rec in caplog.records if rec.levelno == logging.WARNING]
    assert len(warnings) == 1


def test_optional_admin_publik_dan_preview_draft(client, db, monkeypatch):
    secret = "rahasia-jwt-optional-admin-test-key"
    admin_uid = uuid.uuid4()
    non_admin_uid = uuid.uuid4()
    _seed_admin(db, admin_uid, "Admin Preview")

    monkeypatch.setattr(
        "app.core.security.get_settings",
        lambda: Settings(
            database_url="postgresql://x",
            supabase_url="https://contoh.supabase.co",
            supabase_jwt_secret=secret,
        ),
    )

    draft = DatasetVersion(tahun=2025, version_no=990, status="draft")
    db.add(draft)
    db.flush()

    assert optional_admin(db=db, authorization=None) is None
    assert optional_admin(db=db, authorization="Bearer token-rusak") is None
    tok_non_admin = _make_hs256_token(secret, str(non_admin_uid))
    assert optional_admin(db=db, authorization=f"Bearer {tok_non_admin}") is None

    tok_admin = _make_hs256_token(secret, str(admin_uid))
    ident = require_admin(db=db, authorization=f"Bearer {tok_admin}")
    assert ident.user_id == admin_uid

    r_pub = client.get("/api/v1/provinces", params={"tahun": 2025, "version_id": str(draft.id)})
    assert r_pub.status_code == 200
    assert r_pub.json()["version"]["id"] != str(draft.id)

    r_adm = client.get(
        "/api/v1/provinces",
        params={"tahun": 2025, "version_id": str(draft.id)},
        headers={"Authorization": f"Bearer {tok_admin}"},
    )
    assert r_adm.status_code == 200
    assert r_adm.json()["version"]["id"] == str(draft.id)
