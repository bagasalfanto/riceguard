"""GET /recommendations — rekomendasi resmi dibandingkan langsung dengan CSV."""
import csv
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]


def csv_baris() -> list[dict]:
    with (REPO / "dataset" / "rekomendasi_distribusi_v1.csv").open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def test_27_baris_urut(client):
    body = client.get("/api/v1/recommendations").json()

    assert body["tahun"] == 2025
    assert body["ringkasan"]["jumlah_pasangan"] == 27
    assert len(body["items"]) == 27
    assert [i["urutan"] for i in body["items"]] == list(range(1, 28))


def test_baris_sama_dengan_csv(client):
    items = client.get("/api/v1/recommendations").json()["items"]

    for item, csv_row in zip(items, csv_baris(), strict=True):
        assert item["urutan"] == int(csv_row["urutan"])
        assert item["dari_kode"] == csv_row["dari_kode"]
        assert item["dari"] == csv_row["dari"]
        assert item["ke_kode"] == csv_row["ke_kode"]
        assert item["ke"] == csv_row["ke"]
        assert item["ton"] == pytest.approx(float(csv_row["ton"]), abs=0.01)
        assert item["jarak_km"] == pytest.approx(float(csv_row["jarak_km"]), abs=0.1)


def test_ringkasan_dihitung_dari_csv(client):
    baris = csv_baris()
    total = sum(float(r["ton"]) for r in baris)
    ton_km = sum(float(r["ton"]) * float(r["jarak_km"]) for r in baris)

    ringkasan = client.get("/api/v1/recommendations").json()["ringkasan"]

    assert ringkasan["total_dialokasikan_ton"] == pytest.approx(total, abs=0.01)
    assert ringkasan["total_ton_km"] == pytest.approx(ton_km, abs=0.01)
    assert ringkasan["rata_jarak_tertimbang_ton"] == pytest.approx(ton_km / total, abs=0.01)
    assert ringkasan["persen_defisit_tertutup"] == pytest.approx(100.0, abs=0.01)


def test_persen_kebutuhan_penerima(client):
    """Jabar -> DKI: 863.504,32 / 864.300,73 = 99,9%."""
    pertama = client.get("/api/v1/recommendations").json()["items"][0]
    assert pertama["persen_kebutuhan_penerima"] == pytest.approx(99.9, abs=0.1)


def test_satu_pulau(client):
    items = client.get("/api/v1/recommendations").json()["items"]
    jabar_dki = items[0]
    assert jabar_dki["satu_pulau"] is True

    lintas = [i for i in items if not i["satu_pulau"]]
    assert lintas, "harus ada minimal satu pasangan lintas pulau"
    assert all(i["dari_kode"] != i["ke_kode"] for i in items)


def test_explanation_terisi_dan_memuat_angka(client):
    items = client.get("/api/v1/recommendations").json()["items"]
    for item in items:
        assert item["explanation"]
        assert item["dari"] in item["explanation"]
        assert item["ke"] in item["explanation"]


def test_filter_dari_kode(client):
    body = client.get("/api/v1/recommendations", params={"dari_kode": "32"}).json()
    assert body["items"]
    assert {i["dari_kode"] for i in body["items"]} == {"32"}
    assert body["ringkasan"]["jumlah_pasangan"] == len(body["items"])
    assert body["ringkasan"]["persen_defisit_tertutup"] == pytest.approx(100.0, abs=0.01)


def test_filter_ke_kode(client):
    body = client.get("/api/v1/recommendations", params={"ke_kode": "14"}).json()
    assert body["items"]
    assert {i["ke_kode"] for i in body["items"]} == {"14"}


def test_filter_tanpa_hasil(client):
    body = client.get("/api/v1/recommendations", params={"dari_kode": "31"}).json()
    assert body["items"] == []
    assert body["ringkasan"]["jumlah_pasangan"] == 0
    assert body["ringkasan"]["total_dialokasikan_ton"] == 0


def test_tahun_tanpa_versi_404(client):
    r = client.get("/api/v1/recommendations", params={"tahun": 2019})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NO_PUBLISHED_VERSION"
