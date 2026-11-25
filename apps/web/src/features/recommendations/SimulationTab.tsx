import { useMemo, useState } from "react"
import {
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Copy,
  Info,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
} from "lucide-react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { ProvinceRecord } from "@/features/map/mapData"
import { AllocationExplorer } from "@/features/recommendations/AllocationExplorer"
import {
  DEFAULT_SIMULATION_PARAMS,
  parseSimulationSearchParams,
  SIMULATION_LIMITS,
  useMapProvinces,
  useProvincesGeoJSON,
  useSimulateRecommendations,
  writeSimulationSearchParams,
  type SimulationFormParams,
  type SimulationResponse,
} from "@/features/recommendations/recommendationsData"
import { useTahun } from "@/hooks/useTahun"
import { ApiError } from "@/lib/api"
import { formatAngka, formatKm, formatPersen, formatTon } from "@/lib/format"
import { tampilanStatus } from "@/lib/status"
import { cn } from "@/lib/utils"

interface ProductionAdjustmentRow {
  kode_bps: string
  persen: number
}

function formatSignedPercent(value: number): string {
  if (value > 0) return `+${formatAngka(value, 0)}%`
  if (value < 0) return `−${formatAngka(Math.abs(value), 0)}%`
  return "0%"
}

function formatSignedTon(value: number): string {
  if (value > 0) return `+${formatTon(value, 2)}`
  if (value < 0) return `−${formatTon(Math.abs(value), 2)}`
  return "0 ton"
}

function formatSignedTonKm(value: number): string {
  if (value > 0) return `+${formatAngka(value, 0)} ton·km`
  if (value < 0) return `−${formatAngka(Math.abs(value), 0)} ton·km`
  return "0 ton·km"
}

function extractApiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const details = err.details as { alasan?: string } | null
    if (details?.alasan) return `${err.message}: ${details.alasan}`
    return err.message
  }
  if (err instanceof Error) return err.message
  return "Terjadi kesalahan saat menjalankan simulasi."
}

function ProvinceCheckboxList({
  title,
  emptyLabel,
  provinces,
  selectedCodes,
  isLoading,
  tone,
  onToggle,
  onClear,
}: {
  title: string
  emptyLabel: string
  provinces: ProvinceRecord[]
  selectedCodes: string[]
  isLoading: boolean
  tone: "surplus" | "defisit"
  onToggle: (kodeBps: string) => void
  onClear: () => void
}) {
  const selectedSet = useMemo(() => new Set(selectedCodes), [selectedCodes])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{title}</span>
        <div className="flex items-center gap-1.5">
          {selectedCodes.length > 0 ? (
            <button
              className="text-xs text-primary underline-offset-2 hover:underline"
              onClick={onClear}
              type="button"
            >
              Bersihkan
            </button>
          ) : null}
          <Badge className="text-[11px] tabular-nums" variant="secondary">
            {selectedCodes.length}/{provinces.length}
          </Badge>
        </div>
      </div>

      <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border bg-background p-2">
        {isLoading ? (
          <div className="space-y-1.5 p-1">
            {[0, 1, 2, 3].map((idx) => (
              <Skeleton className="h-6 w-full" key={idx} />
            ))}
          </div>
        ) : provinces.length === 0 ? (
          <p className="p-2 text-xs text-muted-foreground">{emptyLabel}</p>
        ) : (
          provinces.map((prov) => {
            const checked = selectedSet.has(prov.kode_bps)
            return (
              <label
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-accent/70",
                  checked && "bg-primary/10 font-medium",
                )}
                key={prov.kode_bps}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <input
                    checked={checked}
                    className="size-3.5 shrink-0 accent-primary"
                    onChange={() => onToggle(prov.kode_bps)}
                    type="checkbox"
                  />
                  <span className="truncate">{prov.provinsi}</span>
                </span>
                <span
                  className={cn(
                    "shrink-0 text-[11px] tabular-nums",
                    tone === "surplus" ? "text-status-surplus" : "text-status-defisit",
                  )}
                >
                  {formatTon(Math.abs(prov.rice_balance_ton))}
                </span>
              </label>
            )
          })
        )}
      </div>
    </div>
  )
}

