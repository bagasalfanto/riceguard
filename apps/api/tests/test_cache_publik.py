"""Cache respons publik dan header Cache-Control (optimasi query)."""
from app.core.cache import cache


def test_cache_terisi_setelah_request_pertama(client):
    cache.clear_all()
    assert len(cache) == 0

    client.get("/api/v1/summary")
    assert len(cache) == 1

    client.get("/api/v1/summary")
    assert len(cache) == 1, "request kedua harus memakai entri cache yang sama"


def test_cache_dipisah_per_version(client):
    cache.clear_all()
    client.get("/api/v1/summary", params={"tahun": 2025})

    kunci = list(cache._data)
    assert kunci and kunci[0][0] == "summary"
    assert kunci[0][1], "kunci cache harus memuat version_id"


def test_cache_dikosongkan_setelah_clear_all(client):
    client.get("/api/v1/provinces")
    assert len(cache) > 0

    cache.clear_all()
    assert len(cache) == 0


def test_header_cache_control_untuk_publik(client):
    r = client.get("/api/v1/summary")
    assert r.headers["cache-control"] == "public, max-age=300"


def test_header_cache_control_tidak_untuk_admin(client):
    r = client.get("/api/v1/summary", headers={"Authorization": "Bearer dummy"})
    assert "cache-control" not in r.headers


def test_header_cache_control_tidak_untuk_error(client):
    r = client.get("/api/v1/summary", params={"tahun": 2019})
    assert r.status_code == 404
    assert "cache-control" not in r.headers
