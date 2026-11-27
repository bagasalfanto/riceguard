"""GET /api/v1/trends — seri nasional, multi-provinsi, gap null, format query, dan error 400 (T7.1)."""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

import pytest
from app.db.models import DatasetVersion, ProvinceStat
from riceguard_calc.build import klasifikasi
from sqlalchemy import delete, select

TAHUN_BARU = 2025
TAHUN_LAMA = 2024
TAHUN_DRAFT = 2026


def _salin_stat(stat: ProvinceStat, version_id, faktor_produksi: Decimal) -> ProvinceStat:
    produksi = (stat.produksi_beras_ton * faktor_produksi).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    kebutuhan = stat.kebutuhan_beras_ton
    balance = (produksi - kebutuhan).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    rasio = (produksi / kebutuhan).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    return ProvinceStat(
        version_id=version_id,
        kode_bps=stat.kode_bps,
        penduduk_jiwa=stat.penduduk_jiwa,
        konsumsi_kg_kapita_tahun=stat.konsumsi_kg_kapita_tahun,
        produksi_padi_ton_gkg=(stat.produksi_padi_ton_gkg * faktor_produksi).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        ),
        produksi_beras_ton=produksi,
        kebutuhan_beras_ton=kebutuhan,
        rice_balance_ton=balance,
        rasio_swasembada=rasio,
        status=klasifikasi(float(rasio), float(balance)),
    )


@pytest.fixture
def dua_tahun_plus_draft(db):
    """Buat versi published 2024 (produksi x0.9) dan draft 2026 (harus diabaikan)."""
    asal = db.scalars(
        select(DatasetVersion).where(DatasetVersion.tahun == TAHUN_BARU, DatasetVersion.status == "published")
    ).one()

    lama = DatasetVersion(tahun=TAHUN_LAMA, version_no=1, status="published")
    draft = DatasetVersion(tahun=TAHUN_DRAFT, version_no=1, status="draft")
    db.add_all([lama, draft])
    db.flush()

    stats_2025 = list(db.scalars(select(ProvinceStat).where(ProvinceStat.version_id == asal.id)))
    for stat in stats_2025:
        db.add(_salin_stat(stat, lama.id, Decimal("0.9")))
        db.add(_salin_stat(stat, draft.id, Decimal("1.1")))
    db.flush()
    return lama


def test_trends_nasional_keempat_metrik_dan_abaikan_draft(client, dua_tahun_plus_draft):
    r_prod = client.get("/api/v1/trends")
    assert r_prod.status_code == 200
    body_prod = r_prod.json()

    assert body_prod["metric"] == "produksi"
    assert body_prod["butuh_minimal_2_tahun"] is False
    assert body_prod["alasan"] is None
    assert body_prod["tahun_tersedia"] == [TAHUN_LAMA, TAHUN_BARU]
    assert TAHUN_DRAFT not in body_prod["tahun_tersedia"]
    assert body_prod["provinsi_meta"] == []

    deret_prod = body_prod["deret"]
    assert [d["tahun"] for d in deret_prod] == [TAHUN_LAMA, TAHUN_BARU]
    assert deret_prod[1]["nasional"] == 34690959.00
    assert deret_prod[0]["nasional"] == pytest.approx(34690959.00 * 0.9, abs=1.0)
    assert deret_prod[0]["per_provinsi"] == {}

    body_keb = client.get("/api/v1/trends", params={"metric": "kebutuhan"}).json()
    assert body_keb["metric"] == "kebutuhan"
    assert body_keb["deret"][1]["nasional"] == pytest.approx(24819269.32, abs=0.02)
    assert body_keb["deret"][0]["nasional"] == body_keb["deret"][1]["nasional"]

    body_bal = client.get("/api/v1/trends", params={"metric": "balance"}).json()
    assert body_bal["metric"] == "balance"
    assert body_bal["deret"][1]["nasional"] == pytest.approx(9871689.69, abs=0.02)
    assert body_bal["deret"][0]["nasional"] < body_bal["deret"][1]["nasional"]

    body_rasio = client.get("/api/v1/trends", params={"metric": "rasio"}).json()
    assert body_rasio["metric"] == "rasio"
    assert body_rasio["deret"][1]["nasional"] == 1.3977
    assert body_rasio["deret"][0]["nasional"] == pytest.approx(1.3977 * 0.9, abs=0.001)


def test_trends_provinsi_hilang_di_satu_tahun_bernilaikan_null(client, db, dua_tahun_plus_draft):
    db.execute(
        delete(ProvinceStat).where(
            ProvinceStat.version_id == dua_tahun_plus_draft.id,
            ProvinceStat.kode_bps == "92",
        )
    )
    db.flush()

    r = client.get("/api/v1/trends", params={"metric": "produksi", "kode_bps": "92,32"})
    assert r.status_code == 200
    body = r.json()

    assert body["provinsi_meta"] == [
        {"kode_bps": "92", "nama": "Papua Barat Daya"},
        {"kode_bps": "32", "nama": "Jawa Barat"},
    ]
    assert body["deret"][0]["tahun"] == TAHUN_LAMA
    assert body["deret"][0]["per_provinsi"]["92"] is None
    assert body["deret"][0]["per_provinsi"]["32"] > 0

    assert body["deret"][1]["tahun"] == TAHUN_BARU
    assert body["deret"][1]["per_provinsi"]["92"] == 499.00
    assert body["deret"][1]["per_provinsi"]["32"] == 5905710.00


def test_trends_kode_bps_berbagai_format_dan_deduplikasi(client, dua_tahun_plus_draft):
    r_comma = client.get("/api/v1/trends?kode_bps=32,31")
    r_repeat = client.get("/api/v1/trends?kode_bps=32&kode_bps=31")
    r_bracket = client.get("/api/v1/trends?kode_bps[]=32&kode_bps[]=31")
    r_dedup = client.get("/api/v1/trends?kode_bps=32,31&kode_bps[]=32")

    for resp in (r_comma, r_repeat, r_bracket, r_dedup):
        assert resp.status_code == 200
        body = resp.json()
        assert [m["kode_bps"] for m in body["provinsi_meta"]] == ["32", "31"]
        assert list(body["deret"][0]["per_provinsi"].keys()) == ["32", "31"]
        assert body["deret"][1]["per_provinsi"] == {"32": 5905710.00, "31": 877.00}

    r_lima = client.get("/api/v1/trends?kode_bps=32,31,33,34,35")
    assert r_lima.status_code == 200
    assert len(r_lima.json()["provinsi_meta"]) == 5


@pytest.mark.parametrize(
    "query",
    [
        "kode_bps=32,31,33,34,35,36",
        "kode_bps=32&kode_bps=31&kode_bps=33&kode_bps=34&kode_bps=35&kode_bps=36",
        "kode_bps[]=32&kode_bps[]=31&kode_bps[]=33&kode_bps[]=34&kode_bps[]=35&kode_bps[]=36",
        "kode_bps=99",
        "kode_bps=32,99",
        "metric=stok",
    ],
)
def test_trends_parameter_tidak_valid_400(client, dua_tahun_plus_draft, query):
    r = client.get(f"/api/v1/trends?{query}")
    assert r.status_code == 400
    err = r.json()["error"]
    assert err["code"] == "INVALID_PARAMS"
    assert set(err) == {"code", "message", "details"}
