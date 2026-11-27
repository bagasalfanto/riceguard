"""Validasi & parsing file upload mentah untuk endpoint admin (T10.3 & T10.4)."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd
from fastapi import UploadFile
from riceguard_calc import (
    parse_konsumsi,
    parse_penduduk,
    parse_produksi,
    parse_referensi,
    total_indonesia,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.db.models import Province

ALLOWED_EXTENSIONS = {".txt", ".csv"}
_DEFAULT_FILENAMES = {
    "produksi": "produksi.txt",
    "penduduk": "penduduk.txt",
    "konsumsi": "konsumsi.csv",
    "referensi": "referensi.csv",
}


@dataclass(slots=True)
class UploadedRawFile:
    key: str
    filename: str
    content: bytes


@dataclass(slots=True)
class ParsedUploadBundle:
    ref_df: pd.DataFrame
    produksi_df: pd.DataFrame
    penduduk_df: pd.DataFrame
    konsumsi_df: pd.DataFrame
    acuan_indonesia: dict
    files: list[UploadedRawFile]
    source_files: dict[str, str]
    has_custom_referensi: bool


def sanitize_upload_filename(filename: str | None, key: str) -> str:
    """Ambil nama file yang aman dan pastikan ekstensinya .txt atau .csv."""
    raw_name = Path(filename or "").name.strip()
    if not raw_name or raw_name in {".", ".."} or "/" in raw_name or "\\" in raw_name or ".." in raw_name:
        raise AppError(
            "INVALID_PARAMS",
            400,
            f"Nama file {key} tidak valid",
            {"field": key, "filename": filename},
        )
    ext = Path(raw_name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise AppError(
            "INVALID_PARAMS",
            400,
            f"Ekstensi file {key} harus .txt atau .csv",
            {"field": key, "filename": raw_name, "allowed": sorted(ALLOWED_EXTENSIONS)},
        )
    return raw_name


def read_validated_upload(upload: UploadFile, key: str) -> UploadedRawFile:
    """Baca UploadFile sambil menegakkan ekstensi aman dan batas ukuran MAX_UPLOAD_MB."""
    settings = get_settings()
    max_bytes = max(1, int(settings.max_upload_mb)) * 1024 * 1024
    safe_name = sanitize_upload_filename(upload.filename or _DEFAULT_FILENAMES[key], key)

    upload.file.seek(0)
    data = upload.file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise AppError(
            "FILE_TOO_LARGE",
            413,
            f"Ukuran file {key} melebihi batas {settings.max_upload_mb} MB",
            {"field": key, "filename": safe_name, "max_bytes": max_bytes},
        )
    if not data.strip():
        raise AppError(
            "INVALID_PARAMS",
            400,
            f"File {key} tidak boleh kosong",
            {"field": key, "filename": safe_name},
        )
    return UploadedRawFile(key=key, filename=safe_name, content=data)


def referensi_from_db(db: Session) -> pd.DataFrame:
    """Bangun DataFrame referensi 38 provinsi dari tabel `provinces`."""
    rows = list(db.scalars(select(Province).order_by(Province.kode_bps.asc())))
    if not rows:
        raise AppError(
            "VALIDATION_FAILED",
            422,
            "Referensi provinsi belum tersedia di database",
            {"validasi": {"lulus": False, "aturan": []}},
        )
    return pd.DataFrame(
        [
            {
                "kode_bps": p.kode_bps,
                "kode_kemendagri": p.kode_kemendagri,
                "provinsi": p.nama,
                "pulau": p.pulau,
                "lat": float(p.lat),
                "lng": float(p.lng),
            }
            for p in rows
        ]
    )


def _parse_frame(key: str, parser, content: bytes) -> pd.DataFrame:
    try:
        return parser(content)
    except (ValueError, KeyError, UnicodeDecodeError, pd.errors.ParserError, pd.errors.EmptyDataError) as exc:
        raise AppError(
            "INVALID_PARAMS",
            400,
            f"Format file {key} tidak dapat dibaca",
            {"field": key, "alasan": str(exc)},
        ) from exc


def parse_uploaded_bundle(
    db: Session,
    *,
    produksi: UploadFile,
    penduduk: UploadFile,
    konsumsi: UploadFile,
    referensi: UploadFile | None = None,
) -> ParsedUploadBundle:
    """Validasi ukuran/ekstensi semua upload lalu parse ke DataFrame `riceguard_calc`."""
    raw_produksi = read_validated_upload(produksi, "produksi")
    raw_penduduk = read_validated_upload(penduduk, "penduduk")
    raw_konsumsi = read_validated_upload(konsumsi, "konsumsi")
    raw_files = [raw_produksi, raw_penduduk, raw_konsumsi]

    has_custom_referensi = referensi is not None and bool(referensi.filename)
    raw_referensi: UploadedRawFile | None = None
    if has_custom_referensi and referensi is not None:
        raw_referensi = read_validated_upload(referensi, "referensi")
        raw_files.append(raw_referensi)

    produksi_df = _parse_frame("produksi", parse_produksi, raw_produksi.content)
    penduduk_df = _parse_frame("penduduk", parse_penduduk, raw_penduduk.content)
    konsumsi_df = _parse_frame("konsumsi", parse_konsumsi, raw_konsumsi.content)
    ref_df = (
        _parse_frame("referensi", parse_referensi, raw_referensi.content)
        if raw_referensi is not None
        else referensi_from_db(db)
    )

    source_files = {f.key: f.filename for f in raw_files}
    acuan = total_indonesia(produksi_df, penduduk_df)

    return ParsedUploadBundle(
        ref_df=ref_df,
        produksi_df=produksi_df,
        penduduk_df=penduduk_df,
        konsumsi_df=konsumsi_df,
        acuan_indonesia=acuan,
        files=raw_files,
        source_files=source_files,
        has_custom_referensi=has_custom_referensi,
    )
