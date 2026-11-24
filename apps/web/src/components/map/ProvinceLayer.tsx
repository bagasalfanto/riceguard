import { useEffect, useMemo, useRef } from "react"
import L, { type Layer, type PathOptions } from "leaflet"
import { GeoJSON, Marker } from "react-leaflet"
import type { Feature, Geometry } from "geojson"

import {
  resolveFillColor,
  type MapLayerResponse,
  type ProvinceGeoJSON,
  type ProvinceGeoProperties,
  type ProvinceRecord,
} from "@/features/map/mapData"
import { formatPersen, formatTon } from "@/lib/format"
import { tampilanStatus } from "@/lib/status"

type ProvinceFeature = Feature<Geometry, ProvinceGeoProperties>

function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function formatCompactTon(nilai: number, signed = false): string {
  const abs = Math.abs(nilai)
  const prefix = signed && nilai > 0 ? "+" : nilai < 0 ? "−" : ""
  if (abs >= 1_000_000) {
    return `${prefix}${(abs / 1_000_000).toFixed(2).replace(".", ",")} jt`
  }
  if (abs >= 1_000) {
    return `${prefix}${Math.round(abs / 1_000).toLocaleString("id-ID")} rb`
  }
  return `${prefix}${Math.round(abs).toLocaleString("id-ID")}`
}

function buildTooltipHtml(
  feature: ProvinceFeature,
  provincesByCode: Map<string, ProvinceRecord>,
  layerData: MapLayerResponse | undefined,
): string {
  const props = feature.properties
  const record = provincesByCode.get(props.kode_bps)
  const nama = escapeHtml(record?.provinsi ?? props.provinsi)

  if (!record) return `<strong>${nama}</strong>`

  const statusInfo = tampilanStatus(record.status)

  if (!layerData || layerData.layer === "status") {
    const sign = record.rice_balance_ton > 0 ? "+" : ""
    return `<div class="space-y-0.5">
      <div class="font-semibold">${nama}</div>
      <div class="text-xs opacity-90">${escapeHtml(statusInfo.label)} &middot; ${sign}${escapeHtml(formatTon(record.rice_balance_ton))}</div>
    </div>`
  }

  if (layerData.layer === "produksi") {
    return `<div class="space-y-0.5">
      <div class="font-semibold">${nama}</div>
      <div class="text-xs opacity-90">Produksi: ${escapeHtml(formatTon(record.produksi_beras_ton))}</div>
    </div>`
  }

  return `<div class="space-y-0.5">
    <div class="font-semibold">${nama}</div>
    <div class="text-xs opacity-90">Kebutuhan: ${escapeHtml(formatTon(record.kebutuhan_beras_ton))}</div>
  </div>`
}

function buildPopupHtml(
  feature: ProvinceFeature,
  provincesByCode: Map<string, ProvinceRecord>,
): string {
  const props = feature.properties
  const record = provincesByCode.get(props.kode_bps)
  const nama = escapeHtml(record?.provinsi ?? props.provinsi)

  if (!record) {
    return `<div class="text-xs"><strong>${nama}</strong><div>Data tidak tersedia</div></div>`
  }

  const statusInfo = tampilanStatus(record.status)
  const sign = record.rice_balance_ton > 0 ? "+" : ""

  return `<div class="min-w-[205px] space-y-1.5 text-xs">
    <div class="flex items-center justify-between gap-2 border-b pb-1">
      <strong class="text-sm font-semibold">${nama}</strong>
      <span class="rounded-full border px-2 py-0.5 text-[11px] font-medium">${escapeHtml(statusInfo.label)}</span>
    </div>
    <div class="space-y-1">
      <div class="flex justify-between gap-4">
        <span class="opacity-75">Produksi</span>
        <span class="font-medium tabular-nums">${escapeHtml(formatTon(record.produksi_beras_ton))}</span>
      </div>
      <div class="flex justify-between gap-4">
        <span class="opacity-75">Kebutuhan</span>
        <span class="font-medium tabular-nums">${escapeHtml(formatTon(record.kebutuhan_beras_ton))}</span>
      </div>
      <div class="flex justify-between gap-4">
        <span class="opacity-75">Balance</span>
        <span class="font-semibold tabular-nums">${sign}${escapeHtml(formatTon(record.rice_balance_ton))}</span>
      </div>
      <div class="flex justify-between gap-4">
        <span class="opacity-75">Rasio</span>
        <span class="font-medium tabular-nums">${escapeHtml(formatPersen(record.rasio_swasembada * 100, 1))}</span>
      </div>
    </div>
  </div>`
}

