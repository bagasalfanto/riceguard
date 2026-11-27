"""GET /api/v1/exports/provinces.csv & recommendations.csv (T8.2)."""
from __future__ import annotations

import csv
import io
from decimal import Decimal
from pathlib import Path

from app.db.models import DatasetVersion
from app.services.exports import (
    PROVINCE_CSV_HEADERS,
    RECOMMENDATION_CSV_HEADERS,
    render_provinces_csv,
    render_recommendations_csv,
)

REPO = Path(__file__).resolve().parents[3]


def _baca_dataset_rows_seperti_db() -> list[list]:
    rows = []
    with (REPO / "dataset" / "dataset_v1.csv").open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.append(
                [
                    int(r["tahun"]),
                    r["kode_bps"],
                    r["kode_kemendagri"],
                    r["provinsi"],
                    r["pulau"],
                    float(Decimal(r["lat"]).quantize(Decimal("0.0001"))),
                    float(Decimal(r["lng"]).quantize(Decimal("0.0001"))),
                    int(r["penduduk_jiwa"]),
                    float(Decimal(r["konsumsi_kg_kapita_tahun"]).quantize(Decimal("0.01"))),
                    float(Decimal(r["produksi_padi_ton_gkg"]).quantize(Decimal("0.01"))),
                    float(Decimal(r["produksi_beras_ton"]).quantize(Decimal("0.01"))),
                    float(Decimal(r["kebutuhan_beras_ton"]).quantize(Decimal("0.01"))),
                    float(Decimal(r["rice_balance_ton"]).quantize(Decimal("0.01"))),
                    float(Decimal(r["rasio_swasembada"]).quantize(Decimal("0.0001"))),
                    r["status"],
                ]
            )
    return rows


def _baca_rekomendasi_rows_seperti_db() -> list[list]:
    rows = []
    with (REPO / "dataset" / "rekomendasi_distribusi_v1.csv").open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.append(
                [
                    int(r["urutan"]),
                    r["dari_kode"],
                    r["dari"],
                    r["ke_kode"],
                    r["ke"],
                    float(Decimal(r["ton"]).quantize(Decimal("0.01"))),
                    float(Decimal(r["jarak_km"]).quantize(Decimal("0.1"))),
                ]
            )
    return rows


def test_unit_render_provinces_csv_bom_crlf_dan_identik_dataset_v1():
    raw_bytes = render_provinces_csv(_baca_dataset_rows_seperti_db())

    assert raw_bytes.startswith(b"\xef\xbb\xbf")
    assert b"\r\n" in raw_bytes
    assert b"\n" not in raw_bytes.replace(b"\r\n", b"")

    teks = raw_bytes.decode("utf-8-sig")
    baris_header = teks.splitlines()[0].split(",")
    assert len(baris_header) == 15
    assert baris_header == PROVINCE_CSV_HEADERS

    disk_text = (REPO / "dataset" / "dataset_v1.csv").read_text(encoding="utf-8")
    assert teks.replace("\r\n", "\n") == disk_text.replace("\r\n", "\n")


def test_unit_render_recommendations_csv_bom_crlf_dan_identik_rekomendasi_v1():
    raw_bytes = render_recommendations_csv(_baca_rekomendasi_rows_seperti_db())

    assert raw_bytes.startswith(b"\xef\xbb\xbf")
    assert b"\r\n" in raw_bytes
    assert b"\n" not in raw_bytes.replace(b"\r\n", b"")

    teks = raw_bytes.decode("utf-8-sig")
    baris_header = teks.splitlines()[0].split(",")
    assert len(baris_header) == 7
    assert baris_header == RECOMMENDATION_CSV_HEADERS

    disk_text = (REPO / "dataset" / "rekomendasi_distribusi_v1.csv").read_text(encoding="utf-8")
    assert teks.replace("\r\n", "\n") == disk_text.replace("\r\n", "\n")


def test_export_provinces_csv_identik_dataset_v1(client):
    r = client.get("/api/v1/exports/provinces.csv", params={"tahun": 2025})
    assert r.status_code == 200
    assert r.headers["content-type"] == "text/csv; charset=utf-8"
    assert r.headers["content-disposition"] == 'attachment; filename="riceguard-provinsi-2025-v1.csv"'
    assert r.content.startswith(b"\xef\xbb\xbf")
    assert b"\r\n" in r.content

    teks = r.content.decode("utf-8-sig")
    disk_text = (REPO / "dataset" / "dataset_v1.csv").read_text(encoding="utf-8")
    assert teks.replace("\r\n", "\n") == disk_text.replace("\r\n", "\n")

    parsed = list(csv.reader(io.StringIO(teks)))
    assert len(parsed) == 39
    assert parsed[0] == PROVINCE_CSV_HEADERS


def test_export_recommendations_csv_identik_rekomendasi_v1(client):
    r = client.get("/api/v1/exports/recommendations.csv", params={"tahun": 2025})
    assert r.status_code == 200
    assert r.headers["content-type"] == "text/csv; charset=utf-8"
    assert r.headers["content-disposition"] == 'attachment; filename="riceguard-rekomendasi-2025-v1.csv"'
    assert r.content.startswith(b"\xef\xbb\xbf")
    assert b"\r\n" in r.content

    teks = r.content.decode("utf-8-sig")
    disk_text = (REPO / "dataset" / "rekomendasi_distribusi_v1.csv").read_text(encoding="utf-8")
    assert teks.replace("\r\n", "\n") == disk_text.replace("\r\n", "\n")

    parsed = list(csv.reader(io.StringIO(teks)))
    assert len(parsed) == 28
    assert parsed[0] == RECOMMENDATION_CSV_HEADERS


def test_export_csv_tahun_404_dan_draft_diabaikan(client, db):
    r_404 = client.get("/api/v1/exports/provinces.csv", params={"tahun": 2019})
    assert r_404.status_code == 404
    assert r_404.json()["error"]["code"] == "NO_PUBLISHED_VERSION"

    draft = DatasetVersion(tahun=2025, version_no=779, status="draft")
    db.add(draft)
    db.flush()

    r_draft = client.get("/api/v1/exports/provinces.csv", params={"version_id": str(draft.id)})
    assert r_draft.status_code == 200
    assert r_draft.headers["content-disposition"] == 'attachment; filename="riceguard-provinsi-2025-v1.csv"'
