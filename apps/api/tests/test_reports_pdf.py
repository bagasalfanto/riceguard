"""Tes rendering chart/peta Matplotlib, template HTML A4, validasi route, dan WeasyPrint PDF (T9.3)."""
from __future__ import annotations

import builtins
import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from app.core.errors import AppError
from app.services.pdf import (
    render_pdf_bytes,
    render_peta_png,
    render_report_html,
    render_status_distribusi_png,
    render_top_surplus_defisit_png,
)

REPO = Path(__file__).resolve().parents[3]
PNG_SIG = b"\x89PNG\r\n\x1a\n"


def _sample_metadata() -> dict:
    return {
        "versi": "v1",
        "version_id": "11111111-1111-4111-8111-111111111111",
        "version_no": 1,
        "tahun": 2025,
        "published_at": "2026-01-01T00:00:00+00:00",
        "published_by": "Sistem (Seed awal)",
        "tanggal_cetak": "2026-11-26T02:00:00+00:00",
        "sumber": [
            {
                "key": "produksi",
                "nama": "Produksi Padi dan Beras Menurut Provinsi",
                "instansi": "BPS",
                "tabel_resmi": "Survei KSA & Ubinan",
                "tahun": 2025,
            }
        ],
        "batasan": "Balance bukan stok beras aktual maupun rencana logistik.",
    }


def _sample_map_values() -> dict[str, str]:
    geo = json.loads((REPO / "dataset" / "geo" / "provinsi-38.min.geojson").read_text(encoding="utf-8"))
    statuses = ("surplus", "balanced", "defisit")
    return {
        f["properties"]["kode_bps"]: statuses[idx % 3]
        for idx, f in enumerate(geo["features"])
    }


def _sample_nasional_data() -> dict:
    return {
        "jenis": "nasional",
        "judul": "National Rice Security Report",
        "subjudul": "Laporan Ketahanan Beras Nasional",
        "tahun": 2025,
        "kpi": {
            "produksi_beras_ton": 34_691_234.56,
            "kebutuhan_beras_ton": 31_234_567.89,
            "rice_balance_ton": 3_456_666.67,
            "rasio_swasembada": 1.1107,
            "total_dialokasikan_ton": 2_900_000.0,
        },
        "ringkasan_status": {"surplus": 15, "balanced": 4, "defisit": 19},
        "top_surplus": [
            {"peringkat": i, "kode_bps": f"3{i}", "provinsi": f"Provinsi Surplus {i}", "nilai": 1_000_000.0 - i * 100_000}
            for i in range(1, 6)
        ],
        "top_defisit": [
            {"peringkat": i, "kode_bps": f"1{i}", "provinsi": f"Provinsi Defisit {i}", "nilai": -800_000.0 + i * 80_000}
            for i in range(1, 6)
        ],
        "top_produksi": [
            {"peringkat": i, "kode_bps": f"3{i}", "provinsi": f"Provinsi Prod {i}", "nilai": 5_000_000.0 - i * 300_000}
            for i in range(1, 6)
        ],
        "top_kebutuhan": [
            {"peringkat": i, "kode_bps": f"3{i}", "provinsi": f"Provinsi Keb {i}", "nilai": 4_000_000.0 - i * 250_000}
            for i in range(1, 6)
        ],
        "pulau_breakdown": [
            {
                "pulau": "Jawa",
                "produksi_beras_ton": 18_000_000.0,
                "kebutuhan_beras_ton": 17_000_000.0,
                "porsi_produksi": 0.52,
                "porsi_kebutuhan": 0.54,
                "jumlah_provinsi": 6,
            },
            {
                "pulau": "Sumatera",
                "produksi_beras_ton": 7_500_000.0,
                "kebutuhan_beras_ton": 6_400_000.0,
                "porsi_produksi": 0.22,
                "porsi_kebutuhan": 0.20,
                "jumlah_provinsi": 10,
            },
        ],
        "map_values": _sample_map_values(),
        "metadata": _sample_metadata(),
    }


