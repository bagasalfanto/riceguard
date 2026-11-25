import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  describeReportError,
  downloadExportFile,
  downloadReportPdf,
  ENDPOINT_EKSPOR_LAPORAN,
  formatTanggalId,
  formatTanggalWaktuId,
  getValidationVersionNo,
  KONFIGURASI_LAPORAN,
  useDataSources,
  useMetaYears,
  useProvincesReport,
  useTransparencyContent,
  useValidationReport,
  type FormatLaporan,
  type JenisLaporan,
  type KonfigurasiLaporan,
} from "@/features/reports/reportsData"
import { useTahun } from "@/hooks/useTahun"
import { tampilanStatus } from "@/lib/status"
import type { ProvinceItem, TahunPublished } from "@/lib/tipe-api"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Pemilih Tahun Global (sinkron dengan useTahun & /meta/years)
// ---------------------------------------------------------------------------
interface TahunSelectorProps {
  activeYear: number | undefined
  setTahun: (tahun: number | undefined) => void
  years: TahunPublished[]
  isLoading: boolean
}

function TahunSelector({ activeYear, setTahun, years, isLoading }: TahunSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs">
      <CalendarDays aria-hidden="true" className="size-4 text-muted-foreground" />
      <span className="font-medium text-muted-foreground">Tahun aktif:</span>
      {isLoading ? (
        <Skeleton className="h-6 w-28 rounded" />
      ) : years.length > 1 ? (
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
  )
}

// ---------------------------------------------------------------------------
// Kartu Pilihan Jenis Laporan (matriks PRD §5.9)
// ---------------------------------------------------------------------------
interface KartuPilihLaporanProps {
  config: KonfigurasiLaporan
  dipilih: boolean
  onPilih: () => void
}

const FORMAT_BADGE_CLASS: Record<FormatLaporan, string> = {
  pdf: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  csv: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  excel: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
}

const FORMAT_LABEL: Record<FormatLaporan, string> = {
  pdf: "PDF",
  csv: "CSV",
  excel: "Excel",
}

function KartuPilihLaporan({ config, dipilih, onPilih }: KartuPilihLaporanProps) {
  return (
    <button
      aria-pressed={dipilih}
      className={cn(
        "flex h-full w-full flex-col justify-between rounded-xl border p-4 text-left transition-all focus-visible:outline-2 focus-visible:outline-ring",
        dipilih
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-card hover:border-primary/50 hover:bg-accent/50",
      )}
      onClick={onPilih}
      type="button"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-semibold leading-snug">{config.judul}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{config.deskripsi}</p>
        </div>
        {dipilih ? (
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {config.formatTersedia.map((fmt) => (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide",
              FORMAT_BADGE_CLASS[fmt],
            )}
            key={fmt}
          >
            {FORMAT_LABEL[fmt]}
          </span>
        ))}
        {config.butuhProvinsi ? (
          <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
            Wajib pilih provinsi
          </span>
        ) : null}
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Dropdown Pencari Provinsi (aksesibel, keyboard + klik luar)
// ---------------------------------------------------------------------------
interface PencariProvinsiProps {
  provinces: ProvinceItem[]
  nilai: string
  onChange: (kodeBps: string) => void
  disabled?: boolean
}

function PencariProvinsi({ provinces, nilai, onChange, disabled }: PencariProvinsiProps) {
  const [cari, setCari] = useState("")
  const [terbuka, setTerbuka] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const terpilih = provinces.find((p) => p.kode_bps === nilai)

  const filtered = useMemo(() => {
    const q = cari.trim().toLowerCase()
    if (!q) return provinces
    return provinces.filter(
      (p) => p.provinsi.toLowerCase().includes(q) || p.kode_bps.toLowerCase().includes(q),
    )
  }, [provinces, cari])

  useEffect(() => {
    if (!terbuka) return
    function handleOutsideClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setTerbuka(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setTerbuka(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener("mousedown", handleOutsideClick)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [terbuka])

  function pilihProvinsi(kode: string) {
    onChange(kode)
    setCari("")
    setTerbuka(false)
    triggerRef.current?.focus()
  }

  return (
    <div className="relative w-full max-w-md" ref={containerRef}>
      <label className="mb-1.5 block text-xs font-medium text-foreground" htmlFor="provinsi-trigger">
        Provinsi untuk Laporan Wilayah{" "}
        <span aria-hidden="true" className="text-destructive">
          *
        </span>
      </label>

      <button
        aria-expanded={terbuka}
        aria-haspopup="listbox"
        aria-required="true"
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-background px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-primary/50",
          terpilih ? "text-foreground" : "text-muted-foreground",
        )}
        disabled={disabled}
        id="provinsi-trigger"
        onClick={() => setTerbuka((prev) => !prev)}
        ref={triggerRef}
        type="button"
      >
        <span className="truncate">
          {terpilih ? `${terpilih.provinsi} (${terpilih.kode_bps})` : "Pilih provinsi..."}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            terbuka && "rotate-180",
          )}
        />
      </button>

      {terbuka && !disabled ? (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="flex items-center gap-2 border-b px-2.5 py-2">
            <Search aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              aria-label="Cari nama provinsi atau kode BPS"
              autoFocus
              className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              onChange={(e) => setCari(e.target.value)}
              placeholder="Ketik nama provinsi atau kode BPS..."
              type="text"
              value={cari}
            />
          </div>
          <ul aria-label="Daftar provinsi" className="max-h-60 overflow-y-auto py-1" role="listbox">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-muted-foreground">
                Tidak ada provinsi yang cocok.
              </li>
            ) : (
              filtered.map((p) => {
                const statusView = tampilanStatus(p.status)
                const selected = p.kode_bps === nilai
                return (
                  <li key={p.kode_bps} role="presentation">
                    <button
                      aria-selected={selected}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
                        selected && "bg-accent font-medium",
                      )}
                      onClick={() => pilihProvinsi(p.kode_bps)}
                      role="option"
                      type="button"
                    >
                      <span className="truncate">
                        {p.provinsi}{" "}
                        <span className="text-xs text-muted-foreground tabular-nums">
                          ({p.kode_bps})
                        </span>
                      </span>
                      <Badge className={cn("shrink-0 text-[10px]", statusView.kelas)} variant="outline">
                        {statusView.label}
                      </Badge>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Banner Konfirmasi Versi Dataset sebelum Unduh
// ---------------------------------------------------------------------------
interface BannerVersiDatasetProps {
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  tahun?: number
  versionNo: number | null
  publishedAt: string | null
  publishedByNama: string | null
  notes: string | null
}

function BannerVersiDataset({
  isLoading,
  isError,
  onRetry,
  tahun,
  versionNo,
  publishedAt,
  publishedByNama,
  notes,
}: BannerVersiDatasetProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    )
  }

  if (isError || versionNo === null) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Metadata versi dataset belum tersedia</AlertTitle>
        <AlertDescription className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <span>
            Tombol unduh dinonaktifkan sampai versi dataset yang akan dicetak berhasil dimuat.
          </span>
          <Button
            className="h-7 gap-1.5 text-xs"
            onClick={onRetry}
            size="sm"
            type="button"
            variant="outline"
          >
            <RefreshCw className="size-3" />
            Coba lagi
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="rounded-xl border bg-card px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck
          aria-hidden="true"
          className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
        />
        <span className="text-sm font-semibold">Konfirmasi Versi Dataset pada Laporan</span>
        <Badge className="tabular-nums" variant="secondary">
          v{versionNo}
        </Badge>
        {tahun ? (
          <Badge className="tabular-nums" variant="secondary">
            Tahun {tahun}
          </Badge>
        ) : null}
      </div>
      <dl className="mt-2.5 grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs text-muted-foreground sm:grid-cols-2">
        <div>
          <dt className="inline font-medium text-foreground">Dipublikasikan:</dt>{" "}
          <dd className="inline">{formatTanggalWaktuId(publishedAt)}</dd>
        </div>
        {publishedByNama ? (
          <div>
            <dt className="inline font-medium text-foreground">Diterbitkan oleh:</dt>{" "}
            <dd className="inline">{publishedByNama}</dd>
          </div>
        ) : null}
        {notes ? (
          <div className="sm:col-span-2">
            <dt className="inline font-medium text-foreground">Catatan sumber:</dt>{" "}
            <dd className="inline">{notes}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tombol Unduh & Panel Aksi Per-Format
// ---------------------------------------------------------------------------
interface TombolUnduhProps {
  label: string
  icon: ReactNode
  disabled: boolean
  sedangUnduh: boolean
  onClick: () => void
  variant?: "default" | "outline"
}

function TombolUnduh({
  label,
  icon,
  disabled,
  sedangUnduh,
  onClick,
  variant = "outline",
}: TombolUnduhProps) {
  return (
    <Button
      className="gap-2"
      disabled={disabled || sedangUnduh}
      onClick={onClick}
      size="sm"
      type="button"
      variant={variant}
    >
      {sedangUnduh ? <Loader2 className="size-4 animate-spin" /> : icon}
      {sedangUnduh ? `Mengunduh ${label}...` : label}
    </Button>
  )
}

interface PanelUnduhanProps {
  config: KonfigurasiLaporan
  tahun: number | undefined
  versionNo: number | null
  kodeBps: string
  metaOk: boolean
  metaLoading: boolean
}

function PanelUnduhan({
  config,
  tahun,
  versionNo,
  kodeBps,
  metaOk,
  metaLoading,
}: PanelUnduhanProps) {
  const [pendingFormats, setPendingFormats] = useState<Partial<Record<FormatLaporan, boolean>>>({})
  const [errorInfo, setErrorInfo] = useState<{ format: FormatLaporan; pesan: string } | null>(null)

  useEffect(() => {
    setErrorInfo(null)
  }, [config.jenis, tahun, kodeBps])

  const butuhProvinsiBelumDipilih = config.butuhProvinsi && kodeBps.trim() === ""
  const baseDisabled = !metaOk || metaLoading || butuhProvinsiBelumDipilih
  const versionSuffix = versionNo !== null ? `-v${versionNo}` : ""

  async function handleUnduh(format: FormatLaporan) {
    if (pendingFormats[format]) return
    setPendingFormats((prev) => ({ ...prev, [format]: true }))
    setErrorInfo(null)

    try {
      const query: Record<string, string | number | undefined> = { tahun }
      let namaFile = ""

      if (format === "pdf") {
        if (config.butuhProvinsi) query.kode_bps = kodeBps
        const fallback = `riceguard-laporan-${config.jenis}-${tahun ?? "latest"}${versionSuffix}.pdf`
        namaFile = await downloadReportPdf(config.jenis, query, fallback)
      } else {
        const endpointCfg =
          config.jenis === "rekomendasi"
            ? ENDPOINT_EKSPOR_LAPORAN.rekomendasi
            : ENDPOINT_EKSPOR_LAPORAN["surplus-defisit"]
        const path = format === "csv" ? endpointCfg.csv : endpointCfg.excel
        const ext = format === "csv" ? "csv" : "xlsx"
        const prefix =
          format === "csv" ? endpointCfg.csvFallbackPrefix : endpointCfg.excelFallbackPrefix
        const fallback = `${prefix}-${tahun ?? "latest"}${versionSuffix}.${ext}`
        namaFile = await downloadExportFile(path, query, fallback)
      }

      toast.success(`Berhasil mengunduh ${namaFile}`)
    } catch (err) {
      const info = describeReportError(err)
      setErrorInfo({ format, pesan: info.message })
      toast.error(info.message)
    } finally {
      setPendingFormats((prev) => ({ ...prev, [format]: false }))
    }
  }

  return (
    <div className="space-y-3">
      {butuhProvinsiBelumDipilih ? (
        <Alert>
          <Info className="size-4" />
          <AlertTitle>Pemilihan provinsi diperlukan</AlertTitle>
          <AlertDescription>
            Pilih provinsi pada dropdown di atas sebelum mengunduh PDF Regional Analysis Report.
          </AlertDescription>
        </Alert>
      ) : null}

      {errorInfo ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Gagal mengunduh {FORMAT_LABEL[errorInfo.format]}</AlertTitle>
          <AlertDescription>{errorInfo.pesan}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {config.formatTersedia.includes("pdf") ? (
          <TombolUnduh
            disabled={baseDisabled}
            icon={<FileText className="size-4" />}
            label="Unduh PDF"
            onClick={() => void handleUnduh("pdf")}
            sedangUnduh={Boolean(pendingFormats.pdf)}
            variant="default"
          />
        ) : null}
        {config.formatTersedia.includes("csv") ? (
          <TombolUnduh
            disabled={baseDisabled}
            icon={<Download className="size-4" />}
            label="Unduh CSV"
            onClick={() => void handleUnduh("csv")}
            sedangUnduh={Boolean(pendingFormats.csv)}
          />
        ) : null}
        {config.formatTersedia.includes("excel") ? (
          <TombolUnduh
            disabled={baseDisabled}
            icon={<FileSpreadsheet className="size-4" />}
            label="Unduh Excel"
            onClick={() => void handleUnduh("excel")}
            sedangUnduh={Boolean(pendingFormats.excel)}
          />
        ) : null}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Kartu Pratinjau Seksi & Metadata Footer Laporan
// ---------------------------------------------------------------------------
interface KartuPreviewLaporanProps {
  config: KonfigurasiLaporan
  activeYear: number | undefined
  versionNo: number | null
  selectedProvince: ProvinceItem | undefined
  sourcesSummary: string
  limitationsText: string
}

function KartuPreviewLaporan({
  config,
  activeYear,
  versionNo,
  selectedProvince,
  sourcesSummary,
  limitationsText,
}: KartuPreviewLaporanProps) {
  const tanggalCetak = useMemo(() => formatTanggalId(new Date().toISOString()), [])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ClipboardList aria-hidden="true" className="size-4 text-muted-foreground" />
          <CardTitle className="text-sm">Pratinjau Isi &amp; Footer Laporan</CardTitle>
        </div>
        <CardDescription>
          {config.judul}
          {config.butuhProvinsi && selectedProvince
            ? ` — ${selectedProvince.provinsi} (${selectedProvince.kode_bps})`
            : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Seksi yang disertakan:</p>
          <ul className="space-y-1.5 text-xs">
            {config.seksi.map((s) => (
              <li className="flex items-start gap-2" key={s}>
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                />
                <span className="text-muted-foreground">{s}</span>
              </li>
            ))}
          </ul>
        </div>

        <Separator />

        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Metadata Footer Laporan:</p>
          <dl className="space-y-1.5 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
            <div className="flex justify-between gap-3">
              <dt className="font-medium text-foreground">Versi Dataset</dt>
              <dd className="text-right tabular-nums">
                {versionNo !== null && activeYear
                  ? `v${versionNo} (${activeYear})`
                  : activeYear
                    ? `Tahun ${activeYear}`
                    : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-medium text-foreground">Tanggal Cetak</dt>
              <dd className="text-right">{tanggalCetak}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Sumber Data</dt>
              <dd className="mt-0.5 leading-relaxed">{sourcesSummary}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Batasan Klaim</dt>
              <dd className="mt-0.5 leading-relaxed">{limitationsText}</dd>
            </div>
          </dl>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
          <Printer aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-foreground" />
          <p className="leading-relaxed">
            Output PDF diformat A4 portrait dan menggunakan{" "}
            <strong className="font-medium text-foreground">
              pola garis, label status, serta kontras hitam-putih
            </strong>{" "}
            agar tetap terbaca saat dicetak grayscale.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Halaman Utama: LaporanPage (`/laporan`)
// ---------------------------------------------------------------------------
export function LaporanPage() {
  const { tahun, setTahun } = useTahun()
  const [jenisAktif, setJenisAktif] = useState<JenisLaporan>("nasional")
  const [kodeBps, setKodeBps] = useState<string>("")

  const metaYearsQuery = useMetaYears()
  const validasiQuery = useValidationReport(tahun)
  const provincesQuery = useProvincesReport(tahun)
  const sourcesQuery = useDataSources()
  const contentQuery = useTransparencyContent()

  const years = metaYearsQuery.data?.tahun ?? []
  const activeYear =
    validasiQuery.data?.tahun ??
    tahun ??
    metaYearsQuery.data?.tahun_terbaru ??
    years[0]?.tahun

  const versionNo = getValidationVersionNo(validasiQuery.data)
  const publishedAt = validasiQuery.data?.published_at ?? null
  const publishedByNama = validasiQuery.data?.published_by_nama ?? null
  const notes = validasiQuery.data?.notes ?? null

  const metaOk = !validasiQuery.isLoading && !validasiQuery.isError && versionNo !== null

  const configAktif =
    KONFIGURASI_LAPORAN.find((c) => c.jenis === jenisAktif) ?? KONFIGURASI_LAPORAN[0]

  const provincesData = provincesQuery.data?.items ?? []
  const effectiveKodeBps = provincesData.some((p) => p.kode_bps === kodeBps) ? kodeBps : ""
  const selectedProvince = provincesData.find((p) => p.kode_bps === effectiveKodeBps)

  const sourcesSummary = useMemo(() => {
    const list = sourcesQuery.data ?? []
    if (list.length === 0) return "BPS & Badan Pangan Nasional (Bapanas)"
    return list.map((s) => (s.instansi ? `${s.nama} (${s.instansi})` : s.nama)).join("; ")
  }, [sourcesQuery.data])

  const limitationsText = useMemo(() => {
    const lim = (contentQuery.data ?? []).find((item) => item.key === "limitations")
    if (lim?.body_md) {
      const firstLine = lim.body_md
        .split("\n")
        .map((line) => line.replace(/^[-*#>\s]+/, "").trim())
        .find(Boolean)
      if (firstLine) return firstLine
    }
    return "Estimasi neraca pangan berbasis data tahunan BPS & Bapanas; tidak mencakup stok gudang, aliran perdagangan aktual, atau biaya logistik riil."
  }, [contentQuery.data])

  function handlePilihJenis(jenis: JenisLaporan) {
    setJenisAktif(jenis)
    if (jenis !== "provinsi") {
      setKodeBps("")
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8">
      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="gap-1.5" variant="outline">
                <FileText aria-hidden="true" className="size-3.5 text-primary" />
                Laporan &amp; Ekspor
              </Badge>
              {activeYear ? (
                <Badge className="tabular-nums" variant="secondary">
                  Tahun {activeYear}
                </Badge>
              ) : null}
              {versionNo !== null ? (
                <Badge className="tabular-nums" variant="secondary">
                  v{versionNo}
                </Badge>
              ) : null}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Report &amp; Export
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Pilih jenis laporan, tahun dataset, dan wilayah (khusus laporan analisis regional)
              untuk mengunduh berkas resmi PDF, CSV, atau Excel.
            </p>
          </div>

          <TahunSelector
            activeYear={activeYear}
            isLoading={metaYearsQuery.isLoading}
            setTahun={setTahun}
            years={years}
          />
        </div>
      </header>

      <Separator />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section aria-labelledby="pilih-jenis-heading">
            <h2 className="mb-3 text-sm font-semibold tracking-tight" id="pilih-jenis-heading">
              1. Pilih Jenis Laporan
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {KONFIGURASI_LAPORAN.map((cfg) => (
                <KartuPilihLaporan
                  config={cfg}
                  dipilih={jenisAktif === cfg.jenis}
                  key={cfg.jenis}
                  onPilih={() => handlePilihJenis(cfg.jenis)}
                />
              ))}
            </div>
          </section>

          {jenisAktif === "provinsi" ? (
            <section aria-labelledby="pilih-provinsi-heading">
              <h2
                className="mb-3 text-sm font-semibold tracking-tight"
                id="pilih-provinsi-heading"
              >
                2. Pilih Provinsi
              </h2>
              {provincesQuery.isLoading ? (
                <Skeleton className="h-9 w-full max-w-md rounded-md" />
              ) : provincesQuery.isError ? (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertTitle>Gagal memuat daftar provinsi</AlertTitle>
                  <AlertDescription className="mt-1 flex flex-wrap items-center gap-2">
                    <span>Daftar provinsi tidak dapat dimuat dari API.</span>
                    <Button
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => void provincesQuery.refetch()}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <RefreshCw className="size-3" />
                      Coba lagi
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : (
                <PencariProvinsi
                  disabled={provincesData.length === 0}
                  nilai={effectiveKodeBps}
                  onChange={setKodeBps}
                  provinces={provincesData}
                />
              )}
            </section>
          ) : null}

          <section aria-labelledby="versi-heading">
            <h2 className="mb-3 text-sm font-semibold tracking-tight" id="versi-heading">
              {jenisAktif === "provinsi" ? "3." : "2."} Konfirmasi Versi Dataset
            </h2>
            <BannerVersiDataset
              isError={validasiQuery.isError}
              isLoading={validasiQuery.isLoading}
              notes={notes}
              onRetry={() => void validasiQuery.refetch()}
              publishedAt={publishedAt}
              publishedByNama={publishedByNama}
              tahun={activeYear}
              versionNo={versionNo}
            />
          </section>

          <section aria-labelledby="unduh-heading">
            <h2 className="mb-3 text-sm font-semibold tracking-tight" id="unduh-heading">
              {jenisAktif === "provinsi" ? "4." : "3."} Unduh Laporan
            </h2>
            <PanelUnduhan
              config={configAktif}
              kodeBps={effectiveKodeBps}
              metaLoading={validasiQuery.isLoading}
              metaOk={metaOk}
              tahun={activeYear}
              versionNo={versionNo}
            />
          </section>
        </div>

        <aside aria-label="Pratinjau isi dan metadata laporan" className="space-y-4">
          <KartuPreviewLaporan
            activeYear={activeYear}
            config={configAktif}
            limitationsText={limitationsText}
            selectedProvince={selectedProvince}
            sourcesSummary={sourcesSummary}
            versionNo={versionNo}
          />
        </aside>
      </div>
    </div>
  )
}
