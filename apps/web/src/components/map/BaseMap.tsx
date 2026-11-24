import { useEffect, type ReactNode } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { RotateCcw } from "lucide-react"
import { MapContainer, TileLayer, ZoomControl, useMap } from "react-leaflet"

import { Button } from "@/components/ui/button"
import { useTema } from "@/hooks/useTema"
import type { BasemapId } from "@/features/map/mapData"

const INDONESIA_CENTER: L.LatLngExpression = [-2.5, 118]
const INDONESIA_ZOOM = 5
const INDONESIA_BOUNDS: L.LatLngBoundsExpression = [
  [-13, 92],
  [10, 144],
]

type TileSpec = {
  url: string
  attribution: string
  maxZoom: number
}

const TILE_SPECS: Record<Exclude<BasemapId, "auto" | "minimal">, TileSpec> = {
  positron: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
  },
  osm: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri, Maxar, Earthstar Geographics",
    maxZoom: 18,
  },
}

export interface MapFocusTarget {
  lat: number
  lng: number
  zoom?: number
  nonce: number
}

function MapAutoResize() {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ animate: false })
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [map])

  return null
}

function MapFlyController({ focusTarget }: { focusTarget: MapFocusTarget | null }) {
  const map = useMap()

  useEffect(() => {
    if (!focusTarget) return
    map.flyTo([focusTarget.lat, focusTarget.lng], focusTarget.zoom ?? 6.5, {
      duration: 0.85,
    })
  }, [map, focusTarget])

  return null
}

function ResetViewControl({ onReset }: { onReset?: () => void }) {
  const map = useMap()

  return (
    <div className="pointer-events-auto absolute top-3 right-3 z-[450]">
      <Button
        aria-label="Reset tampilan peta ke seluruh Indonesia"
        className="h-8 gap-1.5 bg-card/95 px-2.5 text-xs shadow-sm backdrop-blur"
        onClick={() => {
          map.setView(INDONESIA_CENTER, INDONESIA_ZOOM, { animate: true })
          onReset?.()
        }}
        size="sm"
        type="button"
        variant="outline"
      >
        <RotateCcw aria-hidden="true" className="size-3.5" />
        <span className="hidden sm:inline">Seluruh Indonesia</span>
      </Button>
    </div>
  )
}

export interface BaseMapProps {
  basemap?: BasemapId
  focusTarget?: MapFocusTarget | null
  ariaLabel?: string
  className?: string
  overlay?: ReactNode
  onResetView?: () => void
  children?: ReactNode
}

export function BaseMap({
  basemap = "auto",
  focusTarget = null,
  ariaLabel = "Peta interaktif keseimbangan beras 38 provinsi Indonesia",
  className = "h-[520px] w-full",
  overlay,
  onResetView,
  children,
}: BaseMapProps) {
  const { tema } = useTema()

  const resolvedBasemap: Exclude<BasemapId, "auto"> =
    basemap === "auto" ? (tema === "gelap" ? "dark" : "positron") : basemap

  const tileSpec = resolvedBasemap === "minimal" ? null : TILE_SPECS[resolvedBasemap]

  return (
    <div
      aria-label={ariaLabel}
      className={`relative isolate z-0 overflow-hidden rounded-xl border bg-muted/40 ${className}`}
      role="region"
    >
      <MapContainer
        attributionControl
        center={INDONESIA_CENTER}
        className="h-full w-full"
        maxBounds={INDONESIA_BOUNDS}
        maxBoundsViscosity={0.85}
        maxZoom={10}
        minZoom={4}
        zoom={INDONESIA_ZOOM}
        zoomControl={false}
      >
        {tileSpec ? (
          <TileLayer
            attribution={tileSpec.attribution}
            key={resolvedBasemap}
            maxZoom={tileSpec.maxZoom}
            url={tileSpec.url}
          />
        ) : null}

        <ZoomControl position="bottomright" />
        <MapAutoResize />
        <MapFlyController focusTarget={focusTarget} />
        <ResetViewControl onReset={onResetView} />
        {children}
      </MapContainer>

      {overlay}
    </div>
  )
}