def _sample_all_reports() -> list[dict]:
    nasional = _sample_nasional_data()
    map_vals = nasional["map_values"]
    meta = nasional["metadata"]
    prov_item = {
        "tahun": 2025,
        "kode_bps": "35",
        "kode_kemendagri": "35",
        "provinsi": "Jawa Timur",
        "pulau": "Jawa",
        "lat": -7.7194,
        "lng": 112.7324,
        "penduduk_jiwa": 41_500_000,
        "konsumsi_kg_kapita_tahun": 78.5,
        "produksi_padi_ton_gkg": 9_700_000.0,
        "produksi_beras_ton": 5_600_000.0,
        "kebutuhan_beras_ton": 3_257_750.0,
        "rice_balance_ton": 2_342_250.0,
        "rasio_swasembada": 1.719,
        "status": "surplus",
    }
    provinsi = {
        "jenis": "provinsi",
        "judul": "Regional Analysis Report",
        "subjudul": "Laporan Analisis Wilayah — Jawa Timur",
        "tahun": 2025,
        "provinsi": prov_item,
        "perhitungan": [
            {"langkah": "kebutuhan", "rumus": "41.500.000 × 78,5 kg / 1.000", "hasil": 3_257_750.0},
            {"langkah": "balance", "rumus": "5.600.000,00 − 3.257.750,00", "hasil": 2_342_250.0},
            {"langkah": "rasio", "rumus": "5.600.000,00 / 3.257.750,00", "hasil": 1.719},
            {"langkah": "klasifikasi", "rumus": "ambang swasembada 0,90–1,00", "hasil": "surplus"},
        ],
        "rekomendasi_terkait": [
            {
                "urutan": 1,
                "dari_kode": "35",
                "dari": "Jawa Timur",
                "ke_kode": "31",
                "ke": "DKI Jakarta",
                "ton": 400_000.0,
                "jarak_km": 667.5,
                "persen_kebutuhan_penerima": 48.0,
                "satu_pulau": True,
                "explanation": "Jawa Timur memasok DKI Jakarta.",
            }
        ],
        "catatan": None,
        "riwayat": [
            {
                "tahun": 2025,
                "produksi_beras_ton": 5_600_000.0,
                "kebutuhan_beras_ton": 3_257_750.0,
                "rice_balance_ton": 2_342_250.0,
                "rasio_swasembada": 1.719,
                "status": "surplus",
            }
        ],
        "map_values": map_vals,
        "highlight_kode": "35",
        "metadata": meta,
    }
    surplus_defisit = {
        "jenis": "surplus-defisit",
        "judul": "Surplus-Deficit Report",
        "subjudul": "Laporan Status Surplus dan Defisit 38 Provinsi",
        "tahun": 2025,
        "ringkasan": {**nasional["kpi"], "jumlah_status": nasional["ringkasan_status"]},
        "kelompok": {
            "surplus": [prov_item],
            "balanced": [{**prov_item, "kode_bps": "12", "provinsi": "Sumatera Utara", "status": "balanced"}],
            "defisit": [{**prov_item, "kode_bps": "31", "provinsi": "DKI Jakarta", "status": "defisit", "rice_balance_ton": -750_000.0}],
        },
        "provinsi": [prov_item],
        "map_values": map_vals,
        "metadata": meta,
    }
    rekomendasi = {
        "jenis": "rekomendasi",
        "judul": "Distribution Recommendation Report",
        "subjudul": "Laporan Rekomendasi Distribusi Beras Antarprovinsi",
        "tahun": 2025,
        "ringkasan": {
            "total_dialokasikan_ton": 400_000.0,
            "persen_defisit_tertutup": 53.33,
            "jumlah_pasangan": 1,
            "rata_jarak_tertimbang_ton": 667.5,
            "total_ton_km": 267_000_000.0,
        },
        "items": [
            {
                "urutan": 1,
                "dari_kode": "35",
                "dari": "Jawa Timur",
                "ke_kode": "31",
                "ke": "DKI Jakarta",
                "ton": 400_000.0,
                "jarak_km": 667.5,
                "persen_kebutuhan_penerima": 48.0,
                "satu_pulau": True,
                "explanation": "Jawa Timur memasok DKI Jakarta.",
                "dari_lat": -7.7194,
                "dari_lng": 112.7324,
                "ke_lat": -6.199,
                "ke_lng": 106.8344,
            }
        ],
        "map_values": map_vals,
        "metadata": meta,
    }
    return [nasional, provinsi, surplus_defisit, rekomendasi]


def test_render_peta_dan_grafik_png_valid():
    map_vals = _sample_map_values()
    peta = render_peta_png(map_vals)
    assert peta.startswith(PNG_SIG)
    assert len(peta) > 5_000

    peta_hl = render_peta_png(map_vals, highlight_kode="35", title="Highlight")
    assert peta_hl.startswith(PNG_SIG)

    peta_flow = render_peta_png(
        map_vals,
        flows=[
            {"dari_lat": -7.7194, "dari_lng": 112.7324, "ke_lat": -6.199, "ke_lng": 106.8344, "ton": 400_000.0}
        ],
    )
    assert peta_flow.startswith(PNG_SIG)

    nas = _sample_nasional_data()
    bar_top = render_top_surplus_defisit_png(nas["top_surplus"], nas["top_defisit"])
    assert bar_top.startswith(PNG_SIG)

    bar_status = render_status_distribusi_png(nas["ringkasan_status"])
    assert bar_status.startswith(PNG_SIG)


