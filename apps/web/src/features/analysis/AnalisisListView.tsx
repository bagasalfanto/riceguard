import { useCallback, useEffect, useMemo, useState } from "react"
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  AlertCircle,
  ArrowDown,
  ArrowDownRight,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  Minus,
  RotateCcw,
  Search,
  X,
} from "lucide-react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  useAnalysisProvinces,
  useAnalysisRankings,
  usePulauOptions,
  type AnalysisRankingBy,
  type AnalysisSortField,
  type SortOrder,
} from "@/features/analysis/analysisData"
import { useTahun } from "@/hooks/useTahun"
import { formatAngka, formatJiwa, formatPersen, formatTon } from "@/lib/format"
import { SEMUA_STATUS, tampilanStatus, type StatusProvinsi } from "@/lib/status"
import type { ProvinceItem } from "@/lib/tipe-api"
import { cn } from "@/lib/utils"

const VALID_SORT = new Set<AnalysisSortField>([
  "provinsi",
  "penduduk",
  "produksi",
  "kebutuhan",
  "balance",
  "rasio",
  "peringkat",
])

const RANKING_OPTIONS: Array<{ id: AnalysisRankingBy; label: string }> = [
  { id: "produksi", label: "Produksi tertinggi" },
  { id: "kebutuhan", label: "Kebutuhan terbesar" },
  { id: "balance", label: "Rice Balance tertinggi" },
]

function parseSort(raw: string | null): AnalysisSortField {
  if (raw && VALID_SORT.has(raw as AnalysisSortField)) return raw as AnalysisSortField
  return "peringkat"
}

function parseOrder(raw: string | null, sort: AnalysisSortField): SortOrder {
  if (raw === "asc" || raw === "desc") return raw
  return sort === "provinsi" ? "asc" : "desc"
}

function parseStatus(raw: string | null): StatusProvinsi | "" {
  if (raw === "surplus" || raw === "balanced" || raw === "defisit") return raw
  return ""
}

function parseRankingBy(raw: string | null): AnalysisRankingBy {
  if (raw === "kebutuhan" || raw === "balance") return raw
  return "produksi"
}

function StatusIcon({ status }: { status: string }) {
  if (status === "surplus") return <ArrowUpRight aria-hidden="true" className="size-3" />
  if (status === "balanced") return <Minus aria-hidden="true" className="size-3" />
  return <ArrowDownRight aria-hidden="true" className="size-3" />
}

