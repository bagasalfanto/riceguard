import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Info,
  Loader2,
  Scale,
  ShieldCheck,
  UserCheck,
  X,
  XCircle,
} from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
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
  describeDownloadError,
  downloadExportFile,
  formatTanggalId,
  formatTanggalWaktuId,
  formatValidationDetail,
  getOverallValidationStatus,
  getValidationVersionNo,
  RAW_SOURCE_LABELS,
  useDataSources,
  useMetaYears,
  useTransparencyContent,
  useValidationReport,
  type DownloadErrorInfo,
  type ValidationRuleStatus,
} from "@/features/data/dataTransparencyData"
import { useTahun } from "@/hooks/useTahun"
import { ApiError } from "@/lib/api"
import { formatAngka } from "@/lib/format"
import { SEMUA_STATUS, tampilanStatus } from "@/lib/status"
import type { ContentItem } from "@/lib/tipe-api"
import { cn } from "@/lib/utils"

const SECTION_LINKS = [
  { id: "versi", label: "Info Versi" },
  { id: "validasi", label: "Validasi Data" },
  { id: "unduhan", label: "Pusat Unduhan" },
  { id: "sumber", label: "Sumber Data" },
  { id: "metodologi", label: "Metodologi" },
  { id: "batasan", label: "Batasan Klaim" },
] as const

const VALIDATION_STYLE: Record<
  ValidationRuleStatus,
  { badgeClass: string; borderClass: string; ruleLabel: string; overallLabel: string }
> = {
  lulus: {
    badgeClass:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    borderClass: "border-border",
    ruleLabel: "Lulus",
    overallLabel: "Lulus Validasi",
  },
  peringatan: {
    badgeClass: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    borderClass: "border-amber-500/35 bg-amber-500/[0.03]",
    ruleLabel: "Peringatan",
    overallLabel: "Perlu Perhatian",
  },
  gagal: {
    badgeClass: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
    borderClass: "border-red-500/35 bg-red-500/[0.03]",
    ruleLabel: "Gagal",
    overallLabel: "Gagal",
  },
}

const FORMULA_CARDS = [
  {
    step: "1. Estimasi Kebutuhan Beras",
    title: "Penduduk × Konsumsi / 1.000",
    formula: "kebutuhan (ton) = (penduduk_jiwa × konsumsi_kg_kapita_tahun) / 1000",
  },
  {
    step: "2. Rice Balance",
    title: "Produksi Beras − Kebutuhan Beras",
    formula: "rice_balance (ton) = produksi_beras_ton − kebutuhan_beras_ton",
  },
  {
    step: "3. Rasio Swasembada",
    title: "Produksi Beras / Kebutuhan Beras",
    formula: "rasio = produksi_beras_ton / kebutuhan_beras_ton",
  },
] as const

const MATCHING_STEPS = [
  "Urutkan seluruh provinsi berstatus defisit dari kekurangan terbesar ke terkecil.",
  "Untuk setiap provinsi penerima, urutkan kandidat provinsi surplus berdasarkan jarak garis lurus terdekat (rumus Haversine antar-titik pusat provinsi).",
  "Alokasikan sebesar min(sisa defisit penerima, sisa surplus pemasok) hingga defisit atau surplus kandidat habis.",
  "Provinsi berstatus balanced (rasio swasembada 0,90–1,00) tidak menjadi pemasok maupun penerima.",
]

function SectionRetryAlert({
  title,
  error,
  fallback,
  onRetry,
}: {
  title: string
  error: unknown
  fallback: string
  onRetry: () => void
}) {
  return (
    <Alert variant="destructive">
      <AlertCircle aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
        <span>{formatErrorMessage(error, fallback)}</span>
        <Button onClick={onRetry} size="sm" type="button" variant="outline">
          Coba lagi
        </Button>
      </AlertDescription>
    </Alert>
  )
}

