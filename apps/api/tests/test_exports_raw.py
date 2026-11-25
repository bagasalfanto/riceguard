"""GET /api/v1/exports/raw/{nama_file} — allowlist, traversal, draft 404, storage proxy (T8.4)."""
from __future__ import annotations

import httpx
import pytest
from app.core.config import Settings
from app.core.errors import AppError
from app.db.models import DatasetVersion
from app.services.exports import resolve_allowlisted_raw_file
from app.services.storage import content_type_untuk_file, download_raw_object
from sqlalchemy import select


def test_unit_allowlist_dan_tolak_path_traversal():
    source_files = {
        "produksi": "produksi_2025.txt",
        "penduduk": "penduduk_supas2025.txt",
        "konsumsi": "konsumsi_bapanas_2025.csv",
        "referensi": "provinces-reference-serlin.csv",
    }

    assert resolve_allowlisted_raw_file(source_files, "produksi_2025.txt") == "produksi_2025.txt"
    assert resolve_allowlisted_raw_file(source_files, "konsumsi_bapanas_2025.csv") == "konsumsi_bapanas_2025.csv"

    for buruk in (
        "",
        "produksi_2024.txt",
        "../../etc/passwd",
        "..\\..\\etc\\passwd",
        "sub/produksi_2025.txt",
        "..",
        "produksi_2025.txt ",
    ):
        with pytest.raises(AppError) as err:
            resolve_allowlisted_raw_file(source_files, buruk)
        assert err.value.status_code == 404
        assert err.value.code == "NOT_FOUND"


def test_unit_content_type_file_mentah():
    assert content_type_untuk_file("konsumsi_bapanas_2025.csv") == "text/csv; charset=utf-8"
    assert content_type_untuk_file("produksi_2025.txt") == "text/plain; charset=utf-8"


def test_unit_storage_tanpa_service_key_503_dan_sukses_dengan_mock_httpx(monkeypatch):
    monkeypatch.setattr(
        "app.services.storage.get_settings",
        lambda: Settings(database_url="postgresql://x", supabase_service_role_key=""),
    )
    with pytest.raises(AppError) as err_503:
        download_raw_object("2025/id/produksi_2025.txt", nama_file="produksi_2025.txt")
    assert err_503.value.status_code == 503
    assert err_503.value.code == "STORAGE_UNAVAILABLE"

    rekam = {}

    def handler(request: httpx.Request) -> httpx.Response:
        rekam["url"] = str(request.url)
        rekam["auth"] = request.headers.get("authorization")
        rekam["apikey"] = request.headers.get("apikey")
        if str(request.url).endswith("/missing.txt"):
            return httpx.Response(404, json={"error": "not_found"})
        if str(request.url).endswith("/boom.txt"):
            return httpx.Response(500, text="internal error")
        return httpx.Response(200, content=b"isi-mentah")

    monkeypatch.setattr(
        "app.services.storage.get_settings",
        lambda: Settings(
            database_url="postgresql://x",
            supabase_url="https://contoh.supabase.co",
            supabase_service_role_key="rahasia-service-role",
        ),
    )
    monkeypatch.setattr(
        "app.services.storage._http_client",
        lambda: httpx.Client(transport=httpx.MockTransport(handler)),
    )

    konten = download_raw_object("2025/uuid-1/produksi_2025.txt", nama_file="produksi_2025.txt")
    assert konten == b"isi-mentah"
    assert rekam["url"] == "https://contoh.supabase.co/storage/v1/object/raw-uploads/2025/uuid-1/produksi_2025.txt"
    assert rekam["auth"] == "Bearer rahasia-service-role"
    assert rekam["apikey"] == "rahasia-service-role"

    with pytest.raises(AppError) as err_404:
        download_raw_object("2025/uuid-1/missing.txt", nama_file="missing.txt")
    assert err_404.value.status_code == 404
    assert err_404.value.code == "NOT_FOUND"

    with pytest.raises(AppError) as err_upstream:
        download_raw_object("2025/uuid-1/boom.txt", nama_file="boom.txt")
    assert err_upstream.value.status_code == 503
    assert err_upstream.value.code == "STORAGE_UNAVAILABLE"


