"""Error seragam: {"error": {"code", "message", "details"}} (PRD bagian 10)."""
from __future__ import annotations

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, code: str, status_code: int, message: str, details=None):
        super().__init__(message)
        self.code = code
        self.status_code = status_code
        self.message = message
        self.details = details


def not_found_provinsi(kode: str) -> AppError:
    return AppError("NOT_FOUND", 404, f"Provinsi {kode} tidak ada di versi ini", {"kode_bps": kode})


def no_published_version(tahun: int | None) -> AppError:
    pesan = "Belum ada versi dataset yang dipublikasi" if tahun is None else f"Data tahun {tahun} belum dipublikasi"
    return AppError("NO_PUBLISHED_VERSION", 404, pesan, {"tahun": tahun})


async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message, "details": exc.details}},
    )


async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content={
            "error": {
                "code": "INVALID_PARAMS",
                "message": "Parameter tidak valid",
                "details": exc.errors(),
            }
        },
    )
