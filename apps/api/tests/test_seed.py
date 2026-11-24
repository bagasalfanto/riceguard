"""Seed 2025: angka harus sama dengan dataset_v1.csv dan rekomendasi_distribusi_v1.csv."""
from app.db.models import DatasetVersion, DistributionRecommendation, Province, ProvinceStat
from app.services.seed import seed
from sqlalchemy import select


def _kosongkan_tahun(db, tahun=2025):
    for v in db.scalars(select(DatasetVersion).where(DatasetVersion.tahun == tahun)).all():
        db.delete(v)
    db.flush()


def test_seed_menghasilkan_versi_lengkap(db):
    _kosongkan_tahun(db)
    hasil = seed(db, 2025)

    assert hasil["status"] == "ok"
    assert hasil["provinsi"] == 38
    assert hasil["rekomendasi"] == 27

    versi = db.get(DatasetVersion, hasil["version_id"])
    assert versi.status == "published"
    assert versi.published_at is not None
    assert len(db.scalars(select(Province)).all()) >= 38
    assert len(db.scalars(select(ProvinceStat).where(ProvinceStat.version_id == versi.id)).all()) == 38
    assert (
        len(db.scalars(
            select(DistributionRecommendation).where(DistributionRecommendation.version_id == versi.id)
        ).all())
        == 27
    )


def test_angka_summary_sesuai_dataset(db):
    _kosongkan_tahun(db)
    hasil = seed(db, 2025)
    s = hasil["summary"]

    assert round(s["produksi_beras_ton"]) == 34_690_959
    assert round(s["kebutuhan_beras_ton"]) == 24_819_269
    assert round(s["rice_balance_ton"]) == 9_871_690
    assert s["jumlah_status"] == {"surplus": 17, "balanced": 1, "defisit": 20}
    assert round(s["total_dialokasikan_ton"]) == 2_889_188
    assert s["jumlah_pasangan"] == 27


def test_hasil_validasi_lulus(db):
    _kosongkan_tahun(db)
    hasil = seed(db, 2025)
    versi = db.get(DatasetVersion, hasil["version_id"])
    assert versi.validation["lulus"] is True
    kode = {a["kode"]: a["status"] for a in versi.validation["aturan"]}
    assert kode["jumlah_provinsi"] == "lulus"
    assert kode["nilai_positif"] == "lulus"
    assert kode["total_produksi"] == "lulus"
    assert kode["total_penduduk"] == "lulus"


def test_seed_idempoten(db):
    _kosongkan_tahun(db)
    pertama = seed(db, 2025)
    kedua = seed(db, 2025)

    assert kedua["status"] == "dilewati"
    assert kedua["version_id"] == pertama["version_id"]
    jumlah = len(db.scalars(select(DatasetVersion).where(DatasetVersion.tahun == 2025)).all())
    assert jumlah == 1
