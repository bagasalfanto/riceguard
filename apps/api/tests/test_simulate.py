"""POST /api/v1/recommendations/simulate — kesamaan default, skenario, validasi 400, non-persistent (T6.4)."""
from __future__ import annotations

import time

import pytest
from app.core.cache import cache
from app.db.models import DatasetVersion, DistributionRecommendation, ProvinceStat
from sqlalchemy import func, select


def test_simulasi_default_identik_dengan_resmi(client):
    resmi = client.get("/api/v1/recommendations").json()
    resp = client.post("/api/v1/recommendations/simulate", json={})
    assert resp.status_code == 200
    sim = resp.json()

    assert sim["tahun"] == resmi["tahun"]
    assert sim["version"] == resmi["version"]
    assert sim["rekomendasi"] == resmi["items"]
    assert sim["ringkasan"] == resmi["ringkasan"]
    assert len(sim["provinsi"]) == 38

    banding = sim["banding_resmi"]
    assert banding["delta_ton"] == 0.0
    assert banding["delta_ton_km"] == 0.0
    assert banding["status_berubah"] == []
    assert banding["defisit_tidak_tertutup"] == []


def test_simulasi_persen_surplus_terbatas(client):
    # Pada 2025 total surplus ~12,76 juta ton > defisit ~2,89 juta ton:
    # 50% tetap menutup seluruh defisit, tetapi memaksa pasangan yang lebih jauh.
    resp_50 = client.post(
        "/api/v1/recommendations/simulate",
        json={"persen_surplus_dilepas": 50.0},
    )
    assert resp_50.status_code == 200
    sim_50 = resp_50.json()
    assert sim_50["banding_resmi"]["delta_ton_km"] > 0
    assert sim_50["ringkasan"]["jumlah_pasangan"] > 27

    # 20% (~2,55 juta ton) tidak cukup menutup defisit nasional -> delta_ton negatif & ada defisit tersisa.
    resp_20 = client.post(
        "/api/v1/recommendations/simulate",
        json={"persen_surplus_dilepas": 20.0},
    )
    assert resp_20.status_code == 200
    sim_20 = resp_20.json()
    assert sim_20["banding_resmi"]["delta_ton"] < 0
    assert sim_20["banding_resmi"]["defisit_tidak_tertutup"]
    assert sim_20["ringkasan"]["persen_defisit_tertutup"] < 100.0


def test_simulasi_perubahan_produksi_dan_status_berubah(client):
    resp_20 = client.post(
        "/api/v1/recommendations/simulate",
        json={"perubahan_produksi": {"33": -20}},
    )
    assert resp_20.status_code == 200
    sim_20 = resp_20.json()
    jateng_20 = next(p for p in sim_20["provinsi"] if p["kode_bps"] == "33")
    assert jateng_20["status"] == "surplus"

    resp_50 = client.post(
        "/api/v1/recommendations/simulate",
        json={"perubahan_produksi": {"33": -50}},
    )
    assert resp_50.status_code == 200
    sim_50 = resp_50.json()
    perubahan = {c["kode_bps"]: c for c in sim_50["banding_resmi"]["status_berubah"]}
    assert "33" in perubahan
    assert perubahan["33"]["dari"] == "surplus"
    assert perubahan["33"]["ke"] == "defisit"
    assert any(r["ke_kode"] == "33" for r in sim_50["rekomendasi"])


