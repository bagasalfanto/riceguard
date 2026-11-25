"""GET /provinces — filter, sort, pencarian, dan pagination.

Angka acuan diambil dari `dataset/dataset_v1.csv`, bukan tebakan.
"""
import pytest


def test_seluruh_38_provinsi(client):
    body = client.get("/api/v1/provinces").json()
    assert body["total"] == 38
    assert len(body["items"]) == 38
    assert body["tahun"] == 2025
    assert set(body["version"]) == {"id", "version_no"}

    kunci = {
        "tahun", "kode_bps", "kode_kemendagri", "provinsi", "pulau", "lat", "lng",
        "penduduk_jiwa", "konsumsi_kg_kapita_tahun", "produksi_padi_ton_gkg",
        "produksi_beras_ton", "kebutuhan_beras_ton", "rice_balance_ton",
        "rasio_swasembada", "status",
    }
    assert set(body["items"][0]) == kunci


def test_default_urut_nama_naik(client):
    nama = [i["provinsi"] for i in client.get("/api/v1/provinces").json()["items"]]
    assert nama == sorted(nama, key=str.lower)


def test_filter_defisit_20_baris(client):
    body = client.get("/api/v1/provinces", params={"status": "defisit"}).json()
    assert body["total"] == 20
    assert {i["status"] for i in body["items"]} == {"defisit"}


def test_filter_balanced_hanya_kalimantan_barat(client):
    body = client.get("/api/v1/provinces", params={"status": "balanced"}).json()
    assert body["total"] == 1
    satu = body["items"][0]
    assert satu["provinsi"] == "Kalimantan Barat"
    assert satu["rice_balance_ton"] < 0


def test_filter_status_multi_nilai(client):
    body = client.get("/api/v1/provinces", params={"status": "surplus,balanced"}).json()
    assert body["total"] == 18


def test_filter_pulau_papua_6_baris(client):
    body = client.get("/api/v1/provinces", params={"pulau": "Papua"}).json()
    assert body["total"] == 6


def test_cari_nama_tanpa_beda_huruf_besar_kecil(client):
    body = client.get("/api/v1/provinces", params={"q": "JAKARTA"}).json()
    assert [i["provinsi"] for i in body["items"]] == ["DKI Jakarta"]


def test_cari_dengan_karakter_khusus_tidak_jadi_wildcard(client):
    assert client.get("/api/v1/provinces", params={"q": "%"}).json()["total"] == 0


def test_sort_balance_desc_pertama_jawa_timur(client):
    body = client.get("/api/v1/provinces", params={"sort": "balance", "order": "desc"}).json()
    assert body["items"][0]["provinsi"] == "Jawa Timur"
    assert body["items"][0]["rice_balance_ton"] == 2426819.33


def test_sort_numerik_default_turun(client):
    nilai = [i["produksi_beras_ton"] for i in client.get("/api/v1/provinces", params={"sort": "produksi"}).json()["items"]]
    assert nilai == sorted(nilai, reverse=True)


def test_sort_tidak_dikenal_400(client):
    r = client.get("/api/v1/provinces", params={"sort": "ngawur"})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "INVALID_PARAMS"


def test_status_tidak_dikenal_400(client):
    r = client.get("/api/v1/provinces", params={"status": "ngawur"})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "INVALID_PARAMS"


@pytest.mark.parametrize("order", ["naik", "DESC", ""])
def test_order_tidak_dikenal_400(client, order):
    if order == "":
        pytest.skip("string kosong diperlakukan sebagai default")
    r = client.get("/api/v1/provinces", params={"order": order})
    assert r.status_code == 400


def test_pagination(client):
    halaman1 = client.get("/api/v1/provinces", params={"limit": 10, "offset": 0}).json()
    halaman2 = client.get("/api/v1/provinces", params={"limit": 10, "offset": 10}).json()

    assert len(halaman1["items"]) == 10
    assert halaman1["total"] == 38
    assert halaman1["items"][0]["kode_bps"] != halaman2["items"][0]["kode_bps"]


def test_limit_di_atas_batas_ditolak_validasi(client):
    assert client.get("/api/v1/provinces", params={"limit": 5000}).status_code == 400


def test_tahun_tanpa_versi_404(client):
    r = client.get("/api/v1/provinces", params={"tahun": 2019})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NO_PUBLISHED_VERSION"
