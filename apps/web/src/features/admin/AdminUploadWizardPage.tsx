import { useState, type ChangeEvent } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Save,
  ShieldCheck,
  XCircle,
} from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  invalidateDatasetQueries,
  type AdminCreateVersionResponse,
  type AdminValidateResponse,
} from "@/features/admin/adminData"
import {
  formatValidationDetail,
  type ValidationRuleItem,
  type ValidationRuleStatus,
} from "@/features/data/dataTransparencyData"
import { ApiError, apiPostForm } from "@/lib/api"
import { formatAngka, formatJiwa, formatKm, formatPersen, formatTon } from "@/lib/format"
import { tampilanStatus } from "@/lib/status"
import { cn } from "@/lib/utils"

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024
const ACCEPTED_EXTENSIONS = [".csv", ".txt"]

type WizardStep = 1 | 2 | 3 | 4

type FileSlotKey = "produksi" | "penduduk" | "konsumsi" | "referensi"

const FILE_SLOTS: Array<{
  key: FileSlotKey
  label: string
  required: boolean
  hint: string
}> = [
  {
    key: "produksi",
    label: "Data Produksi Padi & Beras (BPS)",
    required: true,
    hint: "File .txt atau .csv berisi produksi padi (GKG) / beras per provinsi beserta baris total Indonesia.",
  },
  {
    key: "penduduk",
    label: "Data Penduduk (BPS SUPAS)",
    required: true,
    hint: "File .txt atau .csv berisi jumlah penduduk per provinsi beserta baris total Indonesia.",
  },
  {
    key: "konsumsi",
    label: "Data Konsumsi Beras per Kapita (Bapanas)",
    required: true,
    hint: "File .csv atau .txt berisi konsumsi beras kg/kapita/tahun per provinsi.",
  },
  {
    key: "referensi",
    label: "Referensi Provinsi & Titik Pusat (Opsional)",
    required: false,
    hint: "Kosongkan untuk memakai tabel referensi 38 provinsi yang sudah tersimpan di sistem.",
  },
]

const STEP_LABELS: Array<{ step: WizardStep; title: string }> = [
  { step: 1, title: "Tahun & Catatan" },
  { step: 2, title: "Upload File" },
  { step: 3, title: "Validasi" },
  { step: 4, title: "Pratinjau & Simpan" },
]

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function isAllowedFile(file: File): boolean {
  const lower = file.name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

function filterRuleItems(value: unknown): ValidationRuleItem[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is ValidationRuleItem =>
      typeof item === "object" && item !== null && "kode" in item && "label" in item,
  )
}

function extractValidationRulesFromDetails(details: unknown): ValidationRuleItem[] {
  if (!details || typeof details !== "object") return []
  if (Array.isArray(details)) return filterRuleItems(details)
  const record = details as { aturan?: unknown; validasi?: { aturan?: unknown } | null }
  const direct = filterRuleItems(record.aturan)
  if (direct.length > 0) return direct
  if (record.validasi && typeof record.validasi === "object") {
    return filterRuleItems(record.validasi.aturan)
  }
  return []
}

function RuleStatusBadge({ status }: { status: ValidationRuleStatus }) {
  if (status === "lulus") {
    return (
      <Badge
        className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        variant="outline"
      >
        <CheckCircle2 aria-hidden="true" className="size-3" />
        Lulus
      </Badge>
    )
  }
  if (status === "peringatan") {
    return (
      <Badge
        className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        variant="outline"
      >
        <AlertTriangle aria-hidden="true" className="size-3" />
        Peringatan
      </Badge>
    )
  }
  return (
    <Badge variant="destructive">
      <XCircle aria-hidden="true" className="size-3" />
      Gagal
    </Badge>
  )
}

