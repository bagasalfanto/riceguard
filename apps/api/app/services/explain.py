"""Kalimat penjelasan rekomendasi, disusun dari kolom yang tersimpan.

Template PRD bagian 12 memuat `{n}` (urutan pemasok terdekat) dan `{sisa}` (sisa surplus
saat giliran), yang hanya bisa diketahui dengan memutar ulang algoritma. Sampai replay itu
ada (T6.1), kalimat di sini hanya memakai angka yang benar-benar tersimpan, supaya tidak
ada angka karangan.
"""
from __future__ import annotations


def _angka(nilai: float) -> str:
    """1.234,5 gaya id-ID."""
    return f"{nilai:,.1f}".replace(",", "_").replace(".", ",").replace("_", ".")


def kalimat_rekomendasi(
    *,
    dari: str,
    ke: str,
    ton: float,
    jarak_km: float,
    persen_kebutuhan: float | None,
) -> str:
    bagian = f"{dari} memasok {_angka(ton)} ton ke {ke}, {_angka(jarak_km)} km garis lurus"
    if persen_kebutuhan is None:
        return f"{bagian}."
    return f"{bagian} — {_angka(persen_kebutuhan)}% kebutuhan {ke}."
