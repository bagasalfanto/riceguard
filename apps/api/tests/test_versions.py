"""Resolusi versi: publik hanya melihat published."""
import pytest
from app.core.errors import AppError
from app.db.models import DatasetVersion
from app.services.versions import list_published_years, resolve_for_read, resolve_published
from sqlalchemy import select


def test_tahun_terbaru_dipakai_kalau_tahun_kosong(db):
    versi = resolve_published(db)
    assert versi.status == "published"
    assert versi.tahun == 2025


def test_tahun_tanpa_versi_published_404(db):
    with pytest.raises(AppError) as err:
        resolve_published(db, 2019)
    assert err.value.code == "NO_PUBLISHED_VERSION"
    assert err.value.status_code == 404


def test_daftar_tahun_published_urut_naik(db):
    tahun = [v.tahun for v in list_published_years(db)]
    assert tahun == sorted(tahun)
    assert 2025 in tahun


def test_version_id_diabaikan_tanpa_admin(db):
    draft = DatasetVersion(tahun=2025, version_no=999, status="draft")
    db.add(draft)
    db.flush()

    versi = resolve_for_read(db, tahun=2025, version_id=str(draft.id), admin=None)
    assert versi.status == "published"
    assert versi.id != draft.id


def test_version_id_dihormati_untuk_admin(db):
    draft = DatasetVersion(tahun=2025, version_no=998, status="draft")
    db.add(draft)
    db.flush()

    versi = resolve_for_read(db, tahun=2025, version_id=str(draft.id), admin=object())
    assert versi.id == draft.id


@pytest.mark.parametrize("buruk", ["bukan-uuid", "../../etc/passwd", "1' or '1'='1", "0" * 40])
def test_version_id_bukan_uuid_ditolak_tanpa_menyentuh_database(db, buruk):
    """Nilai non-UUID tidak boleh sampai ke Postgres: DataError akan membatalkan transaksi."""
    with pytest.raises(AppError) as err:
        resolve_for_read(db, tahun=2025, version_id=buruk, admin=object())
    assert err.value.status_code == 404
    assert err.value.code == "NOT_FOUND"

    # Sesi masih sehat: query berikutnya harus jalan, bukan InFailedSqlTransaction.
    assert resolve_published(db, 2025).status == "published"


def test_version_id_uuid_tapi_tidak_ada(db):
    with pytest.raises(AppError) as err:
        resolve_for_read(db, tahun=2025, version_id="00000000-0000-4000-8000-000000000000", admin=object())
    assert err.value.status_code == 404


def test_hanya_satu_published_per_tahun(db):
    dari_db = db.scalars(
        select(DatasetVersion).where(DatasetVersion.tahun == 2025, DatasetVersion.status == "published")
    ).all()
    assert len(dari_db) == 1
