"""Tes POST /api/v1/admin/versions/validate (dry-run tanpa menulis DB/Storage, T10.3)."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import jwt
import pandas as pd
import pytest
from app.core.config import Settings
from app.core.errors import AppError
from app.db.models import Admin, DatasetVersion
from app.services.ingest import sanitize_upload_filename
from sqlalchemy import func, select, text

REPO = Path(__file__).resolve().parents[3]
RAW = REPO / "dataset" / "raw"
_SECRET = "rahasia-jwt-admin-validate-test-32c"
_ISSUER = "https://contoh.supabase.co/auth/v1"


def _auth_headers(db, monkeypatch) -> dict[str, str]:
    uid = uuid.uuid4()
    db.execute(text("INSERT INTO auth.users (id) VALUES (:uid) ON CONFLICT DO NOTHING"), {"uid": uid})
    db.add(Admin(user_id=uid, nama="Admin Validate"))
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
    return {"Authorization": f"Bearer {tok}"}


def _raw_files(*, include_ref: bool = True) -> dict[str, tuple[str, bytes, str]]:
    files = {
        "produksi": ("produksi_2025.txt", (RAW / "produksi_2025.txt").read_bytes(), "text/plain"),
        "penduduk": ("penduduk_supas2025.txt", (RAW / "penduduk_supas2025.txt").read_bytes(), "text/plain"),
        "konsumsi": ("konsumsi_bapanas_2025.csv", (RAW / "konsumsi_bapanas_2025.csv").read_bytes(), "text/csv"),
    }
    if include_ref:
        files["referensi"] = (
            "provinces-reference-serlin.csv",
            (RAW / "provinces-reference-serlin.csv").read_bytes(),
            "text/csv",
        )
    return files


def test_unit_sanitize_upload_filename_ekstensi():
    assert sanitize_upload_filename("data/produksi_2025.txt", "produksi") == "produksi_2025.txt"
    assert sanitize_upload_filename("konsumsi.CSV", "konsumsi") == "konsumsi.CSV"

    for bad in ("malware.exe", "script.py", "..", ""):
        with pytest.raises(AppError) as err:
            sanitize_upload_filename(bad, "produksi")
        assert err.value.status_code == 400
        assert err.value.code == "INVALID_PARAMS"


def test_admin_validate_regresi_identik_dataset_v1_dan_tanpa_tulis_db(client, db, monkeypatch):
    headers = _auth_headers(db, monkeypatch)
    count_before = db.scalar(select(func.count()).select_from(DatasetVersion))

    r = client.post(
        "/api/v1/admin/versions/validate",
        headers=headers,
        data={"tahun": "2025"},
        files=_raw_files(include_ref=True),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["validasi"]["lulus"] is True
    assert len(body["pratinjau"]) == 38
    assert len(body["rekomendasi"]) == 27

    expected_df = pd.read_csv(REPO / "dataset" / "dataset_v1.csv", dtype={"kode_bps": str}).sort_values("kode_bps")
    actual_by_kode = {row["kode_bps"]: row for row in body["pratinjau"]}
    for exp in expected_df.itertuples():
        act = actual_by_kode[exp.kode_bps]
        assert act["penduduk_jiwa"] == int(exp.penduduk_jiwa)
        assert act["produksi_beras_ton"] == pytest.approx(float(exp.produksi_beras_ton), abs=0.01)
        assert act["kebutuhan_beras_ton"] == pytest.approx(float(exp.kebutuhan_beras_ton), abs=0.01)
        assert act["rice_balance_ton"] == pytest.approx(float(exp.rice_balance_ton), abs=0.01)
        assert act["rasio_swasembada"] == pytest.approx(float(exp.rasio_swasembada), abs=0.0001)
        assert act["status"] == exp.status

    expected_rek = pd.read_csv(REPO / "dataset" / "rekomendasi_distribusi_v1.csv", dtype={"dari_kode": str, "ke_kode": str})
    for exp_r, act_r in zip(expected_rek.itertuples(), body["rekomendasi"], strict=True):
        assert act_r["urutan"] == int(exp_r.urutan)
        assert act_r["dari_kode"] == exp_r.dari_kode
        assert act_r["ke_kode"] == exp_r.ke_kode
        assert act_r["ton"] == pytest.approx(float(exp_r.ton), abs=0.01)
        assert act_r["jarak_km"] == pytest.approx(float(exp_r.jarak_km), abs=0.1)
        assert act_r["explanation"]

    # Tanpa file referensi juga bekerja memakai tabel provinces di DB
    r_noref = client.post(
        "/api/v1/admin/versions/validate",
        headers=headers,
        data={"tahun": "2025"},
        files=_raw_files(include_ref=False),
    )
    assert r_noref.status_code == 200
    assert len(r_noref.json()["pratinjau"]) == 38

    assert db.scalar(select(func.count()).select_from(DatasetVersion)) == count_before


def test_admin_validate_ukuran_melebihi_batas_413_dan_gagal_validasi_422(client, db, monkeypatch):
    headers = _auth_headers(db, monkeypatch)
    count_before = db.scalar(select(func.count()).select_from(DatasetVersion))

    oversized = b"x" * (2 * 1024 * 1024 + 10)
    files_big = _raw_files()
    files_big["produksi"] = ("besar.txt", oversized, "text/plain")
    r_413 = client.post(
        "/api/v1/admin/versions/validate",
        headers=headers,
        data={"tahun": "2025"},
        files=files_big,
    )
    assert r_413.status_code == 413
    assert r_413.json()["error"]["code"] == "FILE_TOO_LARGE"

    # Hapus satu provinsi dari file produksi -> gagal validasi 422
    prod_lines = (RAW / "produksi_2025.txt").read_text(encoding="utf-8").splitlines()
    prod_missing = "\n".join([line for line in prod_lines if line.split("|")[0].strip() != "Aceh"])
    files_bad = _raw_files()
    files_bad["produksi"] = ("produksi_kurang.txt", prod_missing.encode("utf-8"), "text/plain")
    r_422 = client.post(
        "/api/v1/admin/versions/validate",
        headers=headers,
        data={"tahun": "2025"},
        files=files_bad,
    )
    assert r_422.status_code == 422
    assert r_422.json()["error"]["code"] == "VALIDATION_FAILED"
    assert db.scalar(select(func.count()).select_from(DatasetVersion)) == count_before