function ExportDatasetCard({
  title,
  description,
  note,
  csvKey,
  xlsxKey,
  downloadingKey,
  disabled,
  onDownloadCsv,
  onDownloadXlsx,
}: {
  title: string
  description: ReactNode
  note: ReactNode
  csvKey: string
  xlsxKey: string
  downloadingKey: string | null
  disabled: boolean
  onDownloadCsv: () => void
  onDownloadXlsx: () => void
}) {
  const csvBusy = downloadingKey === csvKey
  const xlsxBusy = downloadingKey === xlsxKey
  return (
    <Card className="flex flex-col justify-between">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet aria-hidden="true" className="size-4 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{note}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            aria-busy={csvBusy}
            disabled={disabled || downloadingKey !== null}
            onClick={onDownloadCsv}
            size="sm"
            type="button"
          >
            {csvBusy ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Download aria-hidden="true" className="size-4" />
            )}
            Unduh CSV
          </Button>
          <Button
            aria-busy={xlsxBusy}
            disabled={disabled || downloadingKey !== null}
            onClick={onDownloadXlsx}
            size="sm"
            type="button"
            variant="outline"
          >
            {xlsxBusy ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <FileSpreadsheet aria-hidden="true" className="size-4" />
            )}
            Unduh Excel (.xlsx)
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusRuleIcon({ status }: { status: ValidationRuleStatus }) {
  if (status === "lulus") return <CheckCircle2 aria-hidden="true" className="size-3.5" />
  if (status === "peringatan") return <AlertTriangle aria-hidden="true" className="size-3.5" />
  return <XCircle aria-hidden="true" className="size-3.5" />
}

function getSafeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const parsed = new URL(raw)
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString()
    }
    return null
  } catch {
    return null
  }
}

function formatErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const details =
      err.details && typeof err.details === "object"
        ? (err.details as { alasan?: unknown })
        : null
    if (typeof details?.alasan === "string" && details.alasan.trim() !== "") {
      return `${err.message} (${details.alasan})`
    }
    return err.message
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}

