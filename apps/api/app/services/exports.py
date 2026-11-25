"""Layanan laporan validasi, ekspor CSV/XLSX, dan unduh file sumber mentah (T8.1–T8.4)."""
from __future__ import annotations

import csv
import io
from datetime import UTC, datetime
from typing import Any

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font
from openpyxl.utils import get_column_letter
from sqlalchemy import select
from sqlalchemy.orm import Session, aliased

from app.core.errors import AppError
from app.db.models import (
    Admin,
    DatasetVersion,
    DataSource,
    DistributionRecommendation,
    Province,
    ProvinceStat,
    SiteContent,
)
from app.schemas.data_transparency import (
    RawSourceFileItem,
    ValidationResponse,
    ValidationRuleItem,
)
from app.schemas.summary import SummaryVersion
from app.services.storage import download_raw_object

PROVINCE_CSV_HEADERS = [
    "tahun",
    "kode_bps",
    "kode_kemendagri",
    "provinsi",
    "pulau",
    "lat",
    "lng",
    "penduduk_jiwa",
    "konsumsi_kg_kapita_tahun",
    "produksi_padi_ton_gkg",
    "produksi_beras_ton",
    "kebutuhan_beras_ton",
    "rice_balance_ton",
    "rasio_swasembada",
    "status",
]

RECOMMENDATION_CSV_HEADERS = [
    "urutan",
    "dari_kode",
    "dari",
    "ke_kode",
    "ke",
    "ton",
    "jarak_km",
]

_RAW_KEY_ORDER = ("produksi", "penduduk", "konsumsi", "referensi")
_DEFAULT_BATASAN_KLAIM = (
    "Balance adalah selisih produksi dan estimasi konsumsi rumah tangga tahunan, "
    "bukan stok beras aktual maupun rencana logistik."
)

_PROVINCE_XLSX_FORMATS: dict[int, str] = {
    1: "0",
    2: "@",
    3: "@",
    6: "0.0000",
    7: "0.0000",
    8: "#,##0",
    9: "#,##0.00",
    10: "#,##0.00",
    11: "#,##0.00",
    12: "#,##0.00",
    13: "#,##0.00",
    14: "0.0000",
}

_RECOMMENDATION_XLSX_FORMATS: dict[int, str] = {
    1: "0",
    2: "@",
    4: "@",
    6: "#,##0.00",
    7: "#,##0.0",
}


def _is_safe_filename(nilai: Any) -> bool:
    return (
        isinstance(nilai, str)
        and bool(nilai)
        and nilai.strip() == nilai
        and "/" not in nilai
        and "\\" not in nilai
        and ".." not in nilai
    )


def extract_source_files(source_files: dict | None) -> list[RawSourceFileItem]:
    """Ambil daftar file sumber mentah secara deterministik dari JSONB source_files."""
    if not isinstance(source_files, dict):
        return []

    hasil: list[RawSourceFileItem] = []
    seen_keys: set[str] = set()

    for key in _RAW_KEY_ORDER:
        val = source_files.get(key)
        if _is_safe_filename(val):
            hasil.append(RawSourceFileItem(key=key, nama_file=val))
            seen_keys.add(key)

    for key in sorted(source_files):
        if key in seen_keys:
            continue
        val = source_files.get(key)
        if _is_safe_filename(val):
            hasil.append(RawSourceFileItem(key=str(key), nama_file=val))

    return hasil


def resolve_allowlisted_raw_file(source_files: dict | None, nama_file: str) -> str:
    """Validasi nama file terhadap allowlist source_files; tolak path traversal dengan 404."""
    if not _is_safe_filename(nama_file):
        raise AppError("NOT_FOUND", 404, "File sumber tidak ditemukan", {"nama_file": nama_file})

    allowlist = {item.nama_file: item.nama_file for item in extract_source_files(source_files)}
    aman = allowlist.get(nama_file)
    if aman is None:
        raise AppError("NOT_FOUND", 404, "File sumber tidak ditemukan", {"nama_file": nama_file})
    return aman


def _admin_nama(db: Session, user_id) -> str | None:
    if user_id is None:
        return None
    admin_row = db.get(Admin, user_id)
    return admin_row.nama if admin_row is not None else None


