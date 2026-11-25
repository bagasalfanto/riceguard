"""Validasi hasil RiceGuard: spot-check 5 provinsi + cek aturan rekomendasi distribusi.

Jalankan dari folder repo:  python scripts/validate.py
Butuh: pandas. Opsional: pyproj (cek jarak dengan geodesik WGS84 sebagai pembanding).
"""
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

import pandas as pd

BASE = Path(__file__).resolve().parent.parent
BATAS_SWASEMBADA = Decimal("0.90")
TOL_TON = 0.05  # toleransi pembulatan 2 desimal

# Angka dibaca langsung dari halaman sumber pada 25 Nov 2026:
# produksi beras = BPS Produksi Padi dan Beras Menurut Provinsi 2025 (diperbarui 12 Feb 2026)
# penduduk = BPS Jumlah Penduduk menurut Provinsi dan Jenis Kelamin 2025, hasil SUPAS 2025 (diperbarui 13 Jul 2026)
# konsumsi = Bapanas, Konsumsi per Jenis Pangan Provinsi Update 2025, komoditas Beras (kg/kapita/tahun)
SPOT_CHECK = {
    # kode_bps: (nama, produksi_beras_ton, penduduk_jiwa, konsumsi_kg, kode_kemendagri_di_bapanas)
    "31": ("DKI Jakarta", "877", "10724334", "80.6", "31"),
    "35": ("Jawa Timur", "6027320", "42111119", "85.5", "35"),
    "61": ("Kalimantan Barat", "448325", "5771745", "86.3", "61"),
    "97": ("Papua Pegunungan", "198", "1486352", "43.9", "95"),
    "14": ("Riau", "133187", "6817892", "82.3", "14"),
}


def bulat(x: Decimal, nd: str = "0.01") -> Decimal:
    return x.quantize(Decimal(nd), rounding=ROUND_HALF_UP)


def spot_check(df: pd.DataFrame) -> list[dict]:
    hasil = []
    for kode, (nama, prod, pend, kons, kkd) in SPOT_CHECK.items():
        r = df[df["kode_bps"] == kode].iloc[0]
        prod, pend, kons = Decimal(prod), Decimal(pend), Decimal(kons)
        keb = pend * kons / 1000
        bal = prod - keb
        rasio = prod / keb
        status = "surplus" if bal > 0 else ("balanced" if rasio >= BATAS_SWASEMBADA else "defisit")
        cek = {
            "nama sama": r["provinsi"].replace("DI ", "Daerah Istimewa ") == nama.replace("DI ", "Daerah Istimewa "),
            "kode kemendagri": r["kode_kemendagri"] == kkd,
            "produksi": Decimal(str(r["produksi_beras_ton"])) == prod,
            "penduduk": Decimal(str(r["penduduk_jiwa"])) == pend,
            "konsumsi": Decimal(str(r["konsumsi_kg_kapita_tahun"])) == kons,
            "kebutuhan": Decimal(str(r["kebutuhan_beras_ton"])) == bulat(keb),
            "balance": Decimal(str(r["rice_balance_ton"])) == bulat(bal),
            "rasio": Decimal(str(r["rasio_swasembada"])) == bulat(rasio, "0.0001"),
            "status": r["status"] == status,
        }
        hasil.append({"provinsi": nama, "kebutuhan_ton": float(bulat(keb)), "balance_ton": float(bulat(bal)),
                      "rasio": float(bulat(rasio, "0.0001")), "status": status,
                      "lolos": all(cek.values()), "gagal": [k for k, v in cek.items() if not v]})
    return hasil


def cek_38_provinsi(df: pd.DataFrame) -> list[str]:
    """Hitung ulang SEMUA provinsi dari folder raw/ (tanpa pandas) dan bandingkan dengan dataset."""
    import csv
    raw = BASE / "raw"
    alias = {"DI Yogyakarta": "Daerah Istimewa Yogyakarta"}
    angka = lambda s: Decimal(s.strip().replace(".", "").replace(",", "."))
    nama = lambda s: alias.get(s.strip(), s.strip())
    prod = {nama(l.split("|")[0]): angka(l.split("|")[2]) for l in open(raw / "produksi_2025.txt", encoding="utf-8")}
    pend = {nama(l.split("|")[0]): angka(l.split("|")[1]) for l in open(raw / "penduduk_supas2025.txt", encoding="utf-8")}
    kons = {r["kode_kemendagri"]: Decimal(r["konsumsi_kg_kapita_tahun"])
            for r in csv.DictReader(open(raw / "konsumsi_bapanas_2025.csv", encoding="utf-8"))}
    beda = []
    ds = df.set_index("kode_bps")
    for r in csv.DictReader(open(raw / "provinces-reference-serlin.csv", encoding="utf-8")):
        n, k = r["provinsi"], r["kode_bps"]
        keb = pend[n] * kons[r["kode_kemendagri"]] / 1000
        bal, rasio = prod[n] - keb, prod[n] / keb
        st = "surplus" if bal > 0 else ("balanced" if rasio >= BATAS_SWASEMBADA else "defisit")
        d = ds.loc[k]
        if not (Decimal(str(d["kebutuhan_beras_ton"])) == bulat(keb) and Decimal(str(d["rice_balance_ton"])) == bulat(bal)
                and Decimal(str(d["rasio_swasembada"])) == bulat(rasio, "0.0001") and d["status"] == st):
            beda.append(n)
    return beda


