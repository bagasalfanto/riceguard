"""GET /meta/years dan format error seragam."""
from app.core.cache import ResponseCache


def test_health_tanpa_database():
    from app.main import app
    from fastapi.testclient import TestClient

    with TestClient(app) as c:
        assert c.get("/health").json() == {"status": "ok"}


def test_meta_years_memuat_versi_published(client):
    r = client.get("/api/v1/meta/years")
    assert r.status_code == 200
    body = r.json()
    assert body["jumlah_tahun"] >= 1
    assert body["tahun_terbaru"] == 2025
    assert body["butuh_minimal_2_tahun"] is (body["jumlah_tahun"] < 2)
    pertama = body["tahun"][0]
    assert set(pertama) == {"tahun", "version_id", "version_no", "published_at"}


def test_docs_tersedia(client):
    assert client.get("/openapi.json").status_code == 200


def test_format_error_seragam():
    """Handler error langsung: format sama untuk AppError dan error validasi Pydantic."""
    import asyncio
    import json

    from app.core.errors import AppError, app_error_handler, validation_error_handler
    from fastapi.exceptions import RequestValidationError

    async def jalankan(handler, exc):
        return await handler(None, exc)

    r = asyncio.run(jalankan(app_error_handler, AppError("NO_PUBLISHED_VERSION", 404, "kosong", {"tahun": 2019})))
    body = json.loads(r.body)
    assert r.status_code == 404
    assert body == {"error": {"code": "NO_PUBLISHED_VERSION", "message": "kosong", "details": {"tahun": 2019}}}

    r = asyncio.run(jalankan(validation_error_handler, RequestValidationError([])))
    body = json.loads(r.body)
    assert r.status_code == 400
    assert body["error"]["code"] == "INVALID_PARAMS"
    assert set(body["error"]) == {"code", "message", "details"}


def test_error_handler_tahan_objek_yang_tidak_bisa_di_json():
    """Validator kustom menaruh ValueError di ctx. Tanpa penyaringan ini jadi 500, bukan 400."""
    import asyncio
    import json

    from app.core.errors import AppError, app_error_handler, validation_error_handler
    from fastapi.exceptions import RequestValidationError
    from pydantic import BaseModel, ValidationError, field_validator

    class Contoh(BaseModel):
        n: int

        @field_validator("n")
        @classmethod
        def selalu_gagal(cls, v: int) -> int:
            raise ValueError("gagal di validator")

    try:
        Contoh(n=1)
    except ValidationError as err:
        galat = err.errors()
    assert isinstance(galat[0]["ctx"]["error"], ValueError)

    async def jalankan(handler, exc):
        return await handler(None, exc)

    r = asyncio.run(jalankan(validation_error_handler, RequestValidationError(galat)))
    body = json.loads(r.body)
    assert r.status_code == 400
    assert body["error"]["details"][0]["ctx"]["error"] == "gagal di validator"
    assert body["error"]["details"][0]["loc"] == ["n"]

    r = asyncio.run(jalankan(app_error_handler, AppError("X", 409, "detail aneh", {"err": ValueError("boom")})))
    assert json.loads(r.body)["error"]["details"] == {"err": "boom"}


def test_cache_hit_dan_invalidasi():
    cache = ResponseCache()
    cache.set(("a", "v1", "x=1"), {"nilai": 1})

    assert cache.get(("a", "v1", "x=1")) == {"nilai": 1}
    assert cache.get(("a", "v2", "x=1")) is None

    cache.set(("b", "v1", ""), {"nilai": 2})
    cache.clear_version("v1")
    assert cache.get(("a", "v1", "x=1")) is None
    assert cache.get(("b", "v1", "")) is None


def test_cache_kedaluwarsa():
    cache = ResponseCache(ttl=0)
    cache.set(("a", "v1", ""), 1)
    assert cache.get(("a", "v1", "")) is None


def test_cache_dibatasi_ukuran():
    """Kunci cache memuat query string klien, jadi jumlah entri harus dibatasi."""
    cache = ResponseCache(maks_entri=3)
    for i in range(10):
        cache.set(("provinces", "v1", f"q={i}"), i)

    assert len(cache) == 3
    assert cache.get(("provinces", "v1", "q=9")) == 9
    assert cache.get(("provinces", "v1", "q=0")) is None
