import { useMemo } from "react"
import {
  AlertCircle,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Calculator,
  Info,
  MapPin,
  Minus,
  Scale,
  Sprout,
  Users,
} from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { ChartContainer } from "@/components/charts/ChartContainer"
import { BaseMap, ProvinceLayer } from "@/components/map"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
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
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  useMetricsDictionary,
  useProvinceDetail,
  type MetricGlossaryItem,
} from "@/features/analysis/analysisData"
import {
  buildLayerFromProvinces,
  useMapProvinces,
  useProvincesGeoJSON,
} from "@/features/map/mapData"
import { useTahun } from "@/hooks/useTahun"
import { ApiError } from "@/lib/api"
import { formatAngka, formatJiwa, formatKm, formatPersen, formatTon } from "@/lib/format"
import { tampilanStatus } from "@/lib/status"
import { cn } from "@/lib/utils"

function StatusIcon({ status }: { status: string }) {
  if (status === "surplus") return <ArrowUpRight aria-hidden="true" className="size-3.5" />
  if (status === "balanced") return <Minus aria-hidden="true" className="size-3.5" />
  return <ArrowDownRight aria-hidden="true" className="size-3.5" />
}

function MetricInfo({ item }: { item?: MetricGlossaryItem }) {
  if (!item) return null
  return (
    <TooltipProvider>
      <UiTooltip>
        <TooltipTrigger asChild>
          <button
            aria-label={`Penjelasan ${item.label}`}
            className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            type="button"
          >
            <Info aria-hidden="true" className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs space-y-1 text-left">
          <div className="font-semibold">{item.label}</div>
          <p>{item.penjelasan}</p>
          {item.sumber ? <p className="text-[11px] opacity-80">Sumber: {item.sumber}</p> : null}
        </TooltipContent>
      </UiTooltip>
    </TooltipProvider>
  )
}