function SortButton({
  label,
  field,
  activeSort,
  activeOrder,
  onToggle,
  alignRight = false,
}: {
  label: string
  field: AnalysisSortField
  activeSort: AnalysisSortField
  activeOrder: SortOrder
  onToggle: (field: AnalysisSortField) => void
  alignRight?: boolean
}) {
  const isActive = activeSort === field
  return (
    <button
      className={cn(
        "inline-flex items-center gap-1 font-medium transition-colors hover:text-foreground",
        alignRight && "ml-auto flex-row-reverse",
        isActive ? "text-foreground" : "text-muted-foreground",
      )}
      onClick={() => onToggle(field)}
      type="button"
    >
      <span>{label}</span>
      {isActive ? (
        activeOrder === "asc" ? (
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

const columnHelper = createColumnHelper<ProvinceItem>()

export function AnalisisListView() {
  const navigate = useNavigate()
  const { tahun } = useTahun()
  const [searchParams, setSearchParams] = useSearchParams()

  const statusFilter = parseStatus(searchParams.get("status"))
  const pulauFilter = searchParams.get("pulau") ?? ""
  const sortField = parseSort(searchParams.get("sort"))
  const sortOrder = parseOrder(searchParams.get("order"), sortField)
  const qParam = searchParams.get("q") ?? ""
  const activeTab = searchParams.get("tab") === "ranking" ? "ranking" : "tabel"
  const rankingBy = parseRankingBy(searchParams.get("by"))

  const [searchInput, setSearchInput] = useState(qParam)

  useEffect(() => {
    setSearchInput(qParam)
  }, [qParam])

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

  // Debounce 300 ms untuk pencarian nama / kode BPS
  useEffect(() => {
    const trimmed = searchInput.trim()
    if (trimmed === qParam) return
    const timer = window.setTimeout(() => {
      updateParams({ q: trimmed || null })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput, qParam, updateParams])

  const pulauList = usePulauOptions(tahun)
  const provincesQuery = useAnalysisProvinces({
    tahun,
    status: statusFilter,
    pulau: pulauFilter,
    q: qParam,
    sort: sortField,
    order: sortOrder,
  })
  const rankingsQuery = useAnalysisRankings(rankingBy, tahun, 38)

  const tahunSuffix = tahun ? `?tahun=${tahun}` : ""
  const items = provincesQuery.data?.items ?? []

  const handleSortToggle = useCallback(
    (field: AnalysisSortField) => {
      if (sortField === field) {
        updateParams({ sort: field, order: sortOrder === "asc" ? "desc" : "asc" })
      } else {
        const defaultOrder: SortOrder = field === "provinsi" ? "asc" : "desc"
        updateParams({ sort: field === "peringkat" ? null : field, order: defaultOrder })
      }
    },
    [sortField, sortOrder, updateParams],
  )

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "no",
        header: "#",
        cell: (info) => (
          <span className="text-xs text-muted-foreground tabular-nums">{info.row.index + 1}</span>
        ),
      }),
      columnHelper.accessor("provinsi", {
        header: () => (
          <SortButton
            activeOrder={sortOrder}
            activeSort={sortField}
            field="provinsi"
            label="Provinsi"
            onToggle={handleSortToggle}
          />
        ),
        cell: (info) => {
          const row = info.row.original
          return (
            <Link
              className="group inline-flex flex-col hover:underline"
              onClick={(e) => e.stopPropagation()}
              to={`/analisis/${row.kode_bps}${tahunSuffix}`}
            >
              <span className="font-medium text-foreground group-hover:text-primary">
                {row.provinsi}
              </span>
              <span className="text-[11px] text-muted-foreground">BPS {row.kode_bps}</span>
            </Link>
          )
        },
      }),
      columnHelper.accessor("pulau", {
        header: "Pulau",
        cell: (info) => <span className="text-xs text-muted-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor("penduduk_jiwa", {
        header: () => (
          <div className="text-right">
            <SortButton
              activeOrder={sortOrder}
              activeSort={sortField}
              alignRight
              field="penduduk"
              label="Penduduk"
              onToggle={handleSortToggle}
            />
          </div>
        ),
        cell: (info) => (
          <div className="text-right text-xs tabular-nums">{formatJiwa(info.getValue())}</div>
        ),
      }),
      columnHelper.accessor("konsumsi_kg_kapita_tahun", {
        header: () => <div className="text-right text-muted-foreground">Konsumsi/kapita</div>,
        cell: (info) => (
          <div className="text-right text-xs tabular-nums">
            {formatAngka(info.getValue(), 1)} kg/thn
          </div>
        ),
      }),
      columnHelper.accessor("produksi_beras_ton", {
        header: () => (
          <div className="text-right">
            <SortButton
              activeOrder={sortOrder}
              activeSort={sortField}
              alignRight
              field="produksi"
              label="Produksi"
              onToggle={handleSortToggle}
            />
          </div>
        ),
        cell: (info) => (
          <div className="text-right font-medium tabular-nums">
            {formatTon(info.getValue())}
          </div>
        ),
      }),
      columnHelper.accessor("kebutuhan_beras_ton", {
        header: () => (
          <div className="text-right">
            <SortButton
              activeOrder={sortOrder}
              activeSort={sortField}
              alignRight
              field="kebutuhan"
              label="Kebutuhan"
              onToggle={handleSortToggle}
            />
          </div>
        ),
        cell: (info) => (
          <div className="text-right tabular-nums">{formatTon(info.getValue())}</div>
        ),
      }),
      columnHelper.accessor("rice_balance_ton", {
        header: () => (
          <div className="text-right">
            <SortButton
              activeOrder={sortOrder}
              activeSort={sortField}
              alignRight
              field="balance"
              label="Rice Balance"
              onToggle={handleSortToggle}
            />
          </div>
        ),
        cell: (info) => {
          const val = info.getValue()
          const sign = val > 0 ? "+" : ""
          return (
            <div
              className={cn(
                "text-right font-semibold tabular-nums",
                val >= 0 ? "text-status-surplus" : "text-status-defisit",
              )}
            >
              {sign}
              {formatTon(val)}
            </div>
          )
        },
      }),
      columnHelper.accessor("rasio_swasembada", {
        header: () => (
          <div className="text-right">
            <SortButton
              activeOrder={sortOrder}
              activeSort={sortField}
              alignRight
              field="peringkat"
              label="Rasio"
              onToggle={handleSortToggle}
            />
          </div>
        ),
        cell: (info) => (
          <div className="text-right text-xs tabular-nums">
            {formatPersen(info.getValue() * 100, 1)}
          </div>
        ),
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => {
          const st = info.getValue()
          const infoStatus = tampilanStatus(st)
          return (
            <Badge className={cn("gap-1", infoStatus.kelas)} variant="outline">
              <StatusIcon status={st} />
              {infoStatus.label}
            </Badge>
          )
        },
      }),
    ],
    [sortField, sortOrder, handleSortToggle, tahunSuffix],
  )

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const hasFilters = Boolean(statusFilter || pulauFilter || qParam)
  const activeYear = provincesQuery.data?.tahun ?? tahun ?? 2025

  const rankingItems = rankingsQuery.data?.items ?? []
  const maxAbsRanking = rankingItems.reduce((acc, item) => Math.max(acc, Math.abs(item.nilai)), 0)

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Regional Analysis</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Perbandingan produksi, konsumsi, estimasi kebutuhan, dan rice balance 38 provinsi
            tahun {activeYear}. Klik baris provinsi untuk melihat rincian rumus.
          </p>
        </div>
        {provincesQuery.data ? (
          <Badge className="w-fit text-xs tabular-nums" variant="secondary">
            {provincesQuery.data.total} provinsi &middot; v{provincesQuery.data.version.version_no}
          </Badge>
        ) : null}
      </div>

      <Tabs
        onValueChange={(val) => updateParams({ tab: val === "tabel" ? null : val })}
        value={activeTab}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="tabel">Tabel 38 Provinsi</TabsTrigger>
            <TabsTrigger value="ranking">Regional Ranking</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent className="space-y-4" value="tabel">
          {/* Bar Filter */}
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-3.5 text-xs">
              <div className="relative w-full sm:w-72">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  aria-label="Cari nama provinsi atau kode BPS"
                  className="h-8 pr-8 pl-8 text-xs"
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Cari nama atau kode BPS (mis: 31)..."
                  type="text"
                  value={searchInput}
                />
                {searchInput ? (
                  <Button
                    aria-label="Hapus pencarian"
                    className="absolute top-1/2 right-1 size-6 -translate-y-1/2"
                    onClick={() => {
                      setSearchInput("")
                      updateParams({ q: null })
                    }}
                    size="icon-xs"
                    type="button"
                    variant="ghost"
                  >
                    <X aria-hidden="true" className="size-3.5" />
                  </Button>
                ) : null}
              </div>

              <label className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Status:</span>
                <select
                  aria-label="Filter status"
                  className="h-8 rounded-md border bg-background px-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  onChange={(e) => updateParams({ status: e.target.value || null })}
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
                  onChange={(e) => updateParams({ pulau: e.target.value || null })}
                  value={pulauFilter}
                >
                  <option value="">Semua pulau</option>
                  {pulauList.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>

              {hasFilters ? (
                <Button
                  className="h-8 gap-1 text-xs"
                  onClick={() => {
                    setSearchInput("")
                    updateParams({ status: null, pulau: null, q: null })
                  }}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <RotateCcw aria-hidden="true" className="size-3" />
                  Reset filter
                </Button>
              ) : null}
            </CardContent>
          </Card>

          {provincesQuery.error ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Gagal memuat data provinsi</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {provincesQuery.error instanceof Error
                    ? provincesQuery.error.message
                    : "Terjadi kesalahan saat menghubungi API."}
                </span>
                <Button onClick={() => void provincesQuery.refetch()} size="sm" variant="outline">
                  Coba lagi
                </Button>
              </AlertDescription>
            </Alert>
          ) : provincesQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-72 w-full" />
            </div>
          ) : items.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tidak ada provinsi yang cocok</CardTitle>
                <CardDescription>
                  Ubah kata kunci pencarian atau reset filter untuk melihat seluruh 38 provinsi.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => {
                    setSearchInput("")
                    updateParams({ status: null, pulau: null, q: null })
                  }}
                  size="sm"
                  variant="outline"
                >
                  Tampilkan semua provinsi
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden py-0">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow key={hg.id}>
                      {hg.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow
                      className="cursor-pointer"
                      key={row.id}
                      onClick={() => navigate(`/analisis/${row.original.kode_bps}${tahunSuffix}`)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent className="space-y-4" value="ranking">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">Peringkat 38 Provinsi</CardTitle>
                  <CardDescription>
                    Urutan seluruh provinsi berdasarkan indikator yang dipilih.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pilih indikator peringkat">
                  {RANKING_OPTIONS.map((opt) => (
                    <Button
                      key={opt.id}
                      onClick={() => updateParams({ by: opt.id === "produksi" ? null : opt.id })}
                      size="sm"
                      type="button"
                      variant={rankingBy === opt.id ? "default" : "outline"}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {rankingsQuery.error ? (
                <Alert variant="destructive">
                  <AlertCircle aria-hidden="true" />
                  <AlertTitle>Gagal memuat peringkat</AlertTitle>
                  <AlertDescription>
                    <Button onClick={() => void rankingsQuery.refetch()} size="sm" variant="outline">
                      Coba lagi
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : rankingsQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <div className="divide-y">
                  {rankingItems.map((item) => {
                    const widthPct =
                      maxAbsRanking > 0
                        ? Math.max(2, Math.round((Math.abs(item.nilai) / maxAbsRanking) * 100))
                        : 0
                    const isNegative = item.nilai < 0
                    const sign = rankingBy === "balance" && item.nilai > 0 ? "+" : ""

                    return (
                      <Link
                        className="flex flex-col gap-1.5 py-2.5 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-4 sm:px-2"
                        key={item.kode_bps}
                        to={`/analisis/${item.kode_bps}${tahunSuffix}`}
                      >
                        <div className="flex min-w-0 items-center gap-3 sm:w-64 shrink-0">
                          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
                            {item.peringkat}
                          </span>
                          <span className="truncate font-medium">{item.provinsi}</span>
                        </div>

                        <div className="flex flex-1 items-center gap-3">
                          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                isNegative ? "bg-status-defisit" : "bg-status-surplus",
                              )}
                              style={{ width: `${widthPct}%` }}
                            />
                          </div>
                          <span
                            className={cn(
                              "w-36 shrink-0 text-right text-xs font-semibold tabular-nums",
                              rankingBy === "balance" &&
                                (isNegative ? "text-status-defisit" : "text-status-surplus"),
                            )}
                          >
                            {sign}
                            {formatTon(item.nilai)}
                          </span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
