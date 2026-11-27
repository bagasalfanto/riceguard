"""Rendering peta/grafik Matplotlib (Agg), template Jinja2 A4, dan PDF WeasyPrint (T9.3)."""
from __future__ import annotations

import base64
import io
import json
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Any

import matplotlib

matplotlib.use("Agg")

from jinja2 import Environment, FileSystemLoader, select_autoescape
from matplotlib.backends.backend_agg import FigureCanvasAgg
from matplotlib.figure import Figure
from matplotlib.lines import Line2D
from matplotlib.patches import FancyArrowPatch, Patch
from matplotlib.patches import Polygon as MplPolygon

from app.core.errors import AppError

_TEMPLATE_DIR = Path(__file__).resolve().parents[1] / "templates" / "reports"

_STATUS_STYLE: dict[str, dict[str, str]] = {
    "surplus": {
        "facecolor": "#bbf7d0",
        "edgecolor": "#14532d",
        "hatch": "///",
        "symbol": "[+]",
        "label": "Surplus",
    },
    "balanced": {
        "facecolor": "#fef08a",
        "edgecolor": "#713f12",
        "hatch": "...",
        "symbol": "[=]",
        "label": "Balanced",
    },
    "defisit": {
        "facecolor": "#fecaca",
        "edgecolor": "#7f1d1d",
        "hatch": "xxx",
        "symbol": "[-]",
        "label": "Defisit",
    },
}

_DEFAULT_POLY_STYLE = {
    "facecolor": "#e2e8f0",
    "edgecolor": "#475569",
    "hatch": "",
}


@lru_cache(maxsize=1)
def _load_geojson() -> dict[str, Any]:
    here = Path(__file__).resolve()
    candidates = [parent / "dataset" / "geo" / "provinsi-38.min.geojson" for parent in here.parents]
    candidates.append(Path.cwd() / "dataset" / "geo" / "provinsi-38.min.geojson")
    for path in candidates:
        if path.is_file():
            return json.loads(path.read_text(encoding="utf-8"))
    raise FileNotFoundError("File GeoJSON provinsi-38.min.geojson tidak ditemukan")


def _figure_to_png_bytes(fig: Figure, *, dpi: int = 160) -> bytes:
    FigureCanvasAgg(fig)
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=dpi, bbox_inches="tight", pad_inches=0.08, facecolor="white")
    return buf.getvalue()


def png_to_data_uri(png_bytes: bytes) -> str:
    encoded = base64.b64encode(png_bytes).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def fmt_id(nilai: float | int | None, desimal: int = 2) -> str:
    """Format angka gaya Indonesia (pemisah ribuan titik, desimal koma)."""
    if nilai is None:
        return "-"
    num = float(nilai)
    if desimal <= 0:
        return f"{num:,.0f}".replace(",", ".")
    formatted = f"{num:,.{desimal}f}"
    return formatted.replace(",", "_").replace(".", ",").replace("_", ".")


def fmt_int(nilai: float | int | None) -> str:
    return fmt_id(nilai, 0)


def fmt_tanggal(iso_str: str | None) -> str:
    if not iso_str or iso_str == "-":
        return "-"
    try:
        dt = datetime.fromisoformat(iso_str)
        return dt.strftime("%d-%m-%Y %H:%M UTC")
    except ValueError:
        return str(iso_str)


def status_symbol(status: str | None) -> str:
    return _STATUS_STYLE.get(status or "", {}).get("symbol", "[?]")


def status_label(status: str | None) -> str:
    return _STATUS_STYLE.get(status or "", {}).get("label", str(status or "-"))


def _iter_exterior_rings(geometry: dict[str, Any]) -> list[list[list[float]]]:
    gtype = geometry.get("type")
    coords = geometry.get("coordinates") or []
    if gtype == "Polygon" and coords:
        return [coords[0]]
    if gtype == "MultiPolygon":
        return [poly[0] for poly in coords if poly]
    return []


