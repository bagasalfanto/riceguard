"""Klien Supabase Storage server-side untuk bucket privat raw-uploads (T8.4)."""
from __future__ import annotations

import mimetypes

import httpx

from app.core.config import get_settings
from app.core.errors import AppError

RAW_BUCKET = "raw-uploads"
_MEDIA_TYPES = {
    ".csv": "text/csv; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
}


def content_type_untuk_file(nama_file: str) -> str:
    """Tentukan Content-Type respons sesuai ekstensi file sumber mentah."""
    lower = nama_file.lower()
    for ext, media_type in _MEDIA_TYPES.items():
        if lower.endswith(ext):
            return media_type
    tebakan, _ = mimetypes.guess_type(nama_file)
    return tebakan or "application/octet-stream"


def _http_client() -> httpx.Client:
    return httpx.Client(timeout=15.0)


def download_raw_object(object_path: str, *, nama_file: str | None = None) -> bytes:
    """Unduh objek dari Supabase Storage bucket privat menggunakan service role key."""
    settings = get_settings()
    if not settings.supabase_service_role_key:
        raise AppError("STORAGE_UNAVAILABLE", 503, "Storage file mentah belum dikonfigurasi")

    base_url = settings.supabase_url.rstrip("/")
    url = f"{base_url}/storage/v1/object/{RAW_BUCKET}/{object_path}"
    headers = {
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "apikey": settings.supabase_service_role_key,
    }

    try:
        with _http_client() as client:
            resp = client.get(url, headers=headers)
    except httpx.HTTPError as exc:
        raise AppError(
            "STORAGE_UNAVAILABLE",
            503,
            "Gagal menghubungi storage file mentah",
            {"alasan": str(exc)},
        ) from exc

    if resp.status_code == 404 or (resp.status_code == 400 and "not_found" in resp.text.lower()):
        raise AppError(
            "NOT_FOUND",
            404,
            "File sumber tidak ditemukan di storage",
            {"nama_file": nama_file or object_path},
        )

    if resp.status_code >= 400:
        raise AppError(
            "STORAGE_UNAVAILABLE",
            503,
            "Storage file mentah gagal mengembalikan file",
            {"status_code": resp.status_code},
        )

    return resp.content