export interface ProvinceLayerProps {
  geoData: ProvinceGeoJSON
  layerData?: MapLayerResponse
  provincesByCode: Map<string, ProvinceRecord>
  matchingCodes: Set<string>
  selectedCode: string | null
  showCentroidLabels?: boolean
  onSelectProvince: (kodeBps: string) => void
}

export function ProvinceLayer({
  geoData,
  layerData,
  provincesByCode,
  matchingCodes,
  selectedCode,
  showCentroidLabels = false,
  onSelectProvince,
}: ProvinceLayerProps) {
  const geoJsonRef = useRef<L.GeoJSON | null>(null)

  const latestRef = useRef({
    layerData,
    provincesByCode,
    matchingCodes,
    selectedCode,
    onSelectProvince,
  })
  latestRef.current = {
    layerData,
    provincesByCode,
    matchingCodes,
    selectedCode,
    onSelectProvince,
  }

  const computeStyle = (feature: ProvinceFeature | undefined): PathOptions => {
    if (!feature) return {}
    const { layerData: curLayer, matchingCodes: curMatch, selectedCode: curSelected } = latestRef.current
    const kode = feature.properties.kode_bps
    const isMatch = curMatch.has(kode)
    const isSelected = curSelected === kode

    return {
      fillColor: resolveFillColor(curLayer, kode),
      fillOpacity: !isMatch ? 0.14 : isSelected ? 0.92 : 0.78,
      weight: isSelected ? 2.8 : isMatch ? 1.2 : 0.8,
      opacity: isMatch ? 0.95 : 0.35,
      color: isSelected ? "var(--ring)" : "var(--border)",
    }
  }

  // Perbarui style, tooltip, dan popup langsung di layer Leaflet tanpa fetch ulang GeoJSON
  useEffect(() => {
    const group = geoJsonRef.current
    if (!group) return

    group.eachLayer((subLayer) => {
      const pathLayer = subLayer as L.Path & { feature?: ProvinceFeature }
      const feature = pathLayer.feature
      if (!feature) return

      pathLayer.setStyle(computeStyle(feature))
      pathLayer.setTooltipContent(buildTooltipHtml(feature, provincesByCode, layerData))
      pathLayer.setPopupContent(buildPopupHtml(feature, provincesByCode))

      if (feature.properties.kode_bps === selectedCode) {
        pathLayer.bringToFront()
      }
    })
  }, [layerData, provincesByCode, matchingCodes, selectedCode])

  const handleEachFeature = (feature: ProvinceFeature, layer: Layer) => {
    const pathLayer = layer as L.Path

    pathLayer.bindTooltip(buildTooltipHtml(feature, provincesByCode, layerData), {
      sticky: true,
      direction: "top",
      opacity: 0.98,
    })
    pathLayer.bindPopup(buildPopupHtml(feature, provincesByCode), {
      maxWidth: 280,
    })

    pathLayer.on({
      mouseover: () => {
        const { matchingCodes: curMatch } = latestRef.current
        const isMatch = curMatch.has(feature.properties.kode_bps)
        pathLayer.setStyle({
          weight: 2.5,
          color: "var(--foreground)",
          fillOpacity: isMatch ? 0.92 : 0.35,
        })
        pathLayer.bringToFront()
      },
      mouseout: () => {
        pathLayer.setStyle(computeStyle(feature))
      },
      click: () => {
        latestRef.current.onSelectProvince(feature.properties.kode_bps)
      },
    })
  }

  const centroidMarkers = useMemo(() => {
    if (!showCentroidLabels) return []

    const markers: Array<{ kode: string; lat: number; lng: number; text: string }> = []
    for (const kode of matchingCodes) {
      const rec = provincesByCode.get(kode)
      if (!rec) continue

      let text = ""
      if (!layerData || layerData.layer === "status") {
        text = formatCompactTon(rec.rice_balance_ton, true)
      } else if (layerData.layer === "produksi") {
        text = formatCompactTon(rec.produksi_beras_ton, false)
      } else if (layerData.layer === "kebutuhan") {
        text = formatCompactTon(rec.kebutuhan_beras_ton, false)
      }

      if (text) {
        markers.push({ kode, lat: rec.lat, lng: rec.lng, text })
      }
    }
    return markers
  }, [showCentroidLabels, matchingCodes, provincesByCode, layerData])

  return (
    <>
      <GeoJSON
        data={geoData}
        onEachFeature={handleEachFeature}
        ref={geoJsonRef}
        style={computeStyle}
      />

      {centroidMarkers.map((item) => (
        <Marker
          icon={L.divIcon({
            className: "riceguard-centroid-label",
            html: escapeHtml(item.text),
            iconSize: undefined,
          })}
          interactive={false}
          key={`centroid-${item.kode}`}
          position={[item.lat, item.lng]}
        />
      ))}
    </>
  )
}
