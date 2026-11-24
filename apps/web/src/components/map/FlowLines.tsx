import L from "leaflet"
import { CircleMarker, Marker, Polyline, Tooltip } from "react-leaflet"

import type { DistributionFlow, ProvinceRecord } from "@/features/map/mapData"
import { formatKm, formatTon } from "@/lib/format"

function computeBearingDeg(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const dy = toLat - fromLat
  const dx = (toLng - fromLng) * Math.cos(((fromLat + toLat) / 2) * (Math.PI / 180))
  return (Math.atan2(dx, dy) * 180) / Math.PI
}

export interface FlowLinesProps {
  flows: DistributionFlow[]
  provincesByCode: Map<string, ProvinceRecord>
  selectedIndex?: number | null
  onSelectFlow?: (flow: DistributionFlow, index: number) => void
}

/**
 * Komponen garis alur distribusi dari titik pusat surplus ke defisit (dipakai Wave 5 `/distribusi`).
 */
export function FlowLines({
  flows,
  provincesByCode,
  selectedIndex = null,
  onSelectFlow,
}: FlowLinesProps) {
  const maxTon = flows.reduce((acc, item) => Math.max(acc, item.ton), 0)

  return (
    <>
      {flows.map((flow, idx) => {
        const origin = provincesByCode.get(flow.dari_kode)
        const dest = provincesByCode.get(flow.ke_kode)
        if (!origin || !dest) return null

        const ratio = maxTon > 0 ? Math.sqrt(flow.ton) / Math.sqrt(maxTon) : 0.3
        const weight = Math.max(2, Math.min(10, Math.round((2 + ratio * 8) * 10) / 10))
        const isSelected = selectedIndex === idx

        const midLat = (origin.lat + dest.lat) / 2
        const midLng = (origin.lng + dest.lng) / 2
        const angle = computeBearingDeg(origin.lat, origin.lng, dest.lat, dest.lng)

        const arrowIcon = L.divIcon({
          className: "riceguard-flow-arrow",
          iconSize: [14, 14],
          iconAnchor: [7, 7],
          html: `<svg width="14" height="14" viewBox="0 0 14 14" style="transform: rotate(${angle.toFixed(1)}deg);">
            <path d="M7 1 L12 11 L7 8.5 L2 11 Z" fill="var(--primary)" stroke="var(--background)" stroke-width="1"/>
          </svg>`,
        })

        return (
          <Polyline
            eventHandlers={
              onSelectFlow
                ? {
                    click: () => onSelectFlow(flow, idx),
                  }
                : undefined
            }
            key={`${flow.dari_kode}-${flow.ke_kode}-${flow.urutan}`}
            pathOptions={{
              color: isSelected ? "var(--ring)" : "var(--primary)",
              weight: isSelected ? weight + 2 : weight,
              opacity: isSelected ? 0.95 : 0.72,
            }}
            positions={[
              [origin.lat, origin.lng],
              [dest.lat, dest.lng],
            ]}
          >
            <Tooltip direction="top" sticky>
              <div className="space-y-0.5 text-xs">
                <div className="font-semibold">
                  {flow.dari} &rarr; {flow.ke}
                </div>
                <div>
                  Alokasi: {formatTon(flow.ton)} &middot; Jarak garis lurus {formatKm(flow.jarak_km)}
                </div>
              </div>
            </Tooltip>
            <Marker icon={arrowIcon} interactive={false} position={[midLat, midLng]} />
            <CircleMarker
              center={[dest.lat, dest.lng]}
              interactive={false}
              pathOptions={{
                color: "var(--status-defisit)",
                fillColor: "var(--status-defisit)",
                fillOpacity: 0.85,
                weight: 1,
              }}
              radius={3.5}
            />
          </Polyline>
        )
      })}
    </>
  )
}
