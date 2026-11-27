"""GET /api/v1/exports/provinces.xlsx & recommendations.xlsx (T8.3)."""
from __future__ import annotations

import csv
import io
from pathlib import Path

from app.services.exports import (
    PROVINCE_CSV_HEADERS,
    RECOMMENDATION_CSV_HEADERS,
    render_workbook_xlsx,
)
from openpyxl import load_workbook

REPO = Path(__file__).resolve().parents[3]
XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _muat_csv_typed(path: Path, int_cols: set[str], float_cols: set[str]) -> list[list]:
    rows = []
    with path.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            item = []
            for k, v in row.items():
                if k in int_cols:
                    item.append(int(v))
                elif k in float_cols:
                    item.append(float(v))
                else:
                    item.append(v)
            rows.append(item)
    return rows


def test_unit_render_workbook_xlsx_tiga_sheet_format_dan_metadata():
    prov_rows = _muat_csv_typed(
        REPO / "dataset" / "dataset_v1.csv",
        {"tahun", "penduduk_jiwa"},
        {
            "lat",
            "lng",
            "konsumsi_kg_kapita_tahun",
            "produksi_padi_ton_gkg",
            "produksi_beras_ton",
            "kebutuhan_beras_ton",
            "rice_balance_ton",
            "rasio_swasembada",
        },
    )
    rek_rows = _muat_csv_typed(
        REPO / "dataset" / "rekomendasi_distribusi_v1.csv",
        {"urutan"},
        {"ton", "jarak_km"},
    )
    meta = {
        "version_id": "11111111-1111-4111-8111-111111111111",
        "version_no": 1,
        "tahun": 2025,
        "published_at": "2026-01-01T00:00:00+00:00",
        "published_by": "Sistem (Seed awal)",
        "notes": "Seed awal",
        "batasan_klaim": "Balance bukan stok aktual.",
        "tanggal_cetak": "2026-11-26T00:00:00+00:00",
    }
    sources = [
        {"nama": f"Sumber {i}", "instansi": "BPS", "tabel_resmi": f"Tabel {i}", "tahun": 2025}
        for i in range(1, 5)
    ]

    xlsx_bytes = render_workbook_xlsx(
        province_rows=prov_rows,
        recommendation_rows=rek_rows,
        meta=meta,
        sources=sources,
        active_sheet="Rekomendasi",
    )

    wb = load_workbook(io.BytesIO(xlsx_bytes))
    assert wb.sheetnames == ["Provinsi", "Rekomendasi", "Metadata"]
    assert wb.active.title == "Rekomendasi"

    ws_prov = wb["Provinsi"]
    assert ws_prov.max_row == 39
    assert [c.value for c in ws_prov[1]] == PROVINCE_CSV_HEADERS
    assert all(c.font.bold for c in ws_prov[1])
    assert ws_prov.freeze_panes == "A2"
    assert ws_prov["H2"].number_format == "#,##0"
    assert ws_prov["K2"].number_format == "#,##0.00"
    assert ws_prov["N2"].number_format == "0.0000"
    assert [c.value for c in ws_prov[2]] == prov_rows[0]

    ws_rek = wb["Rekomendasi"]
    assert ws_rek.max_row == 28
    assert [c.value for c in ws_rek[1]] == RECOMMENDATION_CSV_HEADERS
    assert all(c.font.bold for c in ws_rek[1])
    assert ws_rek.freeze_panes == "A2"
    assert ws_rek["F2"].number_format == "#,##0.00"
    assert ws_rek["G2"].number_format == "#,##0.0"
    assert [c.value for c in ws_rek[2]] == rek_rows[0]

    ws_meta = wb["Metadata"]
    meta_dict = {ws_meta.cell(r, 1).value: ws_meta.cell(r, 2).value for r in range(2, 11)}
    assert meta_dict["version"] == "v1"
    assert meta_dict["version_id"] == meta["version_id"]
    assert meta_dict["version_no"] == 1
    assert meta_dict["tahun"] == 2025
    assert meta_dict["batasan_klaim"] == "Balance bukan stok aktual."
    assert meta_dict["tanggal_cetak"] == "2026-11-26T00:00:00+00:00"
    sumber_nama = [ws_meta.cell(r, 1).value for r in range(14, ws_meta.max_row + 1)]
    assert len(sumber_nama) == 4


def test_export_provinces_xlsx_tiga_sheet_dan_nilai_sama_csv(client):
    r = client.get("/api/v1/exports/provinces.xlsx", params={"tahun": 2025})
    assert r.status_code == 200
    assert r.headers["content-type"] == XLSX_MIME
    assert r.headers["content-disposition"] == 'attachment; filename="riceguard-provinsi-2025-v1.xlsx"'

    wb = load_workbook(io.BytesIO(r.content))
    assert wb.sheetnames == ["Provinsi", "Rekomendasi", "Metadata"]
    assert wb.active.title == "Provinsi"

    ws_prov = wb["Provinsi"]
    assert ws_prov.max_row == 39
    assert [c.value for c in ws_prov[1]] == PROVINCE_CSV_HEADERS
    assert ws_prov.freeze_panes == "A2"

    prov_csv = _muat_csv_typed(
        REPO / "dataset" / "dataset_v1.csv",
        {"tahun", "penduduk_jiwa"},
        {
            "lat",
            "lng",
            "konsumsi_kg_kapita_tahun",
            "produksi_padi_ton_gkg",
            "produksi_beras_ton",
            "kebutuhan_beras_ton",
            "rice_balance_ton",
            "rasio_swasembada",
        },
    )
    for row_idx, expected in enumerate(prov_csv, start=2):
        actual = [ws_prov.cell(row_idx, col_idx).value for col_idx in range(1, 16)]
        assert actual == expected

    ws_rek = wb["Rekomendasi"]
    assert ws_rek.max_row == 28
    assert [c.value for c in ws_rek[1]] == RECOMMENDATION_CSV_HEADERS

    ws_meta = wb["Metadata"]
    kv = {ws_meta.cell(row, 1).value: ws_meta.cell(row, 2).value for row in range(2, 11)}
    assert kv["version_no"] == 1
    assert kv["tahun"] == 2025
    assert kv["tanggal_cetak"]
    assert kv["batasan_klaim"]
    sumber_rows = [
        ws_meta.cell(row, 1).value
        for row in range(14, ws_meta.max_row + 1)
        if ws_meta.cell(row, 1).value
    ]
    assert len(sumber_rows) == 4


def test_export_recommendations_xlsx_sheet_aktif_dan_404(client):
    r = client.get("/api/v1/exports/recommendations.xlsx", params={"tahun": 2025})
    assert r.status_code == 200
    assert r.headers["content-type"] == XLSX_MIME
    assert r.headers["content-disposition"] == 'attachment; filename="riceguard-rekomendasi-2025-v1.xlsx"'

    wb = load_workbook(io.BytesIO(r.content))
    assert wb.sheetnames == ["Provinsi", "Rekomendasi", "Metadata"]
    assert wb.active.title == "Rekomendasi"

    r_404 = client.get("/api/v1/exports/recommendations.xlsx", params={"tahun": 2019})
    assert r_404.status_code == 404
    assert r_404.json()["error"]["code"] == "NO_PUBLISHED_VERSION"
