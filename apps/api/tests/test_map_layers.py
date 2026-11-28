"""GET /map/layers — kontrak nilai + kelas legenda (PRD bagian 5.3)."""
import pytest
from app.db.models import Province
from sqlalchemy import select


def test_layer_status_38_kunci_dan_17_1_20(client):
    body = client.get("/api/v1/map/layers", params={"layer": "status"}).json()

    assert body["layer"] == "status"
    assert body["tahun"] == 2025
    assert body["satuan"] == "kategori"
    assert len(body["values"]) == 38

    dari = {}
    for nilai in body["values"].values():
        dari[nilai] = dari.get(nilai, 0) + 1
    assert dari == {"surplus": 17, "balanced": 1, "defisit": 20}


def test_layer_status_tiga_kelas_token_css(client):
    classes = client.get("/api/v1/map/layers", params={"layer": "status"}).json()["classes"]

    assert [c["key"] for c in classes] == ["surplus", "balanced", "defisit"]
    assert [c["color_token"] for c in classes] == [
        "--status-surplus",
        "--status-balanced",
        "--status-defisit",
    ]
    assert [c["pola"] for c in classes] == ["solid", "garis", "titik"]
    assert all(c["min"] is None and c["max"] is None for c in classes)


def test_semua_token_warna_bukan_hex(client):
    for layer in ("status", "produksi", "kebutuhan"):
        for c in client.get("/api/v1/map/layers", params={"layer": layer}).json()["classes"]:
            assert c["color_token"].startswith("--")
            assert not c["color_token"].startswith("#")


def test_layer_tidak_dikenal_400(client):
    r = client.get("/api/v1/map/layers", params={"layer": "ngawur"})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "INVALID_PARAMS"


@pytest.mark.parametrize("layer", ["produksi", "kebutuhan"])
def test_kelas_kuantil_monoton_dan_menutup_data(client, layer):
    body = client.get("/api/v1/map/layers", params={"layer": layer}).json()
    classes = body["classes"]

    assert len(classes) == 5
    assert classes[0]["min"] == body["min"]
    assert classes[-1]["max"] == body["max"]

    for sebelum, sesudah in zip(classes, classes[1:], strict=False):
        assert sebelum["max"] <= sesudah["min"]
        assert sesudah["min"] > sebelum["min"]

    for c in classes:
        assert c["min"] <= c["max"]
        assert c["label"].endswith(" ton")


def test_provinsi_produksi_nol_masuk_kelas_pertama(client, db):
    """Nilai 0 bukan null: harus tetap dapat kelas, bukan abu-abu."""
    versi = client.get("/api/v1/provinces").json()["version"]["id"]
    db.execute(
        Province.__table__.update().where(Province.kode_bps == "11").values(nama="Aceh")
    )
    from app.db.models import ProvinceStat

    db.execute(
        ProvinceStat.__table__.update()
        .where(ProvinceStat.version_id == versi, ProvinceStat.kode_bps == "11")
        .values(produksi_beras_ton=0, rice_balance_ton=-528822.26)
    )
    db.flush()

    body = client.get("/api/v1/map/layers", params={"layer": "produksi"}).json()
    assert body["values"]["11"] == 0
    assert body["min"] == 0
    assert body["classes"][0]["min"] == 0


def test_layer_kepadatan_tanpa_luas_409(client):
    r = client.get("/api/v1/map/layers", params={"layer": "kepadatan"})
    assert r.status_code == 409
    body = r.json()
    assert body["error"]["code"] == "LAYER_UNAVAILABLE"
    assert body["error"]["details"] == {"alasan": "luas_km2 belum tersedia"}


def test_layer_kepadatan_sebagian_terisi(client, db):
    """Sebagian luas terisi: nilai yang ada dihitung, sisanya null + daftar kode."""
    kode = list(db.scalars(select(Province.kode_bps).order_by(Province.kode_bps.asc()).limit(20)))
    db.execute(
        Province.__table__.update()
        .where(Province.kode_bps.in_(kode))
        .values(luas_km2=10000)
    )
    db.flush()

    body = client.get("/api/v1/map/layers", params={"layer": "kepadatan"}).json()

    assert body["satuan"] == "jiwa/km²"
    assert len(body["values"]) == 38
    terisi = [k for k, v in body["values"].items() if v is not None]
    assert len(terisi) == 20
    assert sorted(body["details"]["kode_tanpa_luas"]) == sorted(set(body["values"]) - set(terisi))
    assert body["classes"]


def test_layer_kepadatan_semua_terisi_lima_kelas(client, db):
    db.execute(Province.__table__.update().values(luas_km2=20000))
    db.flush()

    body = client.get("/api/v1/map/layers", params={"layer": "kepadatan"}).json()
    assert all(v is not None for v in body["values"].values())
    assert len(body["classes"]) == 5
    assert body["details"] is None
