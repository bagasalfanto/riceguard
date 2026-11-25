import { useCallback, useMemo, useState } from "react"
import {
  AlertCircle,
  ArrowDown,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Layers,
  MapPin,
  Minus,
  RotateCcw,
  Search,
  TrendingUp,
  X,
} from "lucide-react"
import { Link, useSearchParams } from "react-router-dom"

import {
  TREND_LINE_COLORS,
  TrendLineChart,
  formatTrendMetricValue,
  type TrendLineDatum,
  type TrendLineSeries,
} from "@/components/charts/TrendLineChart"
import { LimitationBanner } from "@/components/layout/LimitationBanner"
import { BaseMap, MapLegend, ProvinceLayer } from "@/components/map"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useMapLayer, useMapProvinces, useProvincesGeoJSON } from "@/features/map/mapData"
import {
  formatApiErrorDetail,
  useCompare,
  useMetaYears,
  useProvincesList,
  useTrends,
  type CompareProvinceItem,
  type TrendMetric,
} from "@/features/trends/trendsData"
import { formatAngka, formatPersen, formatTon } from "@/lib/format"
import { tampilanStatus } from "@/lib/status"
import { cn } from "@/lib/utils"

const MAX_COMPARE_PROVINCES = 5

const METRIC_OPTIONS: Array<{ id: TrendMetric; label: string; description: string }> = [
  {
    id: "produksi",
    label: "Produksi Beras",
    description: "Total produksi beras tahunan (ton)",
  },
  {
    id: "kebutuhan",
    label: "Kebutuhan Beras",
    description: "Estimasi konsumsi beras tahunan (ton)",
  },
  {
    id: "balance",
    label: "Rice Balance",
    description: "Selisih produksi terhadap kebutuhan (ton)",
  },
  {
    id: "rasio",
    label: "Rasio Swasembada",
    description: "Rasio produksi terhadap kebutuhan (%)",
  },
]

type CompareSortKey =
  | "nama"
  | "produksi_b"
  | "delta_produksi"
  | "delta_produksi_persen"
  | "delta_kebutuhan"
  | "balance_b"
  | "delta_balance"
  | "rasio_b"
  | "delta_rasio"

type SortDirection = "asc" | "desc"

function parseMetricParam(raw: string | null): TrendMetric {
  if (raw === "kebutuhan" || raw === "balance" || raw === "rasio") return raw
  return "produksi"
}

function parseKodeBpsParam(raw: string | null): string[] {
  if (!raw) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const part of raw.split(",")) {
    const code = part.trim()
    if (!code || seen.has(code)) continue
    seen.add(code)
    result.push(code)
  }
  return result
}

function parseYearParam(raw: string | null): number | undefined {
  if (!raw || !/^\d{4}$/.test(raw)) return undefined
  return Number(raw)
}

function formatSignedTon(nilai: number | null | undefined): string {
  if (nilai === null || nilai === undefined || Number.isNaN(nilai)) return "—"
  const prefix = nilai > 0 ? "+" : ""
  return `${prefix}${formatTon(nilai)}`
}

function formatSignedPercent(nilai: number | null | undefined): string {
  if (nilai === null || nilai === undefined || Number.isNaN(nilai)) return "—"
  const prefix = nilai > 0 ? "+" : ""
  return `${prefix}${formatPersen(nilai, 1)}`
}

function formatSignedRatioPoints(nilai: number | null | undefined): string {
  if (nilai === null || nilai === undefined || Number.isNaN(nilai)) return "—"
  const points = nilai * 100
  const prefix = points > 0 ? "+" : points < 0 ? "−" : ""
  return `${prefix}${formatAngka(Math.abs(points), 1)} pp`
}

function StatusIcon({ status }: { status: string }) {
  if (status === "surplus") return <ArrowUpRight aria-hidden="true" className="size-3" />
  if (status === "balanced") return <Minus aria-hidden="true" className="size-3" />
  return <ArrowDownRight aria-hidden="true" className="size-3" />
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return (
      <Badge className="text-[11px] text-muted-foreground" variant="outline">
        —
      </Badge>
    )
  }
  const info = tampilanStatus(status)
  return (
    <Badge className={cn("gap-1 text-[11px]", info.kelas)} variant="outline">
      <StatusIcon status={status} />
      {info.label}
    </Badge>
  )
}

function DeltaPill({
  value,
  text,
}: {
  value: number | null | undefined
  text: string
}) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className="text-xs text-muted-foreground tabular-nums">—</span>
  }
  const positive = value > 0
  const negative = value < 0
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        positive
          ? "text-status-surplus"
          : negative
            ? "text-status-defisit"
            : "text-muted-foreground",
      )}
    >
      {positive ? (
        <ArrowUpRight aria-hidden="true" className="size-3.5" />
      ) : negative ? (
        <ArrowDownRight aria-hidden="true" className="size-3.5" />
      ) : (
        <Minus aria-hidden="true" className="size-3.5" />
      )}
      {text}
    </span>
  )
}