def render_peta_png(
    map_values: dict[str, str],
    *,
    flows: list[dict[str, Any]] | None = None,
    highlight_kode: str | None = None,
    title: str = "Peta Status Ketahanan Beras (38 Provinsi)",
) -> bytes:
    """Render peta Indonesia dari GeoJSON dengan warna & pola arsiran ramah cetak hitam-putih."""
    geo = _load_geojson()

    fig = Figure(figsize=(8.6, 3.55), dpi=160)
    ax = fig.add_subplot(111)
    ax.set_facecolor("#f8fafc")

    highlight_center: tuple[float, float, str] | None = None

    for feature in geo.get("features", []):
        props = feature.get("properties") or {}
        kode = str(props.get("kode_bps", ""))
        status = map_values.get(kode)
        style = _STATUS_STYLE.get(status or "", _DEFAULT_POLY_STYLE)

        is_highlighted = highlight_kode is not None and kode == highlight_kode
        dimmed = highlight_kode is not None and not is_highlighted

        alpha = 0.28 if dimmed else 0.95
        linewidth = 1.6 if is_highlighted else (0.35 if dimmed else 0.55)
        edgecolor = "#0f172a" if is_highlighted else ("#94a3b8" if dimmed else style["edgecolor"])
        hatch = "" if dimmed else style["hatch"]

        for ring in _iter_exterior_rings(feature.get("geometry") or {}):
            if len(ring) < 3:
                continue
            patch = MplPolygon(
                ring,
                closed=True,
                facecolor=style["facecolor"],
                edgecolor=edgecolor,
                linewidth=linewidth,
                hatch=hatch,
                alpha=alpha,
                zorder=3 if is_highlighted else 2,
            )
            ax.add_patch(patch)

        if is_highlighted and props.get("lng") is not None and props.get("lat") is not None:
            highlight_center = (
                float(props["lng"]),
                float(props["lat"]),
                str(props.get("provinsi", kode)),
            )

    if highlight_center is not None:
        hx, hy, hnama = highlight_center
        ax.scatter([hx], [hy], s=48, color="#0f172a", edgecolor="white", linewidth=1.0, zorder=6)
        ax.annotate(
            hnama,
            xy=(hx, hy),
            xytext=(0, 8),
            textcoords="offset points",
            ha="center",
            fontsize=7.5,
            fontweight="bold",
            color="#0f172a",
            bbox={"boxstyle": "round,pad=0.2", "facecolor": "white", "edgecolor": "#0f172a", "linewidth": 0.7},
            zorder=7,
        )

    if flows:
        max_ton = max((float(item.get("ton", 0)) for item in flows), default=1.0) or 1.0
        for item in flows:
            x1, y1 = float(item["dari_lng"]), float(item["dari_lat"])
            x2, y2 = float(item["ke_lng"]), float(item["ke_lat"])
            ton = float(item.get("ton", 0))
            lw = 0.75 + 1.65 * (ton / max_ton)
            arrow = FancyArrowPatch(
                (x1, y1),
                (x2, y2),
                connectionstyle="arc3,rad=0.14",
                arrowstyle="-|>,head_length=4.5,head_width=2.6",
                linewidth=lw,
                color="#0f172a",
                alpha=0.82,
                zorder=5,
            )
            ax.add_patch(arrow)

        asal_pts = {(float(i["dari_lng"]), float(i["dari_lat"])) for i in flows}
        tujuan_pts = {(float(i["ke_lng"]), float(i["ke_lat"])) for i in flows}
        if asal_pts:
            ax.scatter(
                [p[0] for p in asal_pts],
                [p[1] for p in asal_pts],
                s=20,
                marker="o",
                color="#14532d",
                edgecolor="white",
                linewidth=0.6,
                zorder=6,
            )
        if tujuan_pts:
            ax.scatter(
                [p[0] for p in tujuan_pts],
                [p[1] for p in tujuan_pts],
                s=24,
                marker="^",
                color="#7f1d1d",
                edgecolor="white",
                linewidth=0.6,
                zorder=6,
            )

    ax.set_xlim(94.5, 141.8)
    ax.set_ylim(-11.4, 6.4)
    ax.set_aspect(1.05)
    ax.set_xticks([])
    ax.set_yticks([])
    for spine in ax.spines.values():
        spine.set_edgecolor("#cbd5e1")
        spine.set_linewidth(0.7)

    ax.set_title(title, fontsize=9.5, fontweight="bold", color="#0f172a", pad=6, loc="left")

    legend_handles: list[Any] = [
        Patch(
            facecolor=_STATUS_STYLE[k]["facecolor"],
            edgecolor=_STATUS_STYLE[k]["edgecolor"],
            hatch=_STATUS_STYLE[k]["hatch"],
            linewidth=0.8,
            label=f"{_STATUS_STYLE[k]['symbol']} {_STATUS_STYLE[k]['label']}",
        )
        for k in ("surplus", "balanced", "defisit")
    ]
    if flows:
        legend_handles.append(
            Line2D([0], [0], color="#0f172a", linewidth=1.4, marker=">", markersize=4.5, label="Alur Distribusi")
        )

    ax.legend(
        handles=legend_handles,
        loc="lower left",
        ncol=len(legend_handles),
        fontsize=7.2,
        frameon=True,
        facecolor="white",
        edgecolor="#94a3b8",
        handlelength=1.8,
        handleheight=1.1,
    )

    return _figure_to_png_bytes(fig)


