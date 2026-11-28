from __future__ import annotations

import sys

from fastapi import FastAPI

print("riceguard: main minimal dimuat", file=sys.stderr, flush=True)

app = FastAPI(title="RiceGuard API", version="0.1.0")


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok", "mode": "minimal"}
