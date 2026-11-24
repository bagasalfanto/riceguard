"""Fixture tes API. Butuh DATABASE_URL yang sudah dimigrasi; tanpa itu tes di-skip."""
from __future__ import annotations

import os

import pytest

DATABASE_URL = os.getenv("DATABASE_URL", "")

pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL belum diisi")


@pytest.fixture(scope="session")
def engine():
    from app.db.session import get_engine

    return get_engine()


@pytest.fixture(scope="session", autouse=True)
def _skema_ada(engine):
    """Tes hanya jalan kalau migrasi sudah diterapkan."""
    from sqlalchemy import inspect

    tabel = set(inspect(engine).get_table_names())
    wajib = {"provinces", "dataset_versions", "province_stats", "distribution_recommendations"}
    if not wajib <= tabel:
        pytest.skip("skema belum dimigrasi (jalankan supabase/migrations/0001_init.sql)")


@pytest.fixture(scope="session", autouse=True)
def _ada_versi_published(_skema_ada):
    """Pastikan ada versi 2025 published supaya endpoint publik bisa diuji."""
    from sqlalchemy import select
    from sqlalchemy.orm import Session

    from app.db.models import DatasetVersion
    from app.db.session import get_engine
    from app.services.seed import seed

    with Session(get_engine()) as db:
        ada = db.scalars(
            select(DatasetVersion).where(DatasetVersion.status == "published")
        ).first()
        if ada is None:
            seed(db)


@pytest.fixture
def db(engine):
    """Sesi yang selalu di-rollback: commit di dalam tes tidak mengotori database."""
    from sqlalchemy.orm import Session

    with engine.connect() as koneksi:
        trans = koneksi.begin()
        sesi = Session(bind=koneksi, join_transaction_mode="create_savepoint", expire_on_commit=False)
        try:
            yield sesi
        finally:
            sesi.close()
            trans.rollback()


@pytest.fixture
def client(db):
    from fastapi.testclient import TestClient

    from app.db.session import get_db
    from app.main import app

    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
