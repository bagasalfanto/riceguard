"""Gating minimal 2 tahun data untuk /meta/years, /trends, dan /compare (T7.3)."""
from __future__ import annotations

import pytest
from app.db.models import DatasetVersion
from sqlalchemy import select


@pytest.fixture(autouse=True)
def _pastikan_satu_tahun_published(db):
    """Pastikan hanya tahun 2025 yang berstatus published di dalam transaksi tes."""
    ekstra = db.scalars(
        select(DatasetVersion).where(
            DatasetVersion.status == "published",
            DatasetVersion.tahun != 2025,
        )
    ).all()
    for versi in ekstra:
        versi.status = "archived"
    if ekstra:
        db.flush()


def test_meta_years_satu_tahun_butuh_minimal_2_tahun(client):
    r = client.get("/api/v1/meta/years")
    assert r.status_code == 200
    body = r.json()

    assert body["jumlah_tahun"] == 1
    assert body["butuh_minimal_2_tahun"] is True
    assert [t["tahun"] for t in body["tahun"]] == [2025]
    assert body["tahun_terbaru"] == 2025


def test_trends_gating_satu_tahun_return_200_kosong(client):
    r = client.get("/api/v1/trends")
    assert r.status_code == 200
    body = r.json()

    assert body == {
        "metric": "produksi",
        "butuh_minimal_2_tahun": True,
        "alasan": "butuh minimal 2 tahun data",
        "tahun_tersedia": [2025],
        "deret": [],
        "provinsi_meta": [],
    }

    r_prov = client.get("/api/v1/trends", params={"metric": "rasio", "kode_bps": "32,31"})
    assert r_prov.status_code == 200
    body_prov = r_prov.json()
    assert body_prov["metric"] == "rasio"
    assert body_prov["butuh_minimal_2_tahun"] is True
    assert body_prov["alasan"] == "butuh minimal 2 tahun data"
    assert body_prov["tahun_tersedia"] == [2025]
    assert body_prov["deret"] == []
    assert body_prov["provinsi_meta"] == []


def test_compare_gating_satu_tahun_return_200_kosong(client):
    r = client.get("/api/v1/compare")
    assert r.status_code == 200
    body = r.json()

    assert body == {
        "tahun_a": None,
        "tahun_b": None,
        "butuh_minimal_2_tahun": True,
        "alasan": "butuh minimal 2 tahun data",
        "nasional": None,
        "items": [],
        "status_berubah": [],
    }


def test_gating_validasi_param_dan_tahun_eksplisit_tetap_berlaku(client):
    r_metric = client.get("/api/v1/trends", params={"metric": "tidak_ada"})
    assert r_metric.status_code == 400
    assert r_metric.json()["error"]["code"] == "INVALID_PARAMS"

    r_kode = client.get("/api/v1/trends", params={"kode_bps": "99"})
    assert r_kode.status_code == 400
    assert r_kode.json()["error"]["code"] == "INVALID_PARAMS"

    r_compare_unpub = client.get("/api/v1/compare", params={"tahun_a": 2024, "tahun_b": 2025})
    assert r_compare_unpub.status_code == 404
    assert r_compare_unpub.json()["error"]["code"] == "NO_PUBLISHED_VERSION"

    r_compare_order = client.get("/api/v1/compare", params={"tahun_a": 2025, "tahun_b": 2025})
    assert r_compare_order.status_code == 400
    assert r_compare_order.json()["error"]["code"] == "INVALID_PARAMS"


def test_draft_dan_archived_tidak_membuka_gating(client, db):
    db.add(DatasetVersion(tahun=2024, version_no=1, status="draft"))
    db.add(DatasetVersion(tahun=2023, version_no=1, status="archived"))
    db.flush()

    meta = client.get("/api/v1/meta/years").json()
    assert meta["jumlah_tahun"] == 1
    assert meta["butuh_minimal_2_tahun"] is True

    trends = client.get("/api/v1/trends").json()
    assert trends["butuh_minimal_2_tahun"] is True
    assert trends["alasan"] == "butuh minimal 2 tahun data"
    assert trends["deret"] == []

    compare = client.get("/api/v1/compare").json()
    assert compare["butuh_minimal_2_tahun"] is True
    assert compare["alasan"] == "butuh minimal 2 tahun data"
    assert compare["items"] == []
