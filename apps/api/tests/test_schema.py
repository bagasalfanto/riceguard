"""Skema database sesuai PRD bagian 9."""
from sqlalchemy import inspect, text

TABEL = [
    "provinces",
    "dataset_versions",
    "province_stats",
    "province_stat_edits",
    "distribution_recommendations",
    "data_sources",
    "site_content",
    "admins",
    "audit_log",
]


def test_sembilan_tabel_ada(engine):
    ada = set(inspect(engine).get_table_names())
    assert set(TABEL) <= ada


def test_enum_ada(engine):
    with engine.connect() as c:
        nilai = dict(
            c.execute(
                text(
                    "select t.typname, string_agg(e.enumlabel, ',' order by e.enumsortorder) "
                    "from pg_type t join pg_enum e on e.enumtypid = t.oid "
                    "where t.typname in ('version_status','province_status') group by t.typname"
                )
            ).all()
        )
    assert nilai["version_status"] == "draft,published,archived"
    assert nilai["province_status"] == "surplus,balanced,defisit"


def test_unique_index_satu_published_per_tahun(engine):
    with engine.connect() as c:
        ada = c.execute(
            text("select 1 from pg_indexes where indexname = 'dataset_versions_one_published'")
        ).first()
    assert ada is not None


def test_rls_aktif_di_semua_tabel_public(engine):
    with engine.connect() as c:
        baris = c.execute(
            text(
                "select tablename, rowsecurity from pg_tables where schemaname = 'public'"
            )
        ).all()
    assert baris
    assert all(r.rowsecurity for r in baris), [r.tablename for r in baris if not r.rowsecurity]


def test_check_constraint_menolak_nilai_tidak_masuk_akal(engine):
    from sqlalchemy.exc import IntegrityError

    with engine.connect() as c:
        trans = c.begin()
        versi = c.execute(text("select id from dataset_versions limit 1")).scalar()
        if versi is None:
            trans.rollback()
            import pytest

            pytest.skip("belum ada versi")
        try:
            c.execute(
                text(
                    "insert into province_stats (version_id, kode_bps, penduduk_jiwa, "
                    "konsumsi_kg_kapita_tahun, produksi_padi_ton_gkg, produksi_beras_ton, "
                    "kebutuhan_beras_ton, rice_balance_ton, rasio_swasembada, status) "
                    "values (:v, '11', -1, 90, 1, 1, 1, 0, 1, 'surplus')"
                ),
                {"v": versi},
            )
            raise AssertionError("penduduk negatif seharusnya ditolak")
        except IntegrityError:
            pass
        finally:
            trans.rollback()
