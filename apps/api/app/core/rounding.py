"""Pembulatan angka konsisten di seluruh API (tiket T4.3)."""
from __future__ import annotations

from decimal import Decimal


def bulatkan_ton(nilai: float | int | Decimal) -> float:
    """Semua nilai ton (produksi, kebutuhan, balance, alokasi) dibulatkan 2 desimal."""
    return round(float(nilai), 2)
