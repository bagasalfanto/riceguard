from __future__ import annotations

import importlib
import os
import sys

from fastapi import FastAPI

app = FastAPI(title="RiceGuard API", version="0.1.0")


def _listing(path: str) -> object:
    try:
        return sorted(os.listdir(path))
    except Exception as exc:  # noqa: BLE001 - diagnostik sementara
        return f"{type(exc).__name__}: {exc}"


@app.get("/health", tags=["meta"])
def health() -> dict:
    hasil: dict[str, object] = {
        "cwd": os.getcwd(),
        "sys_path": sys.path[:6],
        "app_module_file": getattr(sys.modules.get("app"), "__file__", None),
        "list_app": _listing("app"),
        "list_routers": _listing("app/routers"),
        "list_public": _listing("app/routers/public"),
        "list_admin": _listing("app/routers/admin"),
    }
    for nama in ("app.routers", "app.routers.public", "app.routers.admin", "app.routers.public.meta"):
        try:
            importlib.import_module(nama)
            hasil[nama] = "ok"
        except Exception as exc:  # noqa: BLE001 - diagnostik sementara
            hasil[nama] = f"{type(exc).__name__}: {exc}"
    return hasil
