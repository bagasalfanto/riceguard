"""GET /distribution/distance-matrix — dimensi 20x17, urutan, presisi 1 desimal, dan simetri."""
import csv
from pathlib import Path

from riceguard_calc.matching import haversine_km

REPO = Path(__file__).resolve().parents[3]


def _baca_dataset() -> list[dict]:
    with (REPO / "dataset" / "dataset_v1.csv").open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _baca_rekomendasi() -> list[dict]:
    with (REPO / "dataset" / "rekomendasi_distribusi_v1.csv").open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def test_distance_matrix_dimensi_dan_urutan(client):
    r = client.get("/api/v1/distribution/distance-matrix", params={"tahun": 2025})
    assert r.status_code == 200
    body = r.json()

    assert body["tahun"] == 2025
    assert set(body["version"]) == {"id", "version_no"}
    assert body["satuan"] == "km"

    dataset = _baca_dataset()
    exp_baris = [
        row["kode_bps"]
        for row in sorted(
            (r for r in dataset if r["status"] == "defisit"),
            key=lambda r: float(r["rice_balance_ton"]),
        )
    ]
    exp_kolom = [
        row["kode_bps"]
        for row in sorted(
            (r for r in dataset if r["status"] == "surplus"),
            key=lambda r: float(r["rice_balance_ton"]),
            reverse=True,
        )
    ]

    assert body["baris"] == exp_baris
    assert body["kolom"] == exp_kolom
    assert len(body["baris"]) == 20
    assert len(body["kolom"]) == 17
    assert "61" not in body["baris"]
    assert "61" not in body["kolom"]

    matriks = body["jarak_km"]
    assert len(matriks) == 20
    assert all(len(baris) == 17 for baris in matriks)


def test_distance_matrix_cocok_dengan_rekomendasi_csv(client):
    body = client.get("/api/v1/distribution/distance-matrix").json()
    idx_baris = {kode: i for i, kode in enumerate(body["baris"])}
    idx_kolom = {kode: j for j, kode in enumerate(body["kolom"])}

    for row in _baca_rekomendasi():
        i = idx_baris[row["ke_kode"]]
        j = idx_kolom[row["dari_kode"]]
        assert body["jarak_km"][i][j] == float(row["jarak_km"])


def test_distance_matrix_presisi_dan_simetri_haversine(client):
    dataset = {row["kode_bps"]: row for row in _baca_dataset()}
    body = client.get("/api/v1/distribution/distance-matrix").json()

    for i, ke_kode in enumerate(body["baris"]):
        p_ke = dataset[ke_kode]
        for j, dari_kode in enumerate(body["kolom"]):
            p_dari = dataset[dari_kode]
            nilai = body["jarak_km"][i][j]
            maju = round(
                haversine_km(float(p_ke["lat"]), float(p_ke["lng"]), float(p_dari["lat"]), float(p_dari["lng"])),
                1,
            )
            balik = round(
                haversine_km(float(p_dari["lat"]), float(p_dari["lng"]), float(p_ke["lat"]), float(p_ke["lng"])),
                1,
            )
            assert nilai > 0
            assert round(nilai, 1) == nilai
            assert nilai == maju
            assert nilai == balik


def test_distance_matrix_tahun_tidak_ada_404(client):
    r = client.get("/api/v1/distribution/distance-matrix", params={"tahun": 2019})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NO_PUBLISHED_VERSION"
