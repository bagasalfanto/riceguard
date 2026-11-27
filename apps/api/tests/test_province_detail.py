"""GET /provinces/{kode_bps} — detail, rumus terisi, rekomendasi terkait, riwayat, dan 404 (T4.2)."""
from app.db.models import DatasetVersion, ProvinceStat
from sqlalchemy import select


def test_detail_dki_jakarta_defisit(client):
    r = client.get("/api/v1/provinces/31", params={"tahun": 2025})
    assert r.status_code == 200
    body = r.json()

    assert body["kode_bps"] == "31"
    assert body["provinsi"] == "DKI Jakarta"
    assert body["status"] == "defisit"
    assert body["kebutuhan_beras_ton"] == 864381.32
    assert body["rice_balance_ton"] == -863504.32

    langkah = {p["langkah"]: p for p in body["perhitungan"]}
    assert set(langkah) == {"kebutuhan", "balance", "rasio", "klasifikasi"}
    assert langkah["kebutuhan"]["hasil"] == body["kebutuhan_beras_ton"]
    assert langkah["balance"]["hasil"] == body["rice_balance_ton"]
    assert langkah["rasio"]["hasil"] == body["rasio_swasembada"]
    assert langkah["klasifikasi"]["hasil"] == "defisit"

    assert len(body["rekomendasi_terkait"]) >= 1
    assert all(row["ke_kode"] == "31" for row in body["rekomendasi_terkait"])
    assert body["catatan"] is None
    assert len(body["riwayat"]) == 1
    assert body["riwayat"][0]["tahun"] == 2025


def test_detail_jawa_barat_dan_sumatera_selatan_surplus(client):
    jabar = client.get("/api/v1/provinces/32", params={"tahun": 2025}).json()
    assert jabar["status"] == "surplus"
    assert len(jabar["rekomendasi_terkait"]) == 2
    assert all(row["dari_kode"] == "32" for row in jabar["rekomendasi_terkait"])

    sumsel = client.get("/api/v1/provinces/16", params={"tahun": 2025}).json()
    assert sumsel["status"] == "surplus"
    assert len(sumsel["rekomendasi_terkait"]) == 5
    assert all(row["dari_kode"] == "16" for row in sumsel["rekomendasi_terkait"])


def test_detail_kalimantan_barat_balanced(client):
    body = client.get("/api/v1/provinces/61", params={"tahun": 2025}).json()
    assert body["provinsi"] == "Kalimantan Barat"
    assert body["status"] == "balanced"
    assert body["rice_balance_ton"] < 0
    assert body["rekomendasi_terkait"] == []
    assert body["catatan"] and "tidak ikut matching" in body["catatan"]


def test_detail_kode_tidak_dikenal_404(client):
    r = client.get("/api/v1/provinces/99")
    assert r.status_code == 404
    err = r.json()["error"]
    assert err["code"] == "NOT_FOUND"
    assert err["details"]["kode_bps"] == "99"


def test_detail_riwayat_multi_tahun(client, db):
    asal = db.scalars(
        select(DatasetVersion).where(DatasetVersion.tahun == 2025, DatasetVersion.status == "published")
    ).one()
    stat_asal = db.scalars(
        select(ProvinceStat).where(ProvinceStat.version_id == asal.id, ProvinceStat.kode_bps == "31")
    ).one()

    lama = DatasetVersion(tahun=2024, version_no=1, status="published")
    db.add(lama)
    db.flush()

    db.add(
        ProvinceStat(
            version_id=lama.id,
            kode_bps="31",
            penduduk_jiwa=stat_asal.penduduk_jiwa,
            konsumsi_kg_kapita_tahun=stat_asal.konsumsi_kg_kapita_tahun,
            produksi_padi_ton_gkg=stat_asal.produksi_padi_ton_gkg,
            produksi_beras_ton=stat_asal.produksi_beras_ton,
            kebutuhan_beras_ton=stat_asal.kebutuhan_beras_ton,
            rice_balance_ton=stat_asal.rice_balance_ton,
            rasio_swasembada=stat_asal.rasio_swasembada,
            status=stat_asal.status,
        )
    )
    db.flush()

    body = client.get("/api/v1/provinces/31", params={"tahun": 2025}).json()
    assert [row["tahun"] for row in body["riwayat"]] == [2024, 2025]
