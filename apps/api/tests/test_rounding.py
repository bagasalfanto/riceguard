"""Konsistensi pembulatan ton (<= 2 desimal) dan kesamaan agregat dengan /summary (T4.3)."""
from decimal import Decimal


def _cek_maks_dua_desimal(nilai: float, nama: str) -> None:
    d = Decimal(str(nilai)).normalize()
    exponent = d.as_tuple().exponent
    assert isinstance(exponent, int)
    assert exponent >= -2, f"{nama} memiliki > 2 desimal: {nilai}"


def test_tidak_ada_field_ton_lebih_dari_dua_desimal(client):
    provs = client.get("/api/v1/provinces").json()["items"]
    for item in provs:
        for k, v in item.items():
            if k.endswith("_ton") or k.endswith("_ton_gkg"):
                _cek_maks_dua_desimal(v, f"{item['kode_bps']}.{k}")

    summary = client.get("/api/v1/summary").json()
    for k in ("produksi_beras_ton", "kebutuhan_beras_ton", "rice_balance_ton", "total_dialokasikan_ton"):
        _cek_maks_dua_desimal(summary[k], f"summary.{k}")

    rekom = client.get("/api/v1/recommendations").json()
    _cek_maks_dua_desimal(rekom["ringkasan"]["total_dialokasikan_ton"], "rekom.total")
    for r in rekom["items"]:
        _cek_maks_dua_desimal(r["ton"], f"rekom[{r['urutan']}].ton")


def test_jumlah_38_provinsi_sama_dengan_summary(client):
    provs = client.get("/api/v1/provinces").json()["items"]
    summary = client.get("/api/v1/summary").json()

    assert len(provs) == 38
    assert abs(sum(p["produksi_beras_ton"] for p in provs) - summary["produksi_beras_ton"]) <= 1.0
    assert abs(sum(p["kebutuhan_beras_ton"] for p in provs) - summary["kebutuhan_beras_ton"]) <= 1.0
    assert abs(sum(p["rice_balance_ton"] for p in provs) - summary["rice_balance_ton"]) <= 1.0
