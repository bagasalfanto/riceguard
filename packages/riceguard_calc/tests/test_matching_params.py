"""Uji parameter skenario simulasi pada riceguard_calc.matching (T6.1)."""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

import pandas as pd
import pytest
from riceguard_calc import (
    MatchParams,
    build,
    haversine_km,
    match,
    match_detail,
    parse_konsumsi,
    parse_penduduk,
    parse_produksi,
    parse_referensi,
)

ROOT = Path(__file__).resolve().parents[3]
RAW = ROOT / "dataset" / "raw"
KUNCI_V1 = {"urutan", "dari_kode", "dari", "ke_kode", "ke", "ton", "jarak_km"}


@pytest.fixture(scope="module")
def data_2025() -> list[dict]:
    df = build(
        parse_referensi(RAW / "provinces-reference-serlin.csv"),
        parse_produksi(RAW / "produksi_2025.txt"),
        parse_penduduk(RAW / "penduduk_supas2025.txt"),
        parse_konsumsi(RAW / "konsumsi_bapanas_2025.csv"),
        2025,
    )
    return [
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


@pytest.fixture(scope="module")
def acuan_csv() -> pd.DataFrame:
    return pd.read_csv(
        ROOT / "dataset" / "rekomendasi_distribusi_v1.csv",
        dtype={"dari_kode": str, "ke_kode": str},
    )


def _cek_batas_alokasi(hasil: list[dict], prov_sim: list[dict], params: MatchParams) -> None:
    peta = {p["kode"]: p for p in prov_sim}
    keluar: dict[str, float] = {}
    masuk: dict[str, float] = {}
    for row in hasil:
        keluar[row["dari_kode"]] = keluar.get(row["dari_kode"], 0.0) + row["ton"]
        masuk[row["ke_kode"]] = masuk.get(row["ke_kode"], 0.0) + row["ton"]
        assert peta[row["dari_kode"]]["status"] == "surplus"
        assert peta[row["ke_kode"]]["status"] == "defisit"

    faktor = params.persen_surplus_dilepas / 100.0
    for kode, total_keluar in keluar.items():
        assert total_keluar <= peta[kode]["balance"] * faktor + 0.05
    for kode, total_masuk in masuk.items():
        assert total_masuk <= -peta[kode]["balance"] + 0.05


def test_regresi_default_identik_csv(data_2025, acuan_csv):
    for params in (None, MatchParams()):
        hasil = match(data_2025, params)
        assert len(hasil) == 27
        assert all(set(r) == KUNCI_V1 for r in hasil)
        assert [r["urutan"] for r in hasil] == list(acuan_csv["urutan"])
        assert [r["dari_kode"] for r in hasil] == list(acuan_csv["dari_kode"])
        assert [r["ke_kode"] for r in hasil] == list(acuan_csv["ke_kode"])
        for r, a in zip(hasil, acuan_csv.itertuples(), strict=True):
            assert r["ton"] == pytest.approx(a.ton, abs=0.01)
            assert r["jarak_km"] == pytest.approx(a.jarak_km, abs=0.05)

    detail, prov_sim = match_detail(data_2025, MatchParams())
    assert len(detail) == 27
    assert len(prov_sim) == 38
    assert detail[0]["peringkat_jarak"] == 1
    assert detail[0]["sisa_sebelum"] == pytest.approx(1509346.27, abs=0.01)
    assert detail[0]["defisit_penerima"] == pytest.approx(863504.32, abs=0.01)


def test_persen_surplus_dilepas_mengurangi_alokasi(data_2025):
    params_80 = MatchParams(persen_surplus_dilepas=80.0)
    detail_80, prov_sim_80 = match_detail(data_2025, params_80)
    _cek_batas_alokasi(detail_80, prov_sim_80, params_80)

    # Jawa Barat surplus = 1.509.346,27; 80% = 1.207.477,01
    keluar_jabar = sum(r["ton"] for r in detail_80 if r["dari_kode"] == "32")
    assert keluar_jabar <= 1509346.27 * 0.8

    # Dengan 10% surplus dilepas (< total defisit), total teralokasi turun jauh di bawah 2,89 juta ton
    params_10 = MatchParams(persen_surplus_dilepas=10.0)
    detail_10, prov_sim_10 = match_detail(data_2025, params_10)
    _cek_batas_alokasi(detail_10, prov_sim_10, params_10)
    assert sum(r["ton"] for r in detail_10) < 1_500_000

    # Kasus manual: surplus 100 dengan 80% -> hanya 80 yang dilepas untuk defisit 100
    sintetis = [
        {"kode": "S", "nama": "S", "lat": 0.0, "lng": 0.0, "balance": 100.0},
        {"kode": "D", "nama": "D", "lat": 0.0, "lng": 1.0, "balance": -100.0},
    ]
    hasil = match(sintetis, params_80)
    assert len(hasil) == 1
    assert hasil[0]["ton"] == 80.0


def test_jarak_maks_km_membuang_pasangan_jauh(data_2025):
    params = MatchParams(jarak_maks_km=200.0)
    detail, prov_sim = match_detail(data_2025, params)
    _cek_batas_alokasi(detail, prov_sim, params)

    assert detail
    assert all(r["jarak_km"] <= 200.0 for r in detail)
    # Jabar -> DKI (116,8 km) dan Jabar -> Banten (172,9 km) tetap lolos; > 200 km terbuang
    pasangan = {(r["dari_kode"], r["ke_kode"]) for r in detail}
    assert ("32", "31") in pasangan
    assert ("32", "36") in pasangan
    assert len(detail) < 27


def test_kecualikan_pemasok_dan_penerima(data_2025):
    params_pemasok = MatchParams(kecualikan_pemasok=("32",))
    detail_p, prov_p = match_detail(data_2025, params_pemasok)
    _cek_batas_alokasi(detail_p, prov_p, params_pemasok)
    assert all(r["dari_kode"] != "32" for r in detail_p)

    params_penerima = MatchParams(kecualikan_penerima=("31",))
    detail_d, prov_d = match_detail(data_2025, params_penerima)
    _cek_batas_alokasi(detail_d, prov_d, params_penerima)
    assert all(r["ke_kode"] != "31" for r in detail_d)


def test_perubahan_produksi_satu_provinsi_gagal_panen(data_2025):
    # Jawa Tengah (33): -50% membuat produksi < kebutuhan sehingga berubah jadi defisit
    params = MatchParams(perubahan_produksi={"33": -50.0})
    detail, prov_sim = match_detail(data_2025, params)
    _cek_batas_alokasi(detail, prov_sim, params)

    jateng_awal = next(p for p in data_2025 if p["kode"] == "33")
    jateng_sim = next(p for p in prov_sim if p["kode"] == "33")

    exp_prod = float(
        (Decimal(str(jateng_awal["produksi_beras_ton"])) * Decimal("0.5")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
    )
    assert jateng_sim["produksi_beras_ton"] == exp_prod
    assert jateng_sim["kebutuhan_beras_ton"] == jateng_awal["kebutuhan_beras_ton"]
    assert jateng_sim["rice_balance_ton"] < 0
    assert jateng_sim["status"] == "defisit"
    assert any(r["ke_kode"] == "33" for r in detail)
    assert all(r["dari_kode"] != "33" for r in detail)


def test_perubahan_konsumsi_persen(data_2025):
    params = MatchParams(perubahan_konsumsi_persen=10.0)
    detail, prov_sim = match_detail(data_2025, params)
    _cek_batas_alokasi(detail, prov_sim, params)

    dki_awal = next(p for p in data_2025 if p["kode"] == "31")
    dki_sim = next(p for p in prov_sim if p["kode"] == "31")
    assert dki_sim["kebutuhan_beras_ton"] > dki_awal["kebutuhan_beras_ton"]
    assert dki_sim["rice_balance_ton"] < dki_awal["balance"]
    assert sum(r["ton"] for r in detail) > 2_889_188


def test_ambang_swasembada_mengubah_status(data_2025):
    params_80 = MatchParams(ambang_swasembada=0.80)
    detail_80, prov_80 = match_detail(data_2025, params_80)
    peta_80 = {p["kode"]: p for p in prov_80}

    # Banten (0.8942), NTT (0.8879), Kalteng (0.8201) menjadi balanced
    for kode in ("36", "53", "62"):
        assert peta_80[kode]["status"] == "balanced"
        assert all(r["ke_kode"] != kode for r in detail_80)

    params_95 = MatchParams(ambang_swasembada=0.95)
    detail_95, prov_95 = match_detail(data_2025, params_95)
    peta_95 = {p["kode"]: p for p in prov_95}

    # Kalbar (0.9001) turun dari balanced menjadi defisit dan ikut menerima alokasi
    assert peta_95["61"]["status"] == "defisit"
    assert any(r["ke_kode"] == "61" for r in detail_95)


def test_input_minimal_tanpa_produksi_beras():
    data = [
        {"kode": "S1", "nama": "S1", "lat": 0.0, "lng": 0.0, "balance": 100.0, "rasio": 1.5},
        {"kode": "S2", "nama": "S2", "lat": 0.0, "lng": 5.0, "balance": 100.0, "rasio": 1.5},
        {"kode": "D1", "nama": "D1", "lat": 0.0, "lng": 1.0, "balance": -50.0, "rasio": 0.85},
    ]
    # Ambang 0.80 membuat D1 (rasio 0.85) menjadi balanced -> 0 alokasi
    assert match(data, MatchParams(ambang_swasembada=0.80)) == []

    # Jarak S2 -> D1 > 400 km, S1 -> D1 ~ 111 km; jarak_maks_km=200 memilih S1 saja
    jarak_s1 = round(haversine_km(0.0, 1.0, 0.0, 0.0), 1)
    hasil = match(data, MatchParams(jarak_maks_km=200.0, persen_surplus_dilepas=30.0))
    assert hasil == [
        {
            "urutan": 1,
            "dari_kode": "S1",
            "dari": "S1",
            "ke_kode": "D1",
            "ke": "D1",
            "ton": 30.0,
            "jarak_km": jarak_s1,
        }
    ]
