import { useMemo, useState } from "react"
import {
  AlertCircle,
  ArrowRight,
  ChevronRight,
  Compass,
  ExternalLink,
  Layers,
  Ruler,
} from "lucide-react"
import { Link } from "react-router-dom"

import {
  BaseMap,
  FlowLines,
  MapLegend,
  ProvinceLayer,
  type MapFocusTarget,
} from "@/components/map"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  buildLayerFromProvinces,
  type ProvinceGeoJSON,
  type ProvinceRecord,
} from "@/features/map/mapData"
import type {
  RecommendationItem,
  RecommendationSummary,
} from "@/features/recommendations/recommendationsData"
import { formatAngka, formatKm, formatPersen, formatTon } from "@/lib/format"
import { cn } from "@/lib/utils"

function KpiCard({
  label,
  value,
  hint,
  accentClass,
}: {
  label: string
  value: string
  hint: string
  accentClass?: string
}) {
  return (
    <Card className="gap-1.5 py-4">
      <CardHeader className="px-4">
        <CardDescription className="text-xs">{label}</CardDescription>
        <CardTitle className={cn("text-xl tabular-nums", accentClass)}>{value}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 text-xs text-muted-foreground tabular-nums">{hint}</CardContent>
    </Card>
  )
}

export interface AllocationExplorerProps {
  items: RecommendationItem[]
  summary: RecommendationSummary
  tahun: number
  tahunParam?: number
  geoData?: ProvinceGeoJSON
  provinces: ProvinceRecord[]
  provincesByCode: Map<string, ProvinceRecord>
  matchingCodes?: Set<string>
  mapLoading: boolean
  mapError?: unknown
  onRetryMap: () => void
  mapTitle: string
  mapDescription: string
  tableTitle: string
  tableDescription: string
  emptyMessage: string
  emptyAction?: React.ReactNode
}

