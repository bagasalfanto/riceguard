import { useMemo } from "react"
import { AlertCircle, CheckCircle2, ExternalLink, Grid3X3, ListOrdered, Ruler } from "lucide-react"
import { Link } from "react-router-dom"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  useDistanceMatrix,
  useDistributionSuppliers,
  type DeficitProvinceItem,
  type RecommendationItem,
  type SurplusProvinceItem,
} from "@/features/distribution/distributionData"
import { formatAngka, formatKm, formatTon } from "@/lib/format"
import { cn } from "@/lib/utils"

export interface DistanceMatrixProps {
  defisitList: DeficitProvinceItem[]
  surplusList: SurplusProvinceItem[]
  selectedDeficitCode: string
  onSelectDeficit: (kodeBps: string) => void
  recommendations: RecommendationItem[]
  tahun?: number
}

function heatCellStyle(km: number, minKm: number, maxKm: number): React.CSSProperties {
  if (!Number.isFinite(km) || maxKm <= minKm) return {}
  const ratio = Math.min(1, Math.max(0, (km - minKm) / (maxKm - minKm)))
  if (ratio < 0.35) {
    const strength = Math.round((1 - ratio / 0.35) * 26 + 8)
    return {
      backgroundColor: `color-mix(in oklch, var(--status-surplus) ${strength}%, transparent)`,
    }
  }
  if (ratio < 0.7) {
    const strength = Math.round(((ratio - 0.35) / 0.35) * 18 + 6)
    return {
      backgroundColor: `color-mix(in oklch, var(--status-balanced) ${strength}%, transparent)`,
    }
  }
  const strength = Math.round(((ratio - 0.7) / 0.3) * 20 + 10)
  return {
    backgroundColor: `color-mix(in oklch, var(--status-defisit) ${strength}%, transparent)`,
  }
}