def test_export_raw_sukses_empat_file_published_tanpa_admin(client, db, monkeypatch):
    versi = db.scalars(
        select(DatasetVersion).where(DatasetVersion.tahun == 2025, DatasetVersion.status == "published")
    ).one()

    dipanggil: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        dipanggil.append(request.url.path)
        return httpx.Response(200, content=f"konten:{request.url.path}".encode())

    monkeypatch.setattr(
        "app.services.storage.get_settings",
        lambda: Settings(
            database_url="postgresql://x",
            supabase_url="https://contoh.supabase.co",
            supabase_service_role_key="kunci-uji",
        ),
    )
    monkeypatch.setattr(
        "app.services.storage._http_client",
        lambda: httpx.Client(transport=httpx.MockTransport(handler)),
    )

    expected = [
        ("produksi_2025.txt", "text/plain; charset=utf-8"),
        ("penduduk_supas2025.txt", "text/plain; charset=utf-8"),
        ("konsumsi_bapanas_2025.csv", "text/csv; charset=utf-8"),
        ("provinces-reference-serlin.csv", "text/csv; charset=utf-8"),
    ]
    for nama_file, expected_mime in expected:
        r = client.get(f"/api/v1/exports/raw/{nama_file}", params={"tahun": 2025})
        assert r.status_code == 200
        assert r.headers["content-type"] == expected_mime
        assert r.headers["content-disposition"] == f'attachment; filename="{nama_file}"'
        expected_path = f"/storage/v1/object/raw-uploads/2025/{versi.id}/{nama_file}"
        assert expected_path in dipanggil
        assert r.content == f"konten:{expected_path}".encode()


@pytest.mark.parametrize(
    "nama_file",
    [
        "produksi_2024.txt",
        "..%2F..%2Fetc%2Fpasswd",
        "subdir%2Fproduksi_2025.txt",
    ],
)
def test_export_raw_tolak_allowlist_dan_traversal_404(client, nama_file):
    r = client.get(f"/api/v1/exports/raw/{nama_file}", params={"tahun": 2025})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"


def test_export_raw_tolak_traversal_literal_404(client):
    r = client.get("/api/v1/exports/raw/../../etc/passwd")
    assert r.status_code == 404


def test_export_raw_tolak_versi_draft_404(client, db, monkeypatch):
    monkeypatch.setattr(
        "app.services.storage.get_settings",
        lambda: Settings(
            database_url="postgresql://x",
            supabase_url="https://contoh.supabase.co",
            supabase_service_role_key="kunci-uji",
        ),
    )

    draft_tahun = DatasetVersion(
        tahun=2026,
        version_no=1,
        status="draft",
        source_files={"produksi": "produksi_2026.txt"},
    )
    draft_2025 = DatasetVersion(
        tahun=2025,
        version_no=780,
        status="draft",
        source_files={"produksi": "produksi_2025_draft.txt"},
    )
    db.add_all([draft_tahun, draft_2025])
    db.flush()

    r_tahun_draft = client.get("/api/v1/exports/raw/produksi_2026.txt", params={"tahun": 2026})
    assert r_tahun_draft.status_code == 404
    assert r_tahun_draft.json()["error"]["code"] == "NO_PUBLISHED_VERSION"

    r_file_draft = client.get(
        "/api/v1/exports/raw/produksi_2025_draft.txt",
        params={"tahun": 2025, "version_id": str(draft_2025.id)},
    )
    assert r_file_draft.status_code == 404
    assert r_file_draft.json()["error"]["code"] == "NOT_FOUND"


def test_export_raw_tanpa_service_key_503(client, monkeypatch):
    monkeypatch.setattr(
        "app.services.storage.get_settings",
        lambda: Settings(database_url="postgresql://x", supabase_service_role_key=""),
    )
    r = client.get("/api/v1/exports/raw/produksi_2025.txt", params={"tahun": 2025})
    assert r.status_code == 503
    assert r.json()["error"]["code"] == "STORAGE_UNAVAILABLE"
