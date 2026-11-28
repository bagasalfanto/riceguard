"""GET /sources dan GET /content — semua teks Landing datang dari DB."""
from app.core.cache import cache
from app.db.models import SiteContent


def test_empat_sumber_urut_id(client):
    body = client.get("/api/v1/sources").json()
    assert len(body) == 4
    assert [s["id"] for s in body] == sorted(s["id"] for s in body)
    assert set(body[0]) == {"id", "key", "nama", "instansi", "tabel_resmi", "tahun", "diperbarui", "url"}


def test_enam_blok_konten(client):
    body = client.get("/api/v1/content").json()
    assert len(body) == 6
    assert {"hero", "about", "sdg2", "how_it_works", "limitations", "methodology"} == {c["key"] for c in body}


def test_filter_keys_satu_item(client):
    body = client.get("/api/v1/content", params={"keys": "about"}).json()
    assert len(body) == 1
    assert body[0]["key"] == "about"


def test_filter_keys_ganda_dan_koma(client):
    dua = client.get("/api/v1/content?keys=about&keys=sdg2").json()
    assert {c["key"] for c in dua} == {"about", "sdg2"}

    koma = client.get("/api/v1/content", params={"keys": "about,sdg2"}).json()
    assert {c["key"] for c in koma} == {"about", "sdg2"}


def test_key_tak_dikenal_diabaikan(client):
    body = client.get("/api/v1/content", params={"keys": "about,tidak-ada"}).json()
    assert [c["key"] for c in body] == ["about"]


def test_konten_berubah_langsung_setelah_simpan(client, db):
    """T10.7 memanggil cache.clear_all() setelah konten disimpan; tanpa itu cache menahan teks lama."""
    awal = client.get("/api/v1/content", params={"keys": "about"}).json()[0]

    baris = db.get(SiteContent, "about")
    baris.body_md = "Teks baru untuk uji cache."
    db.flush()
    cache.clear_all()

    baru = client.get("/api/v1/content", params={"keys": "about"}).json()[0]
    assert baru["body_md"] == "Teks baru untuk uji cache."
    assert baru["body_md"] != awal["body_md"]
