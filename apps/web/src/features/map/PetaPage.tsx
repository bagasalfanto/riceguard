import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, Layers, RotateCcw, Tag } from "lucide-react"
import { useSearchParams } from "react-router-dom"

import { LimitationBanner } from "@/components/layout/LimitationBanner"
import {
  BaseMap,
  MapLegend,
  ProvinceLayer,
  ProvinceSearch,
  type MapFocusTarget,
} from "@/components/map"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  useMapLayer,
  useMapProvinces,
  useProvincesGeoJSON,
  type BasemapId,
  type MapLayerId,
  type ProvinceRecord,
} from "@/features/map/mapData"
import { ProvinceDetailPanel } from "@/features/map/ProvinceDetailPanel"
import { useTahun } from "@/hooks/useTahun"
import { SEMUA_STATUS, tampilanStatus, type StatusProvinsi } from "@/lib/status"
import { cn } from "@/lib/utils"

const LAYER_OPTIONS: Array<{ id: Exclude<MapLayerId, "kepadatan">; label: string }> = [
  { id: "status", label: "Surplus & Defisit" },
  { id: "produksi", label: "Produksi Beras" },
  { id: "kebutuhan", label: "Kebutuhan Beras" },
]

function parseLayerParam(raw: string | null): MapLayerId {
  if (raw === "produksi" || raw === "kebutuhan") return raw
  return "status"
}

function parseStatusParam(raw: string | null): StatusProvinsi | "" {
  if (raw === "surplus" || raw === "balanced" || raw === "defisit") return raw
  return ""
}

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true,
  )

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  return isDesktop
}

