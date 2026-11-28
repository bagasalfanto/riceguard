"""GET /forecast — gating 503, error upstream 502 tanpa kebocoran token, dan respons 200 parsial (T11.1)."""
from __future__ import annotations

import json
from collections.abc import Iterator
from contextlib import contextmanager

import httpx
from app.core.config import Settings, get_settings
from app.main import app
from app.routers.publik.forecast import get_forecast_transport


@contextmanager
def _override_forecast(
    *,
    settings: Settings,
    transport: httpx.BaseTransport | None = None,
) -> Iterator[None]:
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_forecast_transport] = lambda: transport
    try:
        yield
    finally:
        app.dependency_overrides.pop(get_settings, None)
        app.dependency_overrides.pop(get_forecast_transport, None)


def test_forecast_tanpa_endpoint_mengembalikan_503(client):
    cfg = Settings(ai_endpoint_url="", ai_api_token="")
    with _override_forecast(settings=cfg):
        r = client.get("/api/v1/forecast")

    assert r.status_code == 503
    body = r.json()
    assert body["error"]["code"] == "AI_UNAVAILABLE"
    assert body["error"]["details"] == {"alasan": "endpoint model belum dikonfigurasi"}


def test_forecast_upstream_error_dan_timeout_502_tanpa_bocor_token(client):
    secret_token = "hf_rahasia_token_jangan_bocor_987"
    captured_auth: list[str | None] = []

    def handle_500(request: httpx.Request) -> httpx.Response:
        captured_auth.append(request.headers.get("authorization"))
        return httpx.Response(500, json={"detail": "model crash"})

    def handle_timeout(request: httpx.Request) -> httpx.Response:
        captured_auth.append(request.headers.get("authorization"))
        raise httpx.ReadTimeout("upstream timeout", request=request)

    def handle_invalid_json(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"bukan-json")

    cfg = Settings(
        ai_endpoint_url="https://hf.example.test/predict",
        ai_api_token=secret_token,
        ai_timeout_detik=5.0,
    )

    for transport in (
        httpx.MockTransport(handle_500),
        httpx.MockTransport(handle_timeout),
        httpx.MockTransport(handle_invalid_json),
    ):
        with _override_forecast(settings=cfg, transport=transport):
            r = client.get("/api/v1/forecast")

        assert r.status_code == 502
        body = r.json()
        assert body["error"]["code"] == "AI_UPSTREAM_ERROR"
        assert secret_token not in r.text

    assert captured_auth == [f"Bearer {secret_token}", f"Bearer {secret_token}"]


def test_forecast_200_parsial_36_dari_38_mencatat_kode_hilang(client):
    captured_payload: dict = {}
    captured_headers: dict[str, str] = {}

    def handle_ok(request: httpx.Request) -> httpx.Response:
        nonlocal captured_payload, captured_headers
        captured_payload = json.loads(request.content.decode("utf-8"))
        captured_headers = dict(request.headers)

        prov_list = captured_payload["provinsi"]
        # Kembalikan 36 dari 38 provinsi (hilangkan 2 kode pertama)
        items = [
            {
                "kode_bps": p["kode_bps"],
                "provinsi": p["provinsi"],
                "nilai": round(p["produksi_beras_ton"] * 1.03, 2),
                "interval_bawah": round(p["produksi_beras_ton"] * 0.98, 2),
                "interval_atas": round(p["produksi_beras_ton"] * 1.08, 2),
            }
            for p in prov_list[2:]
        ]
        return httpx.Response(
            200,
            json={
                "tahun": captured_payload["tahun"],
                "satuan": "ton",
                "items": items,
                "model": {"nama": "rice-rf", "versi": "1.2.0"},
                "tahun_tersedia": [2026, 2027],
            },
        )

    cfg = Settings(
        ai_endpoint_url="https://hf.example.test/predict",
        ai_api_token="",
        ai_timeout_detik=10.0,
    )
    with _override_forecast(settings=cfg, transport=httpx.MockTransport(handle_ok)):
        r = client.get("/api/v1/forecast", params={"tahun": 2026})

    assert r.status_code == 200
    assert "authorization" not in captured_headers
    assert captured_payload["tahun"] == 2026
    assert len(captured_payload["provinsi"]) == 38
    assert set(captured_payload["provinsi"][0]) == {
        "kode_bps",
        "provinsi",
        "penduduk_jiwa",
        "konsumsi_kg_kapita_tahun",
        "produksi_beras_ton",
        "kebutuhan_beras_ton",
    }

    body = r.json()
    assert body["tahun"] == 2026
    assert body["satuan"] == "ton"
    assert len(body["items"]) == 36
    assert body["model"] == {"nama": "rice-rf", "versi": "1.2.0"}
    hilang = body["details"]["kode_tanpa_prediksi"]
    assert len(hilang) == 2
    assert hilang == [p["kode_bps"] for p in captured_payload["provinsi"][:2]]
    assert body["details"]["tahun_tersedia"] == [2026, 2027]


def test_forecast_tahun_lampau_tanpa_published_404(client):
    cfg = Settings(ai_endpoint_url="https://hf.example.test/predict")
    with _override_forecast(
        settings=cfg,
        transport=httpx.MockTransport(lambda req: httpx.Response(200, json={"items": []})),
    ):
        r = client.get("/api/v1/forecast", params={"tahun": 2019})

    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NO_PUBLISHED_VERSION"