function SimulationComparisonCard({ data }: { data: SimulationResponse }) {
  const { delta_ton, delta_ton_km, status_berubah, defisit_tidak_tertutup } = data.banding_resmi
  const isIdenticalTon = Math.abs(delta_ton) < 0.01

  return (
    <Card className="gap-4 py-4">
      <CardHeader className="px-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Perbandingan dengan Rekomendasi Resmi</CardTitle>
            <CardDescription className="mt-1">
              Selisih hasil skenario terhadap rekomendasi resmi tahun {data.tahun} (v
              {data.version.version_no}).
            </CardDescription>
          </div>
          {isIdenticalTon && status_berubah.length === 0 && defisit_tidak_tertutup.length === 0 ? (
            <Badge
              className="border-status-surplus/40 bg-status-surplus/10 text-status-surplus"
              variant="outline"
            >
              <CheckCircle2 aria-hidden="true" className="size-3" />
              Identik dengan resmi
            </Badge>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">Selisih Volume (Delta Ton)</div>
            <div
              className={cn(
                "mt-1 flex items-center gap-1 text-base font-semibold tabular-nums",
                delta_ton > 0.01
                  ? "text-status-surplus"
                  : delta_ton < -0.01
                    ? "text-status-defisit"
                    : "text-foreground",
              )}
            >
              {delta_ton > 0.01 ? (
                <ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
              ) : delta_ton < -0.01 ? (
                <ArrowDownRight aria-hidden="true" className="size-4 shrink-0" />
              ) : null}
              <span>{formatSignedTon(delta_ton)}</span>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">Selisih Ton·Km</div>
            <div className="mt-1 text-base font-semibold tabular-nums">
              {formatSignedTonKm(delta_ton_km)}
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">Provinsi Berubah Status</div>
            <div className="mt-1 text-base font-semibold tabular-nums">
              {formatAngka(status_berubah.length)} provinsi
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">Defisit Belum Tertutup</div>
            <div
              className={cn(
                "mt-1 text-base font-semibold tabular-nums",
                defisit_tidak_tertutup.length > 0 ? "text-status-defisit" : "text-status-surplus",
              )}
            >
              {formatAngka(defisit_tidak_tertutup.length)} provinsi
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2 rounded-lg border p-3.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold">Perubahan Status Provinsi</h3>
              <Badge className="tabular-nums" variant="secondary">
                {status_berubah.length}
              </Badge>
            </div>
            {status_berubah.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Tidak ada provinsi yang berubah kategori status pada skenario ini.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {status_berubah.map((chg) => {
                  const fromInfo = tampilanStatus(chg.dari)
                  const toInfo = tampilanStatus(chg.ke)
                  return (
                    <div
                      className="flex items-center gap-1.5 rounded-md border bg-muted/25 px-2.5 py-1.5 text-xs"
                      key={chg.kode_bps}
                    >
                      <span className="font-medium">{chg.provinsi}</span>
                      <Badge className={cn("text-[10px]", fromInfo.kelas)} variant="outline">
                        {fromInfo.label}
                      </Badge>
                      <ArrowRight aria-hidden="true" className="size-3 text-muted-foreground" />
                      <Badge className={cn("text-[10px]", toInfo.kelas)} variant="outline">
                        {toInfo.label}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-lg border p-3.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold">Defisit Tidak Tertutup</h3>
              <Badge className="tabular-nums" variant="secondary">
                {defisit_tidak_tertutup.length}
              </Badge>
            </div>
            {defisit_tidak_tertutup.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Semua defisit provinsi penerima tertutup oleh alokasi skenario ini.
              </p>
            ) : (
              <div className="max-h-56 overflow-y-auto">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provinsi</TableHead>
                      <TableHead className="text-right">Defisit</TableHead>
                      <TableHead className="text-right">Terpenuhi</TableHead>
                      <TableHead className="text-right">Sisa Defisit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {defisit_tidak_tertutup.map((item) => (
                      <TableRow key={item.kode_bps}>
                        <TableCell className="font-medium">{item.provinsi}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatTon(item.defisit_ton)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatTon(item.terpenuhi_ton)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-status-defisit tabular-nums">
                          {formatTon(item.sisa_defisit_ton)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function SimulationTab() {
  const { tahun } = useTahun()
  const [searchParams, setSearchParams] = useSearchParams()

  const [params, setParams] = useState<SimulationFormParams>(() =>
    parseSimulationSearchParams(searchParams),
  )
  const [lastJarakKm, setLastJarakKm] = useState<number>(
    () =>
      parseSimulationSearchParams(searchParams).jarak_maks_km ??
      SIMULATION_LIMITS.jarakDefaultAktif,
  )
  const [productionRows, setProductionRows] = useState<ProductionAdjustmentRow[]>(() =>
    Object.entries(parseSimulationSearchParams(searchParams).perubahan_produksi).map(
      ([kode_bps, persen]) => ({ kode_bps, persen }),
    ),
  )

  const simulationMutation = useSimulateRecommendations()
  const activeYear = simulationMutation.data?.tahun ?? tahun ?? 2025

  const geoQuery = useProvincesGeoJSON()
  const provincesQuery = useMapProvinces(activeYear)

  const baseProvinces = provincesQuery.data ?? []
  const baseProvincesByCode = provincesQuery.byCode

  const allProvincesSorted = useMemo(
    () => [...baseProvinces].sort((a, b) => a.provinsi.localeCompare(b.provinsi, "id-ID")),
    [baseProvinces],
  )
  const surplusProvinces = useMemo(
    () => allProvincesSorted.filter((p) => p.status === "surplus"),
    [allProvincesSorted],
  )
  const deficitProvinces = useMemo(
    () => allProvincesSorted.filter((p) => p.status === "defisit"),
    [allProvincesSorted],
  )

  const buildCurrentFormParams = (): SimulationFormParams => {
    const prodMap: Record<string, number> = {}
    for (const row of productionRows) {
      if (row.kode_bps && row.persen !== 0) {
        prodMap[row.kode_bps] = row.persen
      }
    }
    return {
      ...params,
      perubahan_produksi: prodMap,
      mode: "greedy_v1",
    }
  }

  const toggleCodeInList = (
    field: "kecualikan_pemasok" | "kecualikan_penerima",
    kodeBps: string,
  ) => {
    setParams((prev) => {
      const exists = prev[field].includes(kodeBps)
      return {
        ...prev,
        [field]: exists
          ? prev[field].filter((k) => k !== kodeBps)
          : [...prev[field], kodeBps],
      }
    })
  }

  const addProductionRow = () => {
    const used = new Set(productionRows.map((r) => r.kode_bps))
    const candidate = allProvincesSorted.find((p) => !used.has(p.kode_bps))
    if (!candidate) return
    setProductionRows((prev) => [...prev, { kode_bps: candidate.kode_bps, persen: 0 }])
  }

  const updateProductionRow = (index: number, patch: Partial<ProductionAdjustmentRow>) => {
    setProductionRows((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)),
    )
  }

  const removeProductionRow = (index: number) => {
    setProductionRows((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleRunSimulation = () => {
    const current = buildCurrentFormParams()
    setParams(current)
    setSearchParams((prev) => writeSimulationSearchParams(prev, current), { replace: true })
    simulationMutation.mutate({
      ...(tahun !== undefined ? { tahun } : {}),
      ...current,
    })
  }

  const handleResetDefault = () => {
    setParams(DEFAULT_SIMULATION_PARAMS)
    setLastJarakKm(SIMULATION_LIMITS.jarakDefaultAktif)
    setProductionRows([])
    simulationMutation.reset()
    setSearchParams((prev) => writeSimulationSearchParams(prev, DEFAULT_SIMULATION_PARAMS), {
      replace: true,
    })
  }

  const handleCopyScenarioLink = async () => {
    const current = buildCurrentFormParams()
    const nextParams = writeSimulationSearchParams(searchParams, current)
    setSearchParams(nextParams, { replace: true })

    const qs = nextParams.toString()
    const shareUrl = `${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ""}`

    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success("Link skenario berhasil disalin ke papan klip")
    } catch {
      toast.info("URL skenario telah diperbarui pada bilah alamat")
    }
  }

  const { simulatedProvinces, simulatedProvincesByCode } = useMemo(() => {
    const simItems = simulationMutation.data?.provinsi
    if (!simItems) {
      return {
        simulatedProvinces: baseProvinces,
        simulatedProvincesByCode: baseProvincesByCode,
      }
    }

    const list: ProvinceRecord[] = []
    const byCode = new Map<string, ProvinceRecord>()
    for (const sp of simItems) {
      const base = baseProvincesByCode.get(sp.kode_bps)
      const merged: ProvinceRecord = {
        tahun: simulationMutation.data?.tahun ?? base?.tahun ?? activeYear,
        kode_bps: sp.kode_bps,
        kode_kemendagri: base?.kode_kemendagri ?? sp.kode_bps,
        provinsi: sp.provinsi,
        pulau: sp.pulau,
        lat: base?.lat ?? 0,
        lng: base?.lng ?? 0,
        penduduk_jiwa: base?.penduduk_jiwa ?? 0,
        konsumsi_kg_kapita_tahun: base?.konsumsi_kg_kapita_tahun ?? 0,
        produksi_padi_ton_gkg: base?.produksi_padi_ton_gkg ?? 0,
        produksi_beras_ton: sp.produksi_beras_ton,
        kebutuhan_beras_ton: sp.kebutuhan_beras_ton,
        rice_balance_ton: sp.rice_balance_ton,
        rasio_swasembada: sp.rasio_swasembada,
        status: sp.status,
      }
      list.push(merged)
      byCode.set(merged.kode_bps, merged)
    }
    return { simulatedProvinces: list, simulatedProvincesByCode: byCode }
  }, [simulationMutation.data, baseProvinces, baseProvincesByCode, activeYear])

  const usedProductionCodes = useMemo(
    () => new Set(productionRows.map((r) => r.kode_bps)),
    [productionRows],
  )

  return (
    <div className="space-y-6">
      <Card className="gap-5 py-5">
        <CardHeader className="px-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <SlidersHorizontal aria-hidden="true" className="size-4 text-primary" />
                Parameter Simulasi Skenario
              </CardTitle>
              <CardDescription className="mt-1">
                Sesuaikan 8 parameter berikut lalu tekan &ldquo;Jalankan simulasi&rdquo;. Simulasi
                tidak mengubah data resmi di database.
              </CardDescription>
            </div>
            <Badge variant="outline">Tahun {tahun ?? 2025}</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 px-5">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-3 rounded-lg border bg-muted/20 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="sim-ambang">Ambang swasembada</Label>
                <Badge className="tabular-nums" variant="secondary">
                  {formatAngka(params.ambang_swasembada, 2)} (
                  {formatPersen(params.ambang_swasembada * 100, 0)})
                </Badge>
              </div>
              <Slider
                aria-label="Ambang swasembada"
                id="sim-ambang"
                max={SIMULATION_LIMITS.ambangMax}
                min={SIMULATION_LIMITS.ambangMin}
                onValueChange={([val]) => {
                  if (val !== undefined) {
                    setParams((prev) => ({
                      ...prev,
                      ambang_swasembada: Math.round(val * 100) / 100,
                    }))
                  }
                }}
                step={0.01}
                value={[params.ambang_swasembada]}
              />
              <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
                <span>0,80</span>
                <span>0,90 (default)</span>
                <span>1,00</span>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border bg-muted/20 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="sim-surplus">Persentase surplus dilepas</Label>
                <Badge className="tabular-nums" variant="secondary">
                  {formatPersen(params.persen_surplus_dilepas, 0)}
                </Badge>
              </div>
              <Slider
                aria-label="Persentase surplus dilepas"
                id="sim-surplus"
                max={SIMULATION_LIMITS.surplusMax}
                min={SIMULATION_LIMITS.surplusMin}
                onValueChange={([val]) => {
                  if (val !== undefined) {
                    setParams((prev) => ({ ...prev, persen_surplus_dilepas: Math.round(val) }))
                  }
                }}
                step={1}
                value={[params.persen_surplus_dilepas]}
              />
              <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
                <span>10%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border bg-muted/20 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={params.jarak_maks_km !== null}
                    id="sim-jarak-toggle"
                    onCheckedChange={(checked) => {
                      setParams((prev) => ({
                        ...prev,
                        jarak_maks_km: checked ? lastJarakKm : null,
                      }))
                    }}
                  />
                  <Label htmlFor="sim-jarak-toggle">Jarak maksimum</Label>
                </div>
                <Badge className="tabular-nums" variant="secondary">
                  {params.jarak_maks_km === null
                    ? "Tanpa batas"
                    : formatKm(params.jarak_maks_km, 0)}
                </Badge>
              </div>
              <Slider
                aria-label="Batas jarak maksimum garis lurus"
                disabled={params.jarak_maks_km === null}
                max={SIMULATION_LIMITS.jarakMax}
                min={SIMULATION_LIMITS.jarakMin}
                onValueChange={([val]) => {
                  if (val !== undefined) {
                    const rounded = Math.round(val)
                    setLastJarakKm(rounded)
                    setParams((prev) => ({ ...prev, jarak_maks_km: rounded }))
                  }
                }}
                step={50}
                value={[params.jarak_maks_km ?? lastJarakKm]}
              />
              <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
                <span>100 km</span>
                <span>2.000 km</span>
                <span>4.000 km</span>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border bg-muted/20 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="sim-konsumsi">Perubahan konsumsi nasional</Label>
                <Badge className="tabular-nums" variant="secondary">
                  {formatSignedPercent(params.perubahan_konsumsi_persen)}
                </Badge>
              </div>
              <Slider
                aria-label="Perubahan konsumsi nasional"
                id="sim-konsumsi"
                max={SIMULATION_LIMITS.konsumsiMax}
                min={SIMULATION_LIMITS.konsumsiMin}
                onValueChange={([val]) => {
                  if (val !== undefined) {
                    setParams((prev) => ({
                      ...prev,
                      perubahan_konsumsi_persen: Math.round(val),
                    }))
                  }
                }}
                step={1}
                value={[params.perubahan_konsumsi_persen]}
              />
              <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
                <span>−20%</span>
                <span>0%</span>
                <span>+20%</span>
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <ProvinceCheckboxList
              emptyLabel="Data provinsi surplus belum tersedia."
              isLoading={provincesQuery.isLoading}
              onClear={() => setParams((prev) => ({ ...prev, kecualikan_pemasok: [] }))}
              onToggle={(kode) => toggleCodeInList("kecualikan_pemasok", kode)}
              provinces={surplusProvinces}
              selectedCodes={params.kecualikan_pemasok}
              title="Kecualikan pemasok (provinsi surplus)"
              tone="surplus"
            />

            <ProvinceCheckboxList
              emptyLabel="Data provinsi defisit belum tersedia."
              isLoading={provincesQuery.isLoading}
              onClear={() => setParams((prev) => ({ ...prev, kecualikan_penerima: [] }))}
              onToggle={(kode) => toggleCodeInList("kecualikan_penerima", kode)}
              provinces={deficitProvinces}
              selectedCodes={params.kecualikan_penerima}
              title="Kecualikan penerima (provinsi defisit)"
              tone="defisit"
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-12">
            <div className="space-y-3 rounded-lg border bg-muted/20 p-3.5 lg:col-span-8">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">Perubahan produksi per provinsi</div>
                  <p className="text-xs text-muted-foreground">
                    Simulasikan kenaikan atau penurunan produksi beras (−50% hingga +50%) pada
                    provinsi tertentu.
                  </p>
                </div>
                <Button
                  disabled={
                    allProvincesSorted.length === 0 ||
                    productionRows.length >= allProvincesSorted.length
                  }
                  onClick={addProductionRow}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Plus aria-hidden="true" className="size-3.5" />
                  Tambah provinsi
                </Button>
              </div>

              {productionRows.length === 0 ? (
                <div className="rounded-md border border-dashed bg-background/60 px-3 py-2.5 text-xs text-muted-foreground">
                  Belum ada penyesuaian produksi provinsi. Klik &ldquo;Tambah provinsi&rdquo; untuk
                  menambahkan skenario perubahan produksi.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {productionRows.map((row, idx) => (
                    <div
                      className="flex flex-col gap-2.5 rounded-md border bg-background p-2.5 sm:flex-row sm:items-center"
                      key={`${row.kode_bps}-${idx}`}
                    >
                      <select
                        aria-label={`Pilih provinsi penyesuaian produksi baris ${idx + 1}`}
                        className="h-8 rounded-md border bg-background px-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-ring sm:w-52"
                        onChange={(e) => updateProductionRow(idx, { kode_bps: e.target.value })}
                        value={row.kode_bps}
                      >
                        {allProvincesSorted.map((prov) => {
                          const disabled =
                            prov.kode_bps !== row.kode_bps && usedProductionCodes.has(prov.kode_bps)
                          return (
                            <option disabled={disabled} key={prov.kode_bps} value={prov.kode_bps}>
                              {prov.provinsi}
                            </option>
                          )
                        })}
                      </select>

                      <div className="flex flex-1 items-center gap-3">
                        <Slider
                          aria-label={`Persentase perubahan produksi baris ${idx + 1}`}
                          max={SIMULATION_LIMITS.produksiMax}
                          min={SIMULATION_LIMITS.produksiMin}
                          onValueChange={([val]) => {
                            if (val !== undefined) {
                              updateProductionRow(idx, { persen: Math.round(val) })
                            }
                          }}
                          step={1}
                          value={[row.persen]}
                        />
                        <Badge
                          className={cn(
                            "w-14 shrink-0 justify-center tabular-nums",
                            row.persen > 0
                              ? "border-status-surplus/40 bg-status-surplus/10 text-status-surplus"
                              : row.persen < 0
                                ? "border-status-defisit/40 bg-status-defisit/10 text-status-defisit"
                                : "",
                          )}
                          variant="outline"
                        >
                          {formatSignedPercent(row.persen)}
                        </Badge>
                      </div>

                      <Button
                        aria-label={`Hapus penyesuaian produksi baris ${idx + 1}`}
                        onClick={() => removeProductionRow(idx)}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 aria-hidden="true" className="size-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-lg border bg-muted/20 p-3.5 lg:col-span-4">
              <div className="text-sm font-medium">Mode algoritma</div>
              <p className="text-xs text-muted-foreground">
                Pilih metode pencocokan surplus ke defisit.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button aria-pressed="true" size="sm" type="button" variant="default">
                  Greedy v1
                </Button>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex" tabIndex={0}>
                        <Button
                          aria-disabled="true"
                          className="pointer-events-none"
                          disabled
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Optimal
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Belum diimplementasikan</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 border-t pt-4">
            <Button
              disabled={simulationMutation.isPending}
              onClick={handleRunSimulation}
              type="button"
            >
              {simulationMutation.isPending ? (
                <>
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  Menjalankan simulasi...
                </>
              ) : (
                <>
                  <Play aria-hidden="true" className="size-4" />
                  Jalankan simulasi
                </>
              )}
            </Button>

            <Button
              disabled={simulationMutation.isPending}
              onClick={handleResetDefault}
              type="button"
              variant="outline"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              Reset ke default
            </Button>

            <Button onClick={() => void handleCopyScenarioLink()} type="button" variant="outline">
              <Copy aria-hidden="true" className="size-4" />
              Salin link skenario
            </Button>
          </div>
        </CardContent>
      </Card>

      <Alert className="border-primary/25 bg-primary/5">
        <Info aria-hidden="true" className="text-primary" />
        <AlertTitle>Rekomendasi potensial berbasis data tahunan, bukan rencana logistik</AlertTitle>
        <AlertDescription>
          Hasil simulasi dihitung ulang di memori tanpa menulis ke database, menggunakan jarak
          garis lurus antar centroid provinsi.
        </AlertDescription>
      </Alert>

      {simulationMutation.error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Gagal menjalankan simulasi</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{extractApiErrorMessage(simulationMutation.error)}</span>
            <Button onClick={handleRunSimulation} size="sm" type="button" variant="outline">
              Coba lagi
            </Button>
          </AlertDescription>
        </Alert>
      ) : simulationMutation.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((idx) => (
              <Skeleton className="h-24 w-full rounded-xl" key={idx} />
            ))}
          </div>
          <Skeleton className="h-[460px] w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      ) : simulationMutation.data ? (
        <div className="space-y-6">
          <SimulationComparisonCard data={simulationMutation.data} />

          <AllocationExplorer
            emptyMessage="Tidak ada pasangan alur alokasi yang terbentuk dengan kombinasi parameter simulasi ini."
            geoData={geoQuery.data}
            items={simulationMutation.data.rekomendasi}
            mapDescription="Warna provinsi menampilkan status neraca hasil simulasi; garis menampilkan alur alokasi skenario berdasarkan jarak garis lurus."
            mapError={geoQuery.error ?? provincesQuery.error}
            mapLoading={geoQuery.isLoading || provincesQuery.isLoading}
            mapTitle={`Peta Hasil Simulasi (${simulationMutation.data.tahun})`}
            onRetryMap={() => {
              void geoQuery.refetch()
              void provincesQuery.refetch()
            }}
            provinces={simulatedProvinces}
            provincesByCode={simulatedProvincesByCode}
            summary={simulationMutation.data.ringkasan}
            tableDescription="Klik baris mana pun untuk membuka detail alokasi dan kalimat penjelasan dari hasil simulasi."
            tableTitle="Daftar Rekomendasi Simulasi"
            tahun={simulationMutation.data.tahun}
            tahunParam={tahun}
          />
        </div>
      ) : (
        <Card className="py-6">
          <CardContent className="flex flex-col items-start gap-2 px-6 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Belum ada hasil simulasi yang ditampilkan</p>
            <p className="text-xs leading-relaxed">
              Ubah parameter di atas sesuai skenario yang ingin diuji (atau biarkan nilai default
              untuk memverifikasi kesesuaian dengan rekomendasi resmi), lalu klik{" "}
              <strong className="text-foreground">Jalankan simulasi</strong>.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