def test_simulasi_ambang_jarak_dan_pengecualian(client):
    resp_ambang = client.post(
        "/api/v1/recommendations/simulate",
        json={"ambang_swasembada": 0.80},
    )
    assert resp_ambang.status_code == 200
    berubah = {c["kode_bps"]: c for c in resp_ambang.json()["banding_resmi"]["status_berubah"]}
    for kode in ("36", "53", "62"):
        assert berubah[kode]["dari"] == "defisit"
        assert berubah[kode]["ke"] == "balanced"

    resp_jarak = client.post(
        "/api/v1/recommendations/simulate",
        json={
            "jarak_maks_km": 200.0,
            "kecualikan_pemasok": ["95"],
            "kecualikan_penerima": ["31"],
        },
    )
    assert resp_jarak.status_code == 200
    sim_jarak = resp_jarak.json()
    assert all(r["jarak_km"] <= 200.0 for r in sim_jarak["rekomendasi"])
    assert all(r["dari_kode"] != "95" for r in sim_jarak["rekomendasi"])
    assert all(r["ke_kode"] != "31" for r in sim_jarak["rekomendasi"])
    unmet_codes = {u["kode_bps"] for u in sim_jarak["banding_resmi"]["defisit_tidak_tertutup"]}
    assert "31" in unmet_codes


@pytest.mark.parametrize(
    "payload",
    [
        {"ambang_swasembada": 0.79},
        {"ambang_swasembada": 1.01},
        {"persen_surplus_dilepas": 9.9},
        {"persen_surplus_dilepas": 100.1},
        {"jarak_maks_km": 99.0},
        {"jarak_maks_km": 4001.0},
        {"perubahan_produksi": {"33": -51.0}},
        {"perubahan_produksi": {"33": 51.0}},
        {"perubahan_konsumsi_persen": -21.0},
        {"perubahan_konsumsi_persen": 21.0},
    ],
)
def test_simulasi_rentang_invalid_400(client, payload):
    r = client.post("/api/v1/recommendations/simulate", json=payload)
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "INVALID_PARAMS"


def test_simulasi_mode_optimal_dan_asing_400(client):
    r_opt = client.post("/api/v1/recommendations/simulate", json={"mode": "optimal"})
    assert r_opt.status_code == 400
    err = r_opt.json()["error"]
    assert err["code"] == "INVALID_PARAMS"
    assert err["details"]["alasan"] == "mode optimal belum diimplementasikan"

    r_other = client.post("/api/v1/recommendations/simulate", json={"mode": "linear"})
    assert r_other.status_code == 400
    assert r_other.json()["error"]["code"] == "INVALID_PARAMS"


def test_simulasi_tahun_tidak_ada_404(client):
    r = client.post("/api/v1/recommendations/simulate", json={"tahun": 2019})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NO_PUBLISHED_VERSION"


def test_simulasi_tidak_menulis_db_atau_cache(client, db):
    cache.clear_all()
    sebelum = (
        db.scalar(select(func.count()).select_from(DatasetVersion)),
        db.scalar(select(func.count()).select_from(ProvinceStat)),
        db.scalar(select(func.count()).select_from(DistributionRecommendation)),
    )

    for payload in (
        {},
        {"persen_surplus_dilepas": 50.0, "perubahan_produksi": {"33": -50}},
        {"ambang_swasembada": 0.85, "perubahan_konsumsi_persen": 15.0},
    ):
        r = client.post("/api/v1/recommendations/simulate", json=payload)
        assert r.status_code == 200

    sesudah = (
        db.scalar(select(func.count()).select_from(DatasetVersion)),
        db.scalar(select(func.count()).select_from(ProvinceStat)),
        db.scalar(select(func.count()).select_from(DistributionRecommendation)),
    )
    assert sesudah == sebelum
    assert len(cache) == 0


def test_simulasi_waktu_dibawah_1_detik(client):
    mulai = time.perf_counter()
    r = client.post(
        "/api/v1/recommendations/simulate",
        json={
            "ambang_swasembada": 0.90,
            "persen_surplus_dilepas": 80.0,
            "jarak_maks_km": 1500.0,
            "kecualikan_pemasok": ["95"],
            "perubahan_produksi": {"33": -20},
            "perubahan_konsumsi_persen": 5.0,
        },
    )
    durasi = time.perf_counter() - mulai
    assert r.status_code == 200
    assert durasi < 1.0, f"Simulasi memakan waktu {durasi:.3f}s (>= 1s)"