export function AdminUploadWizardPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [step, setStep] = useState<WizardStep>(1)
  const [tahunInput, setTahunInput] = useState("2025")
  const [notes, setNotes] = useState("")
  const [files, setFiles] = useState<Record<FileSlotKey, File | null>>({
    produksi: null,
    penduduk: null,
    konsumsi: null,
    referensi: null,
  })
  const [fileErrors, setFileErrors] = useState<Partial<Record<FileSlotKey, string>>>({})

  const [validating, setValidating] = useState(false)
  const [validateError, setValidateError] = useState<{
    message: string
    code?: string
    failedRules: ValidationRuleItem[]
    rawDetails?: unknown
  } | null>(null)
  const [validateResult, setValidateResult] = useState<AdminValidateResponse | null>(null)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const parsedTahun = Number(tahunInput)
  const isTahunValid =
    Number.isInteger(parsedTahun) && parsedTahun >= 2000 && parsedTahun <= 2100
  const isStep1Valid = isTahunValid && notes.trim().length > 0

  const hasRequiredFiles = Boolean(files.produksi && files.penduduk && files.konsumsi)
  const hasFileErrors = Object.values(fileErrors).some(Boolean)
  const isStep2Valid = hasRequiredFiles && !hasFileErrors

  function handleFileChange(key: FileSlotKey, event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null
    setValidateResult(null)
    setValidateError(null)
    setSaveError(null)

    if (!selected) {
      setFiles((prev) => ({ ...prev, [key]: null }))
      setFileErrors((prev) => ({ ...prev, [key]: undefined }))
      return
    }

    if (!isAllowedFile(selected)) {
      setFiles((prev) => ({ ...prev, [key]: null }))
      setFileErrors((prev) => ({
        ...prev,
        [key]: `Format "${selected.name}" tidak didukung. Gunakan file .csv atau .txt.`,
      }))
      return
    }

    if (selected.size > MAX_UPLOAD_BYTES) {
      setFiles((prev) => ({ ...prev, [key]: null }))
      setFileErrors((prev) => ({
        ...prev,
        [key]: `Ukuran file ${formatFileSize(selected.size)} melebihi batas maksimal 2 MB.`,
      }))
      return
    }

    setFiles((prev) => ({ ...prev, [key]: selected }))
    setFileErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function buildFormData(includeNotes: boolean): FormData {
    const formData = new FormData()
    formData.append("tahun", String(parsedTahun))
    if (includeNotes) {
      formData.append("notes", notes.trim())
    }
    if (files.produksi) formData.append("produksi", files.produksi)
    if (files.penduduk) formData.append("penduduk", files.penduduk)
    if (files.konsumsi) formData.append("konsumsi", files.konsumsi)
    if (files.referensi) formData.append("referensi", files.referensi)
    return formData
  }

  async function runValidation() {
    if (!isStep1Valid || !isStep2Valid) return
    setValidating(true)
    setValidateError(null)
    setValidateResult(null)

    try {
      const res = await apiPostForm<AdminValidateResponse>(
        "/admin/versions/validate",
        buildFormData(false),
      )
      setValidateResult(res)
    } catch (err) {
      if (err instanceof ApiError) {
        const failedRules = extractValidationRulesFromDetails(err.details)
        setValidateError({
          message: err.message,
          code: err.code,
          failedRules,
          rawDetails: err.details,
        })
      } else {
        setValidateError({
          message: err instanceof Error ? err.message : "Gagal memvalidasi file.",
          failedRules: [],
        })
      }
    } finally {
      setValidating(false)
    }
  }

  async function handleSaveDraft() {
    if (!validateResult?.validasi.lulus) return
    setSaving(true)
    setSaveError(null)

    try {
      const res = await apiPostForm<AdminCreateVersionResponse>(
        "/admin/versions",
        buildFormData(true),
      )
      await invalidateDatasetQueries(queryClient, parsedTahun)
      toast.success(
        `Draft Tahun ${res.version.tahun} v${res.version.version_no} berhasil disimpan.`,
      )
      navigate(`/admin/versi/${res.version.id}`)
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Gagal menyimpan versi draft ke server."
      setSaveError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const ringkasan = validateResult?.ringkasan

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button asChild className="-ml-2 mb-2" size="sm" variant="ghost">
            <Link to="/admin/versi">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Kembali ke Daftar Versi
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Upload Versi Dataset Baru</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ikuti 4 langkah untuk memvalidasi file mentah BPS &amp; Bapanas sebelum menyimpannya
            sebagai draft.
          </p>
        </div>
      </div>

      <ol aria-label="Tahapan upload" className="grid gap-2 sm:grid-cols-4">
        {STEP_LABELS.map((item) => {
          const isCurrent = step === item.step
          const isDone = step > item.step
          return (
            <li
              key={item.step}
              className={cn(
                "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm",
                isCurrent && "border-primary bg-primary/5 font-medium text-foreground",
                isDone && "border-emerald-500/40 bg-emerald-500/5 text-foreground",
                !isCurrent && !isDone && "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  isCurrent && "bg-primary text-primary-foreground",
                  isDone && "bg-emerald-600 text-white",
                  !isCurrent && !isDone && "bg-muted text-muted-foreground",
                )}
              >
                {isDone ? <Check aria-hidden="true" className="size-3.5" /> : item.step}
              </span>
              <span className="truncate">{item.title}</span>
            </li>
          )
        })}
      </ol>

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Langkah 1: Pilih Tahun &amp; Catatan Perubahan</CardTitle>
            <CardDescription>
              Tahun menentukan kelompok versi dataset; catatan wajib diisi untuk jejak audit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-w-xs space-y-1.5">
              <Label htmlFor="wizard-tahun">Tahun Dataset</Label>
              <Input
                id="wizard-tahun"
                max={2100}
                min={2000}
                onChange={(e) => {
                  setTahunInput(e.target.value)
                  setValidateResult(null)
                  setValidateError(null)
                }}
                required
                type="number"
                value={tahunInput}
              />
              {!isTahunValid ? (
                <p className="text-xs text-destructive">Masukkan tahun antara 2000 hingga 2100.</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wizard-notes">Catatan Perubahan (Wajib)</Label>
              <Textarea
                id="wizard-notes"
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Pemutakhiran angka produksi BPS 2025 dan konsumsi Bapanas"
                required
                rows={3}
                value={notes}
              />
              {notes.trim().length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Catatan perubahan wajib diisi sebelum melanjutkan.
                </p>
              ) : null}
            </div>

            <div className="flex justify-end pt-2">
              <Button disabled={!isStep1Valid} onClick={() => setStep(2)} type="button">
                Lanjut ke Upload File
                <ArrowRight aria-hidden="true" className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <CardHeader>
            <CardTitle>Langkah 2: Upload File Mentah</CardTitle>
            <CardDescription>
              Unggah 3 file wajib (produksi, penduduk, konsumsi) dan 1 file referensi opsional.
              Maksimal 2 MB per file (.csv atau .txt).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              {FILE_SLOTS.map((slot) => {
                const selected = files[slot.key]
                const err = fileErrors[slot.key]
                return (
                  <div key={slot.key} className="space-y-2 rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <Label className="text-sm font-medium" htmlFor={`file-${slot.key}`}>
                        {slot.label}
                      </Label>
                      <Badge variant={slot.required ? "default" : "secondary"}>
                        {slot.required ? "Wajib" : "Opsional"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{slot.hint}</p>
                    <Input
                      accept=".csv,.txt"
                      aria-invalid={Boolean(err)}
                      id={`file-${slot.key}`}
                      onChange={(e) => handleFileChange(slot.key, e)}
                      type="file"
                    />
                    {selected ? (
                      <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
                        <FileSpreadsheet aria-hidden="true" className="size-3.5 shrink-0" />
                        <span className="truncate">{selected.name}</span>
                        <span className="shrink-0 text-muted-foreground">
                          ({formatFileSize(selected.size)})
                        </span>
                      </p>
                    ) : null}
                    {err ? <p className="text-xs text-destructive">{err}</p> : null}
                  </div>
                )
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <Button onClick={() => setStep(1)} type="button" variant="outline">
                <ArrowLeft aria-hidden="true" className="size-4" />
                Kembali
              </Button>
              <Button
                disabled={!isStep2Valid}
                onClick={() => {
                  setStep(3)
                  void runValidation()
                }}
                type="button"
              >
                Validasi Data
                <ShieldCheck aria-hidden="true" className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <CardHeader>
            <CardTitle>Langkah 3: Hasil Validasi Data (Dry-Run)</CardTitle>
            <CardDescription>
              Server mem-parse file, menghitung 38 provinsi dan rekomendasi distribusi, serta
              menjalankan 5 aturan validasi tanpa menyimpan ke database.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {validating ? (
              <div className="flex items-center gap-3 rounded-lg border p-6">
                <Loader2 aria-hidden="true" className="size-5 animate-spin text-primary" />
                <div>
                  <p className="font-medium">Memvalidasi dan menghitung pratinjau...</p>
                  <p className="text-xs text-muted-foreground">
                    Memeriksa 38 provinsi, agregat BPS, nilai valid, dan perubahan antar-versi.
                  </p>
                </div>
              </div>
            ) : null}

            {validateError ? (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertCircle aria-hidden="true" />
                  <AlertTitle>
                    {validateError.code === "VALIDATION_FAILED"
                      ? "Validasi Data Gagal (422)"
                      : validateError.code === "FILE_TOO_LARGE"
                        ? "Ukuran File Melebihi Batas (413)"
                        : "Validasi Gagal"}
                  </AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>{validateError.message}</p>
                    {validateError.failedRules.length === 0 && validateError.rawDetails ? (
                      <pre className="mt-2 max-h-48 overflow-auto rounded bg-background/80 p-2 font-mono text-xs text-foreground">
                        {typeof validateError.rawDetails === "string"
                          ? validateError.rawDetails
                          : JSON.stringify(validateError.rawDetails, null, 2)}
                      </pre>
                    ) : null}
                  </AlertDescription>
                </Alert>

                {validateError.failedRules.length > 0 ? (
                  <div className="space-y-3">
                    {validateError.failedRules.map((rule) => {
                      const formatted = formatValidationDetail(rule)
                      return (
                        <div
                          key={rule.kode}
                          className={cn(
                            "rounded-lg border p-4",
                            rule.status === "gagal" ? "border-red-500/35" : "border-border",
                          )}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-medium">{rule.label}</p>
                              <p className="font-mono text-xs text-muted-foreground">{rule.kode}</p>
                            </div>
                            <RuleStatusBadge status={rule.status} />
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">{formatted.summary}</p>
                          {formatted.rows.length > 0 ? (
                            <dl className="mt-2 grid gap-1.5 rounded-md bg-muted/40 p-2.5 text-xs sm:grid-cols-2">
                              {formatted.rows.map((row) => (
                                <div key={row.label} className="flex justify-between gap-2">
                                  <dt className="text-muted-foreground">{row.label}</dt>
                                  <dd className={row.mono ? "font-mono" : "font-medium"}>
                                    {row.value}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}

            {validateResult ? (
              <div className="space-y-4">
                <Alert variant={validateResult.validasi.lulus ? "default" : "destructive"}>
                  {validateResult.validasi.lulus ? (
                    <CheckCircle2 aria-hidden="true" className="text-emerald-600" />
                  ) : (
                    <XCircle aria-hidden="true" />
                  )}
                  <AlertTitle>
                    {validateResult.validasi.lulus
                      ? "Seluruh Aturan Wajib Validasi Lulus"
                      : "Validasi Belum Lulus"}
                  </AlertTitle>
                  <AlertDescription>
                    {validateResult.validasi.lulus
                      ? `Ditemukan ${validateResult.pratinjau.length} provinsi dan ${validateResult.rekomendasi.length} rekomendasi distribusi.`
                      : "Perbaiki berkas yang gagal aturan sebelum melanjutkan ke penyimpanan draft."}
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  {validateResult.validasi.aturan.map((rule) => {
                    const formatted = formatValidationDetail(rule)
                    return (
                      <div key={rule.kode} className="rounded-lg border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium">{rule.label}</p>
                            <p className="font-mono text-xs text-muted-foreground">{rule.kode}</p>
                          </div>
                          <RuleStatusBadge status={rule.status} />
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{formatted.summary}</p>
                        {formatted.rows.length > 0 ? (
                          <dl className="mt-2 grid gap-1.5 rounded-md bg-muted/40 p-2.5 text-xs sm:grid-cols-2">
                            {formatted.rows.map((row) => (
                              <div key={row.label} className="flex justify-between gap-2">
                                <dt className="text-muted-foreground">{row.label}</dt>
                                <dd className={row.mono ? "font-mono" : "font-medium"}>
                                  {row.value}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="flex gap-2">
                <Button onClick={() => setStep(2)} type="button" variant="outline">
                  <ArrowLeft aria-hidden="true" className="size-4" />
                  Ganti File
                </Button>
                <Button
                  disabled={validating}
                  onClick={() => void runValidation()}
                  type="button"
                  variant="secondary"
                >
                  Ulangi Validasi
                </Button>
              </div>
              <Button
                disabled={!validateResult?.validasi.lulus || validating}
                onClick={() => setStep(4)}
                type="button"
              >
                Lanjut ke Pratinjau
                <ArrowRight aria-hidden="true" className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 4 && validateResult ? (
        <div className="space-y-6">
          {saveError ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Gagal Menyimpan Draft</AlertTitle>
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Langkah 4: Pratinjau Hasil Hitung &amp; Simpan Draft</CardTitle>
              <CardDescription>
                Tahun {parsedTahun} · Catatan: {notes.trim()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {ringkasan ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Produksi Beras Nasional</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {formatTon(ringkasan.produksi_beras_ton)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Kebutuhan Beras Nasional</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {formatTon(ringkasan.kebutuhan_beras_ton)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Rice Balance</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {formatTon(ringkasan.rice_balance_ton)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Rasio &amp; Status Provinsi</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {ringkasan.rasio_swasembada !== undefined &&
                      ringkasan.rasio_swasembada !== null
                        ? formatAngka(ringkasan.rasio_swasembada, 3)
                        : "—"}
                    </p>
                    {ringkasan.jumlah_status ? (
                      <p className="text-xs text-muted-foreground">
                        Surplus {ringkasan.jumlah_status.surplus} · Balanced{" "}
                        {ringkasan.jumlah_status.balanced} · Defisit{" "}
                        {ringkasan.jumlah_status.defisit}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <Tabs defaultValue="provinces">
                <TabsList>
                  <TabsTrigger value="provinces">
                    Pratinjau Provinsi ({validateResult.pratinjau.length})
                  </TabsTrigger>
                  <TabsTrigger value="recommendations">
                    Rekomendasi Distribusi ({validateResult.rekomendasi.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent className="mt-4" value="provinces">
                  <div className="max-h-[440px] overflow-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Kode</TableHead>
                          <TableHead>Provinsi</TableHead>
                          <TableHead className="text-right">Penduduk</TableHead>
                          <TableHead className="text-right">Konsumsi</TableHead>
                          <TableHead className="text-right">Produksi Beras</TableHead>
                          <TableHead className="text-right">Kebutuhan</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                          <TableHead className="text-right">Rasio</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validateResult.pratinjau.map((row) => {
                          const st = tampilanStatus(row.status)
                          return (
                            <TableRow key={row.kode_bps}>
                              <TableCell className="font-mono text-xs">{row.kode_bps}</TableCell>
                              <TableCell className="font-medium">{row.provinsi}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatJiwa(row.penduduk_jiwa)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatAngka(row.konsumsi_kg_kapita_tahun, 1)} kg/kap/thn
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatTon(row.produksi_beras_ton, 1)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatTon(row.kebutuhan_beras_ton, 1)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatTon(row.rice_balance_ton, 1)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatAngka(row.rasio_swasembada, 3)}
                              </TableCell>
                              <TableCell>
                                <Badge className={st.kelas} variant="outline">
                                  {st.label}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent className="mt-4" value="recommendations">
                  <div className="max-h-[440px] overflow-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Dari (Surplus)</TableHead>
                          <TableHead>Ke (Defisit)</TableHead>
                          <TableHead className="text-right">Alokasi</TableHead>
                          <TableHead className="text-right">Jarak</TableHead>
                          <TableHead className="text-right">Tutup Defisit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validateResult.rekomendasi.map((rec) => (
                          <TableRow key={`${rec.urutan}-${rec.dari_kode}-${rec.ke_kode}`}>
                            <TableCell className="font-mono text-xs">{rec.urutan}</TableCell>
                            <TableCell className="font-medium">{rec.dari}</TableCell>
                            <TableCell className="font-medium">{rec.ke}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatTon(rec.ton, 1)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatKm(rec.jarak_km, 1)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatPersen(rec.persen_kebutuhan_penerima, 1)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
                <Button onClick={() => setStep(3)} type="button" variant="outline">
                  <ArrowLeft aria-hidden="true" className="size-4" />
                  Kembali ke Validasi
                </Button>
                <Button disabled={saving} onClick={() => void handleSaveDraft()} type="button">
                  {saving ? (
                    <>
                      <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                      Menyimpan Draft...
                    </>
                  ) : (
                    <>
                      <Save aria-hidden="true" className="size-4" />
                      Simpan sebagai Draft
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