def test_render_html_semua_jenis_a4_footer_dan_marker_bw():
    for report in _sample_all_reports():
        html = render_report_html(report)
        assert "size: A4 portrait;" in html
        assert "margin: 12mm 12mm 18mm 12mm;" in html
        assert "counter(page)" in html
        assert "counter(pages)" in html
        assert "data:image/png;base64," in html
        assert "Dataset v1" in html
        assert "2025" in html
        assert "Balance bukan stok beras aktual maupun rencana logistik." in html
        assert "Produksi Padi dan Beras Menurut Provinsi" in html
        assert "[+]" in html
        assert "34.691.234,56" in html or "5.600.000,00" in html or "400.000,00" in html


def test_render_pdf_bytes_native_missing_raises_503(monkeypatch):
    real_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name == "weasyprint":
            raise OSError("cannot load library 'libgobject-2.0-0'")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fake_import)
    with pytest.raises(AppError) as exc_info:
        render_pdf_bytes("<html><body>halo</body></html>")
    assert exc_info.value.status_code == 503
    assert exc_info.value.code == "PDF_UNAVAILABLE"


def test_weasyprint_real_nasional_fit_max_4_halaman():
    html = render_report_html(_sample_nasional_data())
    try:
        import weasyprint
    except OSError as exc:
        pytest.skip(f"Pango/GObject native library tidak tersedia di host ini: {exc}")

    doc = weasyprint.HTML(string=html).render()
    assert 1 <= len(doc.pages) <= 4
    pdf_bytes = doc.write_pdf()
    assert pdf_bytes.startswith(b"%PDF-")


def test_reports_route_validasi_parameter(client):
    r_bad_jenis = client.get("/api/v1/reports/tidak-valid.pdf")
    assert r_bad_jenis.status_code == 400
    assert r_bad_jenis.json()["error"]["code"] == "INVALID_PARAMS"

    r_no_kode = client.get("/api/v1/reports/provinsi.pdf", params={"tahun": 2025})
    assert r_no_kode.status_code == 400
    assert r_no_kode.json()["error"]["code"] == "INVALID_PARAMS"

    r_unknown_kode = client.get("/api/v1/reports/provinsi.pdf", params={"tahun": 2025, "kode_bps": "99"})
    assert r_unknown_kode.status_code == 404
    assert r_unknown_kode.json()["error"]["code"] == "NOT_FOUND"

    r_no_year = client.get("/api/v1/reports/nasional.pdf", params={"tahun": 2019})
    assert r_no_year.status_code == 404
    assert r_no_year.json()["error"]["code"] == "NO_PUBLISHED_VERSION"


def test_reports_endpoint_semua_jenis_dengan_mock_weasyprint(client, monkeypatch):
    captured: list[str] = []

    def fake_write_pdf(self):
        captured.append("called")
        return b"%PDF-1.4\n%mock-riceguard\n"

    monkeypatch.setattr("app.routers.public.reports.render_pdf_bytes", lambda html: fake_write_pdf(SimpleNamespace(html=html)))

    cases = [
        ("nasional", {}),
        ("provinsi", {"kode_bps": "35"}),
        ("surplus-defisit", {}),
        ("rekomendasi", {}),
    ]
    for jenis, extra_params in cases:
        r = client.get(f"/api/v1/reports/{jenis}.pdf", params={"tahun": 2025, **extra_params})
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/pdf"
        assert r.headers["content-disposition"] == f'attachment; filename="riceguard-laporan-{jenis}-2025-v1.pdf"'
        assert r.content.startswith(b"%PDF-")

    assert len(captured) == 4


def test_reports_endpoint_real_weasyprint_nasional_live_db(client):
    try:
        import weasyprint  # noqa: F401
    except OSError as exc:
        pytest.skip(f"Pango/GObject native library tidak tersedia di host ini: {exc}")

    r = client.get("/api/v1/reports/nasional.pdf", params={"tahun": 2025})
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.headers["content-disposition"] == 'attachment; filename="riceguard-laporan-nasional-2025-v1.pdf"'
    assert r.content.startswith(b"%PDF-")