export function AnalisisDetailView({ kode }: { kode: string }) {
  const navigate = useNavigate()
  const { tahun } = useTahun()
  const tahunSuffix = tahun ? `?tahun=${tahun}` : ""

  const detailQuery = useProvinceDetail(kode, tahun)
  const detail = detailQuery.data
  const metricsQuery = useMetricsDictionary()

  const activeYear = detail?.tahun ?? tahun ?? 2025
  const geoQuery = useProvincesGeoJSON()
  const mapProvincesQuery = useMapProvinces(activeYear)

  const miniLayerData = useMemo(() => {
    if (!mapProvincesQuery.data) return undefined
    return buildLayerFromProvinces(mapProvincesQuery.data, "status", activeYear)
  }, [mapProvincesQuery.data, activeYear])

  const allCodes = useMemo(() => {
    const set = new Set<string>()
    for (const p of mapProvincesQuery.data ?? []) set.add(p.kode_bps)
    return set
  }, [mapProvincesQuery.data])

  const focusTarget = useMemo(() => {
    if (!detail) return null
    return { lat: detail.lat, lng: detail.lng, zoom: 6.2, nonce: 1 }
  }, [detail])

  if (detailQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-8">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-36 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      </div>
    )
  }

  if (detailQuery.error) {
    const is404 = detailQuery.error instanceof ApiError && detailQuery.error.status === 404
    if (is404) {
      return (
        <div className="mx-auto w-full max-w-3xl px-4 py-12">
          <Card>
            <CardHeader>
              <CardTitle>Provinsi tidak ditemukan (404)</CardTitle>
              <CardDescription>
                Kode provinsi <code className="font-mono">{kode}</code> tidak terdaftar pada dataset
                tahun {tahun ?? "terbaru"}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to={`/analisis${tahunSuffix}`}>
                  <ArrowLeft aria-hidden="true" className="size-4" />
                  Kembali ke Regional Analysis
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )
    }

    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Gagal memuat analisis provinsi</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {detailQuery.error instanceof Error
                ? detailQuery.error.message
                : "Terjadi kesalahan saat mengambil data provinsi."}
            </span>
            <Button onClick={() => void detailQuery.refetch()} size="sm" variant="outline">
              Coba lagi
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!detail) return null

  const statusInfo = tampilanStatus(detail.status)
  const balanceSign = detail.rice_balance_ton > 0 ? "+" : ""
  const rasioPersen = detail.rasio_swasembada * 100
  // Skala progress 0..200% agar garis 0,90 (45% lebar) & 1,00 (50% lebar) terlihat jelas
  const progressValue = Math.max(0, Math.min(100, (detail.rasio_swasembada / 2) * 100))

  const kebutuhanStep = detail.perhitungan.find((s) => s.langkah === "kebutuhan")
  const balanceStep = detail.perhitungan.find((s) => s.langkah === "balance")
  const klasifikasiStep = detail.perhitungan.find((s) => s.langkah === "klasifikasi")

  const metricsByField = new Map(
    (metricsQuery.data?.metrik ?? []).map((item) => [item.field, item]),
  )
  const rawTemplate =
    metricsQuery.data?.template_ringkasan[
      detail.status as "surplus" | "balanced" | "defisit"
    ]
  const narasiRingkasan = rawTemplate
    ? rawTemplate
        .replaceAll("{provinsi}", detail.provinsi)
        .replaceAll("{produksi_beras_ton}", formatAngka(detail.produksi_beras_ton, 0))
        .replaceAll("{kebutuhan_beras_ton}", formatAngka(detail.kebutuhan_beras_ton, 0))
        .replaceAll("{rice_balance_ton_abs}", formatAngka(Math.abs(detail.rice_balance_ton), 0))
        .replaceAll("{rasio_persen}", formatPersen(rasioPersen, 1))
    : null

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild size="sm" variant="ghost">
          <Link to={`/analisis${tahunSuffix}`}>
            <ArrowLeft aria-hidden="true" className="size-4" />
            Daftar 38 Provinsi
          </Link>
        </Button>

        <Button asChild size="sm" variant="outline">
          <Link to={`/peta?prov=${detail.kode_bps}${tahun ? `&tahun=${tahun}` : ""}`}>
            <MapPin aria-hidden="true" className="size-4" />
            Buka di Rice Map
          </Link>
        </Button>
      </div>

      {/* Header + Progress Rasio Swasembada */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Kode BPS {detail.kode_bps}</span>
                <span>&middot;</span>
                <span>{detail.pulau}</span>
                <span>&middot;</span>
                <span>
                  Tahun {detail.tahun} (v{detail.version.version_no})
                </span>
              </div>
              <CardTitle className="mt-1 text-2xl">{detail.provinsi}</CardTitle>
              <CardDescription className="mt-1">{statusInfo.keterangan}</CardDescription>
            </div>

            <div className="flex flex-col items-start gap-1 sm:items-end">
              <Badge className={cn("gap-1 text-xs", statusInfo.kelas)} variant="outline">
                <StatusIcon status={detail.status} />
                {statusInfo.label}
              </Badge>
              <div
                className={cn(
                  "text-xl font-semibold tabular-nums",
                  detail.rice_balance_ton >= 0 ? "text-status-surplus" : "text-status-defisit",
                )}
              >
                {balanceSign}
                {formatTon(detail.rice_balance_ton)}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-2 border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-medium">
              Rasio Swasembada:{" "}
              <span className="font-semibold tabular-nums">
                {formatPersen(rasioPersen, 1)} ({formatAngka(detail.rasio_swasembada, 4)})
              </span>
            </span>
            <span className="text-muted-foreground">
              Ambang FAO 1999: 90% (0,90) – 100% (1,00)
            </span>
          </div>

          <div className="relative pt-1 pb-5">
            <Progress className="h-3" value={progressValue} />
            {/* Garis penanda 0,90 (45% dari skala 0..2,00) */}
            <div
              className="absolute top-0 bottom-4 w-0.5 bg-status-balanced"
              style={{ left: "45%" }}
            >
              <span className="absolute top-4 -translate-x-1/2 text-[10px] font-medium whitespace-nowrap text-muted-foreground">
                0,90
              </span>
            </div>
            {/* Garis penanda 1,00 (50% dari skala 0..2,00) */}
            <div
              className="absolute top-0 bottom-4 w-0.5 bg-status-surplus"
              style={{ left: "50%" }}
            >
              <span className="absolute top-4 translate-x-1 text-[10px] font-medium whitespace-nowrap text-muted-foreground">
                1,00
              </span>
            </div>
          </div>

          {narasiRingkasan ? (
            <p className="rounded-lg border bg-muted/35 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              {narasiRingkasan}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Grid Utama: Produksi, Konsumsi, Rumus Terisi, dan Peta Mini */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Production Analysis */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span className="flex items-center gap-2">
                    <Sprout aria-hidden="true" className="size-4 text-primary" />
                    Production Analysis
                  </span>
                  <MetricInfo item={metricsByField.get("produksi_beras_ton")} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Produksi Beras</span>
                  <span className="font-semibold tabular-nums">
                    {formatTon(detail.produksi_beras_ton)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Produksi Padi (GKG)</span>
                  <span className="tabular-nums">{formatTon(detail.produksi_padi_ton_gkg)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Consumption Analysis */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span className="flex items-center gap-2">
                    <Users aria-hidden="true" className="size-4 text-primary" />
                    Consumption Analysis
                  </span>
                  <MetricInfo item={metricsByField.get("konsumsi_kg_kapita_tahun")} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Jumlah Penduduk</span>
                  <span className="font-semibold tabular-nums">
                    {formatJiwa(detail.penduduk_jiwa)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Konsumsi per Kapita</span>
                  <span className="tabular-nums">
                    {formatAngka(detail.konsumsi_kg_kapita_tahun, 1)} kg/kapita/tahun
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Rumus Terisi: Demand & Rice Balance Calculation */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span className="flex items-center gap-2">
                    <Calculator aria-hidden="true" className="size-4 text-primary" />
                    Rice Demand Calculation
                  </span>
                  <MetricInfo item={metricsByField.get("kebutuhan_beras_ton")} />
                </CardTitle>
                <CardDescription>Dᵢ = (Pᵢ &times; Cᵢ) / 1.000</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
                  {kebutuhanStep?.rumus ??
                    `${formatAngka(detail.penduduk_jiwa)} × ${formatAngka(detail.konsumsi_kg_kapita_tahun, 1)} kg / 1.000`}
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-muted-foreground">Estimasi kebutuhan (dibulatkan):</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatTon(Math.round(detail.kebutuhan_beras_ton))}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground tabular-nums">
                  Nilai presisi dataset: {formatTon(detail.kebutuhan_beras_ton, 2)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span className="flex items-center gap-2">
                    <Scale aria-hidden="true" className="size-4 text-primary" />
                    Rice Balance Calculation
                  </span>
                  <MetricInfo item={metricsByField.get("rice_balance_ton")} />
                </CardTitle>
                <CardDescription>Bᵢ = Produksi Beras &minus; Estimasi Kebutuhan</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
                  {balanceStep?.rumus ??
                    `${formatAngka(detail.produksi_beras_ton, 2)} − ${formatAngka(detail.kebutuhan_beras_ton, 2)}`}
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-muted-foreground">Rice Balance:</span>
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      detail.rice_balance_ton >= 0 ? "text-status-surplus" : "text-status-defisit",
                    )}
                  >
                    {balanceSign}
                    {formatTon(detail.rice_balance_ton, 2)}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Klasifikasi: <strong className="text-foreground">{statusInfo.label}</strong> (
                  {klasifikasiStep?.rumus ?? statusInfo.keterangan})
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Peta Mini */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Lokasi Provinsi</CardTitle>
            <CardDescription>Highlight wilayah {detail.provinsi}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {geoQuery.data && mapProvincesQuery.data ? (
              <BaseMap
                ariaLabel={`Peta mini ${detail.provinsi}`}
                basemap="satellite"
                className="h-[270px] w-full"
                focusTarget={focusTarget}
              >
                <ProvinceLayer
                  geoData={geoQuery.data}
                  layerData={miniLayerData}
                  matchingCodes={allCodes}
                  onSelectProvince={(kodeBaru) => navigate(`/analisis/${kodeBaru}${tahunSuffix}`)}
                  provincesByCode={mapProvincesQuery.byCode}
                  selectedCode={detail.kode_bps}
                />
              </BaseMap>
            ) : (
              <Skeleton className="h-[270px] w-full rounded-xl" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Distribusi Terkait */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {detail.status === "surplus"
              ? "Rekomendasi Penerima dari Provinsi Ini"
              : detail.status === "defisit"
                ? "Rekomendasi Pemasok untuk Provinsi Ini"
                : "Keterlibatan Matching Distribusi"}
          </CardTitle>
          <CardDescription>
            Berdasarkan algoritma pencocokan surplus ke defisit terdekat (jarak garis lurus antar
            pusat provinsi, bersifat potensial).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {detail.catatan || detail.status === "balanced" ? (
            <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
              {detail.catatan ??
                "Provinsi kategori balanced (rasio 0,90–1,00) tidak ikut matching distribusi."}
            </div>
          ) : detail.rekomendasi_terkait.length === 0 ? (
            <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
              Tidak ada alokasi distribusi aktif untuk provinsi ini pada versi dataset ini.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{detail.status === "surplus" ? "Tujuan (Defisit)" : "Pemasok (Surplus)"}</TableHead>
                  <TableHead className="text-right">Alokasi</TableHead>
                  <TableHead className="text-right">Jarak Garis Lurus</TableHead>
                  <TableHead className="text-right">% Kebutuhan Penerima</TableHead>
                  <TableHead>Koneksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.rekomendasi_terkait.map((rec) => {
                  const targetCode = detail.status === "surplus" ? rec.ke_kode : rec.dari_kode
                  const targetName = detail.status === "surplus" ? rec.ke : rec.dari
                  return (
                    <TableRow key={rec.urutan}>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {rec.urutan}
                      </TableCell>
                      <TableCell>
                        <Link
                          className="font-medium hover:text-primary hover:underline"
                          to={`/analisis/${targetCode}${tahunSuffix}`}
                        >
                          {targetName}
                        </Link>
                        <div className="mt-0.5 text-[11px] whitespace-normal text-muted-foreground">
                          {rec.explanation}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatTon(rec.ton)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {formatKm(rec.jarak_km)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {formatPersen(rec.persen_kebutuhan_penerima, 1)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={rec.satu_pulau ? "secondary" : "outline"}>
                          {rec.satu_pulau ? "Satu pulau" : "Lintas pulau"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Historical Comparison — hanya jika >= 2 tahun */}
      {detail.riwayat.length >= 2 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historical Comparison</CardTitle>
            <CardDescription>
              Perbandingan produksi, estimasi kebutuhan, dan rice balance antar tahun published.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer height={280} label={`Riwayat tahunan ${detail.provinsi}`}>
              <ResponsiveContainer height="100%" width="100%">
                <BarChart data={detail.riwayat} margin={{ bottom: 8, left: 8, right: 16, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="tahun" />
                  <YAxis tickFormatter={(v) => formatAngka(Number(v) / 1_000, 0)} width={56} />
                  <Tooltip formatter={(v, nama) => [formatTon(Number(v ?? 0)), String(nama ?? "")]} />
                  <Legend />
                  <Bar dataKey="produksi_beras_ton" fill="var(--status-surplus)" name="Produksi" />
                  <Bar dataKey="kebutuhan_beras_ton" fill="var(--status-defisit)" name="Kebutuhan" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
