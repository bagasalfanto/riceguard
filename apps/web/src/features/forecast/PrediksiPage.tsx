import { useMemo, useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  Cpu,
  Info,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from "lucide-react"

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
import {
  extractForecastUnavailableReason,
  isForecastUnavailableError,
  useForecast,
  type ForecastResponse,
} from "@/features/forecast/forecastData"
import { formatAngka, formatTon } from "@/lib/format"

const NON_OFFICIAL_BANNER_TEXT =
  "Angka prediksi berasal dari model eksternal, bukan bagian dataset resmi, dan tidak dipakai untuk rekomendasi distribusi."

function formatNilaiSatuan(nilai: number, satuan: string): string {
  if (satuan.trim().toLowerCase() === "ton") {
    return formatTon(nilai)
  }
  return `${formatAngka(nilai)} ${satuan}`
}

function formatInterval(bawah: number | null, atas: number | null, satuan: string): string {
  if (bawah !== null && atas !== null) {
    return `${formatAngka(bawah)} – ${formatAngka(atas)} ${satuan}`
  }
  if (bawah !== null) return `≥ ${formatNilaiSatuan(bawah, satuan)}`
  if (atas !== null) return `≤ ${formatNilaiSatuan(atas, satuan)}`
  return "—"
}

function getTahunTersedia(data: ForecastResponse): number[] {
  const raw = data.details?.tahun_tersedia
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is number => typeof item === "number" && Number.isFinite(item))
}

function getKodeTanpaPrediksi(data: ForecastResponse): string[] {
  const raw = data.details?.kode_tanpa_prediksi
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
}

function ForecastLoadingSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-8 w-40" />
        </div>
        <Skeleton className="h-9 w-full max-w-sm" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  )
}

function ForecastUnavailableCard({ reason }: { reason: string | null }) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles aria-hidden="true" className="size-5 text-muted-foreground" />
          <CardTitle>Prediksi belum tersedia</CardTitle>
        </div>
        <CardDescription>
          {reason ?? "Layanan model prediksi eksternal saat ini belum diaktifkan."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Tidak ada angka pengganti yang ditampilkan saat layanan prediksi tidak tersedia. Data resmi
          pada Dashboard, Rice Map, dan Recommendations tetap beroperasi seperti biasa.
        </p>
      </CardContent>
    </Card>
  )
}

