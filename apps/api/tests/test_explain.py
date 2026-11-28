"""Kalimat penjelasan rekomendasi deterministik PRD bagian 12 (T6.2)."""
from __future__ import annotations

from pathlib import Path

import pandas as pd
from app.services.explain import kalimat_rekomendasi
from riceguard_calc import match_detail

REPO = Path(__file__).resolve().parents[3]


def test_kalimat_rekomendasi_template_lengkap_dan_fallback():
    teks = kalimat_rekomendasi(
        dari="Jawa Barat",
        ke="DKI Jakarta",
        ton=863504.32,
        jarak_km=116.8,
        persen_kebutuhan=99.9,
        n=1,
        sisa_sebelum=1509346.27,
        defisit_penerima=863504.32,
    )
    assert teks == (
        "Jawa Barat dipilih untuk DKI Jakarta karena merupakan provinsi surplus ke-1 terdekat "
        "(116,8 km) dengan sisa surplus 1.509.346,27 ton saat giliran DKI Jakarta. "
        "Alokasi 863.504,32 ton menutup 100% defisit DKI Jakarta."
    )

    parsial = kalimat_rekomendasi(
        dari="Sumatera Selatan",
        ke="Riau",
        ton=59850.04,
        jarak_km=489.7,
        persen_kebutuhan=10.67,
        n=3,
        sisa_sebelum=1290224.33,
        defisit_penerima=427925.51,
    )
    assert "ke-3 terdekat (489,7 km)" in parsial
    assert "1.290.224,33 ton" in parsial
    assert "59.850,04 ton" in parsial
    assert "14%" in parsial

    desimal = kalimat_rekomendasi(
        dari="Sumatera Utara",
        ke="Riau",
        ton=115719.38,
        jarak_km=358.9,
        n=2,
        sisa_sebelum=115719.38,
        defisit_penerima=427925.51,
    )
    assert "27%" in desimal

    desimal_koma = kalimat_rekomendasi(
        dari="Aceh",
        ke="Riau",
        ton=193422.33,
        jarak_km=500.0,
        n=1,
        sisa_sebelum=401666.74,
        defisit_penerima=427925.51,
    )
    assert "45,2%" in desimal_koma

    fallback = kalimat_rekomendasi(
        dari="Jawa Barat",
        ke="DKI Jakarta",
        ton=863504.32,
        jarak_km=116.8,
        persen_kebutuhan=99.9,
    )
    assert "863.504,32 ton" in fallback
    assert "116,8 km" in fallback
    assert "99,9%" in fallback


def test_regenerasi_27_baris_dataset_v1():
    df = pd.read_csv(REPO / "dataset" / "dataset_v1.csv", dtype={"kode_bps": str})
    masukan = [
        {
            "kode": r.kode_bps,
            "nama": r.provinsi,
            "pulau": r.pulau,
            "lat": float(r.lat),
            "lng": float(r.lng),
            "penduduk_jiwa": int(r.penduduk_jiwa),
            "konsumsi_kg_kapita_tahun": float(r.konsumsi_kg_kapita_tahun),
            "produksi_beras_ton": float(r.produksi_beras_ton),
            "kebutuhan_beras_ton": float(r.kebutuhan_beras_ton),
            "balance": float(r.rice_balance_ton),
            "rasio_swasembada": float(r.rasio_swasembada),
            "status": r.status,
        }
        for r in df.itertuples()
    ]
    detail_rows, _ = match_detail(masukan)
    assert len(detail_rows) == 27

    kalimat_semua = [
        kalimat_rekomendasi(
            dari=r["dari"],
            ke=r["ke"],
            ton=r["ton"],
            jarak_km=r["jarak_km"],
            n=r["peringkat_jarak"],
            sisa_sebelum=r["sisa_sebelum"],
            defisit_penerima=r["defisit_penerima"],
        )
        for r in detail_rows
    ]

    baris_1 = kalimat_semua[0]
    for acuan in ("Jawa Barat", "DKI Jakarta", "116,8 km", "863.504,32 ton", "100%"):
        assert acuan in baris_1

    for row, teks in zip(detail_rows, kalimat_semua, strict=True):
        assert row["dari"] in teks
        assert row["ke"] in teks
        assert f"ke-{row['peringkat_jarak']} terdekat" in teks
        assert " ton" in teks
        assert " km" in teks
        assert "%" in teks
        assert "{" not in teks and "}" not in teks
        assert "None" not in teks


def test_get_recommendations_memuat_kalimat_prd12(client):
    items = client.get("/api/v1/recommendations").json()["items"]
    assert len(items) == 27

    pertama = items[0]["explanation"]
    for acuan in ("Jawa Barat", "DKI Jakarta", "ke-1 terdekat", "116,8 km", "863.504,32 ton", "100%"):
        assert acuan in pertama

    for item in items:
        teks = item["explanation"]
        assert "surplus ke-" in teks
        assert "sisa surplus " in teks
        assert " ton saat giliran " in teks
        assert " km)" in teks
        assert "% defisit " in teks
        assert "{" not in teks and "}" not in teks
        assert "None" not in teks


def test_get_recommendations_filter_mempertahankan_peringkat_global(client):
    semua = {i["urutan"]: i["explanation"] for i in client.get("/api/v1/recommendations").json()["items"]}
    terfilter = client.get("/api/v1/recommendations", params={"dari_kode": "32"}).json()["items"]
    assert terfilter
    for item in terfilter:
        assert item["explanation"] == semua[item["urutan"]]