def render_top_surplus_defisit_png(
    top_surplus: list[dict[str, Any]],
    top_defisit: list[dict[str, Any]],
) -> bytes:
    """Render grafik batang horizontal Top-5 Surplus vs Top-5 Defisit (ramah grayscale)."""
    rows = list(reversed(top_defisit[:5])) + list(reversed(top_surplus[:5]))
    if not rows:
        rows = [{"provinsi": "Tidak ada data", "nilai": 0.0}]

    labels = [str(r["provinsi"]) for r in rows]
    values = [float(r["nilai"]) / 1_000.0 for r in rows]  # ribu ton agar ringkas

    fig = Figure(figsize=(8.2, 2.85), dpi=160)
    ax = fig.add_subplot(111)

    y_pos = list(range(len(rows)))
    for idx, val in enumerate(values):
        style = _STATUS_STYLE["surplus"] if val >= 0 else _STATUS_STYLE["defisit"]
        ax.barh(
            idx,
            val,
            height=0.66,
            color=style["facecolor"],
            edgecolor=style["edgecolor"],
            hatch=style["hatch"],
            linewidth=0.8,
            zorder=3,
        )
        offset = 18 if val >= 0 else -18
        ha = "left" if val >= 0 else "right"
        ax.annotate(
            f"{fmt_id(val, 0)} rb t",
            xy=(val, idx),
            xytext=(offset / 6, 0),
            textcoords="offset points",
            va="center",
            ha=ha,
            fontsize=6.8,
            color="#0f172a",
        )

    ax.axvline(0, color="#0f172a", linewidth=0.9, zorder=4)
    ax.grid(axis="x", linestyle="--", linewidth=0.5, color="#cbd5e1", zorder=1)
    ax.set_yticks(y_pos)
    ax.set_yticklabels(labels, fontsize=7.4, color="#0f172a")
    ax.tick_params(axis="x", labelsize=7.0, colors="#334155")
    ax.set_xlabel("Rice Balance (ribu ton)", fontsize=7.5, color="#334155")
    ax.set_title("Top-5 Provinsi Surplus vs Defisit", fontsize=9.2, fontweight="bold", color="#0f172a", loc="left")

    min_v = min(values, default=0.0)
    max_v = max(values, default=0.0)
    span = max(max_v - min_v, 1.0)
    ax.set_xlim(min_v - span * 0.22, max_v + span * 0.22)

    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)

    legend_handles = [
        Patch(
            facecolor=_STATUS_STYLE[k]["facecolor"],
            edgecolor=_STATUS_STYLE[k]["edgecolor"],
            hatch=_STATUS_STYLE[k]["hatch"],
            label=f"{_STATUS_STYLE[k]['symbol']} {_STATUS_STYLE[k]['label']}",
        )
        for k in ("surplus", "defisit")
    ]
    ax.legend(handles=legend_handles, loc="lower right", fontsize=7.0, frameon=True, facecolor="white")

    return _figure_to_png_bytes(fig)


