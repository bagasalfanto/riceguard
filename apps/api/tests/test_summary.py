"""GET /summary — angka nasional harus sama dengan dataset_v1.csv."""
from decimal import Decimal

from app.db.models import DatasetVersion
from sqlalchemy import select


def test_summary_2025_sesuai_dataset(client):
    r = client.get("/api/v1/summary", params={"tahun": 2025})
    assert r.status_code == 200
    body = r.json()

    assert body["tahun"] == 2025
    assert body["produksi_beras_ton"] == 34690959.00
    assert body["kebutuhan_beras_ton"] == 24819269.31
    assert body["rice_balance_ton"] == 9871689.69
    assert body["rasio_swasembada"] == 1.3977
    assert body["jumlah_status"] == {"surplus": 17, "balanced": 1, "defisit": 20}
    assert body["total_dialokasikan_ton"] == 2889188.48


def test_summary_tanpa_tahun_memakai_versi_terbaru(client):
    body = client.get("/api/v1/summary").json()
    assert body["tahun"] == 2025


def test_summary_delta_null_karena_satu_tahun(client):
    assert client.get("/api/v1/summary").json()["delta_tahun_sebelumnya"] is None


def test_summary_tahun_tanpa_versi_404(client):
    r = client.get("/api/v1/summary", params={"tahun": 2019})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NO_PUBLISHED_VERSION"


def test_summary_pulau_breakdown(client):
    pulau = client.get("/api/v1/summary").json()["pulau_breakdown"]

    assert len(pulau) == 7
    assert [p["pulau"] for p in pulau][0] == "Jawa"
    assert {p["pulau"]: p["jumlah_provinsi"] for p in pulau}["Jawa"] == 6
    assert round(sum(p["porsi_produksi"] for p in pulau), 4) == 1.0
    assert round(sum(p["porsi_kebutuhan"] for p in pulau), 4) == 1.0
    # urut produksi menurun
    nilai = [p["produksi_beras_ton"] for p in pulau]
    assert nilai == sorted(nilai, reverse=True)


def test_summary_melengkapi_pulau_breakdown_yang_belum_ada(client, db):
    """Versi lama yang summary-nya belum memuat pulau_breakdown dihitung lalu disimpan."""
    versi = db.scalars(
        select(DatasetVersion).where(DatasetVersion.tahun == 2025, DatasetVersion.status == "published")
    ).one()
    ringkas = dict(versi.summary or {})
    ringkas.pop("pulau_breakdown", None)
    versi.summary = ringkas
    db.flush()

    body = client.get("/api/v1/summary").json()
    assert len(body["pulau_breakdown"]) == 7

    db.refresh(versi)
    assert len(versi.summary["pulau_breakdown"]) == 7


def test_summary_version_id_diabaikan_tanpa_admin(client, db):
    draft = DatasetVersion(tahun=2025, version_no=777, status="draft")
    db.add(draft)
    db.flush()

    body = client.get("/api/v1/summary", params={"version_id": str(draft.id)}).json()
    assert body["version"]["id"] != str(draft.id)


def test_summary_rasio_empat_desimal(client):
    nilai = client.get("/api/v1/summary").json()["rasio_swasembada"]
    assert Decimal(str(nilai)) == Decimal("1.3977")
