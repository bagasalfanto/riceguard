"""GET /rankings — urutan dicek ke dataset_v1.csv."""
import pytest


def test_produksi_lima_besar(client):
    body = client.get("/api/v1/rankings", params={"by": "produksi", "limit": 5}).json()
    assert [i["provinsi"] for i in body["items"]] == [
        "Jawa Timur",
        "Jawa Barat",
        "Jawa Tengah",
        "Sulawesi Selatan",
        "Sumatera Selatan",
    ]
    assert [i["peringkat"] for i in body["items"]] == [1, 2, 3, 4, 5]
    assert body["items"][0]["nilai"] == 6027320.00
    assert body["by"] == "produksi"
    assert body["tahun"] == 2025


def test_kebutuhan_lima_besar(client):
    body = client.get("/api/v1/rankings", params={"by": "kebutuhan", "limit": 5}).json()
    assert body["items"][0]["provinsi"] == "Jawa Barat"
    assert body["items"][0]["nilai"] == 4396363.73


def test_surplus_hanya_status_surplus_urut_balance_turun(client):
    body = client.get("/api/v1/rankings", params={"by": "surplus", "limit": 5}).json()
    nilai = [i["nilai"] for i in body["items"]]
    assert nilai == sorted(nilai, reverse=True)
    assert body["items"][0]["provinsi"] == "Jawa Timur"
    assert all(n > 0 for n in nilai)


def test_defisit_hanya_status_defisit_urut_balance_naik(client):
    body = client.get("/api/v1/rankings", params={"by": "defisit", "limit": 5}).json()
    nilai = [i["nilai"] for i in body["items"]]
    assert nilai == sorted(nilai)
    assert body["items"][0]["provinsi"] == "DKI Jakarta"
    assert all(n < 0 for n in nilai)


def test_limit_dipotong_jadi_38(client):
    body = client.get("/api/v1/rankings", params={"by": "produksi", "limit": 99}).json()
    assert len(body["items"]) == 38


def test_by_tidak_dikenal_400(client):
    r = client.get("/api/v1/rankings", params={"by": "ngawur"})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "INVALID_PARAMS"


@pytest.mark.parametrize("by", ["produksi", "kebutuhan", "surplus", "defisit"])
def test_limit_nol_tidak_mengembalikan_semua(client, by):
    body = client.get("/api/v1/rankings", params={"by": by, "limit": 0}).json()
    assert 1 <= len(body["items"]) <= 38