export function AllocationExplorer({
  items,
  summary,
  tahun,
  tahunParam,
  geoData,
  provinces,
  provincesByCode,
  matchingCodes,
  mapLoading,
  mapError,
  onRetryMap,
  mapTitle,
  mapDescription,
  tableTitle,
  tableDescription,
  emptyMessage,
  emptyAction,
}: AllocationExplorerProps) {
  const [selectedUrutan, setSelectedUrutan] = useState<number | null>(null)
  const [selectedProvinceCode, setSelectedProvinceCode] = useState<string | null>(null)
  const [focusTarget, setFocusTarget] = useState<MapFocusTarget | null>(null)

  const tahunSuffix = tahunParam ? `?tahun=${tahunParam}` : ""

  const statusLayerData = useMemo(
    () => buildLayerFromProvinces(provinces, "status", tahun),
    [provinces, tahun],
  )

  const effectiveMatchingCodes = useMemo(() => {
    if (matchingCodes) return matchingCodes
    const all = new Set<string>()
    for (const p of provinces) all.add(p.kode_bps)
    return all
  }, [matchingCodes, provinces])

  const islandCounts = useMemo(() => {
    let satu = 0
    let lintas = 0
    for (const item of items) {
      if (item.satu_pulau) satu += 1
      else lintas += 1
    }
    return { satu, lintas }
  }, [items])

  const selectedIndex = useMemo(() => {
    if (selectedUrutan === null) return null
    const idx = items.findIndex((item) => item.urutan === selectedUrutan)
    return idx >= 0 ? idx : null
  }, [items, selectedUrutan])

  const selectedItem = selectedIndex !== null ? items[selectedIndex] : null
  const senderProvince = selectedItem ? provincesByCode.get(selectedItem.dari_kode) : undefined
  const receiverProvince = selectedItem ? provincesByCode.get(selectedItem.ke_kode) : undefined

  const handleSelectAllocation = (item: RecommendationItem) => {
    setSelectedUrutan(item.urutan)
    setSelectedProvinceCode(item.ke_kode)

    const origin = provincesByCode.get(item.dari_kode)
    const dest = provincesByCode.get(item.ke_kode)
    if (origin && dest) {
      setFocusTarget({
        lat: (origin.lat + dest.lat) / 2,
        lng: (origin.lng + dest.lng) / 2,
        zoom: 5.5,
        nonce: Date.now(),
      })
    }
  }

  const coveredPct = summary.persen_defisit_tertutup
  const weightedDistance = summary.rata_jarak_tertimbang_ton

  return (
    <div className="space-y-6">
      <section
        aria-label="Ringkasan KPI rekomendasi distribusi"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <KpiCard
          accentClass="text-status-surplus"
          hint={`Total ton·km: ${formatAngka(summary.total_ton_km)} ton·km`}
          label="Total Dialokasikan"
          value={formatTon(summary.total_dialokasikan_ton)}
        />
        <KpiCard
          accentClass={
            coveredPct !== null && coveredPct !== undefined && coveredPct >= 100
              ? "text-status-surplus"
              : "text-status-balanced"
          }
          hint="Porsi kebutuhan defisit penerima yang terpenuhi"
          label="Defisit Tertutup"
          value={coveredPct !== null && coveredPct !== undefined ? formatPersen(coveredPct, 1) : "—"}
        />
        <KpiCard
          hint={`${islandCounts.satu} satu pulau · ${islandCounts.lintas} lintas pulau`}
          label="Jumlah Pasangan"
          value={`${formatAngka(summary.jumlah_pasangan)} alur`}
        />
        <KpiCard
          hint="Jarak garis lurus antar centroid tertimbang ton"
          label="Rata-rata Jarak Tertimbang"
          value={
            weightedDistance !== null && weightedDistance !== undefined
              ? formatKm(weightedDistance, 1)
              : "—"
          }
        />
      </section>

      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers aria-hidden="true" className="size-4 text-primary" />
                {mapTitle}
              </CardTitle>
              <CardDescription className="mt-1">{mapDescription}</CardDescription>
            </div>
            <Badge className="shrink-0 text-xs tabular-nums" variant="secondary">
              {items.length} alur alokasi
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-2.5 px-4">
          {mapError ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Gagal memuat peta alur alokasi</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {mapError instanceof Error
                    ? mapError.message
                    : "Terjadi kesalahan saat memuat lapisan peta provinsi."}
                </span>
                <Button onClick={onRetryMap} size="sm" type="button" variant="outline">
                  Coba lagi
                </Button>
              </AlertDescription>
            </Alert>
          ) : mapLoading || !geoData ? (
            <Skeleton className="h-[440px] w-full rounded-xl" />
          ) : (
            <>
              <BaseMap
                ariaLabel={mapTitle}
                basemap="satellite"
                className="h-[420px] w-full lg:h-[460px]"
                focusTarget={focusTarget}
                onResetView={() => {
                  setFocusTarget(null)
                  setSelectedProvinceCode(null)
                }}
                overlay={<MapLegend layerData={statusLayerData} />}
              >
                <ProvinceLayer
                  geoData={geoData}
                  layerData={statusLayerData}
                  matchingCodes={effectiveMatchingCodes}
                  onSelectProvince={(kode) => setSelectedProvinceCode(kode)}
                  provincesByCode={provincesByCode}
                  selectedCode={selectedItem?.ke_kode ?? selectedProvinceCode}
                />
                {items.length > 0 ? (
                  <FlowLines
                    flows={items}
                    onSelectFlow={(flow) => {
                      const matched = items.find((it) => it.urutan === flow.urutan)
                      if (matched) handleSelectAllocation(matched)
                    }}
                    provincesByCode={provincesByCode}
                    selectedIndex={selectedIndex}
                  />
                ) : null}
              </BaseMap>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  Klik baris tabel atau garis di peta untuk membuka penjelasan lengkap alokasi.
                </span>
                <span className="tabular-nums">
                  Jarak dihitung dengan garis lurus antar centroid provinsi.
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="gap-3 overflow-hidden py-4">
        <CardHeader className="px-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">{tableTitle}</CardTitle>
              <CardDescription className="mt-1">{tableDescription}</CardDescription>
            </div>
            <Badge className="tabular-nums" variant="outline">
              {items.length} baris
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="px-0">
          {items.length === 0 ? (
            <div className="mx-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/35 p-4 text-xs text-muted-foreground">
              <span>{emptyMessage}</span>
              {emptyAction}
            </div>
          ) : (
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 pl-4">Urutan</TableHead>
                  <TableHead>Pemasok</TableHead>
                  <TableHead>Penerima</TableHead>
                  <TableHead className="text-right">Volume (ton)</TableHead>
                  <TableHead className="text-right">Jarak Garis Lurus</TableHead>
                  <TableHead className="text-right">% Kebutuhan Penerima</TableHead>
                  <TableHead>Koneksi</TableHead>
                  <TableHead className="w-16 pr-4 text-right">Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const isSelected = selectedUrutan === item.urutan
                  const origin = provincesByCode.get(item.dari_kode)
                  const dest = provincesByCode.get(item.ke_kode)

                  return (
                    <TableRow
                      aria-selected={isSelected}
                      className={cn(
                        "cursor-pointer",
                        isSelected && "bg-primary/10 hover:bg-primary/15",
                      )}
                      data-state={isSelected ? "selected" : undefined}
                      key={`${item.urutan}-${item.dari_kode}-${item.ke_kode}`}
                      onClick={() => handleSelectAllocation(item)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          handleSelectAllocation(item)
                        }
                      }}
                      tabIndex={0}
                    >
                      <TableCell className="pl-4 font-semibold tabular-nums">
                        #{item.urutan}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{item.dari}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {origin ? `${origin.pulau} · ` : ""}BPS {item.dari_kode}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{item.ke}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {dest ? `${dest.pulau} · ` : ""}BPS {item.ke_kode}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatTon(item.ton, 2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatKm(item.jarak_km, 1)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.persen_kebutuhan_penerima !== null &&
                        item.persen_kebutuhan_penerima !== undefined
                          ? formatPersen(item.persen_kebutuhan_penerima, 2)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.satu_pulau ? "secondary" : "outline"}>
                          {item.satu_pulau ? "Satu pulau" : "Lintas pulau"}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-4 text-right text-muted-foreground">
                        <ChevronRight aria-hidden="true" className="ml-auto size-4" />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet
        onOpenChange={(open) => {
          if (!open) setSelectedUrutan(null)
        }}
        open={Boolean(selectedItem)}
      >
        <SheetContent className="flex flex-col overflow-y-auto sm:max-w-md" side="right">
          {selectedItem ? (
            <>
              <SheetHeader className="border-b pb-4">
                <div className="flex flex-wrap items-center gap-2 pr-6">
                  <Badge className="tabular-nums" variant="secondary">
                    Alur #{selectedItem.urutan}
                  </Badge>
                  <Badge variant={selectedItem.satu_pulau ? "secondary" : "outline"}>
                    {selectedItem.satu_pulau ? "Satu pulau" : "Lintas pulau"}
                  </Badge>
                </div>
                <SheetTitle className="mt-1 flex flex-wrap items-center gap-1.5 text-lg">
                  <span>{selectedItem.dari}</span>
                  <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-primary" />
                  <span>{selectedItem.ke}</span>
                </SheetTitle>
                <SheetDescription>
                  Rekomendasi potensial berbasis data tahunan {tahun}, bukan rencana logistik.
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-4 px-4 py-2">
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="rounded-lg border bg-status-surplus/5 p-3">
                    <div className="text-[11px] font-medium text-status-surplus">Pemasok</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">
                      {selectedItem.dari}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      BPS {selectedItem.dari_kode}
                      {senderProvince ? ` · ${senderProvince.pulau}` : ""}
                    </div>
                  </div>

                  <div className="rounded-lg border bg-status-defisit/5 p-3">
                    <div className="text-[11px] font-medium text-status-defisit">Penerima</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">
                      {selectedItem.ke}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      BPS {selectedItem.ke_kode}
                      {receiverProvince ? ` · ${receiverProvince.pulau}` : ""}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="rounded-lg border bg-muted/35 p-3">
                    <div className="text-xs text-muted-foreground">Volume Alokasi</div>
                    <div className="mt-1 text-lg font-semibold text-foreground tabular-nums">
                      {formatTon(selectedItem.ton, 2)}
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/35 p-3">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Ruler aria-hidden="true" className="size-3.5 text-primary" />
                      Jarak Garis Lurus
                    </div>
                    <div className="mt-1 text-lg font-semibold text-foreground tabular-nums">
                      {formatKm(selectedItem.jarak_km, 1)}
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/35 p-3 sm:col-span-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">Kontribusi Kebutuhan Penerima</span>
                      <span className="font-semibold text-foreground tabular-nums">
                        {selectedItem.persen_kebutuhan_penerima !== null &&
                        selectedItem.persen_kebutuhan_penerima !== undefined
                          ? formatPersen(selectedItem.persen_kebutuhan_penerima, 2)
                          : "—"}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">Klasifikasi Koneksi</span>
                      <span className="inline-flex items-center gap-1 font-medium text-foreground">
                        <Compass aria-hidden="true" className="size-3.5 text-primary" />
                        {selectedItem.satu_pulau ? "Satu pulau" : "Lintas pulau"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 rounded-lg border bg-muted/25 p-3.5">
                  <div className="text-xs font-semibold text-foreground">Penjelasan Alokasi</div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {selectedItem.explanation}
                  </p>
                </div>
              </div>

              <SheetFooter className="border-t pt-4">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/analisis/${selectedItem.dari_kode}${tahunSuffix}`}>
                      <span className="truncate">Analisis {selectedItem.dari}</span>
                      <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="default">
                    <Link to={`/analisis/${selectedItem.ke_kode}${tahunSuffix}`}>
                      <span className="truncate">Analisis {selectedItem.ke}</span>
                      <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
                    </Link>
                  </Button>
                </div>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