export function DataPage() {
  const { tahun, setTahun } = useTahun()
  const location = useLocation()

  const metaYearsQuery = useMetaYears()
  const validationQuery = useValidationReport(tahun)
  const sourcesQuery = useDataSources()
  const contentQuery = useTransparencyContent()

  const [downloadingKey, setDownloadingKey] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<{
    label: string
    info: DownloadErrorInfo
  } | null>(null)

  const years = metaYearsQuery.data?.tahun ?? []
  const activeYear =
    validationQuery.data?.tahun ?? tahun ?? metaYearsQuery.data?.tahun_terbaru ?? undefined
  const versionNo = getValidationVersionNo(validationQuery.data)
  const tahunSuffix = activeYear ? `?tahun=${activeYear}` : ""

  const contentMap = useMemo(() => {
    const map = new Map<string, ContentItem>()
    for (const item of contentQuery.data ?? []) {
      map.set(item.key, item)
    }
    return map
  }, [contentQuery.data])

  const methodologyItem = contentMap.get("methodology")
  const limitationsItem = contentMap.get("limitations")

  useEffect(() => {
    if (!location.hash) return
    const targetId = location.hash.slice(1)
    if (!targetId) return
    const target = document.getElementById(targetId)
    if (!target) return
    const timer = window.setTimeout(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 50)
    return () => window.clearTimeout(timer)
  }, [
    location.hash,
    location.key,
    validationQuery.isLoading,
    sourcesQuery.isLoading,
    contentQuery.isLoading,
  ])

  const handleDownload = async (
    key: string,
    label: string,
    path: string,
    fallbackFilename: string,
    query?: { tahun?: number },
  ) => {
    if (downloadingKey !== null) return
    setDownloadingKey(key)
    setDownloadError(null)
    try {
      const savedName = await downloadExportFile(path, query, fallbackFilename)
      toast.success(`Berhasil mengunduh ${savedName}`)
    } catch (err) {
      const info = describeDownloadError(err)
      setDownloadError({ label, info })
      toast.error(info.message)
    } finally {
      setDownloadingKey(null)
    }
  }

  const validationData = validationQuery.data
  const overallStatus = validationData ? getOverallValidationStatus(validationData) : null
  const passedRulesCount = validationData
    ? validationData.aturan.filter((r) => r.status === "lulus").length
    : 0

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8">
      {/* Header & Pemilih Tahun */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="gap-1.5" variant="outline">
                <Database aria-hidden="true" className="size-3.5 text-primary" />
                Transparansi Data
              </Badge>
              {activeYear ? (
                <Badge className="tabular-nums" variant="secondary">
                  Tahun {activeYear}
                </Badge>
              ) : null}
              {versionNo !== null ? (
                <Badge className="tabular-nums" variant="secondary">
                  Versi v{versionNo}
                </Badge>
              ) : null}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Data &amp; Methodology
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Sumber data resmi, informasi publikasi versi, hasil validasi otomatis, pusat unduhan
              dataset, penjelasan metodologi perhitungan, serta batasan klaim RiceGuard.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs">
            <CalendarDays aria-hidden="true" className="size-4 text-muted-foreground" />
            <span className="font-medium text-muted-foreground">Tahun aktif:</span>
            {years.length > 1 ? (
              <label className="inline-flex items-center gap-1.5">
                <span className="sr-only">Pilih tahun dataset</span>
                <select
                  aria-label="Pilih tahun dataset"
                  className="h-7 rounded-md border bg-background px-2 text-xs font-medium text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  onChange={(e) => setTahun(Number(e.target.value))}
                  value={activeYear ?? ""}
                >
                  {years.map((item) => (
                    <option key={item.tahun} value={item.tahun}>
                      Data {item.tahun} (v{item.version_no})
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <span className="font-semibold text-foreground tabular-nums">
                {activeYear ? `Data ${activeYear}` : "Memuat..."}
              </span>
            )}
          </div>
        </div>

        <nav
          aria-label="Navigasi bagian halaman data"
          className="flex flex-wrap items-center gap-1.5"
        >
          {SECTION_LINKS.map((item) => (
            <Button asChild className="h-8 text-xs" key={item.id} size="sm" variant="outline">
              <Link to={{ hash: `#${item.id}`, search: location.search }}>{item.label}</Link>
            </Button>
          ))}
        </nav>
      </header>

      <Separator />

      {/* 1. Data Update Information */}
      <section aria-labelledby="versi-heading" className="scroll-mt-20 space-y-4" id="versi">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold tracking-tight" id="versi-heading">
              Informasi Pembaruan Data
            </h2>
            <p className="text-xs text-muted-foreground">
              Jejak versi published yang sedang ditampilkan di seluruh halaman publik.
            </p>
          </div>
        </div>

        {validationQuery.isLoading ? (
          <Card>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((idx) => (
                <Skeleton className="h-20 w-full rounded-lg" key={idx} />
              ))}
            </CardContent>
          </Card>
        ) : validationQuery.error ? (
          <SectionRetryAlert
            error={validationQuery.error}
            fallback="Terjadi kesalahan saat mengambil laporan validasi dari API."
            onRetry={() => void validationQuery.refetch()}
            title="Gagal memuat informasi versi dan validasi"
          />
        ) : validationData ? (
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  <span>
                    Dataset Tahun {validationData.tahun} · v{versionNo ?? 1}
                  </span>
                  <Badge
                    className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    variant="outline"
                  >
                    <ShieldCheck aria-hidden="true" className="size-3" />
                    Published
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Angka pada dashboard, peta, analisis, dan rekomendasi merujuk ke versi ini.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground">Versi Aktif</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  v{versionNo ?? 1}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    ({validationData.tahun})
                  </span>
                </p>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground">Tanggal Publish</p>
                <p className="mt-1 text-sm font-semibold tabular-nums">
                  {formatTanggalWaktuId(validationData.published_at)}
                </p>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <UserCheck aria-hidden="true" className="size-3.5" />
                  Dipublikasikan Oleh
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {validationData.published_by_nama ??
                    validationData.published_by ??
                    "Sistem (Seed awal)"}
                </p>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground">Catatan Perubahan</p>
                <p className="mt-1 text-sm text-foreground">
                  {validationData.notes?.trim()
                    ? validationData.notes
                    : "Tidak ada catatan perubahan."}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </section>

      {/* 2. Data Validation Panel */}
      <section aria-labelledby="validasi-heading" className="scroll-mt-20 space-y-4" id="validasi">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight" id="validasi-heading">
              Validasi Data Otomatis
            </h2>
            <p className="text-xs text-muted-foreground">
              Lima pemeriksaan mutu terhadap kelengkapan provinsi, tanda nilai, acuan nasional BPS,
              dan perubahan antar-versi.
            </p>
          </div>
          {overallStatus ? (
            <Badge
              className={cn("gap-1.5 px-3 py-1 text-xs", VALIDATION_STYLE[overallStatus].badgeClass)}
              variant="outline"
            >
              <StatusRuleIcon status={overallStatus} />
              {VALIDATION_STYLE[overallStatus].overallLabel}
            </Badge>
          ) : null}
        </div>

        {validationQuery.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((idx) => (
              <Skeleton className="h-24 w-full rounded-xl" key={idx} />
            ))}
          </div>
        ) : validationQuery.error ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Panel validasi tidak tersedia</AlertTitle>
            <AlertDescription>
              {formatErrorMessage(
                validationQuery.error,
                "Gagal mengambil detail aturan validasi.",
              )}
            </AlertDescription>
          </Alert>
        ) : validationData ? (
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b pb-4">
              <div>
                <CardTitle className="text-base">
                  Ringkasan Pemeriksaan ({formatAngka(passedRulesCount, 0)}/
                  {formatAngka(validationData.aturan.length, 0)} aturan lulus)
                </CardTitle>
                <CardDescription>
                  Diperiksa pada: {formatTanggalWaktuId(validationData.diperiksa_pada)}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {validationData.aturan.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Belum ada catatan aturan validasi untuk versi dataset ini.
                </p>
              ) : (
                validationData.aturan.map((rule) => {
                  const style = VALIDATION_STYLE[rule.status] ?? VALIDATION_STYLE.gagal
                  const formatted = formatValidationDetail(rule)
                  return (
                    <div
                      className={cn("rounded-lg border p-4 transition-colors", style.borderClass)}
                      key={rule.kode}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-foreground">{rule.label}</h3>
                            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                              {rule.kode}
                            </code>
                          </div>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {formatted.summary}
                          </p>
                        </div>
                        <Badge className={cn("gap-1", style.badgeClass)} variant="outline">
                          <StatusRuleIcon status={rule.status} />
                          {style.ruleLabel}
                        </Badge>
                      </div>

                      {formatted.rows.length > 0 ? (
                        <dl className="mt-3 grid gap-2 border-t pt-3 text-xs sm:grid-cols-3">
                          {formatted.rows.map((row) => (
                            <div className="space-y-0.5" key={row.label}>
                              <dt className="text-muted-foreground">{row.label}</dt>
                              <dd
                                className={cn(
                                  "font-medium text-foreground",
                                  row.mono && "tabular-nums",
                                )}
                              >
                                {row.value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        ) : null}
      </section>

      {/* 3. Data Download Hub */}
      <section aria-labelledby="unduhan-heading" className="scroll-mt-20 space-y-4" id="unduhan">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight" id="unduhan-heading">
              Pusat Unduhan Data
            </h2>
            <p className="text-xs text-muted-foreground">
              Ekspor resmi mengikuti versi published aktif ({activeYear ?? "terbaru"}) dengan
              urutan kolom identik dataset spesifikasi.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to={`/laporan${tahunSuffix}`}>
              <FileText aria-hidden="true" className="size-4" />
              Laporan PDF Siap Cetak
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          </Button>
        </div>

        {downloadError ? (
          <Alert variant={downloadError.info.isStorageUnavailable ? "default" : "destructive"}>
            {downloadError.info.isStorageUnavailable ? (
              <Info aria-hidden="true" />
            ) : (
              <AlertCircle aria-hidden="true" />
            )}
            <AlertTitle className="flex items-center justify-between gap-2">
              <span>Gagal mengunduh {downloadError.label}</span>
              <Button
                aria-label="Tutup pesan unduhan"
                className="h-6 px-2 text-xs"
                onClick={() => setDownloadError(null)}
                size="xs"
                type="button"
                variant="ghost"
              >
                <X aria-hidden="true" className="size-3.5" />
                Tutup
              </Button>
            </AlertTitle>
            <AlertDescription>{downloadError.info.message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          <ExportDatasetCard
            csvKey="provinces.csv"
            description={
              <>
                38 provinsi dengan 15 kolom identik <code>dataset_v1.csv</code> (penduduk,
                konsumsi, produksi padi &amp; beras, kebutuhan, rice balance, rasio, dan status).
              </>
            }
            disabled={validationQuery.isLoading}
            downloadingKey={downloadingKey}
            note={
              <>
                File Excel berisi 3 sheet terstruktur: <strong>Provinsi</strong>,{" "}
                <strong>Rekomendasi</strong>, dan <strong>Metadata</strong>.
              </>
            }
            onDownloadCsv={() =>
              void handleDownload(
                "provinces.csv",
                "Dataset Provinsi (CSV)",
                "/exports/provinces.csv",
                `riceguard-provinsi-${activeYear ?? "latest"}-v${versionNo ?? 1}.csv`,
                { tahun: activeYear },
              )
            }
            onDownloadXlsx={() =>
              void handleDownload(
                "provinces.xlsx",
                "Dataset Provinsi (Excel)",
                "/exports/provinces.xlsx",
                `riceguard-provinsi-${activeYear ?? "latest"}-v${versionNo ?? 1}.xlsx`,
                { tahun: activeYear },
              )
            }
            title="Dataset Provinsi"
            xlsxKey="provinces.xlsx"
          />

          <ExportDatasetCard
            csvKey="recommendations.csv"
            description={
              <>
                Pasangan pemasok–penerima hasil algoritma matching greedy v1 (7 kolom:{" "}
                <code>urutan, dari_kode, dari, ke_kode, ke, ton, jarak_km</code>).
              </>
            }
            disabled={validationQuery.isLoading}
            downloadingKey={downloadingKey}
            note="Format CSV memakai UTF-8 BOM agar angka langsung terbaca rapi di Microsoft Excel."
            onDownloadCsv={() =>
              void handleDownload(
                "recommendations.csv",
                "Rekomendasi Distribusi (CSV)",
                "/exports/recommendations.csv",
                `riceguard-rekomendasi-${activeYear ?? "latest"}-v${versionNo ?? 1}.csv`,
                { tahun: activeYear },
              )
            }
            onDownloadXlsx={() =>
              void handleDownload(
                "recommendations.xlsx",
                "Rekomendasi Distribusi (Excel)",
                "/exports/recommendations.xlsx",
                `riceguard-rekomendasi-${activeYear ?? "latest"}-v${versionNo ?? 1}.xlsx`,
                { tahun: activeYear },
              )
            }
            title="Rekomendasi Distribusi"
            xlsxKey="recommendations.xlsx"
          />

          {/* File Sumber Mentah */}
          <Card className="flex flex-col justify-between">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database aria-hidden="true" className="size-4 text-primary" />
                File Sumber Mentah
              </CardTitle>
              <CardDescription>
                Arsip file mentah asli yang digunakan untuk membangun versi published tahun{" "}
                {activeYear ?? "aktif"}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {validationQuery.isLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((idx) => (
                    <Skeleton className="h-10 w-full" key={idx} />
                  ))}
                </div>
              ) : !validationData || validationData.source_files.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Daftar file sumber mentah belum tersedia untuk versi ini.
                </p>
              ) : (
                <ul className="space-y-2">
                  {validationData.source_files.map((file) => {
                    const keyId = `raw:${file.nama_file}`
                    const busy = downloadingKey === keyId
                    return (
                      <li
                        className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2"
                        key={`${file.key}-${file.nama_file}`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-foreground">
                            {RAW_SOURCE_LABELS[file.key] ?? file.key}
                          </p>
                          <p className="truncate font-mono text-[11px] text-muted-foreground">
                            {file.nama_file}
                          </p>
                        </div>
                        <Button
                          aria-busy={busy}
                          aria-label={`Unduh file mentah ${file.nama_file}`}
                          disabled={downloadingKey !== null}
                          onClick={() =>
                            void handleDownload(
                              keyId,
                              file.nama_file,
                              `/exports/raw/${encodeURIComponent(file.nama_file)}`,
                              file.nama_file,
                              { tahun: activeYear },
                            )
                          }
                          size="xs"
                          type="button"
                          variant="outline"
                        >
                          {busy ? (
                            <Loader2 aria-hidden="true" className="size-3 animate-spin" />
                          ) : (
                            <Download aria-hidden="true" className="size-3" />
                          )}
                          Unduh
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 4. Data Source Information Table */}
      <section aria-labelledby="sumber-heading" className="scroll-mt-20 space-y-4" id="sumber">
        <div>
          <h2 className="text-lg font-semibold tracking-tight" id="sumber-heading">
            Informasi Sumber Data Resmi
          </h2>
          <p className="text-xs text-muted-foreground">
            Daftar instansi, nama tabel resmi, dan tanggal pembaruan sumber yang digabungkan oleh
            sistem.
          </p>
        </div>

        {sourcesQuery.isLoading ? (
          <Skeleton className="h-56 w-full rounded-xl" />
        ) : sourcesQuery.error ? (
          <SectionRetryAlert
            error={sourcesQuery.error}
            fallback="Terjadi kesalahan saat mengambil sumber data dari API."
            onRetry={() => void sourcesQuery.refetch()}
            title="Gagal memuat daftar sumber data"
          />
        ) : !sourcesQuery.data || sourcesQuery.data.length === 0 ? (
          <Card>
            <CardContent className="text-sm text-muted-foreground">
              Belum ada sumber data yang tercatat.
            </CardContent>
          </Card>
        ) : (
          <Card className="py-0">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kunci</TableHead>
                    <TableHead>Nama Sumber</TableHead>
                    <TableHead>Instansi</TableHead>
                    <TableHead>Tabel Resmi</TableHead>
                    <TableHead className="text-right">Tahun</TableHead>
                    <TableHead>Diperbarui</TableHead>
                    <TableHead className="text-right">Tautan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sourcesQuery.data.map((source) => {
                    const safeUrl = getSafeExternalUrl(source.url)
                    return (
                      <TableRow key={source.id}>
                        <TableCell>
                          <Badge className="font-mono text-[11px]" variant="secondary">
                            {source.key}
                          </Badge>
                        </TableCell>
                        <TableCell className="min-w-[220px] font-medium whitespace-normal">
                          {source.nama}
                        </TableCell>
                        <TableCell>{source.instansi}</TableCell>
                        <TableCell className="min-w-[180px] whitespace-normal text-muted-foreground">
                          {source.tabel_resmi ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {source.tahun ?? "—"}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {formatTanggalId(source.diperbarui)}
                        </TableCell>
                        <TableCell className="text-right">
                          {safeUrl ? (
                            <a
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary underline underline-offset-2 hover:opacity-80"
                              href={safeUrl}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Buka
                              <ExternalLink aria-hidden="true" className="size-3" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      {/* 5. Methodology */}
      <section aria-labelledby="metodologi-heading" className="scroll-mt-20 space-y-4" id="metodologi">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight" id="metodologi-heading">
            <BookOpen aria-hidden="true" className="size-4 text-primary" />
            Metodologi &amp; Definisi Perhitungan
          </h2>
          <p className="text-xs text-muted-foreground">
            Rumus kebutuhan, klasifikasi swasembada FAO 1999, serta mekanisme algoritma pencocokan
            pemasok–penerima.
          </p>
        </div>

        {contentQuery.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-44 w-full rounded-xl" />
            <div className="grid gap-4 md:grid-cols-3">
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          </div>
        ) : contentQuery.error ? (
          <SectionRetryAlert
            error={contentQuery.error}
            fallback="Terjadi kesalahan saat mengambil konten metodologi dari API."
            onRetry={() => void contentQuery.refetch()}
            title="Gagal memuat dokumen metodologi dan batasan"
          />
        ) : (
          <div className="space-y-4">
            {methodologyItem ? (
              <Card>
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{methodologyItem.title}</CardTitle>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Diperbarui: {formatTanggalWaktuId(methodologyItem.updated_at)}
                  </span>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                    {methodologyItem.body_md}
                  </p>
                </CardContent>
              </Card>
            ) : null}

            {/* Rumus Utama */}
            <div className="grid gap-4 md:grid-cols-3">
              {FORMULA_CARDS.map((card) => (
                <Card className="gap-2 py-4" key={card.step}>
                  <CardHeader className="px-4">
                    <CardDescription>{card.step}</CardDescription>
                    <CardTitle className="text-sm font-semibold">{card.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 text-xs leading-relaxed text-muted-foreground">
                    <code className="block rounded bg-muted px-2 py-1.5 font-mono text-[11px] text-foreground">
                      {card.formula}
                    </code>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Ambang Status FAO 1999 & Algoritma Matching */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Scale aria-hidden="true" className="size-4 text-primary" />
                    Klasifikasi Status (Kriteria FAO 1999)
                  </CardTitle>
                  <CardDescription>
                    Status provinsi ditentukan oleh ambang rasio swasembada (bukan tanda positif
                    atau negatif rice balance semata).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {SEMUA_STATUS.map((status) => {
                    const info = tampilanStatus(status)
                    const thresholdText =
                      status === "surplus"
                        ? "rasio > 1"
                        : status === "balanced"
                          ? "0,90 ≤ rasio ≤ 1,00"
                          : "rasio < 0,90"
                    return (
                      <div
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2.5"
                        key={status}
                      >
                        <div className="flex items-center gap-2">
                          <Badge className={info.kelas} variant="outline">
                            {info.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{info.keterangan}</span>
                        </div>
                        <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                          {thresholdText}
                        </code>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Algoritma Matching Distribusi (Greedy v1)</CardTitle>
                  <CardDescription>
                    Mencocokkan kekurangan provinsi defisit dengan surplus provinsi terdekat.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-2.5">
                    {MATCHING_STEPS.map((step, index) => (
                      <li className="flex gap-3 text-xs leading-relaxed text-muted-foreground" key={step}>
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary tabular-nums">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </section>

      {/* 6. Batasan Klaim (#batasan) */}
      <section aria-labelledby="batasan-heading" className="scroll-mt-20" id="batasan">
        {contentQuery.isLoading ? (
          <Skeleton className="h-36 w-full rounded-xl" />
        ) : (
          <Card className="border-amber-500/40 bg-amber-500/[0.04]">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle
                  aria-hidden="true"
                  className="size-5 shrink-0 text-amber-600 dark:text-amber-400"
                />
                <CardTitle className="text-base" id="batasan-heading">
                  {limitationsItem?.title ?? "Batasan Klaim"}
                </CardTitle>
              </div>
              {limitationsItem?.updated_at ? (
                <span className="text-xs text-muted-foreground tabular-nums">
                  Diperbarui: {formatTanggalWaktuId(limitationsItem.updated_at)}
                </span>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed whitespace-pre-line text-foreground">
                {limitationsItem?.body_md ??
                  "Balance = produksi beras dikurangi estimasi konsumsi, bukan stok beras aktual. Jarak diukur sebagai garis lurus antar-titik pusat provinsi. Rekomendasi bersifat potensial berbasis data tahunan dan bukan rencana logistik."}
              </p>
              <p className="text-xs text-muted-foreground">
                Kebutuhan memakai estimasi konsumsi rumah tangga per kapita, sehingga kebutuhan
                industri, hotel/restoran, stok Bulog, impor, dan susut pangan tidak tercakup dalam
                angka ini.
              </p>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}
