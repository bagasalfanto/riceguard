"""Error seragam: {"error": {"code", "message", "details"}} (PRD bagian 10).

Detail dari Pydantic bisa memuat objek Python (misalnya `ValueError` di `ctx` saat
validator kustom gagal). Objek seperti itu tidak bisa di-JSON-kan dan akan mengubah
error 400 menjadi 500, jadi semua detail disaring ke bentuk yang pasti aman dulu.
"""
from __future__ import annotations

from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

_SCALAR = (str, int, float, bool, type(None))


class AppError(Exception):
    def __init__(self, code: str, status_code: int, message: str, details: Any = None):
        super().__init__(message)
        self.code = code
        self.status_code = status_code
        self.message = message
        self.details = details


def _aman(nilai: Any, kedalaman: int = 0) -> Any:
    """Ubah nilai apa pun jadi bentuk JSON-safe tanpa melempar exception."""
    if kedalaman > 6:
        return str(nilai)
    if isinstance(nilai, _SCALAR):
        return nilai
    if isinstance(nilai, BaseException):
        return str(nilai)
    if isinstance(nilai, dict):
        return {str(k): _aman(v, kedalaman + 1) for k, v in nilai.items()}
    if isinstance(nilai, (list, tuple, set)):
        return [_aman(v, kedalaman + 1) for v in nilai]
    if hasattr(nilai, "isoformat"):
        return nilai.isoformat()
    return str(nilai)


def _ringkas_error(galat: dict) -> dict:
    """Ambil hanya bagian error Pydantic yang stabil untuk klien."""
    return {
        "type": galat.get("type"),
        "loc": [str(bagian) for bagian in galat.get("loc", ())],
        "msg": galat.get("msg"),
        "input": _aman(galat.get("input")),
        "ctx": _aman(galat.get("ctx")) if galat.get("ctx") is not None else None,
    }


def not_found_provinsi(kode: str) -> AppError:
    return AppError("NOT_FOUND", 404, f"Provinsi {kode} tidak ada di versi ini", {"kode_bps": kode})


def no_published_version(tahun: int | None) -> AppError:
    pesan = "Belum ada versi dataset yang dipublikasi" if tahun is None else f"Data tahun {tahun} belum dipublikasi"
    return AppError("NO_PUBLISHED_VERSION", 404, pesan, {"tahun": tahun})


async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message, "details": _aman(exc.details)}},
    )


async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content={
            "error": {
                "code": "INVALID_PARAMS",
                "message": "Parameter tidak valid",
                "details": [_ringkas_error(g) for g in exc.errors()],
            }
        },
    )