def bangun_validasi(db: Session, versi: DatasetVersion) -> ValidationResponse:
    """Susun laporan validasi dan metadata versi untuk GET /api/v1/validation."""
    val_data = versi.validation if isinstance(versi.validation, dict) else {}
    raw_aturan = val_data.get("aturan") or []
    aturan = [
        ValidationRuleItem(
            kode=str(item["kode"]),
            label=str(item["label"]),
            status=item["status"],
            detail=item.get("detail"),
        )
        for item in raw_aturan
        if isinstance(item, dict)
    ]
    lulus = bool(val_data.get("lulus", bool(aturan) and all(a.status != "gagal" for a in aturan)))
    published_by_nama = _admin_nama(db, versi.published_by)

    return ValidationResponse(
        tahun=versi.tahun,
        version=SummaryVersion(id=str(versi.id), version_no=versi.version_no),
        version_no=versi.version_no,
        version_id=str(versi.id),
        published_at=versi.published_at,
        published_by=str(versi.published_by) if versi.published_by is not None else None,
        published_by_nama=published_by_nama,
        notes=versi.notes,
        lulus=lulus,
        diperiksa_pada=versi.published_at or versi.created_at,
        aturan=aturan,
        source_files=extract_source_files(versi.source_files),
    )


def _load_province_rows(db: Session, versi: DatasetVersion) -> list[list[Any]]:
    stmt = (
        select(ProvinceStat, Province)
        .join(Province, Province.kode_bps == ProvinceStat.kode_bps)
        .where(ProvinceStat.version_id == versi.id)
        .order_by(ProvinceStat.kode_bps.asc())
    )
    rows = db.execute(stmt).all()
    return [
        [
            int(versi.tahun),
            stat.kode_bps,
            prov.kode_kemendagri,
            prov.nama,
            prov.pulau,
            float(prov.lat),
            float(prov.lng),
            int(stat.penduduk_jiwa),
            float(stat.konsumsi_kg_kapita_tahun),
            float(stat.produksi_padi_ton_gkg),
            float(stat.produksi_beras_ton),
            float(stat.kebutuhan_beras_ton),
            float(stat.rice_balance_ton),
            float(stat.rasio_swasembada),
            stat.status,
        ]
        for stat, prov in rows
    ]


def _load_recommendation_rows(db: Session, versi: DatasetVersion) -> list[list[Any]]:
    asal = aliased(Province)
    tujuan = aliased(Province)
    stmt = (
        select(DistributionRecommendation, asal.nama, tujuan.nama)
        .join(asal, asal.kode_bps == DistributionRecommendation.dari_kode)
        .join(tujuan, tujuan.kode_bps == DistributionRecommendation.ke_kode)
        .where(DistributionRecommendation.version_id == versi.id)
        .order_by(DistributionRecommendation.urutan.asc())
    )
    rows = db.execute(stmt).all()
    return [
        [
            int(rec.urutan),
            rec.dari_kode,
            dari_nama,
            rec.ke_kode,
            ke_nama,
            float(rec.ton),
            float(rec.jarak_km),
        ]
        for rec, dari_nama, ke_nama in rows
    ]


def _render_csv_bytes(headers: list[str], rows: list[list[Any]]) -> bytes:
    buf = io.StringIO()
    buf.write("\ufeff")
    writer = csv.writer(buf, lineterminator="\r\n")
    writer.writerow(headers)
    writer.writerows(rows)
    return buf.getvalue().encode("utf-8")


def render_provinces_csv(rows: list[list[Any]]) -> bytes:
    """Format baris provinsi menjadi CSV UTF-8 BOM berakhiran CRLF."""
    return _render_csv_bytes(PROVINCE_CSV_HEADERS, rows)


def render_recommendations_csv(rows: list[list[Any]]) -> bytes:
    """Format baris rekomendasi menjadi CSV UTF-8 BOM berakhiran CRLF."""
    return _render_csv_bytes(RECOMMENDATION_CSV_HEADERS, rows)


def ekspor_provinsi_csv(db: Session, versi: DatasetVersion) -> bytes:
    return render_provinces_csv(_load_province_rows(db, versi))


def ekspor_rekomendasi_csv(db: Session, versi: DatasetVersion) -> bytes:
    return render_recommendations_csv(_load_recommendation_rows(db, versi))


def _auto_fit_columns(ws, *, min_width: int = 10, max_width: int = 50, padding: int = 6) -> None:
    for col_idx, col_cells in enumerate(ws.iter_cols(), start=1):
        max_len = max((len(str(cell.value or "")) for cell in col_cells), default=0)
        ws.column_dimensions[get_column_letter(col_idx)].width = min(max(max_len + padding, min_width), max_width)


def _populate_table_sheet(
    ws,
    headers: list[str],
    rows: list[list[Any]],
    col_formats: dict[int, str],
) -> None:
    ws.append(headers)
    bold_font = Font(bold=True)
    for cell in ws[1]:
        cell.font = bold_font
    ws.freeze_panes = "A2"

    for row in rows:
        ws.append(row)

    for row_cells in ws.iter_rows(min_row=2, max_row=ws.max_row):
        for col_idx, fmt in col_formats.items():
            row_cells[col_idx - 1].number_format = fmt

    _auto_fit_columns(ws)


