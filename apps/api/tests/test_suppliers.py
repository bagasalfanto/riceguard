"""GET /distribution/suppliers/{kode_bps} — peringkat pemasok, jarak CSV, dan error 400/404."""
import csv
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]


def _baca_rekomendasi() -> list[dict]:
    with (REPO / "dataset" / "rekomendasi_distribusi_v1.csv").open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def test_suppliers_dki_jakarta_17_baris_urut_jarak(client):
    r = client.get("/api/v1/distribution/suppliers/31", params={"tahun": 2025})
    assert r.status_code == 200
    body = r.json()

    assert body["tahun"] == 2025
    assert set(body["version"]) == {"id", "version_no"}
    assert body["penerima"] == {
        "kode_bps": "31",
        "provinsi": "DKI Jakarta",
        "pulau": "Jawa",
        "defisit_ton": pytest.approx(863504.32, abs=0.01),
        "terpenuhi_ton": pytest.approx(863504.32, abs=0.01),
    }

    items = body["items"]
    assert len(items) == 17
    kunci_urut = [(i["jarak_km"], i["kode_bps"]) for i in items]
    assert kunci_urut == sorted(kunci_urut)

    pertama = items[0]
    assert pertama["kode_bps"] == "32"
    assert pertama["provinsi"] == "Jawa Barat"
    assert pertama["jarak_km"] == 116.8
    assert pertama["satu_pulau"] is True
    assert pertama["dipakai_di_rekomendasi"] is True
    assert pertama["alokasi_ton"] == pytest.approx(863504.32, abs=0.01)

    for item in items[1:]:
        assert item["dipakai_di_rekomendasi"] is False
        assert item["alokasi_ton"] == 0.0

    for item in items:
        assert item["sisa_ton"] == pytest.approx(item["surplus_ton"] - item["terpakai_ton"], abs=0.01)
        assert item["satu_pulau"] is (item["pulau"] == "Jawa")


def test_suppliers_jarak_dan_alokasi_sama_dengan_csv(client):
    rek_per_tujuan: dict[str, dict[str, dict]] = {}
    for row in _baca_rekomendasi():
        rek_per_tujuan.setdefault(row["ke_kode"], {})[row["dari_kode"]] = row

    for ke_kode in ("31", "14", "97"):
        body = client.get(f"/api/v1/distribution/suppliers/{ke_kode}").json()
        peta = {i["kode_bps"]: i for i in body["items"]}
        acuan_tujuan = rek_per_tujuan[ke_kode]

        for dari_kode, row in acuan_tujuan.items():
            item = peta[dari_kode]
            assert item["dipakai_di_rekomendasi"] is True
            assert item["jarak_km"] == float(row["jarak_km"])
            assert item["alokasi_ton"] == pytest.approx(float(row["ton"]), abs=0.01)


@pytest.mark.parametrize("kode_bps", ["32", "61"])
def test_suppliers_bukan_defisit_400(client, kode_bps):
    r = client.get(f"/api/v1/distribution/suppliers/{kode_bps}")
    assert r.status_code == 400
    err = r.json()["error"]
    assert err["code"] == "INVALID_PARAMS"
    assert err["details"] == {"kode_bps": kode_bps, "alasan": "bukan provinsi defisit"}


def test_suppliers_kode_tidak_dikenal_404(client):
    r = client.get("/api/v1/distribution/suppliers/99")
    assert r.status_code == 404
    err = r.json()["error"]
    assert err["code"] == "NOT_FOUND"
    assert err["details"]["kode_bps"] == "99"


def test_suppliers_tahun_tidak_ada_404(client):
    r = client.get("/api/v1/distribution/suppliers/31", params={"tahun": 2019})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NO_PUBLISHED_VERSION"
