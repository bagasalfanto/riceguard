import { useMemo, useState } from "react"
import { AlertCircle, ArrowRight, Compass, ExternalLink, Layers, Ruler } from "lucide-react"
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
import type { RecommendationItem } from "@/features/distribution/distributionData"
import {
  buildLayerFromProvinces,
  type ProvinceGeoJSON,
  type ProvinceRecord,
} from "@/features/map/mapData"
import { formatKm, formatPersen, formatTon } from "@/lib/format"

export interface SupplyDemandMapProps {
  geoData?: ProvinceGeoJSON
  provinces: ProvinceRecord[]
  provincesByCode: Map<string, ProvinceRecord>
  flows: RecommendationItem[]
  deficitCodes: Set<string>
  selectedDeficitCode: string | null
  tahun: number
  tahunParam?: number
  isLoading: boolean
  error?: unknown
  onRetry: () => void
  onSelectDeficitProvince: (kodeBps: string) => void
}

export function SupplyDemandMap({
  geoData,
  provinces,
  provincesByCode,
  flows,
  deficitCodes,
  selectedDeficitCode,
  tahun,
  tahunParam,
  isLoading,
  error,
  onRetry,
  onSelectDeficitProvince,
}: SupplyDemandMapProps) {
  const [selectedUrutan, setSelectedUrutan] = useState<number | null>(null)
  const [focusTarget, setFocusTarget] = useState<MapFocusTarget | null>(null)

  const tahunSuffix = tahunParam ? `?tahun=${tahunParam}` : ""

  const statusLayerData = useMemo(
    () => buildLayerFromProvinces(provinces, "status", tahun),
    [provinces, tahun],
  )

  const matchingCodes = useMemo(() => {
    const set = new Set<string>()
    for (const p of provinces) {
      set.add(p.kode_bps)
    }
    return set
  }, [provinces])

  const selectedFlowIndex = useMemo(() => {
    if (selectedUrutan === null) return null
    const idx = flows.findIndex((item) => item.urutan === selectedUrutan)
    return idx >= 0 ? idx : null
  }, [flows, selectedUrutan])

  const selectedFlow = selectedFlowIndex !== null ? flows[selectedFlowIndex] : null
  const senderProvince = selectedFlow ? provincesByCode.get(selectedFlow.dari_kode) : undefined
  const receiverProvince = selectedFlow ? provincesByCode.get(selectedFlow.ke_kode) : undefined

  return (
    <>
      <Card className="flex flex-col gap-3 py-4">
        <CardHeader className="px-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers aria-hidden="true" className="size-4 text-primary" />
                Peta Alur Alokasi Surplus ke Defisit
              </CardTitle>
              <CardDescription className="mt-1">
                Garis menghubungkan titik pusat provinsi pemasok dan penerima (tebal garis &prop;
                &radic;ton). Klik garis alur untuk detail alokasi.
              </CardDescription>
            </div>
            <Badge className="shrink-0 text-xs tabular-nums" variant="secondary">
              {flows.length} pasangan alur
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex-1 space-y-2.5 px-4">
          {error ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Gagal memuat peta alur distribusi</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {error instanceof Error
                    ? error.message
                    : "Terjadi kesalahan saat memuat lapisan peta atau daftar alur."}
                </span>
                <Button onClick={onRetry} size="sm" type="button" variant="outline">
                  Coba lagi
                </Button>
              </AlertDescription>
            </Alert>
          ) : isLoading || !geoData ? (
            <Skeleton className="h-[460px] w-full rounded-xl" />
          ) : (
            <>
              <BaseMap
                ariaLabel="Peta alur alokasi surplus ke defisit antar provinsi Indonesia"
                basemap="satellite"
                className="h-[440px] w-full lg:h-[490px]"
                focusTarget={focusTarget}
                onResetView={() => setFocusTarget(null)}
                overlay={<MapLegend layerData={statusLayerData} />}
              >
                <ProvinceLayer
                  geoData={geoData}
                  layerData={statusLayerData}
                  matchingCodes={matchingCodes}
                  onSelectProvince={(kode) => {
                    if (deficitCodes.has(kode)) {
                      onSelectDeficitProvince(kode)
                    }
                  }}
                  provincesByCode={provincesByCode}
                  selectedCode={selectedDeficitCode}
                />
                {flows.length > 0 ? (
                  <FlowLines
                    flows={flows}
                    onSelectFlow={(flow) => setSelectedUrutan(flow.urutan)}
                    provincesByCode={provincesByCode}
                    selectedIndex={selectedFlowIndex}
                  />
                ) : null}
              </BaseMap>

              {flows.length === 0 ? (
                <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  Belum ada pasangan alur alokasi yang tersedia untuk tahun {tahun}.
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    Arah panah menunjukkan alokasi potensial dari pemasok surplus menuju penerima
                    defisit.
                  </span>
                  <span className="tabular-nums">
                    Jarak memakai garis lurus antar centroid provinsi (bukan jarak jalan/laut).
                  </span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Sheet
        onOpenChange={(open) => {
          if (!open) setSelectedUrutan(null)
        }}
        open={Boolean(selectedFlow)}
      >
        <SheetContent className="flex flex-col overflow-y-auto sm:max-w-md" side="right">
          {selectedFlow ? (
            <>
              <SheetHeader className="border-b pb-4">
                <div className="flex flex-wrap items-center gap-2 pr-6">
                  <Badge className="tabular-nums" variant="secondary">
                    Alur #{selectedFlow.urutan}
                  </Badge>
                  <Badge variant={selectedFlow.satu_pulau ? "secondary" : "outline"}>
                    {selectedFlow.satu_pulau ? "Satu pulau" : "Lintas pulau"}
                  </Badge>
                </div>
                <SheetTitle className="mt-1 flex flex-wrap items-center gap-1.5 text-lg">
                  <span>{selectedFlow.dari}</span>
                  <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-primary" />
                  <span>{selectedFlow.ke}</span>
                </SheetTitle>
                <SheetDescription>
                  Detail alokasi potensial tahun {tahun}. Rekomendasi bersifat analitis, bukan
                  rencana logistik operasional.
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-4 px-4 py-2">
                {/* Pengirim -> Penerima */}
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="rounded-lg border bg-status-surplus/5 p-3">
                    <div className="text-[11px] font-medium text-status-surplus">
                      Pemasok (Surplus)
                    </div>
                    <div className="mt-1 text-sm font-semibold text-foreground">
                      {selectedFlow.dari}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      BPS {selectedFlow.dari_kode}
                      {senderProvince ? ` · ${senderProvince.pulau}` : ""}
                    </div>
                  </div>

                  <div className="rounded-lg border bg-status-defisit/5 p-3">
                    <div className="text-[11px] font-medium text-status-defisit">
                      Penerima (Defisit)
                    </div>
                    <div className="mt-1 text-sm font-semibold text-foreground">
                      {selectedFlow.ke}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      BPS {selectedFlow.ke_kode}
                      {receiverProvince ? ` · ${receiverProvince.pulau}` : ""}
                    </div>
                  </div>
                </div>

                {/* Metrik Utama Alur */}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="rounded-lg border bg-muted/35 p-3">
                    <div className="text-xs text-muted-foreground">Volume Alokasi</div>
                    <div className="mt-1 text-lg font-semibold text-foreground tabular-nums">
                      {formatTon(selectedFlow.ton, 2)}
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/35 p-3">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Ruler aria-hidden="true" className="size-3.5 text-primary" />
                      Jarak Garis Lurus
                    </div>
                    <div className="mt-1 text-lg font-semibold text-foreground tabular-nums">
                      {formatKm(selectedFlow.jarak_km, 1)}
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/35 p-3 sm:col-span-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">Kontribusi Kebutuhan Penerima</span>
                      <span className="font-semibold text-foreground tabular-nums">
                        {formatPersen(selectedFlow.persen_kebutuhan_penerima, 2)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">Klasifikasi Koneksi</span>
                      <span className="inline-flex items-center gap-1 font-medium text-foreground">
                        <Compass aria-hidden="true" className="size-3.5 text-primary" />
                        {selectedFlow.satu_pulau
                          ? "Satu pulau (klaster pulau sama)"
                          : "Lintas pulau (antar-pulau)"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Penjelasan */}
                <div className="space-y-1.5 rounded-lg border bg-muted/25 p-3.5">
                  <div className="text-xs font-semibold text-foreground">Penjelasan Alokasi</div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {selectedFlow.explanation}
                  </p>
                </div>

                {/* Aksi fokus ke matriks pemasok */}
                {deficitCodes.has(selectedFlow.ke_kode) ? (
                  <Button
                    className="w-full"
                    onClick={() => {
                      onSelectDeficitProvince(selectedFlow.ke_kode)
                      if (receiverProvince) {
                        setFocusTarget({
                          lat: receiverProvince.lat,
                          lng: receiverProvince.lng,
                          zoom: 6,
                          nonce: Date.now(),
                        })
                      }
                      setSelectedUrutan(null)
                    }}
                    type="button"
                    variant="secondary"
                  >
                    Lihat semua kandidat pemasok untuk {selectedFlow.ke}
                  </Button>
                ) : null}
              </div>

              <SheetFooter className="border-t pt-4">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/analisis/${selectedFlow.dari_kode}${tahunSuffix}`}>
                      <span className="truncate">Analisis {selectedFlow.dari}</span>
                      <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="default">
                    <Link to={`/analisis/${selectedFlow.ke_kode}${tahunSuffix}`}>
                      <span className="truncate">Analisis {selectedFlow.ke}</span>
                      <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
                    </Link>
                  </Button>
                </div>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  )
}
