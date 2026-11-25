from __future__ import annotations

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.errors import AppError, app_error_handler, validation_error_handler
from app.routers.public import content, meta, summary

app = FastAPI(
    title="RiceGuard API",
    version="0.1.0",
    description="Keseimbangan produksi-kebutuhan beras dan rekomendasi distribusi 38 provinsi.",
)

_settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)

API = "/api/v1"
app.include_router(meta.router, prefix=API)
app.include_router(summary.router, prefix=API)
app.include_router(content.router, prefix=API)


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok"}
