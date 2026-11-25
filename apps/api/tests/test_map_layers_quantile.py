"""quantile_classes — batas kelas unik, nilai kembar digabung."""
from app.services.map_layers import quantile_classes


def test_lima_kelas_untuk_seri_merata():
    classes = quantile_classes(list(range(1, 101)))
    assert len(classes) == 5
    assert classes[0]["min"] == 1
    assert classes[-1]["max"] == 100
    for sebelum, sesudah in zip(classes, classes[1:], strict=False):
        assert sebelum["max"] <= sesudah["min"]


def test_nilai_kembar_menggabungkan_kelas():
    classes = quantile_classes([0] * 20 + [10] * 10 + [100] * 8)
    assert len(classes) < 5
    assert classes[0]["min"] == 0
    assert classes[-1]["max"] == 100


def test_semua_nilai_sama_satu_kelas():
    classes = quantile_classes([7] * 38)
    assert len(classes) == 1
    assert classes[0]["min"] == classes[0]["max"] == 7
    assert classes[0]["label"] == "7 ton"


def test_seri_kosong():
    assert quantile_classes([]) == []


def test_label_format_id_id():
    classes = quantile_classes([1000, 2000, 3000, 4000, 5000, 6000])
    assert classes[0]["label"].startswith("< ")
    assert "." in classes[-1]["label"]
    assert "," not in classes[-1]["label"]


def test_satu_nilai_tidak_pakai_label_kurung():
    classes = quantile_classes([1, 2])
    assert all("–" not in c["label"] or c["label"] for c in classes)
    assert classes[0]["label"].startswith("< ")