export function PetaPage() {
  const { tahun } = useTahun()
  const activeYear = tahun ?? 2025
  const [searchParams, setSearchParams] = useSearchParams()
  const isDesktop = useIsDesktop()

  const activeLayer = parseLayerParam(searchParams.get("layer"))
  const selectedCode = searchParams.get("prov")
  const statusFilter = parseStatusParam(searchParams.get("status"))
  const pulauFilter = searchParams.get("pulau") ?? ""

  const [basemap, setBasemap] = useState<BasemapId>("satellite")
  const [showCentroidLabels, setShowCentroidLabels] = useState(false)
  const [focusTarget, setFocusTarget] = useState<MapFocusTarget | null>(null)

  const geoQuery = useProvincesGeoJSON()
  const provincesQuery = useMapProvinces(activeYear)
  const layerQuery = useMapLayer(activeLayer, activeYear, provincesQuery.data)

  const provinces = provincesQuery.data ?? []
  const { byCode, pulauList } = provincesQuery

  const updateParam = useCallback(
    (updates: Record<string, string | null>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(updates)) {
            if (!v) next.delete(k)
            else next.set(k, v)
          }
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const handleSelectProvince = useCallback(
    (kodeBps: string | null, shouldFocus = false) => {
      updateParam({ prov: kodeBps })
      if (kodeBps && shouldFocus) {
        const rec = byCode.get(kodeBps)
        if (rec) {
          setFocusTarget({ lat: rec.lat, lng: rec.lng, zoom: 6.5, nonce: Date.now() })
        }
      }
    },
    [byCode, updateParam],
  )

  const handleSearchSelect = useCallback(
    (province: ProvinceRecord) => {
      handleSelectProvince(province.kode_bps, true)
    },
    [handleSelectProvince],
  )

  const matchingCodes = useMemo(() => {
    const set = new Set<string>()
    for (const p of provinces) {
      if (statusFilter && p.status !== statusFilter) continue
      if (pulauFilter && p.pulau !== pulauFilter) continue
      set.add(p.kode_bps)
    }
    return set
  }, [provinces, statusFilter, pulauFilter])

  const summaryCounts = useMemo(() => {
    const counts = { surplus: 0, balanced: 0, defisit: 0 }
    for (const p of provinces) {
      counts[p.status] += 1
    }
    return counts
  }, [provinces])

  const selectedProvince = selectedCode ? byCode.get(selectedCode) ?? null : null
  const hasFilter = Boolean(statusFilter || pulauFilter)
  const isLoading = geoQuery.isLoading || provincesQuery.isLoading
  const error = geoQuery.error || provincesQuery.error || layerQuery.error

  return (
    <>
      <LimitationBanner />

      <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Interactive Rice Map</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Peta sebaran surplus, seimbang, dan defisit beras {provinces.length || 38} provinsi
              tahun {activeYear}.
            </p>
          </div>
          <Badge className="w-fit text-xs tabular-nums" variant="secondary">
            {matchingCodes.size} / {provinces.length || 38} provinsi ditampilkan
          </Badge>
        </div>

        {/* Bilah Kontrol Layer, Pencarian, dan Filter */}
        <Card>
          <CardContent className="flex flex-col gap-3 p-3.5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              {/* Radio 4 Layer (Kepadatan disabled dengan tooltip alasan) */}
              <div
                aria-label="Pilih layer peta"
                className="flex flex-wrap items-center gap-1.5"
                role="radiogroup"
              >
                <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Layers aria-hidden="true" className="size-3.5 text-primary" />
                  Layer:
                </span>

                {LAYER_OPTIONS.map((opt) => {
                  const active = activeLayer === opt.id
                  return (
                    <Button
                      aria-checked={active}
                      key={opt.id}
                      onClick={() =>
                        updateParam({ layer: opt.id === "status" ? null : opt.id })
                      }
                      role="radio"
                      size="sm"
                      type="button"
                      variant={active ? "default" : "outline"}
                    >
                      {opt.label}
                    </Button>
                  )
                })}

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex" tabIndex={0}>
                        <Button
                          aria-checked={false}
                          aria-disabled="true"
                          className="pointer-events-none"
                          disabled
                          role="radio"
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Kepadatan Penduduk
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Data luas wilayah (km&sup2;) belum tersedia di dataset
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <ProvinceSearch
                className="w-full lg:w-72"
                onSelect={handleSearchSelect}
                provinces={provinces}
                selectedCode={selectedCode}
              />
            </div>

            {/* Filter Status, Pulau, Basemap, dan Toggle Centroid */}
            <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-xs">
              <label className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Status:</span>
                <select
                  aria-label="Filter status provinsi"
                  className="h-8 rounded-md border bg-background px-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  onChange={(e) => updateParam({ status: e.target.value || null })}
                  value={statusFilter}
                >
                  <option value="">Semua status</option>
                  {SEMUA_STATUS.map((st) => (
                    <option key={st} value={st}>
                      {tampilanStatus(st).label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Pulau:</span>
                <select
                  aria-label="Filter pulau"
                  className="h-8 rounded-md border bg-background px-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  onChange={(e) => updateParam({ pulau: e.target.value || null })}
                  value={pulauFilter}
                >
                  <option value="">Semua pulau</option>
                  {pulauList.map((pulau) => (
                    <option key={pulau} value={pulau}>
                      {pulau}
                    </option>
                  ))}
                </select>
              </label>

              {hasFilter ? (
                <Button
                  className="h-8 gap-1 text-xs"
                  onClick={() => updateParam({ status: null, pulau: null })}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <RotateCcw aria-hidden="true" className="size-3" />
                  Reset filter
                </Button>
              ) : null}

              <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                <label className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Basemap:</span>
                  <select
                    aria-label="Pilih gaya basemap"
                    className="h-8 rounded-md border bg-background px-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    onChange={(e) => setBasemap(e.target.value as BasemapId)}
                    value={basemap}
                  >
                    <option value="satellite">Esri Satelit</option>
                    <option value="auto">Otomatis (Ikut Tema)</option>
                    <option value="esri-light">Esri Light Gray</option>
                    <option value="esri-dark">Esri Dark Gray</option>
                    <option value="osm">OpenStreetMap</option>
                    <option value="minimal">Canvas Polos</option>
                  </select>
                </label>

                <button
                  aria-checked={showCentroidLabels}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
                    showCentroidLabels
                      ? "border-primary bg-primary/10 text-primary"
                      : "bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                  onClick={() => setShowCentroidLabels((v) => !v)}
                  role="switch"
                  type="button"
                >
                  <Tag aria-hidden="true" className="size-3.5" />
                  Label nilai
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Konten Utama: Peta + Panel Samping */}
        {error ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Gagal memuat data peta</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              <span>{error instanceof Error ? error.message : "Terjadi kesalahan saat memuat peta."}</span>
              <Button
                onClick={() => {
                  void geoQuery.refetch()
                  void provincesQuery.refetch()
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                Coba lagi
              </Button>
            </AlertDescription>
          </Alert>
        ) : isLoading || !geoQuery.data ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
            <Skeleton className="h-[520px] w-full rounded-xl" />
            <Skeleton className="hidden h-[520px] w-full rounded-xl lg:block" />
          </div>
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
            <div className="min-w-0 flex-1">
              <BaseMap
                basemap={basemap}
                className="h-[480px] w-full lg:h-[600px]"
                focusTarget={focusTarget}
                onResetView={() => setFocusTarget(null)}
                overlay={<MapLegend layerData={layerQuery.data} />}
              >
                <ProvinceLayer
                  geoData={geoQuery.data}
                  layerData={layerQuery.data}
                  matchingCodes={matchingCodes}
                  onSelectProvince={(kode) => handleSelectProvince(kode, true)}
                  provincesByCode={byCode}
                  selectedCode={selectedCode}
                  showCentroidLabels={showCentroidLabels}
                />
              </BaseMap>
            </div>

            {/* Panel Samping Kanan (Desktop) */}
            <aside className="hidden w-96 shrink-0 lg:block">
              <ProvinceDetailPanel
                onClose={selectedProvince ? () => handleSelectProvince(null) : undefined}
                province={selectedProvince}
                summaryCounts={summaryCounts}
                tahun={tahun}
                totalProvinces={provinces.length}
              />
            </aside>
          </div>
        )}
      </div>

      {/* Drawer Bawah (Mobile < 1024px) */}
      <Sheet
        onOpenChange={(open) => {
          if (!open) handleSelectProvince(null)
        }}
        open={!isDesktop && Boolean(selectedProvince)}
      >
        <SheetContent className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-0" side="bottom">
          <SheetHeader className="sr-only">
            <SheetTitle>{selectedProvince?.provinsi ?? "Detail Provinsi"}</SheetTitle>
            <SheetDescription>Ringkasan neraca beras provinsi terpilih</SheetDescription>
          </SheetHeader>
          <ProvinceDetailPanel
            inDrawer
            onClose={() => handleSelectProvince(null)}
            province={selectedProvince}
            summaryCounts={summaryCounts}
            tahun={tahun}
            totalProvinces={provinces.length}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}