def render_status_distribusi_png(ringkasan_status: dict[str, int]) -> bytes:
    """Render diagram batang distribusi jumlah provinsi per status."""
    keys = ("surplus", "balanced", "defisit")
    labels = [f"{_STATUS_STYLE[k]['symbol']} {_STATUS_STYLE[k]['label']}" for k in keys]
    counts = [int(ringkasan_status.get(k, 0)) for k in keys]

    fig = Figure(figsize=(5.6, 2.0), dpi=160)
    ax = fig.add_subplot(111)

    for idx, (k, count) in enumerate(zip(keys, counts, strict=True)):
        style = _STATUS_STYLE[k]
        ax.barh(
            idx,
            count,
            height=0.58,
            color=style["facecolor"],
            edgecolor=style["edgecolor"],
            hatch=style["hatch"],
            linewidth=0.8,
            zorder=3,
        )
        ax.text(count + 0.4, idx, f"{count} prov.", va="center", ha="left", fontsize=7.5, fontweight="bold")

    ax.invert_yaxis()
    ax.set_yticks(list(range(len(keys))))
    ax.set_yticklabels(labels, fontsize=7.8, color="#0f172a")
    ax.set_xlim(0, max(counts, default=1) + 6)
    ax.grid(axis="x", linestyle="--", linewidth=0.5, color="#cbd5e1", zorder=1)
    ax.tick_params(axis="x", labelsize=7.0, colors="#334155")
    ax.set_title("Distribusi Status 38 Provinsi", fontsize=9.0, fontweight="bold", color="#0f172a", loc="left")
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)

    return _figure_to_png_bytes(fig)


@lru_cache(maxsize=1)
def _jinja_env() -> Environment:
    env = Environment(
        loader=FileSystemLoader(str(_TEMPLATE_DIR)),
        autoescape=select_autoescape(["html", "xml"]),
    )
    env.filters["fmt_id"] = fmt_id
    env.filters["fmt_int"] = fmt_int
    env.filters["fmt_tanggal"] = fmt_tanggal
    env.filters["status_symbol"] = status_symbol
    env.filters["status_label"] = status_label
    return env


def _build_chart_uris(data: dict[str, Any]) -> dict[str, str]:
    jenis = data["jenis"]
    charts: dict[str, str] = {}

    if jenis == "nasional":
        charts["peta"] = png_to_data_uri(
            render_peta_png(
                data["map_values"],
                title=f"Peta Surplus–Defisit Nasional ({data['tahun']})",
            )
        )
        charts["top_bar"] = png_to_data_uri(
            render_top_surplus_defisit_png(data["top_surplus"], data["top_defisit"])
        )
    elif jenis == "provinsi":
        prov = data["provinsi"]
        charts["peta"] = png_to_data_uri(
            render_peta_png(
                data["map_values"],
                highlight_kode=data.get("highlight_kode"),
                title=f"Lokasi & Status Wilayah: {prov['provinsi']} ({data['tahun']})",
            )
        )
    elif jenis == "surplus-defisit":
        charts["peta"] = png_to_data_uri(
            render_peta_png(
                data["map_values"],
                title=f"Peta Klasifikasi Status 38 Provinsi ({data['tahun']})",
            )
        )
        charts["status_bar"] = png_to_data_uri(
            render_status_distribusi_png(data["ringkasan"]["jumlah_status"])
        )
    elif jenis == "rekomendasi":
        charts["peta"] = png_to_data_uri(
            render_peta_png(
                data["map_values"],
                flows=data["items"],
                title=f"Peta Alur Rekomendasi Distribusi Beras ({data['tahun']})",
            )
        )

    return charts


def render_report_html(data: dict[str, Any]) -> str:
    """Render struktur data laporan (T9.2) menjadi HTML A4 siap-cetak WeasyPrint."""
    charts = _build_chart_uris(data)
    template = _jinja_env().get_template("laporan.html")
    return template.render(data=data, charts=charts)


def render_pdf_bytes(html: str) -> bytes:
    """Konversi HTML ke PDF bytes via lazy-imported WeasyPrint."""
    try:
        import weasyprint

        return weasyprint.HTML(string=html).write_pdf()
    except OSError as exc:
        raise AppError(
            "PDF_UNAVAILABLE",
            503,
            "Generator PDF membutuhkan library sistem Pango/GObject",
            {"alasan": str(exc)},
        ) from exc
