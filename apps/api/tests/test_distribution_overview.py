"""GET /distribution/overview — verifikasi jumlah status, prioritas, total, dan sisa terhadap CSV."""
import csv
from collections import defaultdict
from pathlib import Path

import pytest
from app.core.cache import cache

REPO = Path(__file__).resolve().parents[3]


def _baca_dataset() -> list[dict]:
    with (REPO / "dataset" / "dataset_v1.csv").open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _baca_rekomendasi() -> list[dict]:
    with (REPO / "dataset" / "rekomendasi_distribusi_v1.csv").open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def test_overview_jumlah_dan_balanced_dikecualikan(client):
    r = client.get("/api/v1/distribution/overview", params={"tahun": 2025})
    assert r.status_code == 200
    body = r.json()

    assert body["tahun"] == 2025
    assert set(body["version"]) == {"id", "version_no"}
    assert len(body["surplus"]) == 17
    assert len(body["defisit"]) == 20
    assert body["ringkasan"]["jumlah_pasangan"] == 27

    kode_surplus = {s["kode_bps"] for s in body["surplus"]}
    kode_defisit = {d["kode_bps"] for d in body["defisit"]}
    assert kode_surplus.isdisjoint(kode_defisit)
    # Kalimantan Barat (61) berstatus balanced sehingga tidak boleh muncul di kedua daftar.
    assert "61" not in kode_surplus
    assert "61" not in kode_defisit


def test_overview_urutan_dan_prioritas_monoton(client):
    body = client.get("/api/v1/distribution/overview").json()

    surplus = body["surplus"]
    saldo_surplus = [s["rice_balance_ton"] for s in surplus]
    assert saldo_surplus == sorted(saldo_surplus, reverse=True)
    assert all(x > 0 for x in saldo_surplus)
    assert surplus[0]["kode_bps"] == "35"

    defisit = body["defisit"]
    saldo_defisit = [d["rice_balance_ton"] for d in defisit]
    assert saldo_defisit == sorted(saldo_defisit)
    assert all(x < 0 for x in saldo_defisit)
    assert [d["prioritas"] for d in defisit] == list(range(1, 21))
    assert defisit[0]["kode_bps"] == "31"
    assert defisit[0]["provinsi"] == "DKI Jakarta"


def test_overview_total_dan_sisa_sesuai_csv(client):
    dataset = {row["kode_bps"]: row for row in _baca_dataset()}
    rekomendasi = _baca_rekomendasi()

    terpakai_csv: dict[str, float] = defaultdict(float)
    terpenuhi_csv: dict[str, float] = defaultdict(float)
    for row in rekomendasi:
        ton = float(row["ton"])
        terpakai_csv[row["dari_kode"]] += ton
        terpenuhi_csv[row["ke_kode"]] += ton

    body = client.get("/api/v1/distribution/overview").json()

    for item in body["surplus"]:
        acuan = dataset[item["kode_bps"]]
        exp_terpakai = round(terpakai_csv[item["kode_bps"]], 2)
        assert item["rice_balance_ton"] == pytest.approx(float(acuan["rice_balance_ton"]), abs=0.02)
        assert item["terpakai_ton"] == pytest.approx(exp_terpakai, abs=0.01)
        assert item["sisa_ton"] == pytest.approx(item["rice_balance_ton"] - item["terpakai_ton"], abs=0.01)

    jatim = next(s for s in body["surplus"] if s["kode_bps"] == "35")
    assert jatim["terpakai_ton"] == 0.0
    assert jatim["sisa_ton"] == jatim["rice_balance_ton"]

    for item in body["defisit"]:
        acuan = dataset[item["kode_bps"]]
        exp_defisit = round(abs(float(acuan["rice_balance_ton"])), 2)
        exp_terpenuhi = round(terpenuhi_csv[item["kode_bps"]], 2)
        assert item["defisit_ton"] == pytest.approx(exp_defisit, abs=0.01)
        assert item["rasio_swasembada"] == pytest.approx(float(acuan["rasio_swasembada"]), abs=0.0001)
        assert item["terpenuhi_ton"] == pytest.approx(exp_terpenuhi, abs=0.01)
        assert item["persen_terpenuhi"] == pytest.approx(100.0, abs=0.01)

    exp_total_surplus = sum(float(r["rice_balance_ton"]) for r in dataset.values() if r["status"] == "surplus")
    exp_total_defisit = sum(abs(float(r["rice_balance_ton"])) for r in dataset.values() if r["status"] == "defisit")
    exp_total_alokasi = sum(float(r["ton"]) for r in rekomendasi)

    ringkasan = body["ringkasan"]
    assert ringkasan["total_surplus_ton"] == pytest.approx(exp_total_surplus, abs=0.02)
    assert ringkasan["total_terpakai_ton"] == pytest.approx(exp_total_alokasi, abs=0.01)
    assert ringkasan["total_sisa_ton"] == pytest.approx(exp_total_surplus - exp_total_alokasi, abs=0.02)
    assert ringkasan["total_defisit_ton"] == pytest.approx(exp_total_defisit, abs=0.02)
    assert ringkasan["total_terpenuhi_ton"] == pytest.approx(exp_total_alokasi, abs=0.01)
    assert ringkasan["persen_defisit_tertutup"] == pytest.approx(100.0, abs=0.01)
    assert ringkasan["jumlah_pasangan"] == 27


def test_overview_cache_dan_tahun_tidak_ada_404(client):
    cache.clear_all()
    assert client.get("/api/v1/distribution/overview").status_code == 200
    assert len(cache) == 1
    assert client.get("/api/v1/distribution/overview").status_code == 200
    assert len(cache) == 1

    r = client.get("/api/v1/distribution/overview", params={"tahun": 2019})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NO_PUBLISHED_VERSION"
