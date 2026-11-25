"""Kalimat penjelasan rekomendasi berbasis template deterministik (PRD bagian 12)."""
from __future__ import annotations


def _angka(nilai: float, desimal: int = 1) -> str:
    """Format angka gaya id-ID (titik ribuan, koma desimal)."""
    if desimal == 0:
        return f"{nilai:,.0f}".replace(",", ".")
    return f"{nilai:,.{desimal}f}".replace(",", "_").replace(".", ",").replace("_", ".")


def _format_persen(persen: float) -> str:
    bulat = round(persen, 1)
    if bulat.is_integer():
        return _angka(bulat, 0)
    return _angka(bulat, 1)


def kalimat_rekomendasi(
    *,
    dari: str,
    ke: str,
    ton: float,
    jarak_km: float,
    persen_kebutuhan: float | None = None,
    n: int | None = None,
    sisa_sebelum: float | None = None,
    defisit_penerima: float | None = None,
) -> str:
    """Susun kalimat penjelasan distribusi dari angka data tanpa LLM."""
    if n is not None and sisa_sebelum is not None:
        if defisit_penerima and defisit_penerima > 0:
            persen = ton / defisit_penerima * 100
        elif persen_kebutuhan is not None:
            persen = persen_kebutuhan
        else:
            persen = 0.0
        return (
            f"{dari} dipilih untuk {ke} karena merupakan provinsi surplus ke-{n} terdekat "
            f"({_angka(jarak_km, 1)} km) dengan sisa surplus {_angka(sisa_sebelum, 2)} ton saat giliran {ke}. "
            f"Alokasi {_angka(ton, 2)} ton menutup {_format_persen(persen)}% defisit {ke}."
        )

    bagian = f"{dari} memasok {_angka(ton, 2)} ton ke {ke}, {_angka(jarak_km, 1)} km garis lurus"
    if persen_kebutuhan is None:
        return f"{bagian}."
    return f"{bagian} — {_format_persen(persen_kebutuhan)}% kebutuhan {ke}."
