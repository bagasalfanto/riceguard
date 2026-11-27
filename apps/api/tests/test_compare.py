"""GET /api/v1/compare — perbandingan dua tahun, perubahan status, nol, dan error 400/404 (T7.2)."""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

import pytest
from app.db.models import DatasetVersion, ProvinceStat
from riceguard_calc.build import klasifikasi
from sqlalchemy import delete, select

TAHUN_B = 2025
TAHUN_A = 2024


@pytest.fixture
def dua_tahun_compare(db):
    """Salin 38 provinsi 2025 ke 2024 dengan produksi x0.9 serta klasifikasi ulang status."""
    asal = db.scalars(
        select(DatasetVersion).where(DatasetVersion.tahun == TAHUN_B, DatasetVersion.status == "published")
    ).one()

    lama = DatasetVersion(tahun=TAHUN_A, version_no=1, status="published")
    db.add(lama)
    db.flush()

    for stat in db.scalars(select(ProvinceStat).where(ProvinceStat.version_id == asal.id)):
        produksi = (stat.produksi_beras_ton * Decimal("0.9")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        kebutuhan = stat.kebutuhan_beras_ton
        balance = (produksi - kebutuhan).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        rasio = (produksi / kebutuhan).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        db.add(
            ProvinceStat(
                version_id=lama.id,
                kode_bps=stat.kode_bps,
                penduduk_jiwa=stat.penduduk_jiwa,
                konsumsi_kg_kapita_tahun=stat.konsumsi_kg_kapita_tahun,
                produksi_padi_ton_gkg=(stat.produksi_padi_ton_gkg * Decimal("0.9")).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                ),
                produksi_beras_ton=produksi,
                kebutuhan_beras_ton=kebutuhan,
                rice_balance_ton=balance,
                rasio_swasembada=rasio,
                status=klasifikasi(float(rasio), float(balance)),
            )
        )
    db.flush()
    return lama


def test_compare_default_dua_tahun_terakhir_dan_konsistensi_delta(client, dua_tahun_compare):
    r = client.get("/api/v1/compare")
    assert r.status_code == 200
    body = r.json()

    assert body["tahun_a"] == TAHUN_A
    assert body["tahun_b"] == TAHUN_B
    assert body["butuh_minimal_2_tahun"] is False
    assert body["alasan"] is None

    nas = body["nasional"]
    assert nas["produksi_b"] == 34690959.00
    assert nas["delta_produksi"] == pytest.approx(nas["produksi_b"] - nas["produksi_a"], abs=0.01)
    assert nas["delta_produksi_persen"] == pytest.approx(11.11, abs=0.02)
    assert nas["kebutuhan_a"] == nas["kebutuhan_b"]
    assert nas["delta_kebutuhan"] == 0.0
    assert nas["delta_balance"] == pytest.approx(nas["balance_b"] - nas["balance_a"], abs=0.01)
    assert nas["surplus_count_a"] + nas["defisit_count_a"] + nas["balanced_count_a"] == 38
    assert nas["surplus_count_b"] + nas["defisit_count_b"] + nas["balanced_count_b"] == 38

    items = body["items"]
    assert len(items) == 38
    nama_urut = [i["nama"] for i in items]
    assert nama_urut == sorted(nama_urut, key=str.lower)

    for item in items:
        assert item["delta_produksi"] == pytest.approx(item["produksi_b"] - item["produksi_a"], abs=0.01)
        assert item["delta_balance"] == pytest.approx(item["balance_b"] - item["balance_a"], abs=0.01)
        assert item["delta_rasio"] == pytest.approx(item["rasio_b"] - item["rasio_a"], abs=0.0001)

    berubah_dari_items = [
        {
            "kode_bps": i["kode_bps"],
            "nama": i["nama"],
            "status_a": i["status_a"],
            "status_b": i["status_b"],
            "delta_produksi": i["delta_produksi"],
            "delta_balance": i["delta_balance"],
        }
        for i in items
        if i["status_a"] != i["status_b"]
    ]
    assert body["status_berubah"] == berubah_dari_items
    peta_berubah = {c["kode_bps"]: c for c in body["status_berubah"]}
    assert peta_berubah["61"]["status_a"] == "defisit"
    assert peta_berubah["61"]["status_b"] == "balanced"


def test_compare_produksi_nol_delta_persen_null(client, db, dua_tahun_compare):
    stat_jabar = db.scalars(
        select(ProvinceStat).where(
            ProvinceStat.version_id == dua_tahun_compare.id,
            ProvinceStat.kode_bps == "32",
        )
    ).one()
    stat_jabar.produksi_beras_ton = Decimal("0.00")
    stat_jabar.rice_balance_ton = -stat_jabar.kebutuhan_beras_ton
    stat_jabar.rasio_swasembada = Decimal("0.0000")
    stat_jabar.status = "defisit"
    db.flush()

    r = client.get("/api/v1/compare", params={"tahun_a": TAHUN_A, "tahun_b": TAHUN_B})
    assert r.status_code == 200
    items = r.json()["items"]
    jabar = next(i for i in items if i["kode_bps"] == "32")

    assert jabar["produksi_a"] == 0.0
    assert jabar["delta_produksi"] == jabar["produksi_b"]
    assert jabar["delta_produksi_persen"] is None


def test_compare_outer_union_provinsi_hilang_di_satu_tahun(client, db, dua_tahun_compare):
    db.execute(
        delete(ProvinceStat).where(
            ProvinceStat.version_id == dua_tahun_compare.id,
            ProvinceStat.kode_bps == "92",
        )
    )
    db.flush()

    r = client.get("/api/v1/compare", params={"tahun_a": TAHUN_A, "tahun_b": TAHUN_B})
    assert r.status_code == 200
    body = r.json()
    assert len(body["items"]) == 38

    pbd = next(i for i in body["items"] if i["kode_bps"] == "92")
    assert pbd["status_a"] is None
    assert pbd["status_b"] == "defisit"
    assert pbd["produksi_a"] is None
    assert pbd["produksi_b"] == 499.00
    assert pbd["delta_produksi"] is None
    assert pbd["delta_produksi_persen"] is None
    assert pbd["delta_kebutuhan"] is None
    assert pbd["delta_balance"] is None
    assert pbd["delta_rasio"] is None
    assert all(c["kode_bps"] != "92" for c in body["status_berubah"])


@pytest.mark.parametrize(
    "params",
    [
        {"tahun_a": 2025, "tahun_b": 2025},
        {"tahun_a": 2025, "tahun_b": 2024},
        {"tahun_a": 2024},
        {"tahun_b": 2025},
    ],
)
def test_compare_parameter_invalid_400(client, dua_tahun_compare, params):
    r = client.get("/api/v1/compare", params=params)
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "INVALID_PARAMS"


def test_compare_tahun_belum_published_404(client, db, dua_tahun_compare):
    db.add(DatasetVersion(tahun=2026, version_no=1, status="draft"))
    db.flush()

    r_missing = client.get("/api/v1/compare", params={"tahun_a": 2020, "tahun_b": 2025})
    assert r_missing.status_code == 404
    assert r_missing.json()["error"]["code"] == "NO_PUBLISHED_VERSION"

    r_draft = client.get("/api/v1/compare", params={"tahun_a": 2024, "tahun_b": 2026})
    assert r_draft.status_code == 404
    assert r_draft.json()["error"]["code"] == "NO_PUBLISHED_VERSION"
