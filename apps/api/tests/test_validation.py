"""GET /api/v1/validation — laporan validasi 5 aturan dan metadata versi (T8.1)."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace

import pandas as pd
from app.core.cache import cache
from app.db.models import Admin, DatasetVersion
from app.services.exports import bangun_validasi, extract_source_files
from app.services.validation import validasi
from riceguard_calc import parse_penduduk, parse_produksi, total_indonesia
from sqlalchemy import select

REPO = Path(__file__).resolve().parents[3]


def test_unit_extract_source_files_deterministik_dan_aman():
    sumber = {
        "referensi": "provinces-reference-serlin.csv",
        "konsumsi": "konsumsi_bapanas_2025.csv",
        "acuan_indonesia": {"produksi_beras_ton": 34690959.0},
        "buruk": "../rahasia.txt",
        "penduduk": "penduduk_supas2025.txt",
        "produksi": "produksi_2025.txt",
        "tambahan": "catatan.csv",
    }
    items = extract_source_files(sumber)
    assert [(i.key, i.nama_file) for i in items] == [
        ("produksi", "produksi_2025.txt"),
        ("penduduk", "penduduk_supas2025.txt"),
        ("konsumsi", "konsumsi_bapanas_2025.csv"),
        ("referensi", "provinces-reference-serlin.csv"),
        ("tambahan", "catatan.csv"),
    ]


def test_unit_validasi_perubahan_50_persen_memicu_peringatan():
    raw = REPO / "dataset" / "raw"
    df_lama = pd.read_csv(REPO / "dataset" / "dataset_v1.csv", dtype={"kode_bps": str})
    df_baru = df_lama.copy()
    df_baru.loc[df_baru["kode_bps"] == "32", "produksi_beras_ton"] *= 1.5

    acuan = total_indonesia(
        parse_produksi(raw / "produksi_2025.txt"),
        parse_penduduk(raw / "penduduk_supas2025.txt"),
    )
    acuan["produksi_beras_ton"] = float(df_baru["produksi_beras_ton"].sum())
    hasil = validasi(df_baru, acuan, sebelumnya=df_lama)

    assert hasil["lulus"] is True
    aturan = {a["kode"]: a for a in hasil["aturan"]}
    assert aturan["perubahan_besar"]["status"] == "peringatan"
    assert aturan["perubahan_besar"]["detail"]["provinsi"] == [
        {"kode_bps": "32", "perubahan_persen": 50.0}
    ]


def test_validation_seed_2025_lulus_lima_aturan(client):
    r = client.get("/api/v1/validation", params={"tahun": 2025})
    assert r.status_code == 200
    body = r.json()

    assert body["tahun"] == 2025
    assert body["version"]["version_no"] == body["version_no"] == 1
    assert body["version"]["id"] == body["version_id"]
    assert body["lulus"] is True
    assert body["diperiksa_pada"] is not None
    assert body["published_at"] is not None

    aturan = body["aturan"]
    assert len(aturan) == 5
    assert [a["kode"] for a in aturan] == [
        "jumlah_provinsi",
        "nilai_positif",
        "total_produksi",
        "total_penduduk",
        "perubahan_besar",
    ]
    assert all(a["status"] in {"lulus", "peringatan"} for a in aturan)

    by_kode = {a["kode"]: a for a in aturan}
    detail_prod = by_kode["total_produksi"]["detail"]
    assert set(detail_prod) >= {"nilai", "acuan_bps", "selisih_persen"}
    assert detail_prod["selisih_persen"] <= 0.1

    assert [f["key"] for f in body["source_files"]] == [
        "produksi",
        "penduduk",
        "konsumsi",
        "referensi",
    ]


def test_validation_perubahan_besar_50_persen_dan_nama_admin(client, db):
    df_lama = pd.read_csv(REPO / "dataset" / "dataset_v1.csv", dtype={"kode_bps": str})
    df_baru = df_lama.copy()
    df_baru["produksi_beras_ton"] = df_baru["produksi_beras_ton"] * 1.5

    raw = REPO / "dataset" / "raw"
    acuan = total_indonesia(
        parse_produksi(raw / "produksi_2025.txt"),
        parse_penduduk(raw / "penduduk_supas2025.txt"),
    )
    acuan["produksi_beras_ton"] = float(df_baru["produksi_beras_ton"].sum())
    hasil_validasi = validasi(df_baru, acuan, sebelumnya=df_lama)

    # Gunakan UUID acak untuk menguji lookup nama admin bila tidak ada constraint FK yang memblokir,
    # atau gunakan baris admin yang sudah ada jika tabel admins memakai FK ke auth.users.
    admin_ada = db.scalars(select(Admin)).first()
    versi_2025 = db.scalars(
        select(DatasetVersion).where(DatasetVersion.tahun == 2025, DatasetVersion.status == "published")
    ).one()

    versi_2026 = DatasetVersion(
        tahun=2026,
        version_no=1,
        status="published",
        notes="Uji perubahan produksi 50%",
        validation=hasil_validasi,
        source_files=versi_2025.source_files,
        published_by=admin_ada.user_id if admin_ada else None,
        published_at=versi_2025.published_at,
    )
    db.add(versi_2026)
    db.flush()

    r = client.get("/api/v1/validation", params={"tahun": 2026})
    assert r.status_code == 200
    body = r.json()

    assert body["tahun"] == 2026
    assert body["lulus"] is True
    by_kode = {a["kode"]: a for a in body["aturan"]}
    assert by_kode["perubahan_besar"]["status"] == "peringatan"
    assert len(by_kode["perubahan_besar"]["detail"]["provinsi"]) == 38
    assert all(p["perubahan_persen"] == 50.0 for p in by_kode["perubahan_besar"]["detail"]["provinsi"])
    assert body["notes"] == "Uji perubahan produksi 50%"
    if admin_ada is not None:
        assert body["published_by"] == str(admin_ada.user_id)
        assert body["published_by_nama"] == admin_ada.nama
    else:
        assert body["published_by_nama"] is None


def test_validation_tanpa_tahun_dan_error_404(client, db):
    r_latest = client.get("/api/v1/validation")
    assert r_latest.status_code == 200
    assert r_latest.json()["tahun"] == 2025

    r_404 = client.get("/api/v1/validation", params={"tahun": 2019})
    assert r_404.status_code == 404
    assert r_404.json()["error"]["code"] == "NO_PUBLISHED_VERSION"

    draft = DatasetVersion(tahun=2025, version_no=778, status="draft", validation={"lulus": False, "aturan": []})
    db.add(draft)
    db.flush()

    r_draft = client.get("/api/v1/validation", params={"version_id": str(draft.id)})
    assert r_draft.status_code == 200
    assert r_draft.json()["version_id"] != str(draft.id)


def test_validation_memakai_cache_publik(client):
    cache.clear_all()
    r1 = client.get("/api/v1/validation", params={"tahun": 2025})
    assert r1.status_code == 200
    assert r1.headers["cache-control"] == "public, max-age=300"
    assert any(k[0] == "validation" for k in cache._data)

    n_cache = len(cache)
    r2 = client.get("/api/v1/validation", params={"tahun": 2025})
    assert r2.status_code == 200
    assert len(cache) == n_cache
    assert r2.json() == r1.json()


def test_unit_bangun_validasi_admin_dan_fallback_diperiksa_pada():
    class _FakeDb:
        def __init__(self, admin_map):
            self._admin_map = admin_map

        def get(self, model, pk):
            if model is Admin:
                return self._admin_map.get(pk)
            return None

    uid = uuid.uuid4()
    created_at = datetime(2026, 2, 1, tzinfo=UTC)
    versi_tanpa_admin = SimpleNamespace(
        id=uuid.uuid4(),
        tahun=2025,
        version_no=1,
        published_at=None,
        created_at=created_at,
        published_by=None,
        notes="Catatan uji",
        validation={
            "lulus": True,
            "aturan": [{"kode": "jumlah_provinsi", "label": "38 provinsi", "status": "lulus", "detail": {"jumlah": 38}}],
        },
        source_files={"produksi": "produksi_2025.txt"},
    )
    resp1 = bangun_validasi(_FakeDb({}), versi_tanpa_admin)
    assert resp1.published_by is None
    assert resp1.published_by_nama is None
    assert resp1.diperiksa_pada == created_at
    assert resp1.version.id == resp1.version_id == str(versi_tanpa_admin.id)
    assert resp1.version.version_no == resp1.version_no == 1
    assert [(f.key, f.nama_file) for f in resp1.source_files] == [("produksi", "produksi_2025.txt")]

    published_at = datetime(2026, 2, 2, tzinfo=UTC)
    versi_dengan_admin = SimpleNamespace(
        id=uuid.uuid4(),
        tahun=2025,
        version_no=2,
        published_at=published_at,
        created_at=created_at,
        published_by=uid,
        notes=None,
        validation={"lulus": False, "aturan": []},
        source_files=None,
    )
    resp2 = bangun_validasi(_FakeDb({uid: SimpleNamespace(nama="Admin RiceGuard")}), versi_dengan_admin)
    assert resp2.published_by == str(uid)
    assert resp2.published_by_nama == "Admin RiceGuard"
    assert resp2.diperiksa_pada == published_at
    assert resp2.lulus is False
    assert resp2.source_files == []
