from __future__ import annotations

import sys
import traceback

print("riceguard: main.py mulai dimuat", file=sys.stderr, flush=True)

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

try:
    from app.core.config import get_settings
    from app.core.errors import AppError, app_error_handler, validation_error_handler
    from app.routers.admin import audit as admin_audit
    from app.routers.admin import content as admin_content
    from app.routers.admin import versions as admin_versions
    from app.routers.public import (
        content,
        data_exports,
        distribution,
        forecast,
        map_layers,
        meta,
        provinces,
        recommendations,
        reports,
        rice_balance,
        summary,
        trends,
    )
except Exception:
    traceback.print_exc()
    raise

print("riceguard: seluruh router berhasil dimuat", file=sys.stderr, flush=True)

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
    expose_headers=["Content-Disposition"],
)

app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)

API = "/api/v1"


@app.middleware("http")
async def cache_control_publik(request, call_next):
    """Data publik jarang berubah: izinkan cache 5 menit.

    Request yang membawa token admin (preview draft) tidak diberi header ini supaya
    draft tidak ikut tersimpan di cache bersama.
    """
    response = await call_next(request)
    if (
        request.method == "GET"
        and request.url.path.startswith(API)
        and "authorization" not in request.headers
        and response.status_code == 200
    ):
        response.headers["Cache-Control"] = "public, max-age=300"
    return response


app.include_router(meta.router, prefix=API)
app.include_router(summary.router, prefix=API)
app.include_router(content.router, prefix=API)
app.include_router(provinces.router, prefix=API)
app.include_router(map_layers.router, prefix=API)
app.include_router(distribution.router, prefix=API)
app.include_router(recommendations.router, prefix=API)
app.include_router(rice_balance.router, prefix=API)
app.include_router(trends.router, prefix=API)
app.include_router(data_exports.router, prefix=API)
app.include_router(reports.router, prefix=API)
app.include_router(forecast.router, prefix=API)
app.include_router(admin_versions.router, prefix=API)
app.include_router(admin_content.router, prefix=API)
app.include_router(admin_audit.router, prefix=API)


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok"}
