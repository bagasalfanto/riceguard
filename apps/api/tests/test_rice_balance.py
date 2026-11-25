"""GET /rice-balance — neraca beras per provinsi plus total nasional."""
import csv
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]


def test_nasional_sama_dengan_summary(client):
    body = client.get("/api/v1/rice-balance").json()
    nasional = body["nasional"]

    assert body["tahun"] == 2025
    assert nasional["produksi_beras_ton"] == 34690959.00
    assert nasional["kebutuhan_beras_ton"] == 24819269.31
    assert nasional["rice_balance_ton"] == 9871689.69
    assert nasional["rasio_swasembada"] == 1.3977
    assert nasional["jumlah_status"] == {"surplus": 17, "balanced": 1, "defisit": 20}


def test_38_baris_urut_balance_menurun(client):
    items = client.get("/api/v1/rice-balance").json()["items"]

    assert len(items) == 38
    nilai = [i["rice_balance_ton"] for i in items]
    assert nilai == sorted(nilai, reverse=True)
    assert items[0]["provinsi"] == "Jawa Timur"


def test_angka_sama_dengan_dataset(client):
    items = client.get("/api/v1/rice-balance").json()["items"]

    with (REPO / "dataset" / "dataset_v1.csv").open(encoding="utf-8") as f:
        csv_rows = {r["kode_bps"]: r for r in csv.DictReader(f)}

    for item in items:
        acuan = csv_rows[item["kode_bps"]]
        assert item["produksi_beras_ton"] == pytest.approx(float(acuan["produksi_beras_ton"]), abs=0.01)
        assert item["kebutuhan_beras_ton"] == pytest.approx(float(acuan["kebutuhan_beras_ton"]), abs=0.01)
        assert item["rice_balance_ton"] == pytest.approx(float(acuan["rice_balance_ton"]), abs=0.01)
        assert item["status"] == acuan["status"]


def test_kalimantan_barat_balanced_dengan_balance_negatif(client):
    items = client.get("/api/v1/rice-balance").json()["items"]
    kobar = next(i for i in items if i["provinsi"] == "Kalimantan Barat")

    assert kobar["status"] == "balanced"
    assert kobar["rice_balance_ton"] < 0


def test_tahun_tanpa_versi_404(client):
    r = client.get("/api/v1/rice-balance", params={"tahun": 2019})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NO_PUBLISHED_VERSION"