function EmptyState({
  alasan,
  jumlahTahun,
}: {
  alasan: string | null
  jumlahTahun: number
}) {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-10">
      <Card className="text-center">
        <CardHeader className="items-center space-y-2">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-primary">
            <CalendarClock aria-hidden="true" className="size-6" />
          </div>
          <CardTitle className="text-xl">Butuh minimal 2 tahun data</CardTitle>
          <CardDescription className="max-w-lg">
            {alasan
              ? `Status API: ${alasan}. `
              : ""}
            Saat ini terdapat {jumlahTahun} tahun dataset yang terpublikasi. Halaman Historical
            Trends otomatis aktif setelah minimal 2 tahun dataset diterbitkan.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link to="/dashboard">Kembali ke Dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/peta">Buka Rice Map</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cara Mengaktifkan Tren Multi-Tahun</CardTitle>
          <CardDescription>
            Publikasikan minimal dua tahun dataset resmi agar seluruh analitik historis dapat
            ditampilkan.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="font-medium text-foreground">1. Tren Nasional &amp; Regional</div>
            <p className="mt-1 text-xs">
              Grafik garis produksi, kebutuhan, rice balance, dan rasio swasembada nasional serta
              perbandingan hingga 5 provinsi.
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="font-medium text-foreground">2. Peta Historis &amp; Perbandingan</div>
            <p className="mt-1 text-xs">
              Slider tahun peta sebaran status serta perbandingan antar dua tahun beserta daftar
              perubahan status provinsi.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function HistoricalMapSnapshot({
  tahunTersedia,
  selectedYear,
  onSelectYear,
}: {
  tahunTersedia: number[]
  selectedYear: number
  onSelectYear: (tahun: number) => void
}) {
  const [selectedMapProv, setSelectedMapProv] = useState<string | null>(null)
  const geoQuery = useProvincesGeoJSON()
  const provincesQuery = useMapProvinces(selectedYear)
  const layerQuery = useMapLayer("status", selectedYear, provincesQuery.data)

  const provinces = provincesQuery.data ?? []
  const { byCode } = provincesQuery

  const allCodes = useMemo(() => {
    const set = new Set<string>()
    for (const p of provinces) set.add(p.kode_bps)
    return set
  }, [provinces])

  const activeIdx = Math.max(0, tahunTersedia.indexOf(selectedYear))
  const selectedRec = selectedMapProv ? byCode.get(selectedMapProv) ?? null : null
  const mapError = geoQuery.error ?? provincesQuery.error ?? layerQuery.error

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers aria-hidden="true" className="size-4 text-primary" />
              Peta Historis (Snapshot Tahunan)
            </CardTitle>
            <CardDescription className="mt-1">
              Geser slider atau pilih tahun untuk melihat sebaran status neraca beras 38 provinsi.
            </CardDescription>
          </div>
          <Badge className="w-fit text-xs tabular-nums" variant="secondary">
            Snapshot Tahun {selectedYear}
          </Badge>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Button
              aria-label="Tahun sebelumnya"
              disabled={activeIdx <= 0}
              onClick={() => onSelectYear(tahunTersedia[activeIdx - 1])}
              size="icon-sm"
              type="button"
              variant="outline"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </Button>
            <Button
              aria-label="Tahun berikutnya"
              disabled={activeIdx >= tahunTersedia.length - 1}
              onClick={() => onSelectYear(tahunTersedia[activeIdx + 1])}
              size="icon-sm"
              type="button"
              variant="outline"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          </div>

          <div className="flex-1 px-1">
            <Slider
              aria-label="Pilih tahun snapshot peta historis"
              max={Math.max(0, tahunTersedia.length - 1)}
              min={0}
              onValueChange={(vals) => {
                const nextYear = tahunTersedia[vals[0] ?? 0]
                if (nextYear !== undefined) onSelectYear(nextYear)
              }}
              step={1}
              value={[activeIdx]}
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {tahunTersedia.map((yr) => (
              <Button
                key={yr}
                onClick={() => onSelectYear(yr)}
                size="xs"
                type="button"
                variant={yr === selectedYear ? "default" : "outline"}
              >
                {yr}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {mapError ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Gagal memuat peta historis</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              <span>{formatApiErrorDetail(mapError, "Gagal mengambil layer peta.").message}</span>
              <Button
                onClick={() => {
                  void geoQuery.refetch()
                  void provincesQuery.refetch()
                  void layerQuery.refetch()
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                Coba lagi
              </Button>
            </AlertDescription>
          </Alert>
        ) : geoQuery.isLoading || provincesQuery.isLoading || !geoQuery.data ? (
          <Skeleton className="h-[420px] w-full rounded-xl" />
        ) : (
          <BaseMap
            ariaLabel={`Peta historis status neraca beras tahun ${selectedYear}`}
            basemap="satellite"
            className="h-[420px] w-full"
            overlay={<MapLegend layerData={layerQuery.data} />}
          >
            <ProvinceLayer
              geoData={geoQuery.data}
              layerData={layerQuery.data}
              matchingCodes={allCodes}
              onSelectProvince={(kode) => setSelectedMapProv(kode)}
              provincesByCode={byCode}
              selectedCode={selectedMapProv}
            />
          </BaseMap>
        )}

        {selectedRec ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-3.5 py-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <MapPin aria-hidden="true" className="size-3.5 text-primary" />
              <span className="font-semibold">{selectedRec.provinsi}</span>
              <StatusBadge status={selectedRec.status} />
              <span className="text-muted-foreground tabular-nums">
                Balance {selectedYear}: {formatSignedTon(selectedRec.rice_balance_ton)}
              </span>
              <span className="text-muted-foreground tabular-nums">
                Rasio: {formatPersen(selectedRec.rasio_swasembada * 100, 1)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild size="xs" variant="outline">
                <Link to={`/analisis/${selectedRec.kode_bps}?tahun=${selectedYear}`}>
                  Detail provinsi
                </Link>
              </Button>
              <Button
                aria-label="Tutup ringkasan provinsi"
                onClick={() => setSelectedMapProv(null)}
                size="icon-xs"
                type="button"
                variant="ghost"
              >
                <X aria-hidden="true" className="size-3.5" />
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function SortHeadButton({
  label,
  sortKey,
  activeSort,
  activeDir,
  onToggle,
  alignRight = false,
}: {
  label: string
  sortKey: CompareSortKey
  activeSort: CompareSortKey
  activeDir: SortDirection
  onToggle: (key: CompareSortKey) => void
  alignRight?: boolean
}) {
  const isActive = activeSort === sortKey
  return (
    <button
      className={cn(
        "inline-flex items-center gap-1 font-medium transition-colors hover:text-foreground",
        alignRight && "ml-auto flex-row-reverse",
        isActive ? "text-foreground" : "text-muted-foreground",
      )}
      onClick={() => onToggle(sortKey)}
      type="button"
    >
      <span>{label}</span>
      {isActive ? (
        activeDir === "asc" ? (
          <ArrowUp aria-hidden="true" className="size-3.5 text-primary" />
        ) : (
          <ArrowDown aria-hidden="true" className="size-3.5 text-primary" />
        )
      ) : (
        <ArrowUpDown aria-hidden="true" className="size-3 opacity-50" />
      )}
    </button>
  )
}

function getCompareSortValue(item: CompareProvinceItem, key: CompareSortKey): string | number | null {
  switch (key) {
    case "nama":
      return item.nama
    case "produksi_b":
      return item.produksi_b
    case "delta_produksi":
      return item.delta_produksi
    case "delta_produksi_persen":
      return item.delta_produksi_persen
    case "delta_kebutuhan":
      return item.delta_kebutuhan
    case "balance_b":
      return item.balance_b
    case "delta_balance":
      return item.delta_balance
    case "rasio_b":
      return item.rasio_b
    case "delta_rasio":
      return item.delta_rasio
  }
}

export function TrenPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const activeMetric = parseMetricParam(searchParams.get("metric"))
  const selectedCodes = useMemo(
    () => parseKodeBpsParam(searchParams.get("kode_bps")),
    [searchParams],
  )
  const urlMapYear = parseYearParam(searchParams.get("tahun_peta"))
  const urlTahunA = parseYearParam(searchParams.get("tahun_a"))
  const urlTahunB = parseYearParam(searchParams.get("tahun_b"))

  const [provinceSearch, setProvinceSearch] = useState("")
  const [compareSearch, setCompareSearch] = useState("")
  const [onlyStatusChanged, setOnlyStatusChanged] = useState(false)
  const [compareSort, setCompareSort] = useState<CompareSortKey>("delta_balance")
  const [compareDir, setCompareDir] = useState<SortDirection>("desc")

  const updateParams = useCallback(
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

  const metaYearsQuery = useMetaYears()
  const metaYears = metaYearsQuery.data
  const hasTwoYearsMeta = metaYears?.butuh_minimal_2_tahun === false

  const nationalTrendsQuery = useTrends(activeMetric, [], metaYearsQuery.isSuccess)
  const nationalTrends = nationalTrendsQuery.data

  const trendsAvailable =
    hasTwoYearsMeta &&
    nationalTrends !== undefined &&
    !nationalTrends.butuh_minimal_2_tahun &&
    nationalTrends.deret.length >= 2

  const tahunTersedia = useMemo(() => {
    if (nationalTrends?.tahun_tersedia?.length) {
      return [...nationalTrends.tahun_tersedia].sort((a, b) => a - b)
    }
    return (metaYears?.tahun ?? []).map((t) => t.tahun).sort((a, b) => a - b)
  }, [nationalTrends, metaYears])

  const tahunTerbaru = metaYears?.tahun_terbaru ?? tahunTersedia[tahunTersedia.length - 1]
  const activeMapYear =
    urlMapYear && tahunTersedia.includes(urlMapYear)
      ? urlMapYear
      : (tahunTersedia[tahunTersedia.length - 1] ?? 2025)

  const defaultTahunA =
    tahunTersedia.length >= 2 ? tahunTersedia[tahunTersedia.length - 2] : undefined
  const defaultTahunB =
    tahunTersedia.length >= 2 ? tahunTersedia[tahunTersedia.length - 1] : undefined

  const activeTahunA = urlTahunA ?? defaultTahunA
  const activeTahunB = urlTahunB ?? defaultTahunB

  const regionalTrendsQuery = useTrends(
    activeMetric,
    selectedCodes,
    trendsAvailable && selectedCodes.length > 0,
  )
  const provincesListQuery = useProvincesList(tahunTerbaru, trendsAvailable)
  const compareQuery = useCompare(activeTahunA, activeTahunB, trendsAvailable)

  const provincesList = provincesListQuery.data?.items ?? []

  const provinceNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of provincesList) {
      map.set(p.kode_bps, p.provinsi)
    }
    for (const meta of regionalTrendsQuery.data?.provinsi_meta ?? []) {
      map.set(meta.kode_bps, meta.nama)
    }
    return map
  }, [provincesList, regionalTrendsQuery.data])

  const filteredProvinceOptions = useMemo(() => {
    const q = provinceSearch.trim().toLowerCase()
    if (!q) return provincesList
    return provincesList.filter(
      (p) =>
        p.provinsi.toLowerCase().includes(q) ||
        p.pulau.toLowerCase().includes(q) ||
        p.kode_bps.includes(q),
    )
  }, [provincesList, provinceSearch])

  const toggleProvinceCode = (kodeBps: string) => {
    const exists = selectedCodes.includes(kodeBps)
    if (exists) {
      const next = selectedCodes.filter((c) => c !== kodeBps)
      updateParams({ kode_bps: next.length > 0 ? next.join(",") : null })
      return
    }
    if (selectedCodes.length >= MAX_COMPARE_PROVINCES) return
    const next = [...selectedCodes, kodeBps]
    updateParams({ kode_bps: next.join(",") })
  }

  const activeMetricInfo =
    METRIC_OPTIONS.find((m) => m.id === activeMetric) ?? METRIC_OPTIONS[0]

  const nationalChartData: TrendLineDatum[] = useMemo(() => {
    return (nationalTrends?.deret ?? []).map((pt) => ({
      tahun: pt.tahun,
      nasional: pt.nasional,
    }))
  }, [nationalTrends])

  const regionalChartData: TrendLineDatum[] = useMemo(() => {
    return (regionalTrendsQuery.data?.deret ?? []).map((pt) => {
      const row: TrendLineDatum = { tahun: pt.tahun }
      for (const kode of selectedCodes) {
        row[kode] = pt.per_provinsi[kode] ?? null
      }
      return row
    })
  }, [regionalTrendsQuery.data, selectedCodes])

  const regionalSeries: TrendLineSeries[] = useMemo(() => {
    return selectedCodes.map((kode, idx) => ({
      key: kode,
      label: provinceNameMap.get(kode) ?? `BPS ${kode}`,
      color: TREND_LINE_COLORS[idx % TREND_LINE_COLORS.length],
    }))
  }, [selectedCodes, provinceNameMap])

  const handleSelectTahunA = (nextA: number) => {
    let nextB = activeTahunB ?? tahunTersedia[tahunTersedia.length - 1]
    if (nextB === undefined || nextA >= nextB) {
      const validB = tahunTersedia.find((t) => t > nextA)
      if (validB === undefined) return
      nextB = validB
    }
    updateParams({ tahun_a: String(nextA), tahun_b: String(nextB) })
  }

  const handleSelectTahunB = (nextB: number) => {
    let nextA = activeTahunA ?? tahunTersedia[0]
    if (nextA === undefined || nextA >= nextB) {
      const candidates = tahunTersedia.filter((t) => t < nextB)
      if (candidates.length === 0) return
      nextA = candidates[candidates.length - 1]
    }
    updateParams({ tahun_a: String(nextA), tahun_b: String(nextB) })
  }

  const handleSortToggle = (key: CompareSortKey) => {
    if (compareSort === key) {
      setCompareDir((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setCompareSort(key)
      setCompareDir(key === "nama" ? "asc" : "desc")
    }
  }

  const sortedCompareItems = useMemo(() => {
    const compareData = compareQuery.data
    if (!compareData) return []
    const changedSet = new Set(compareData.status_berubah.map((s) => s.kode_bps))
    const q = compareSearch.trim().toLowerCase()

    const filtered = compareData.items.filter((item) => {
      if (onlyStatusChanged && !changedSet.has(item.kode_bps)) return false
      if (!q) return true
      return (
        item.nama.toLowerCase().includes(q) ||
        item.pulau.toLowerCase().includes(q) ||
        item.kode_bps.includes(q)
      )
    })

    return [...filtered].sort((a, b) => {
      const va = getCompareSortValue(a, compareSort)
      const vb = getCompareSortValue(b, compareSort)
      if (va === null && vb === null) return a.nama.localeCompare(b.nama, "id-ID")
      if (va === null) return 1
      if (vb === null) return -1

      let cmp = 0
      if (typeof va === "string" && typeof vb === "string") {
        cmp = va.localeCompare(vb, "id-ID")
      } else {
        cmp = Number(va) - Number(vb)
      }
      return compareDir === "asc" ? cmp : -cmp
    })
  }, [compareQuery.data, compareSearch, onlyStatusChanged, compareSort, compareDir])

  if (metaYearsQuery.isLoading || (hasTwoYearsMeta && nationalTrendsQuery.isLoading)) {
    return (
      <>
        <LimitationBanner />
        <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <Skeleton className="h-80 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </>
    )
  }

  if (metaYearsQuery.error) {
    const err = formatApiErrorDetail(
      metaYearsQuery.error,
      "Gagal memeriksa ketersediaan tahun dataset.",
    )
    return (
      <>
        <LimitationBanner />
        <div className="mx-auto w-full max-w-3xl px-4 py-8">
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Gagal memuat metadata tahun</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <p>{err.message}</p>
                {err.alasan ? <p className="text-xs opacity-90">{err.alasan}</p> : null}
              </div>
              <Button onClick={() => void metaYearsQuery.refetch()} size="sm" variant="outline">
                Coba lagi
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </>
    )
  }

  if (nationalTrendsQuery.error) {
    const err = formatApiErrorDetail(
      nationalTrendsQuery.error,
      "Gagal memuat data tren historis.",
    )
    return (
      <>
        <LimitationBanner />
        <div className="mx-auto w-full max-w-3xl px-4 py-8">
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Gagal memuat data tren</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <p>{err.message}</p>
                {err.alasan ? <p className="text-xs opacity-90">{err.alasan}</p> : null}
              </div>
              <Button onClick={() => void nationalTrendsQuery.refetch()} size="sm" variant="outline">
                Coba lagi
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </>
    )
  }

  const isInsufficientYears =
    !hasTwoYearsMeta ||
    nationalTrends?.butuh_minimal_2_tahun === true ||
    (nationalTrends?.deret.length ?? 0) === 0

  if (isInsufficientYears) {
    return (
      <>
        <LimitationBanner />
        <EmptyState
          alasan={nationalTrends?.alasan ?? null}
          jumlahTahun={metaYears?.jumlah_tahun ?? 0}
        />
      </>
    )
  }

  const compareData = compareQuery.data
  const displayTahunA = compareData?.tahun_a ?? activeTahunA
  const displayTahunB = compareData?.tahun_b ?? activeTahunB
  const regionalError = regionalTrendsQuery.error
    ? formatApiErrorDetail(regionalTrendsQuery.error, "Gagal memuat tren provinsi.")
    : null
  const compareError = compareQuery.error
    ? formatApiErrorDetail(compareQuery.error, "Gagal memuat perbandingan antar tahun.")
    : null

  return (
    <>
      <LimitationBanner />

      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Historical Trends</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pemantauan tren historis dan perbandingan antar tahun ({tahunTersedia.join(" – ")}).
            </p>
          </div>
          <Badge className="w-fit text-xs tabular-nums" variant="secondary">
            {tahunTersedia.length} tahun terpublikasi
          </Badge>
        </div>

        {/* Blok 1: Grafik Tren Nasional */}
        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp aria-hidden="true" className="size-4 text-primary" />
                  Tren Nasional — {activeMetricInfo.label}
                </CardTitle>
                <CardDescription className="mt-1">{activeMetricInfo.description}</CardDescription>
              </div>

              <div
                aria-label="Pilih metrik tren"
                className="flex flex-wrap gap-1.5"
                role="group"
              >
                {METRIC_OPTIONS.map((opt) => (
                  <Button
                    aria-pressed={activeMetric === opt.id}
                    key={opt.id}
                    onClick={() =>
                      updateParams({ metric: opt.id === "produksi" ? null : opt.id })
                    }
                    size="sm"
                    type="button"
                    variant={activeMetric === opt.id ? "default" : "outline"}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            {nationalTrends?.deret.length ? (
              <div className="flex flex-wrap gap-2">
                {nationalTrends.deret.map((pt) => (
                  <Badge className="text-xs tabular-nums" key={pt.tahun} variant="outline">
                    {pt.tahun}: {formatTrendMetricValue(pt.nasional, activeMetric)}
                  </Badge>
                ))}
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="px-2 sm:px-4">
            <TrendLineChart
              ariaLabel={`Grafik tren nasional ${activeMetricInfo.label}`}
              data={nationalChartData}
              metric={activeMetric}
              series={[
                {
                  key: "nasional",
                  label: `Nasional (${activeMetricInfo.label})`,
                  color: "var(--primary)",
                },
              ]}
            />
          </CardContent>
        </Card>

        {/* Blok 2: Perbandingan Tren Regional (hingga 5 provinsi) */}
        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 aria-hidden="true" className="size-4 text-primary" />
                  Regional Trend Comparison
                </CardTitle>
                <CardDescription className="mt-1">
                  Pilih hingga {MAX_COMPARE_PROVINCES} provinsi untuk membandingkan tren{" "}
                  {activeMetricInfo.label.toLowerCase()}. Garis terputus menunjukkan data provinsi
                  tidak tersedia pada tahun tersebut.
                </CardDescription>
              </div>
              <Badge
                className="w-fit text-xs tabular-nums"
                variant={selectedCodes.length >= MAX_COMPARE_PROVINCES ? "default" : "secondary"}
              >
                {selectedCodes.length} / {MAX_COMPARE_PROVINCES} provinsi
              </Badge>
            </div>

            {selectedCodes.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {selectedCodes.map((kode, idx) => (
                  <Badge
                    className="gap-1.5 pr-1 text-xs"
                    key={kode}
                    variant="secondary"
                  >
                    <span
                      aria-hidden="true"
                      className="size-2.5 rounded-full"
                      style={{
                        backgroundColor: TREND_LINE_COLORS[idx % TREND_LINE_COLORS.length],
                      }}
                    />
                    <span>{provinceNameMap.get(kode) ?? `BPS ${kode}`}</span>
                    <button
                      aria-label={`Hapus ${provinceNameMap.get(kode) ?? kode}`}
                      className="rounded-full p-0.5 hover:bg-muted"
                      onClick={() => toggleProvinceCode(kode)}
                      type="button"
                    >
                      <X aria-hidden="true" className="size-3" />
                    </button>
                  </Badge>
                ))}
                <Button
                  className="h-6 px-2 text-xs"
                  onClick={() => updateParams({ kode_bps: null })}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  Hapus semua
                </Button>
              </div>
            ) : null}
          </CardHeader>

          <CardContent className="grid gap-4 lg:grid-cols-[18rem_1fr]">
            {/* Pemilih Multi-Provinsi */}
            <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  aria-label="Cari provinsi untuk dibandingkan"
                  className="h-8 pr-7 pl-8 text-xs"
                  onChange={(e) => setProvinceSearch(e.target.value)}
                  placeholder="Cari provinsi..."
                  type="text"
                  value={provinceSearch}
                />
                {provinceSearch ? (
                  <button
                    aria-label="Hapus pencarian provinsi"
                    className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setProvinceSearch("")}
                    type="button"
                  >
                    <X aria-hidden="true" className="size-3.5" />
                  </button>
                ) : null}
              </div>

              {selectedCodes.length >= MAX_COMPARE_PROVINCES ? (
                <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  Maksimal {MAX_COMPARE_PROVINCES} provinsi tercapai. Hapus salah satu untuk memilih
                  provinsi lain.
                </p>
              ) : null}

              <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                {provincesListQuery.isLoading ? (
                  <div className="space-y-1.5">
                    {[0, 1, 2, 3, 4].map((idx) => (
                      <Skeleton className="h-7 w-full" key={idx} />
                    ))}
                  </div>
                ) : provincesListQuery.error ? (
                  <div className="space-y-2 p-1 text-xs text-destructive">
                    <p>Gagal memuat daftar provinsi.</p>
                    <Button
                      onClick={() => void provincesListQuery.refetch()}
                      size="xs"
                      type="button"
                      variant="outline"
                    >
                      Coba lagi
                    </Button>
                  </div>
                ) : filteredProvinceOptions.length === 0 ? (
                  <p className="p-2 text-xs text-muted-foreground">Provinsi tidak ditemukan.</p>
                ) : (
                  filteredProvinceOptions.map((prov) => {
                    const checked = selectedCodes.includes(prov.kode_bps)
                    const disabled =
                      !checked && selectedCodes.length >= MAX_COMPARE_PROVINCES
                    const colorIdx = selectedCodes.indexOf(prov.kode_bps)

                    return (
                      <label
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
                          disabled
                            ? "cursor-not-allowed opacity-50"
                            : "cursor-pointer hover:bg-accent/70",
                          checked && "bg-primary/10 font-medium",
                        )}
                        key={prov.kode_bps}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <input
                            checked={checked}
                            className="size-3.5 shrink-0 accent-primary"
                            disabled={disabled}
                            onChange={() => toggleProvinceCode(prov.kode_bps)}
                            type="checkbox"
                          />
                          <span className="truncate">{prov.provinsi}</span>
                        </span>
                        {checked ? (
                          <span
                            aria-hidden="true"
                            className="size-2.5 shrink-0 rounded-full"
                            style={{
                              backgroundColor:
                                TREND_LINE_COLORS[colorIdx % TREND_LINE_COLORS.length],
                            }}
                          />
                        ) : (
                          <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                            {prov.kode_bps}
                          </span>
                        )}
                      </label>
                    )
                  })
                )}
              </div>
            </div>

            {/* Area Grafik Regional */}
            <div className="min-w-0">
              {selectedCodes.length === 0 ? (
                <div className="flex h-80 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 p-6 text-center">
                  <BarChart3 aria-hidden="true" className="size-8 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Belum ada provinsi yang dipilih</p>
                    <p className="max-w-md text-xs text-muted-foreground">
                      Centang hingga {MAX_COMPARE_PROVINCES} provinsi di panel kiri untuk
                      membandingkan lintasan historisnya.
                    </p>
                  </div>
                  {provincesList.length > 0 ? (
                    <Button
                      onClick={() => {
                        const sample = provincesList.slice(0, 3).map((p) => p.kode_bps)
                        if (sample.length > 0) {
                          updateParams({ kode_bps: sample.join(",") })
                        }
                      }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Pilih 3 provinsi contoh
                    </Button>
                  ) : null}
                </div>
              ) : regionalError ? (
                <Alert variant="destructive">
                  <AlertCircle aria-hidden="true" />
                  <AlertTitle>Gagal memuat tren regional</AlertTitle>
                  <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-1">
                      <p>{regionalError.message}</p>
                      {regionalError.alasan ? (
                        <p className="text-xs opacity-90">{regionalError.alasan}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => void regionalTrendsQuery.refetch()}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Coba lagi
                      </Button>
                      <Button
                        onClick={() => updateParams({ kode_bps: null })}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Reset pilihan
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : regionalTrendsQuery.isLoading ? (
                <Skeleton className="h-80 w-full rounded-xl" />
              ) : (
                <TrendLineChart
                  ariaLabel={`Perbandingan tren ${activeMetricInfo.label} antar provinsi`}
                  data={regionalChartData}
                  metric={activeMetric}
                  series={regionalSeries}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Blok 3: Peta Historis */}
        <HistoricalMapSnapshot
          onSelectYear={(yr) =>
            updateParams({
              tahun_peta:
                yr === tahunTersedia[tahunTersedia.length - 1] ? null : String(yr),
            })
          }
          selectedYear={activeMapYear}
          tahunTersedia={tahunTersedia}
        />

        {/* Blok 4: Perbandingan Antar Tahun (Year-to-Year Comparison) */}
        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ArrowLeftRight aria-hidden="true" className="size-4 text-primary" />
                  Year-to-Year Comparison
                </CardTitle>
                <CardDescription className="mt-1">
                  Bandingkan ringkasan nasional, perubahan status provinsi, dan selisih angka antar
                  dua tahun terpublikasi.
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <label className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Tahun A:</span>
                  <select
                    aria-label="Pilih Tahun A untuk perbandingan"
                    className="h-8 rounded-md border bg-background px-2 text-xs text-foreground"
                    onChange={(e) => handleSelectTahunA(Number(e.target.value))}
                    value={activeTahunA ?? ""}
                  >
                    {tahunTersedia.map((t) => (
                      <option
                        disabled={t >= tahunTersedia[tahunTersedia.length - 1]}
                        key={t}
                        value={t}
                      >
                        {t}
                      </option>
                    ))}
                  </select>
                </label>

                <ArrowRight aria-hidden="true" className="size-3.5 text-muted-foreground" />

                <label className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Tahun B:</span>
                  <select
                    aria-label="Pilih Tahun B untuk perbandingan"
                    className="h-8 rounded-md border bg-background px-2 text-xs text-foreground"
                    onChange={(e) => handleSelectTahunB(Number(e.target.value))}
                    value={activeTahunB ?? ""}
                  >
                    {tahunTersedia.map((t) => (
                      <option
                        disabled={t <= tahunTersedia[0]}
                        key={t}
                        value={t}
                      >
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {compareError ? (
              <Alert variant="destructive">
                <AlertCircle aria-hidden="true" />
                <AlertTitle>Gagal memuat perbandingan tahun</AlertTitle>
                <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    <p>{compareError.message}</p>
                    {compareError.alasan ? (
                      <p className="text-xs opacity-90">{compareError.alasan}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => void compareQuery.refetch()}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Coba lagi
                    </Button>
                    {(urlTahunA !== undefined || urlTahunB !== undefined) ? (
                      <Button
                        onClick={() => updateParams({ tahun_a: null, tahun_b: null })}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <RotateCcw aria-hidden="true" className="size-3.5" />
                        Reset tahun
                      </Button>
                    ) : null}
                  </div>
                </AlertDescription>
              </Alert>
            ) : compareQuery.isLoading || !compareData ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[0, 1, 2, 3].map((idx) => (
                    <Skeleton className="h-24 w-full rounded-xl" key={idx} />
                  ))}
                </div>
                <Skeleton className="h-64 w-full rounded-xl" />
              </div>
            ) : !compareData.nasional ? (
              <Alert>
                <AlertCircle aria-hidden="true" />
                <AlertTitle>Data perbandingan belum tersedia</AlertTitle>
                <AlertDescription>
                  {compareData.alasan ?? "Butuh minimal 2 tahun data untuk membandingkan."}
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {/* 4 Kartu Delta Ringkasan Nasional */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Card className="gap-1.5 py-4">
                    <CardHeader className="px-4">
                      <CardDescription>Produksi Nasional ({displayTahunB})</CardDescription>
                      <CardTitle className="text-lg tabular-nums">
                        {formatTon(compareData.nasional.produksi_b)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 px-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <DeltaPill
                          text={formatSignedTon(compareData.nasional.delta_produksi)}
                          value={compareData.nasional.delta_produksi}
                        />
                        {compareData.nasional.delta_produksi_persen !== null ? (
                          <Badge className="text-[11px] tabular-nums" variant="secondary">
                            {formatSignedPercent(compareData.nasional.delta_produksi_persen)}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {displayTahunA}: {formatTon(compareData.nasional.produksi_a)}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="gap-1.5 py-4">
                    <CardHeader className="px-4">
                      <CardDescription>Kebutuhan Nasional ({displayTahunB})</CardDescription>
                      <CardTitle className="text-lg tabular-nums">
                        {formatTon(compareData.nasional.kebutuhan_b)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 px-4">
                      <DeltaPill
                        text={formatSignedTon(compareData.nasional.delta_kebutuhan)}
                        value={compareData.nasional.delta_kebutuhan}
                      />
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {displayTahunA}: {formatTon(compareData.nasional.kebutuhan_a)}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="gap-1.5 py-4">
                    <CardHeader className="px-4">
                      <CardDescription>Rice Balance ({displayTahunB})</CardDescription>
                      <CardTitle className="text-lg tabular-nums">
                        {formatSignedTon(compareData.nasional.balance_b)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 px-4">
                      <DeltaPill
                        text={formatSignedTon(compareData.nasional.delta_balance)}
                        value={compareData.nasional.delta_balance}
                      />
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {displayTahunA}: {formatSignedTon(compareData.nasional.balance_a)}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="gap-1.5 py-4">
                    <CardHeader className="px-4">
                      <CardDescription>Status Provinsi ({displayTahunB})</CardDescription>
                      <CardTitle className="text-lg tabular-nums">
                        {compareData.nasional.surplus_count_b} /{" "}
                        {compareData.nasional.balanced_count_b} /{" "}
                        {compareData.nasional.defisit_count_b}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 px-4 text-xs text-muted-foreground">
                      <div>Surplus / Balanced / Defisit</div>
                      <div className="tabular-nums">
                        {displayTahunA}: {compareData.nasional.surplus_count_a} /{" "}
                        {compareData.nasional.balanced_count_a} /{" "}
                        {compareData.nasional.defisit_count_a}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Daftar Perubahan Status */}
                <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold">
                        Perubahan Status ({displayTahunA} → {displayTahunB})
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Provinsi yang berpindah kategori swasembada antar kedua tahun.
                      </p>
                    </div>
                    <Badge className="text-xs tabular-nums" variant="secondary">
                      {compareData.status_berubah.length} provinsi berubah
                    </Badge>
                  </div>

                  {compareData.status_berubah.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Tidak ada perubahan status provinsi antara tahun {displayTahunA} dan{" "}
                      {displayTahunB}.
                    </p>
                  ) : (
                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {compareData.status_berubah.map((chg) => (
                        <div
                          className="flex flex-col gap-2 rounded-lg border bg-card p-3"
                          key={chg.kode_bps}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              className="text-sm font-medium hover:text-primary hover:underline"
                              to={`/analisis/${chg.kode_bps}${displayTahunB ? `?tahun=${displayTahunB}` : ""}`}
                            >
                              {chg.nama}
                            </Link>
                            <span className="text-[11px] text-muted-foreground tabular-nums">
                              {chg.kode_bps}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusBadge status={chg.status_a} />
                            <ArrowRight
                              aria-hidden="true"
                              className="size-3.5 text-muted-foreground"
                            />
                            <StatusBadge status={chg.status_b} />
                          </div>
                          <div className="flex flex-wrap justify-between gap-2 border-t pt-2 text-[11px] text-muted-foreground tabular-nums">
                            <span>Δ Prod: {formatSignedTon(chg.delta_produksi)}</span>
                            <span>Δ Bal: {formatSignedTon(chg.delta_balance)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tabel Perbandingan Provinsi */}
                <div className="space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:w-72">
                      <Search
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                      />
                      <Input
                        aria-label="Cari provinsi di tabel perbandingan"
                        className="h-8 pr-7 pl-8 text-xs"
                        onChange={(e) => setCompareSearch(e.target.value)}
                        placeholder="Cari provinsi, pulau, atau BPS..."
                        type="text"
                        value={compareSearch}
                      />
                      {compareSearch ? (
                        <button
                          aria-label="Hapus pencarian perbandingan"
                          className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setCompareSearch("")}
                          type="button"
                        >
                          <X aria-hidden="true" className="size-3.5" />
                        </button>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        aria-pressed={onlyStatusChanged}
                        onClick={() => setOnlyStatusChanged((v) => !v)}
                        size="sm"
                        type="button"
                        variant={onlyStatusChanged ? "default" : "outline"}
                      >
                        Hanya status berubah ({compareData.status_berubah.length})
                      </Button>
                      <Badge className="text-xs tabular-nums" variant="secondary">
                        {sortedCompareItems.length} / {compareData.items.length} provinsi
                      </Badge>
                    </div>
                  </div>

                  {sortedCompareItems.length === 0 ? (
                    <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                      Tidak ada provinsi yang sesuai filter pencarian.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>
                              <SortHeadButton
                                activeDir={compareDir}
                                activeSort={compareSort}
                                label="Provinsi"
                                onToggle={handleSortToggle}
                                sortKey="nama"
                              />
                            </TableHead>
                            <TableHead>
                              Status ({displayTahunA} → {displayTahunB})
                            </TableHead>
                            <TableHead className="text-right">
                              <SortHeadButton
                                activeDir={compareDir}
                                activeSort={compareSort}
                                alignRight
                                label={`Prod ${displayTahunB}`}
                                onToggle={handleSortToggle}
                                sortKey="produksi_b"
                              />
                            </TableHead>
                            <TableHead className="text-right">
                              <SortHeadButton
                                activeDir={compareDir}
                                activeSort={compareSort}
                                alignRight
                                label="Δ Produksi"
                                onToggle={handleSortToggle}
                                sortKey="delta_produksi"
                              />
                            </TableHead>
                            <TableHead className="text-right">
                              <SortHeadButton
                                activeDir={compareDir}
                                activeSort={compareSort}
                                alignRight
                                label="Δ Prod %"
                                onToggle={handleSortToggle}
                                sortKey="delta_produksi_persen"
                              />
                            </TableHead>
                            <TableHead className="text-right">
                              <SortHeadButton
                                activeDir={compareDir}
                                activeSort={compareSort}
                                alignRight
                                label="Δ Kebutuhan"
                                onToggle={handleSortToggle}
                                sortKey="delta_kebutuhan"
                              />
                            </TableHead>
                            <TableHead className="text-right">
                              <SortHeadButton
                                activeDir={compareDir}
                                activeSort={compareSort}
                                alignRight
                                label={`Bal ${displayTahunB}`}
                                onToggle={handleSortToggle}
                                sortKey="balance_b"
                              />
                            </TableHead>
                            <TableHead className="text-right">
                              <SortHeadButton
                                activeDir={compareDir}
                                activeSort={compareSort}
                                alignRight
                                label="Δ Balance"
                                onToggle={handleSortToggle}
                                sortKey="delta_balance"
                              />
                            </TableHead>
                            <TableHead className="text-right">
                              <SortHeadButton
                                activeDir={compareDir}
                                activeSort={compareSort}
                                alignRight
                                label={`Rasio ${displayTahunB}`}
                                onToggle={handleSortToggle}
                                sortKey="rasio_b"
                              />
                            </TableHead>
                            <TableHead className="text-right">
                              <SortHeadButton
                                activeDir={compareDir}
                                activeSort={compareSort}
                                alignRight
                                label="Δ Rasio"
                                onToggle={handleSortToggle}
                                sortKey="delta_rasio"
                              />
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedCompareItems.map((item) => (
                            <TableRow key={item.kode_bps}>
                              <TableCell>
                                <Link
                                  className="group inline-flex flex-col hover:underline"
                                  to={`/analisis/${item.kode_bps}${displayTahunB ? `?tahun=${displayTahunB}` : ""}`}
                                >
                                  <span className="font-medium group-hover:text-primary">
                                    {item.nama}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground">
                                    {item.pulau} &middot; BPS {item.kode_bps}
                                  </span>
                                </Link>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <StatusBadge status={item.status_a} />
                                  <ArrowRight
                                    aria-hidden="true"
                                    className="size-3 shrink-0 text-muted-foreground"
                                  />
                                  <StatusBadge status={item.status_b} />
                                </div>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatTon(item.produksi_b)}
                              </TableCell>
                              <TableCell className="text-right">
                                <DeltaPill
                                  text={formatSignedTon(item.delta_produksi)}
                                  value={item.delta_produksi}
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <DeltaPill
                                  text={formatSignedPercent(item.delta_produksi_persen)}
                                  value={item.delta_produksi_persen}
                                />
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatSignedTon(item.delta_kebutuhan)}
                              </TableCell>
                              <TableCell className="text-right font-medium tabular-nums">
                                {formatSignedTon(item.balance_b)}
                              </TableCell>
                              <TableCell className="text-right">
                                <DeltaPill
                                  text={formatSignedTon(item.delta_balance)}
                                  value={item.delta_balance}
                                />
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {item.rasio_b !== null
                                  ? formatPersen(item.rasio_b * 100, 1)
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                <DeltaPill
                                  text={formatSignedRatioPoints(item.delta_rasio)}
                                  value={item.delta_rasio}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
