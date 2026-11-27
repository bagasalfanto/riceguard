"""GET /provinces lanjutan — filter multi-pulau, pencarian kode_bps, sort peringkat, dan fields (T4.1)."""


def test_filter_multi_pulau(client):
    body = client.get(
        "/api/v1/provinces",
        params={"pulau": "Jawa,Bali & Nusa Tenggara"},
    ).json()
    assert body["total"] == 9
    assert {i["pulau"] for i in body["items"]} == {"Jawa", "Bali & Nusa Tenggara"}


def test_cari_berdasarkan_kode_bps(client):
    body = client.get("/api/v1/provinces", params={"q": "31"}).json()
    assert body["total"] == 1
    assert body["items"][0]["kode_bps"] == "31"
    assert body["items"][0]["provinsi"] == "DKI Jakarta"


def test_sort_peringkat_urut_rasio_turun(client):
    body = client.get("/api/v1/provinces", params={"sort": "peringkat"}).json()
    rasio = [i["rasio_swasembada"] for i in body["items"]]
    assert rasio == sorted(rasio, reverse=True)


def test_proyeksi_fields_subset_kolom(client):
    body = client.get(
        "/api/v1/provinces",
        params={"fields": "kode_bps,provinsi,status"},
    ).json()
    assert body["total"] == 38
    assert set(body) == {"tahun", "version", "items", "total"}
    assert set(body["items"][0]) == {"kode_bps", "provinsi", "status"}


def test_fields_tidak_dikenal_400(client):
    r = client.get("/api/v1/provinces", params={"fields": "kode_bps,kolom_palsu"})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "INVALID_PARAMS"


def test_rankings_by_balance_semua_38_provinsi(client):
    body = client.get("/api/v1/rankings", params={"by": "balance", "limit": 38}).json()
    assert len(body["items"]) == 38
    nilai = [i["nilai"] for i in body["items"]]
    assert nilai == sorted(nilai, reverse=True)
    assert body["items"][0]["provinsi"] == "Jawa Timur"
    assert body["items"][-1]["provinsi"] == "DKI Jakarta"