export function DistanceMatrix({
  defisitList,
  surplusList,
  selectedDeficitCode,
  onSelectDeficit,
  recommendations,
  tahun,
}: DistanceMatrixProps) {
  const tahunSuffix = tahun ? `?tahun=${tahun}` : ""

  const suppliersQuery = useDistributionSuppliers(selectedDeficitCode, tahun)
  const matrixQuery = useDistanceMatrix(tahun)

  const deficitByCode = useMemo(() => {
    const map = new Map<string, DeficitProvinceItem>()
    for (const item of defisitList) map.set(item.kode_bps, item)
    return map
  }, [defisitList])

  const surplusByCode = useMemo(() => {
    const map = new Map<string, SurplusProvinceItem>()
    for (const item of surplusList) map.set(item.kode_bps, item)
    return map
  }, [surplusList])

  const recommendedPairs = useMemo(() => {
    const set = new Set<string>()
    for (const rec of recommendations) {
      set.add(`${rec.dari_kode}->${rec.ke_kode}`)
    }
    return set
  }, [recommendations])

  const { minKm, maxKm } = useMemo(() => {
    const rows = matrixQuery.data?.jarak_km ?? []
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    for (const row of rows) {
      for (const val of row) {
        if (val < min) min = val
        if (val > max) max = val
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return { minKm: 0, maxKm: 0 }
    }
    return { minKm: min, maxKm: max }
  }, [matrixQuery.data])

  if (defisitList.length === 0 || surplusList.length === 0) {
    return (
      <Card className="py-4" id="matriks-jarak">
        <CardHeader className="px-4">
          <CardTitle className="text-base">Matriks Jarak &amp; Kandidat Pemasok</CardTitle>
          <CardDescription>
            Tidak ada pasangan provinsi surplus dan defisit untuk disusun ke matriks jarak.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const suppliersData = suppliersQuery.data
  const matrixData = matrixQuery.data

  return (
    <section aria-label="Matriks jarak garis lurus dan peringkat pemasok" className="space-y-4" id="matriks-jarak">
      {/* 1. Selector Defisit + Peringkat Pemasok Terurut Jarak */}
      <Card className="gap-4 overflow-hidden py-4">
        <CardHeader className="px-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ListOrdered aria-hidden="true" className="size-4 text-primary" />
                Kandidat Pemasok Terurut Jarak Garis Lurus
              </CardTitle>
              <CardDescription className="mt-1">
                Daftar seluruh {surplusList.length} provinsi surplus diurutkan dari jarak garis
                lurus terdekat menuju provinsi defisit terpilih.
              </CardDescription>
            </div>

            <label className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:gap-2">
              <span className="font-medium text-muted-foreground">Provinsi defisit:</span>
              <select
                aria-label="Pilih provinsi defisit untuk melihat peringkat pemasok"
                className="h-9 min-w-[240px] rounded-md border bg-background px-2.5 text-xs font-medium text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                onChange={(e) => onSelectDeficit(e.target.value)}
                value={selectedDeficitCode}
              >
                {defisitList.map((d) => (
                  <option key={d.kode_bps} value={d.kode_bps}>
                    #{d.prioritas} {d.provinsi} (defisit {formatTon(d.defisit_ton)})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {suppliersData ? (
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/35 px-3 py-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-foreground">
                  {suppliersData.penerima.provinsi}
                </span>
                <span className="text-muted-foreground">
                  {suppliersData.penerima.pulau} &middot; BPS {suppliersData.penerima.kode_bps}
                </span>
                <Badge
                  className="border-status-defisit/40 bg-status-defisit/10 text-status-defisit tabular-nums"
                  variant="outline"
                >
                  Defisit {formatTon(suppliersData.penerima.defisit_ton, 2)}
                </Badge>
                <Badge className="tabular-nums" variant="secondary">
                  Terpenuhi {formatTon(suppliersData.penerima.terpenuhi_ton, 2)}
                </Badge>
              </div>
              <Link
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                to={`/analisis/${suppliersData.penerima.kode_bps}${tahunSuffix}`}
              >
                Buka detail provinsi
                <ExternalLink aria-hidden="true" className="size-3" />
              </Link>
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="px-0">
          {suppliersQuery.error ? (
            <div className="px-4">
              <Alert variant="destructive">
                <AlertCircle aria-hidden="true" />
                <AlertTitle>Gagal memuat daftar pemasok</AlertTitle>
                <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {suppliersQuery.error instanceof Error
                      ? suppliersQuery.error.message
                      : "Terjadi kesalahan saat mengambil kandidat pemasok."}
                  </span>
                  <Button
                    onClick={() => void suppliersQuery.refetch()}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Coba lagi
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          ) : suppliersQuery.isLoading || !suppliersData ? (
            <div className="space-y-2 px-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : suppliersData.items.length === 0 ? (
            <div className="mx-4 rounded-lg border bg-muted/35 p-4 text-xs text-muted-foreground">
              Tidak ada kandidat pemasok surplus yang tersedia untuk provinsi ini.
            </div>
          ) : (
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 pl-4">#</TableHead>
                  <TableHead>Pemasok (Surplus)</TableHead>
                  <TableHead className="text-right">Jarak Garis Lurus</TableHead>
                  <TableHead>Koneksi</TableHead>
                  <TableHead className="text-right">Total Surplus</TableHead>
                  <TableHead className="text-right">Sisa Surplus</TableHead>
                  <TableHead className="pr-4 text-right">Status di Rekomendasi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliersData.items.map((item, idx) => (
                  <TableRow
                    className={cn(item.dipakai_di_rekomendasi && "bg-primary/5 hover:bg-primary/10")}
                    key={item.kode_bps}
                  >
                    <TableCell className="pl-4 text-muted-foreground tabular-nums">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      <Link
                        className="group inline-flex flex-col hover:underline"
                        to={`/analisis/${item.kode_bps}${tahunSuffix}`}
                      >
                        <span className="font-medium text-foreground group-hover:text-primary">
                          {item.provinsi}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {item.pulau} &middot; BPS {item.kode_bps}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatKm(item.jarak_km, 1)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.satu_pulau ? "secondary" : "outline"}>
                        {item.satu_pulau ? "Satu pulau" : "Lintas pulau"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatTon(item.surplus_ton)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        item.sisa_ton <= 0.01
                          ? "text-muted-foreground"
                          : "font-medium text-status-surplus",
                      )}
                    >
                      {formatTon(item.sisa_ton)}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      {item.dipakai_di_rekomendasi ? (
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <Badge
                            className="gap-1 border-status-surplus/40 bg-status-surplus/10 text-status-surplus tabular-nums"
                            variant="outline"
                          >
                            <CheckCircle2 aria-hidden="true" className="size-3" />
                            Dipakai ({formatTon(item.alokasi_ton)})
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Tidak dipakai</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 2. Heatmap Matriks Jarak 20 x 17 */}
      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Grid3X3 aria-hidden="true" className="size-4 text-primary" />
                Matriks Jarak Garis Lurus ({defisitList.length} Defisit &times;{" "}
                {surplusList.length} Surplus)
              </CardTitle>
              <CardDescription className="mt-1">
                Satuan km (1 desimal). Klik baris provinsi defisit untuk memuat peringkat pemasok di
                atas. Sel berbingkai menandakan pasangan pada rekomendasi resmi.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className="size-3 rounded-xs border"
                  style={heatCellStyle(minKm, minKm, maxKm)}
                />
                Dekat ({formatKm(minKm, 1)})
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className="size-3 rounded-xs border"
                  style={heatCellStyle((minKm + maxKm) / 2, minKm, maxKm)}
                />
                Sedang
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className="size-3 rounded-xs border"
                  style={heatCellStyle(maxKm, minKm, maxKm)}
                />
                Jauh ({formatKm(maxKm, 1)})
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className="size-3 rounded-xs border-2 border-primary bg-primary/15"
                />
                Pasangan resmi
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-4">
          {matrixQuery.error ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Gagal memuat matriks jarak</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {matrixQuery.error instanceof Error
                    ? matrixQuery.error.message
                    : "Terjadi kesalahan saat mengambil matriks jarak."}
                </span>
                <Button
                  onClick={() => void matrixQuery.refetch()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Coba lagi
                </Button>
              </AlertDescription>
            </Alert>
          ) : matrixQuery.isLoading || !matrixData ? (
            <Skeleton className="h-80 w-full rounded-lg" />
          ) : matrixData.baris.length === 0 || matrixData.kolom.length === 0 ? (
            <div className="rounded-lg border bg-muted/35 p-4 text-xs text-muted-foreground">
              Matriks jarak belum tersedia untuk tahun ini.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative w-full overflow-x-auto rounded-lg border">
                <table
                  aria-label={`Matriks jarak garis lurus ${matrixData.baris.length} provinsi defisit terhadap ${matrixData.kolom.length} provinsi surplus`}
                  className="w-full border-collapse text-[11px]"
                >
                  <thead>
                    <tr className="border-b bg-muted/60">
                      <th
                        className="sticky left-0 z-20 min-w-[190px] border-r bg-muted px-2.5 py-2 text-left font-semibold text-foreground"
                        scope="col"
                      >
                        <span className="inline-flex items-center gap-1">
                          <Ruler aria-hidden="true" className="size-3 text-primary" />
                          Defisit &darr; / Surplus &rarr; ({matrixData.satuan})
                        </span>
                      </th>
                      {matrixData.kolom.map((surplusKode) => {
                        const sup = surplusByCode.get(surplusKode)
                        return (
                          <th
                            className="min-w-[82px] border-r px-1.5 py-2 text-right font-medium text-foreground last:border-r-0"
                            key={surplusKode}
                            scope="col"
                            title={
                              sup
                                ? `${sup.provinsi} (Surplus ${formatTon(sup.rice_balance_ton)})`
                                : surplusKode
                            }
                          >
                            <div className="truncate max-w-[82px]">
                              {sup?.provinsi ?? surplusKode}
                            </div>
                            <div className="text-[10px] font-normal text-muted-foreground tabular-nums">
                              BPS {surplusKode}
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixData.baris.map((defisitKode, rowIdx) => {
                      const def = deficitByCode.get(defisitKode)
                      const isSelected = defisitKode === selectedDeficitCode
                      const rowDistances = matrixData.jarak_km[rowIdx] ?? []

                      return (
                        <tr
                          aria-selected={isSelected}
                          className={cn(
                            "cursor-pointer border-b transition-colors last:border-b-0 hover:bg-accent/50",
                            isSelected && "ring-1 ring-inset ring-primary/60",
                          )}
                          key={defisitKode}
                          onClick={() => onSelectDeficit(defisitKode)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              onSelectDeficit(defisitKode)
                            }
                          }}
                          tabIndex={0}
                        >
                          <th
                            className={cn(
                              "sticky left-0 z-10 border-r px-2.5 py-1.5 text-left font-medium whitespace-nowrap",
                              isSelected ? "bg-primary/15 text-foreground" : "bg-card text-foreground",
                            )}
                            scope="row"
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
                                  isSelected
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground",
                                )}
                              >
                                {def?.prioritas ?? rowIdx + 1}
                              </span>
                              <span className="truncate max-w-[140px]">
                                {def?.provinsi ?? defisitKode}
                              </span>
                            </div>
                          </th>

                          {matrixData.kolom.map((surplusKode, colIdx) => {
                            const km = rowDistances[colIdx]
                            const isOfficialPair = recommendedPairs.has(
                              `${surplusKode}->${defisitKode}`,
                            )
                            const supName = surplusByCode.get(surplusKode)?.provinsi ?? surplusKode
                            const defName = def?.provinsi ?? defisitKode

                            return (
                              <td
                                className={cn(
                                  "border-r px-1.5 py-1.5 text-right tabular-nums last:border-r-0",
                                  isOfficialPair &&
                                    "font-semibold text-foreground ring-2 ring-inset ring-primary",
                                  isSelected && !isOfficialPair && "font-medium",
                                )}
                                key={`${defisitKode}-${surplusKode}`}
                                style={
                                  typeof km === "number"
                                    ? heatCellStyle(km, minKm, maxKm)
                                    : undefined
                                }
                                title={`${supName} → ${defName}: ${formatKm(km, 1)} (jarak garis lurus)${isOfficialPair ? " · Pasangan alokasi resmi" : ""}`}
                              >
                                {typeof km === "number" ? formatAngka(km, 1) : "—"}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Geser tabel ke samping untuk melihat seluruh {matrixData.kolom.length} kolom
                provinsi surplus.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
