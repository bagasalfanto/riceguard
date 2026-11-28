"""Regresi T11.4: fitur prediksi AI tidak mengubah respons endpoint resmi."""
from __future__ import annotations

import json

import httpx
from app.core.cache import cache
from app.core.config import Settings, get_settings
from app.main import app
from app.routers.publik.forecast import get_forecast_transport

OFFICIAL_ENDPOINTS = (
    "/api/v1/summary",
    "/api/v1/provinces",
    "/api/v1/map/layers?layer=status",
)


def _mock_forecast_transport(request: httpx.Request) -> httpx.Response:
    payload = json.loads(request.content.decode("utf-8"))
    items = [
        {
            "kode_bps": p["kode_bps"],
            "provinsi": p["provinsi"],
            "nilai": 99_999_999.0,
            "interval_bawah": 90_000_000.0,
            "interval_atas": 110_000_000.0,
        }
        for p in payload["provinsi"]
    ]
    return httpx.Response(
        200,
        json={
            "tahun": payload["tahun"],
            "satuan": "ton",
            "items": items,
            "model": {"nama": "mock-isolation", "versi": "0.0.1"},
        },
    )


def test_endpoint_resmi_identik_saat_forecast_nonaktif_vs_aktif(client):
    # 1. Kondisi nonaktif (503)
    cache.clear_all()
    app.dependency_overrides[get_settings] = lambda: Settings(ai_endpoint_url="")
    app.dependency_overrides[get_forecast_transport] = lambda: None
    try:
        r_forecast_off = client.get("/api/v1/forecast")
        assert r_forecast_off.status_code == 503
        baseline = {path: client.get(path).content for path in OFFICIAL_ENDPOINTS}
    finally:
        app.dependency_overrides.pop(get_settings, None)
        app.dependency_overrides.pop(get_forecast_transport, None)

    # 2. Kondisi aktif (200 dengan angka prediksi ekstrem)
    cache.clear_all()
    app.dependency_overrides[get_settings] = lambda: Settings(
        ai_endpoint_url="https://hf.example.test/predict"
    )
    app.dependency_overrides[get_forecast_transport] = lambda: httpx.MockTransport(
        _mock_forecast_transport
    )
    try:
        r_forecast_on = client.get("/api/v1/forecast")
        assert r_forecast_on.status_code == 200
        active = {path: client.get(path).content for path in OFFICIAL_ENDPOINTS}
    finally:
        app.dependency_overrides.pop(get_settings, None)
        app.dependency_overrides.pop(get_forecast_transport, None)

    for path in OFFICIAL_ENDPOINTS:
        assert active[path] == baseline[path], f"Respons {path} berubah karena /forecast"