export function PrediksiPage() {
  const [selectedTahun, setSelectedTahun] = useState<number | undefined>(undefined)
  const [searchQuery, setSearchQuery] = useState("")

  const { data, error, isError, isLoading, isFetching, refetch } = useForecast(selectedTahun)

  const filteredItems = useMemo(() => {
    const items = data?.items ?? []
    const needle = searchQuery.trim().toLowerCase()
    if (!needle) return items
    return items.filter(
      (item) =>
        item.provinsi.toLowerCase().includes(needle) || item.kode_bps.toLowerCase().includes(needle),
    )
  }, [data?.items, searchQuery])

  const unavailable = isError && isForecastUnavailableError(error)
  const unavailableReason = unavailable ? extractForecastUnavailableReason(error) : null
  const tahunTersedia = data ? getTahunTersedia(data) : []
  const kodeTanpaPrediksi = data ? getKodeTanpaPrediksi(data) : []
  const activeTahun = selectedTahun ?? data?.tahun

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Prediksi Produksi (AI)
          </h1>
          <Badge variant="outline">Eksperimental · Non-Resmi</Badge>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Proyeksi produksi beras per provinsi dari model eksternal untuk eksplorasi, terpisah dari
          dataset resmi RiceGuard.
        </p>
      </header>

      <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100">
        <AlertTriangle aria-hidden="true" className="text-amber-700 dark:text-amber-300" />
        <AlertTitle>Penanda Non-Resmi</AlertTitle>
        <AlertDescription className="text-amber-900/90 dark:text-amber-100/90">
          <p className="whitespace-normal break-words leading-relaxed">{NON_OFFICIAL_BANNER_TEXT}</p>
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <ForecastLoadingSkeleton />
      ) : unavailable ? (
        <ForecastUnavailableCard reason={unavailableReason} />
      ) : isError ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Gagal memuat prediksi</AlertTitle>
          <AlertDescription className="flex w-full flex-wrap items-center justify-between gap-3">
            <span>
              {error instanceof Error
                ? error.message
                : "Terjadi gangguan saat menghubungi model prediksi eksternal."}
            </span>
            <Button
              disabled={isFetching}
              onClick={() => {
                void refetch()
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCw aria-hidden="true" className={isFetching ? "animate-spin" : undefined} />
              Coba lagi
            </Button>
          </AlertDescription>
        </Alert>
      ) : data ? (
        <div className="space-y-4">
          <Card>
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    <span>Proyeksi Produksi Tahun {data.tahun}</span>
                    {data.model?.nama ? (
                      <Badge className="gap-1" variant="secondary">
                        <Cpu aria-hidden="true" />
                        <span>
                          {data.model.nama}
                          {data.model.versi ? ` v${data.model.versi}` : ""}
                        </span>
                      </Badge>
                    ) : null}
                  </CardTitle>
                  <CardDescription>
                    Menampilkan {data.items.length} provinsi (satuan: {data.satuan}).
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {tahunTersedia.length > 0 ? (
                    <label className="inline-flex items-center gap-2 text-sm">
                      <CalendarDays aria-hidden="true" className="size-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Tahun target</span>
                      <select
                        aria-label="Pilih tahun target prediksi"
                        className="rounded-md border bg-background px-2.5 py-1.5 text-sm"
                        disabled={isFetching}
                        onChange={(event) => {
                          const parsed = Number(event.target.value)
                          setSelectedTahun(Number.isFinite(parsed) ? parsed : undefined)
                        }}
                        value={activeTahun ?? ""}
                      >
                        {tahunTersedia.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <Badge className="gap-1.5" variant="outline">
                      <CalendarDays aria-hidden="true" />
                      <span>Tahun target: {data.tahun}</span>
                    </Badge>
                  )}
                </div>
              </div>

              <div className="relative w-full max-w-sm">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  aria-label="Cari provinsi atau kode BPS"
                  className="pr-9 pl-9"
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Cari provinsi atau kode BPS..."
                  type="search"
                  value={searchQuery}
                />
                {searchQuery ? (
                  <Button
                    aria-label="Hapus pencarian"
                    className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
                    onClick={() => setSearchQuery("")}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <X aria-hidden="true" className="size-3.5" />
                  </Button>
                ) : null}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {kodeTanpaPrediksi.length > 0 ? (
                <Alert>
                  <Info aria-hidden="true" />
                  <AlertTitle>Sebagian provinsi tidak memiliki prediksi</AlertTitle>
                  <AlertDescription>
                    <p className="whitespace-normal break-words">
                      {kodeTanpaPrediksi.length} kode BPS tidak disertakan dalam respons model dan
                      tidak diisi angka nol: {kodeTanpaPrediksi.join(", ")}.
                    </p>
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Kode BPS</TableHead>
                      <TableHead>Provinsi</TableHead>
                      <TableHead className="text-right">Nilai Prediksi</TableHead>
                      <TableHead className="text-right">Interval Keyakinan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.length === 0 ? (
                      <TableRow>
                        <TableCell className="py-8 text-center text-muted-foreground" colSpan={4}>
                          {searchQuery
                            ? "Tidak ada provinsi yang cocok dengan pencarian."
                            : "Belum ada item prediksi untuk tahun target ini."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredItems.map((item) => (
                        <TableRow key={item.kode_bps}>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {item.kode_bps}
                          </TableCell>
                          <TableCell className="font-medium">{item.provinsi}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatNilaiSatuan(item.nilai, data.satuan)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground tabular-nums">
                            {formatInterval(item.interval_bawah, item.interval_atas, data.satuan)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