def render_workbook_xlsx(
    *,
    province_rows: list[list[Any]],
    recommendation_rows: list[list[Any]],
    meta: dict[str, Any],
    sources: list[dict[str, Any]],
    active_sheet: str = "Provinsi",
) -> bytes:
    """Bangun workbook Excel 3 sheet (Provinsi, Rekomendasi, Metadata)."""
    wb = Workbook()

    ws_prov = wb.active
    ws_prov.title = "Provinsi"
    _populate_table_sheet(ws_prov, PROVINCE_CSV_HEADERS, province_rows, _PROVINCE_XLSX_FORMATS)

    ws_rek = wb.create_sheet("Rekomendasi")
    _populate_table_sheet(ws_rek, RECOMMENDATION_CSV_HEADERS, recommendation_rows, _RECOMMENDATION_XLSX_FORMATS)

    ws_meta = wb.create_sheet("Metadata")
    bold_font = Font(bold=True)

    ws_meta.append(["Atribut", "Nilai"])
    for cell in ws_meta[1]:
        cell.font = bold_font

    meta_rows = [
        ("version", f"v{meta['version_no']}"),
        ("version_id", meta["version_id"]),
        ("version_no", meta["version_no"]),
        ("tahun", meta["tahun"]),
        ("published_at", meta["published_at"]),
        ("published_by", meta["published_by"]),
        ("notes", meta["notes"]),
        ("batasan_klaim", meta["batasan_klaim"]),
        ("tanggal_cetak", meta["tanggal_cetak"]),
    ]
    for label, nilai in meta_rows:
        ws_meta.append([label, nilai])
        if label == "batasan_klaim":
            ws_meta.cell(row=ws_meta.max_row, column=2).alignment = Alignment(wrap_text=True)

    ws_meta.append([])
    ws_meta.append(["Sumber Data"])
    ws_meta.cell(row=ws_meta.max_row, column=1).font = bold_font

    ws_meta.append(["Nama", "Instansi", "Tabel Resmi", "Tahun"])
    for cell in ws_meta[ws_meta.max_row]:
        cell.font = bold_font

    for sumber in sources:
        ws_meta.append(
            [
                sumber["nama"],
                sumber["instansi"],
                sumber.get("tabel_resmi") or "-",
                sumber.get("tahun"),
            ]
        )

    _auto_fit_columns(ws_meta, min_width=14, max_width=72, padding=4)

    if active_sheet in wb.sheetnames:
        wb.active = wb.sheetnames.index(active_sheet)

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def ekspor_workbook_xlsx(db: Session, versi: DatasetVersion, *, active_sheet: str = "Provinsi") -> bytes:
    """Ambil data dari DB dan hasilkan file Excel 3 sheet untuk versi dataset."""
    province_rows = _load_province_rows(db, versi)
    recommendation_rows = _load_recommendation_rows(db, versi)

    admin_nama = _admin_nama(db, versi.published_by)
    published_by = admin_nama or (str(versi.published_by) if versi.published_by is not None else "Sistem (Seed awal)")

    batasan_row = db.get(SiteContent, "limitations")
    batasan_klaim = (
        " ".join(batasan_row.body_md.split())
        if batasan_row is not None and batasan_row.body_md.strip()
        else _DEFAULT_BATASAN_KLAIM
    )

    source_rows = list(db.scalars(select(DataSource).order_by(DataSource.id.asc())))
    sources = [
        {
            "nama": s.nama,
            "instansi": s.instansi,
            "tabel_resmi": s.tabel_resmi,
            "tahun": s.tahun,
        }
        for s in source_rows
    ]

    meta = {
        "version_id": str(versi.id),
        "version_no": int(versi.version_no),
        "tahun": int(versi.tahun),
        "published_at": versi.published_at.isoformat() if versi.published_at is not None else "-",
        "published_by": published_by,
        "notes": versi.notes or "-",
        "batasan_klaim": batasan_klaim,
        "tanggal_cetak": datetime.now(UTC).isoformat(),
    }

    return render_workbook_xlsx(
        province_rows=province_rows,
        recommendation_rows=recommendation_rows,
        meta=meta,
        sources=sources,
        active_sheet=active_sheet,
    )


def ambil_file_mentah(versi: DatasetVersion, nama_file: str) -> tuple[str, bytes]:
    """Validasi nama_file via allowlist versi published lalu unduh dari Supabase Storage."""
    aman_nama = resolve_allowlisted_raw_file(versi.source_files, nama_file)
    object_path = f"{versi.tahun}/{versi.id}/{aman_nama}"
    konten = download_raw_object(object_path, nama_file=aman_nama)
    return aman_nama, konten