def cek_rekomendasi(df: pd.DataFrame, rek: pd.DataFrame) -> dict[str, bool]:
    from matching import haversine_km

    st = df.set_index("kode_bps")
    bal, status = st["rice_balance_ton"], st["status"]
    keluar = rek.groupby("dari_kode")["ton"].sum()
    masuk = rek.groupby("ke_kode")["ton"].sum()
    surplus = status[status == "surplus"].index
    defisit = status[status == "defisit"].index
    total_surplus, total_defisit = bal[surplus].sum(), -bal[defisit].sum()

    hasil = {
        "pemasok hanya provinsi surplus": rek["dari_kode"].isin(surplus).all(),
        "penerima hanya provinsi defisit": rek["ke_kode"].isin(defisit).all(),
        "provinsi balanced tidak ikut": not (rek["dari_kode"].isin(status[status == "balanced"].index).any()
                                             or rek["ke_kode"].isin(status[status == "balanced"].index).any()),
        "kiriman tiap pemasok <= surplusnya": all(keluar[k] <= bal[k] + TOL_TON for k in keluar.index),
        "terima tiap provinsi <= defisitnya": all(masuk[k] <= -bal[k] + TOL_TON for k in masuk.index),
        "semua ton > 0": (rek["ton"] > 0).all(),
    }
    if total_surplus >= total_defisit:
        hasil["semua defisit tertutup penuh (surplus nasional cukup)"] = all(
            abs(masuk.get(k, 0) + bal[k]) <= TOL_TON * 2 for k in defisit)
    hasil["total dialokasikan = min(total surplus, total defisit)"] = abs(
        rek["ton"].sum() - min(total_surplus, total_defisit)) <= TOL_TON * len(rek)

    # Urutan: provinsi defisit dilayani dari defisit terbesar
    urutan_ke = list(dict.fromkeys(rek.sort_values("urutan")["ke_kode"]))
    hasil["defisit terbesar dilayani lebih dulu"] = urutan_ke == sorted(urutan_ke, key=lambda k: bal[k])

    # Tiap penerima: pemasok dipakai dari yang terdekat; pemasok lebih dekat yang dilewati harus sudah habis
    sisa = {k: bal[k] for k in surplus}
    terdekat_ok = True
    for ke in urutan_ke:
        baris = rek[rek["ke_kode"] == ke].sort_values("urutan")
        jarak = list(baris["jarak_km"])
        if jarak != sorted(jarak):
            terdekat_ok = False
        jauh_terpakai = jarak[-1]
        for s in surplus:
            d = haversine_km(st.at[ke, "lat"], st.at[ke, "lng"], st.at[s, "lat"], st.at[s, "lng"])
            if d < jauh_terpakai - 0.05 and s not in set(baris["dari_kode"]) and sisa[s] > TOL_TON:
                terdekat_ok = False
        for b in baris.itertuples():
            sisa[b.dari_kode] -= b.ton
    hasil["pemasok terdekat dipakai lebih dulu"] = terdekat_ok

    # Jarak: dibandingkan dengan geodesik elipsoid WGS84 (metode berbeda)
    try:
        from pyproj import Geod
        g = Geod(ellps="WGS84")
        selisih = []
        for b in rek.itertuples():
            _, _, m = g.inv(st.at[b.dari_kode, "lng"], st.at[b.dari_kode, "lat"], st.at[b.ke_kode, "lng"], st.at[b.ke_kode, "lat"])
            selisih.append(abs(b.jarak_km - m / 1000) / (m / 1000))
        hasil[f"jarak haversine vs geodesik WGS84 (selisih maks {max(selisih):.2%})"] = max(selisih) < 0.01
    except ImportError:
        pass
    return hasil


if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    df = pd.read_csv(BASE / "dataset_v1.csv", dtype={"kode_bps": str, "kode_kemendagri": str})
    rek = pd.read_csv(BASE / "rekomendasi_distribusi_v1.csv", dtype={"dari_kode": str, "ke_kode": str})

    print("== Spot-check 5 provinsi (angka sumber -> hitung ulang Decimal) ==")
    sc = spot_check(df)
    for s in sc:
        print(f"  {'LOLOS' if s['lolos'] else 'GAGAL'}  {s['provinsi']:18} kebutuhan {s['kebutuhan_ton']:>14,.2f}"
              f"  balance {s['balance_ton']:>14,.2f}  rasio {s['rasio']:.4f}  {s['status']}  {s['gagal'] or ''}")
    beda38 = cek_38_provinsi(df)
    print(f"== Hitung ulang 38 provinsi dari raw/ ==\n  {'LOLOS' if not beda38 else 'GAGAL'}  {38 - len(beda38)}/38 cocok {beda38 or ''}")
    print("== Aturan rekomendasi distribusi ==")
    cr = cek_rekomendasi(df, rek)
    for k, v in cr.items():
        print(f"  {'LOLOS' if v else 'GAGAL'}  {k}")
    ok = all(s["lolos"] for s in sc) and not beda38 and all(cr.values())
    print("SEMUA LOLOS" if ok else "ADA YANG GAGAL")
    sys.exit(0 if ok else 1)
