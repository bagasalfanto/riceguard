"""Tes komposisi data laporan T9.2 dan kesamaan angka dengan endpoint sumber."""
from __future__ import annotations

from datetime import datetime

import pytest
from app.core.errors import AppError
from app.db.models import DataSource, SiteContent
from app.services.exports import (
    laporan_nasional,
    laporan_provinsi,
    laporan_rekomendasi,
    laporan_surplus_defisit,
)


def _assert_metadata_lengkap(meta: dict, db) -> None:
    assert meta["versi"] == f"v{meta['version_no']}"
    assert meta["version_id"]
    assert isinstance(meta["version_no"], int)
    assert meta["tahun"] == 2025
    assert meta["published_at"]
    assert meta["published_by"]

    # tanggal_cetak harus ISO-8601 yang valid
    parsed = datetime.fromisoformat(meta["tanggal_cetak"])
    assert parsed.tzinfo is not None

    # sumber sama dengan tabel data_sources
    sumber_db = list(db.query(DataSource).order_by(DataSource.id.asc()))
    assert len(meta["sumber"]) == len(sumber_db)
    assert [s["nama"] for s in meta["sumber"]] == [s.nama for s in sumber_db]

    # batasan diambil dari site_content.limitations
    limitations = db.get(SiteContent, "limitations")
    assert limitations is not None
    expected_batasan = " ".join(limitations.body_md.split())
    assert meta["batasan"] == expected_batasan


def test_laporan_nasional_parity_dengan_summary_dan_rankings(client, db):
    hasil = laporan_nasional(db, tahun=2025)
    _assert_metadata_lengkap(hasil["metadata"], db)

    r_sum = client.get("/api/v1/summary", params={"tahun": 2025})
    assert r_sum.status_code == 200
    summary = r_sum.json()

    kpi = hasil["kpi"]
    assert kpi["produksi_beras_ton"] == summary["produksi_beras_ton"]
    assert kpi["kebutuhan_beras_ton"] == summary["kebutuhan_beras_ton"]
    assert kpi["rice_balance_ton"] == summary["rice_balance_ton"]
    assert kpi["rasio_swasembada"] == summary["rasio_swasembada"]
    assert kpi["total_dialokasikan_ton"] == summary["total_dialokasikan_ton"]
    assert hasil["ringkasan_status"] == summary["jumlah_status"]
    assert hasil["pulau_breakdown"] == summary["pulau_breakdown"]

    for by_key, field in (
        ("surplus", "top_surplus"),
        ("defisit", "top_defisit"),
        ("produksi", "top_produksi"),
        ("kebutuhan", "top_kebutuhan"),
    ):
        r_rank = client.get("/api/v1/rankings", params={"by": by_key, "tahun": 2025, "limit": 5})
        assert r_rank.status_code == 200
        assert hasil[field] == r_rank.json()["items"]

    assert len(hasil["map_values"]) == 38


def test_laporan_provinsi_parity_dan_not_found(client, db):
    # Uji provinsi surplus (Jawa Timur 35) dan defisit (DKI Jakarta 31)
    for kode in ("35", "31"):
        hasil = laporan_provinsi(db, 2025, kode)
        _assert_metadata_lengkap(hasil["metadata"], db)

        r_detail = client.get(f"/api/v1/provinces/{kode}", params={"tahun": 2025})
        assert r_detail.status_code == 200
        detail = r_detail.json()

        prov = hasil["provinsi"]
        assert prov["kode_bps"] == detail["kode_bps"]
        assert prov["produksi_beras_ton"] == detail["produksi_beras_ton"]
        assert prov["kebutuhan_beras_ton"] == detail["kebutuhan_beras_ton"]
        assert prov["rice_balance_ton"] == detail["rice_balance_ton"]
        assert prov["rasio_swasembada"] == detail["rasio_swasembada"]
        assert prov["status"] == detail["status"]
        assert hasil["perhitungan"] == detail["perhitungan"]
        assert hasil["rekomendasi_terkait"] == detail["rekomendasi_terkait"]
        assert hasil["riwayat"] == detail["riwayat"]
        assert hasil["highlight_kode"] == kode

    with pytest.raises(AppError) as exc_info:
        laporan_provinsi(db, 2025, "99")
    assert exc_info.value.status_code == 404
    assert exc_info.value.code == "NOT_FOUND"


def test_laporan_surplus_defisit_38_provinsi_terkelompok(client, db):
    hasil = laporan_surplus_defisit(db, tahun=2025)
    _assert_metadata_lengkap(hasil["metadata"], db)

    r_prov = client.get("/api/v1/provinces", params={"tahun": 2025, "limit": 100})
    assert r_prov.status_code == 200
    api_items = {p["kode_bps"]: p for p in r_prov.json()["items"]}
    assert len(api_items) == 38

    kelompok = hasil["kelompok"]
    total_terkelompok = (
        len(kelompok["surplus"]) + len(kelompok["balanced"]) + len(kelompok["defisit"])
    )
    assert total_terkelompok == 38
    assert len(hasil["provinsi"]) == 38

    # Pastikan urutan & angka tiap provinsi sama persis dengan /provinces
    for status_key in ("surplus", "balanced", "defisit"):
        assert all(p["status"] == status_key for p in kelompok[status_key])
        for p in kelompok[status_key]:
            assert p == api_items[p["kode_bps"]]

    surplus_balances = [p["rice_balance_ton"] for p in kelompok["surplus"]]
    assert surplus_balances == sorted(surplus_balances, reverse=True)
    defisit_balances = [p["rice_balance_ton"] for p in kelompok["defisit"]]
    assert defisit_balances == sorted(defisit_balances)


def test_laporan_rekomendasi_parity_dan_koordinat(client, db):
    hasil = laporan_rekomendasi(db, tahun=2025)
    _assert_metadata_lengkap(hasil["metadata"], db)

    r_rek = client.get("/api/v1/recommendations", params={"tahun": 2025})
    assert r_rek.status_code == 200
    api_rek = r_rek.json()

    assert hasil["ringkasan"] == api_rek["ringkasan"]
    assert len(hasil["items"]) == len(api_rek["items"]) == 27

    for item, api_item in zip(hasil["items"], api_rek["items"], strict=True):
        for key in (
            "urutan",
            "dari_kode",
            "dari",
            "ke_kode",
            "ke",
            "ton",
            "jarak_km",
            "persen_kebutuhan_penerima",
            "satu_pulau",
            "explanation",
        ):
            assert item[key] == api_item[key]
        assert -12.0 <= item["dari_lat"] <= 7.0
        assert 94.0 <= item["dari_lng"] <= 142.0
        assert -12.0 <= item["ke_lat"] <= 7.0
        assert 94.0 <= item["ke_lng"] <= 142.0
