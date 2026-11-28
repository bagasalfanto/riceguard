from __future__ import annotations

import importlib

from fastapi import FastAPI

app = FastAPI(title="RiceGuard API", version="0.1.0")

MODUL = [
    "pandas",
    "riceguard_calc",
    "sqlalchemy",
    "psycopg",
    "openpyxl",
    "jinja2",
    "pydantic_settings",
    "app.core.config",
    "app.core.errors",
    "app.db.models",
    "app.services.compute",
    "app.services.exports",
    "app.services.pdf",
    "app.routers.public.summary",
]


@app.get("/health", tags=["meta"])
def health() -> dict:
    hasil: dict[str, str] = {}
    for nama in MODUL:
        try:
            importlib.import_module(nama)
            hasil[nama] = "ok"
        except Exception as exc:  # noqa: BLE001 - diagnostik sementara
            hasil[nama] = f"{type(exc).__name__}: {exc}"
    return {"status": "probe", "hasil": hasil}
