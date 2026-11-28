"""delta_tahun_sebelumnya — butuh dua tahun published berurutan."""
import pytest
from app.db.models import DatasetVersion, ProvinceStat
from sqlalchemy import select

TAHUN = 2025
SEBELUM = 2024


@pytest.fixture
def dua_tahun(db):
    """Salin 38 baris 2025 ke 2024 dengan produksi x0,9 dan konsumsi identik."""
    asal = db.scalars(
        select(DatasetVersion).where(DatasetVersion.tahun == TAHUN, DatasetVersion.status == "published")
    ).one()

    lama = DatasetVersion(tahun=SEBELUM, version_no=1, status="published")
    db.add(lama)
    db.flush()

    for stat in db.scalars(select(ProvinceStat).where(ProvinceStat.version_id == asal.id)):
        produksi = (stat.produksi_beras_ton * 9 / 10).quantize(stat.produksi_beras_ton)
        kebutuhan = stat.kebutuhan_beras_ton
        db.add(
            ProvinceStat(
                version_id=lama.id,
                kode_bps=stat.kode_bps,
                penduduk_jiwa=stat.penduduk_jiwa,
                konsumsi_kg_kapita_tahun=stat.konsumsi_kg_kapita_tahun,
                produksi_padi_ton_gkg=stat.produksi_padi_ton_gkg,
                produksi_beras_ton=produksi,
                kebutuhan_beras_ton=kebutuhan,
                rice_balance_ton=produksi - kebutuhan,
                rasio_swasembada=produksi / kebutuhan,
                status=stat.status,
            )
        )
    db.flush()
    return lama


def test_delta_terisi_dengan_dua_tahun(client, dua_tahun):
    delta = client.get("/api/v1/summary", params={"tahun": TAHUN}).json()["delta_tahun_sebelumnya"]

    assert delta["tahun"] == SEBELUM
    assert delta["produksi_persen"] == pytest.approx(11.11, abs=0.02)
    assert delta["kebutuhan_persen"] == pytest.approx(0.0, abs=0.01)
    assert delta["balance_ton"] > 0
    assert delta["balance_persen"] is not None


def test_delta_null_kalau_tahun_sebelumnya_tidak_berurutan(client, db):
    """2023 published, 2025 published: 2025 tidak punya `tahun - 1`."""
    asal = db.scalars(
        select(DatasetVersion).where(DatasetVersion.tahun == TAHUN, DatasetVersion.status == "published")
    ).one()
    db.add(DatasetVersion(tahun=2023, version_no=1, status="published"))
    db.flush()

    assert asal.tahun == TAHUN
    assert client.get("/api/v1/summary", params={"tahun": TAHUN}).json()["delta_tahun_sebelumnya"] is None


def test_delta_pembagian_nol_jadi_null(client, db, dua_tahun):
    """Tahun lama dengan produksi 0 tidak boleh menghasilkan Infinity."""
    from app.services.summary import _persen

    assert _persen(10.0, 0.0) is None
    assert _persen(0.0, 0.0) is None
    assert _persen(10.0, 5.0) == 100.0
