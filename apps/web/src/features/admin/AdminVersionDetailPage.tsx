import { useMemo, useState, type FormEvent } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  History,
  Loader2,
  Pencil,
  RefreshCw,
  Rocket,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Textarea } from "@/components/ui/textarea"
import {
  invalidateDatasetQueries,
  invalidateVersionDetailQueries,
  parseSourceFiles,
  useAdminVersionDetail,
  useAdminVersionProvinces,
  useAdminVersionRecommendations,
  useAdminVersions,
  VERSION_STATUS_META,
  type AdminDeleteVersionResponse,
  type AdminPatchProvinceBody,
  type AdminPatchProvinceResponse,
  type AdminProvinceRow,
  type AdminVersionMutationResponse,
} from "@/features/admin/adminData"
import {
  describeDownloadError,
  downloadExportFile,
  formatTanggalWaktuId,
  formatValidationDetail,
  RAW_SOURCE_LABELS,
  type ValidationRuleStatus,
} from "@/features/data/dataTransparencyData"
import { apiDelete, apiPatch, apiPost } from "@/lib/api"
import { formatAngka, formatJiwa, formatKm, formatPersen, formatTon } from "@/lib/format"
import { tampilanStatus, type StatusProvinsi } from "@/lib/status"

function RuleBadge({ status }: { status: ValidationRuleStatus }) {
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

interface EditDraftValues {
  penduduk_jiwa: string
  konsumsi_kg_kapita_tahun: string
  produksi_padi_ton_gkg: string
  produksi_beras_ton: string
  reason: string
}

export function AdminVersionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const detailQuery = useAdminVersionDetail(id)
  const provincesQuery = useAdminVersionProvinces(id)
  const recommendationsQuery = useAdminVersionRecommendations(id)

  const version = detailQuery.data?.version
  const yearVersionsQuery = useAdminVersions(
    version ? { tahun: version.tahun } : undefined,
  )

  const currentPublishedForYear = useMemo(() => {
    if (!version || !yearVersionsQuery.data) return null
    return (
      yearVersionsQuery.data.items.find(
        (item) => item.tahun === version.tahun && item.status === "published",
      ) ?? null
    )
  }, [version, yearVersionsQuery.data])

  const [provinceSearch, setProvinceSearch] = useState("")
  const [provinceStatusFilter, setProvinceStatusFilter] = useState<"" | StatusProvinsi>("")

  const [editingRow, setEditingRow] = useState<AdminProvinceRow | null>(null)
  const [editValues, setEditValues] = useState<EditDraftValues>({
    penduduk_jiwa: "",
    konsumsi_kg_kapita_tahun: "",
    produksi_padi_ton_gkg: "",
    produksi_beras_ton: "",
    reason: "",
  })
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [recomputing, setRecomputing] = useState(false)
  const [downloadingCsv, setDownloadingCsv] = useState(false)

  const [confirmPublishOpen, setConfirmPublishOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const [confirmRollbackOpen, setConfirmRollbackOpen] = useState(false)
  const [rollingBack, setRollingBack] = useState(false)

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [duplicateOpen, setDuplicateOpen] = useState(false)
  const [duplicateNotes, setDuplicateNotes] = useState("")
  const [duplicating, setDuplicating] = useState(false)

  const filteredProvinces = useMemo(() => {
    const items = provincesQuery.data?.items ?? []
    const q = provinceSearch.trim().toLowerCase()
    return items.filter((row) => {
      if (provinceStatusFilter && row.status !== provinceStatusFilter) return false
      if (!q) return true
      return (
        row.provinsi.toLowerCase().includes(q) ||
        row.kode_bps.toLowerCase().includes(q) ||
        row.pulau.toLowerCase().includes(q)
      )
    })
  }, [provincesQuery.data?.items, provinceSearch, provinceStatusFilter])

  function openEditDialog(row: AdminProvinceRow) {
    setEditingRow(row)
    setEditValues({
      penduduk_jiwa: String(row.penduduk_jiwa),
      konsumsi_kg_kapita_tahun: String(row.konsumsi_kg_kapita_tahun),
      produksi_padi_ton_gkg: String(row.produksi_padi_ton_gkg),
      produksi_beras_ton: String(row.produksi_beras_ton),
      reason: "",
    })
    setEditError(null)
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!id || !editingRow) return

    const reason = editValues.reason.trim()
    if (!reason) {
      setEditError("Alasan perubahan wajib diisi.")
      return
    }

    const penduduk = Number(editValues.penduduk_jiwa)
    const konsumsi = Number(editValues.konsumsi_kg_kapita_tahun)
    const padi = Number(editValues.produksi_padi_ton_gkg)
    const beras = Number(editValues.produksi_beras_ton)

    if (
      !Number.isFinite(penduduk) ||
      penduduk <= 0 ||
      !Number.isFinite(konsumsi) ||
      konsumsi <= 0 ||
      !Number.isFinite(padi) ||
      padi < 0 ||
      !Number.isFinite(beras) ||
      beras < 0
    ) {
      setEditError("Pastikan seluruh nilai numerik valid (penduduk & konsumsi > 0, produksi ≥ 0).")
      return
    }

    const payload: AdminPatchProvinceBody = { reason }
    if (penduduk !== editingRow.penduduk_jiwa) payload.penduduk_jiwa = Math.round(penduduk)
    if (konsumsi !== editingRow.konsumsi_kg_kapita_tahun) {
      payload.konsumsi_kg_kapita_tahun = konsumsi
    }
    if (padi !== editingRow.produksi_padi_ton_gkg) payload.produksi_padi_ton_gkg = padi
    if (beras !== editingRow.produksi_beras_ton) payload.produksi_beras_ton = beras

    if (Object.keys(payload).length === 1) {
      setEditError("Ubah minimal satu nilai input sebelum menyimpan.")
      return
    }

    setSavingEdit(true)
    setEditError(null)
    try {
      await apiPatch<AdminPatchProvinceResponse>(
        `/admin/versions/${id}/provinces/${editingRow.kode_bps}`,
        payload,
      )
      await invalidateVersionDetailQueries(queryClient, id)
      toast.success(`Data ${editingRow.provinsi} diperbarui dan seluruh rekomendasi dihitung ulang.`)
      setEditingRow(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan perubahan provinsi."
      setEditError(msg)
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleRecompute() {
    if (!id) return
    setRecomputing(true)
    try {
      await apiPost<AdminVersionMutationResponse>(`/admin/versions/${id}/recompute`, {})
      await invalidateVersionDetailQueries(queryClient, id)
      toast.success("Perhitungan ulang 38 provinsi dan rekomendasi selesai.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghitung ulang versi.")
    } finally {
      setRecomputing(false)
    }
  }

  async function handlePublish() {
    if (!id || !version) return
    setPublishing(true)
    try {
      await apiPost<AdminVersionMutationResponse>(`/admin/versions/${id}/publish`, {})
      await Promise.all([
        invalidateVersionDetailQueries(queryClient, id),
        invalidateDatasetQueries(queryClient, version.tahun),
      ])
      toast.success(`Tahun ${version.tahun} v${version.version_no} berhasil dipublikasikan.`)
      setConfirmPublishOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mempublikasikan versi.")
    } finally {
      setPublishing(false)
    }
  }

  async function handleRollback() {
    if (!id || !version) return
    setRollingBack(true)
    try {
      await apiPost<AdminVersionMutationResponse>(`/admin/versions/${id}/rollback`, {})
      await Promise.all([
        invalidateVersionDetailQueries(queryClient, id),
        invalidateDatasetQueries(queryClient, version.tahun),
      ])
      toast.success(
        `Rollback berhasil: Tahun ${version.tahun} v${version.version_no} kini aktif di publik.`,
      )
      setConfirmRollbackOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal melakukan rollback versi.")
    } finally {
      setRollingBack(false)
    }
  }

  async function handleDeleteDraft() {
    if (!id || !version) return
    setDeleting(true)
    try {
      await apiDelete<AdminDeleteVersionResponse>(`/admin/versions/${id}`)
      await invalidateDatasetQueries(queryClient, version.tahun)
      toast.success(`Draft Tahun ${version.tahun} v${version.version_no} telah dihapus.`)
      setConfirmDeleteOpen(false)
      navigate("/admin/versi")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus draft.")
    } finally {
      setDeleting(false)
    }
  }

  async function handleDuplicate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!id || !version) return
    const trimmed = duplicateNotes.trim()
    if (!trimmed) {
      toast.error("Catatan untuk draft baru wajib diisi.")
      return
    }
    setDuplicating(true)
    try {
      const res = await apiPost<AdminVersionMutationResponse>(
        `/admin/versions/${id}/duplicate`,
        { notes: trimmed },
      )
      await invalidateDatasetQueries(queryClient, version.tahun)
      toast.success(`Draft baru v${res.version.version_no} dibuat dari v${version.version_no}.`)
      setDuplicateOpen(false)
      navigate(`/admin/versi/${res.version.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menduplikat versi.")
    } finally {
      setDuplicating(false)
    }
  }

  async function handleDownloadCsv() {
    if (!id || !version) return
    setDownloadingCsv(true)
    try {
      const query =
        version.status === "published" ? { tahun: version.tahun } : { version_id: id }
      const savedName = await downloadExportFile(
        "/exports/provinces.csv",
        query,
        `riceguard-provinsi-${version.tahun}-v${version.version_no}.csv`,
      )
      toast.success(`Berhasil mengunduh ${savedName}`)
    } catch (err) {
      toast.error(describeDownloadError(err).message)
    } finally {
      setDownloadingCsv(false)
    }
  }

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  if (detailQuery.error || !detailQuery.data || !version) {
    return (
      <div className="space-y-4">
        <Button asChild size="sm" variant="ghost">
          <Link to="/admin/versi">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Kembali ke Daftar Versi
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Gagal memuat detail versi</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {detailQuery.error instanceof Error
                ? detailQuery.error.message
                : "Versi tidak ditemukan."}
            </span>
            <Button onClick={() => void detailQuery.refetch()} size="sm" variant="outline">
              Coba Lagi
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const { validasi, ringkasan, source_files, edits } = detailQuery.data
  const statusMeta = VERSION_STATUS_META[version.status]
  const isDraft = version.status === "draft"
  const sourceList = parseSourceFiles(source_files)
  const recommendations = recommendationsQuery.data?.items ?? []

  return (
    <div className="space-y-6">
      <div>
        <Button asChild className="-ml-2 mb-2" size="sm" variant="ghost">
          <Link to="/admin/versi">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Kembali ke Daftar Versi
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight">
                Tahun {version.tahun} · v{version.version_no}
              </h1>
              <Badge className={statusMeta.badgeClass} variant="outline">
                {statusMeta.label}
              </Badge>
              {validasi.lulus ? (
                <Badge
                  className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  variant="outline"
                >
                  <CheckCircle2 aria-hidden="true" className="size-3" />
                  Validasi Lulus
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle aria-hidden="true" className="size-3" />
                  Validasi Gagal
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {version.notes || "Tanpa catatan perubahan."}
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <span>Dibuat: {formatTanggalWaktuId(version.created_at)}</span>
              {version.published_at ? (
                <span>
                  Dipublish: {formatTanggalWaktuId(version.published_at)}
                  {version.published_by_nama ? ` oleh ${version.published_by_nama}` : ""}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Aksi Versi ({statusMeta.label})</CardTitle>
          <CardDescription>{statusMeta.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          {isDraft ? (
            <>
              <Button
                disabled={recomputing}
                onClick={() => void handleRecompute()}
                size="sm"
                variant="outline"
              >
                {recomputing ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <RefreshCw aria-hidden="true" className="size-4" />
                )}
                Hitung Ulang
              </Button>

              <Button asChild size="sm" variant="outline">
                <Link
                  rel="noopener noreferrer"
                  target="_blank"
                  to={`/dashboard?version_id=${version.id}&tahun=${version.tahun}`}
                >
                  <ExternalLink aria-hidden="true" className="size-4" />
                  Preview Publik
                </Link>
              </Button>

              <Button
                disabled={!validasi.lulus || publishing}
                onClick={() => setConfirmPublishOpen(true)}
                size="sm"
              >
                <Rocket aria-hidden="true" className="size-4" />
                Publish
              </Button>

              <Button
                disabled={deleting}
                onClick={() => setConfirmDeleteOpen(true)}
                size="sm"
                variant="destructive"
              >
                <Trash2 aria-hidden="true" className="size-4" />
                Hapus Draft
              </Button>
            </>
          ) : null}

          {version.status === "archived" ? (
            <Button
              disabled={rollingBack}
              onClick={() => setConfirmRollbackOpen(true)}
              size="sm"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              Rollback ke Versi Ini
            </Button>
          ) : null}

          {version.status === "published" || version.status === "archived" ? (
            <>
              <Button
                onClick={() => {
                  setDuplicateNotes(`Salinan dari v${version.version_no} (${version.tahun})`)
                  setDuplicateOpen(true)
                }}
                size="sm"
                variant="outline"
              >
                <Copy aria-hidden="true" className="size-4" />
                Duplikat jadi Draft
              </Button>

              <Button
                disabled={downloadingCsv}
                onClick={() => void handleDownloadCsv()}
                size="sm"
                variant="outline"
              >
                {downloadingCsv ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Download aria-hidden="true" className="size-4" />
                )}
                Unduh CSV
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-3.5">
          <p className="text-xs text-muted-foreground">Produksi Beras</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {formatTon(ringkasan?.produksi_beras_ton)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3.5">
          <p className="text-xs text-muted-foreground">Kebutuhan Beras</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {formatTon(ringkasan?.kebutuhan_beras_ton)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3.5">
          <p className="text-xs text-muted-foreground">Rice Balance</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {formatTon(ringkasan?.rice_balance_ton)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3.5">
          <p className="text-xs text-muted-foreground">Rasio Swasembada</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {ringkasan?.rasio_swasembada !== undefined && ringkasan?.rasio_swasembada !== null
              ? formatAngka(ringkasan.rasio_swasembada, 3)
              : "—"}
          </p>
        </div>
      </div>

      <Tabs defaultValue="provinces">
        <TabsList className="flex-wrap">
          <TabsTrigger value="provinces">
            Data Provinsi ({provincesQuery.data?.items.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="recommendations">
            Rekomendasi ({recommendations.length})
          </TabsTrigger>
          <TabsTrigger value="validation">Validasi ({validasi.aturan.length})</TabsTrigger>
          <TabsTrigger value="history">Riwayat Edit ({edits.length})</TabsTrigger>
        </TabsList>

        <TabsContent className="mt-4 space-y-4" value="provinces">
          {!isDraft ? (
            <Alert>
              <AlertTriangle aria-hidden="true" />
              <AlertTitle>Versi Terkunci ({statusMeta.label})</AlertTitle>
              <AlertDescription>
                Data pada versi berstatus {statusMeta.label.toLowerCase()} tidak dapat diubah.
                Gunakan tombol &ldquo;Duplikat jadi Draft&rdquo; bila ingin melakukan koreksi.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Input
              aria-label="Cari provinsi"
              className="max-w-xs"
              onChange={(e) => setProvinceSearch(e.target.value)}
              placeholder="Cari provinsi, kode BPS, atau pulau..."
              value={provinceSearch}
            />
            <select
              aria-label="Filter status provinsi"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              onChange={(e) => setProvinceStatusFilter(e.target.value as "" | StatusProvinsi)}
              value={provinceStatusFilter}
            >
              <option value="">Semua status</option>
              <option value="surplus">Surplus</option>
              <option value="balanced">Balanced</option>
              <option value="defisit">Defisit</option>
            </select>
          </div>

          {provincesQuery.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : provincesQuery.error ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Gagal memuat tabel provinsi</AlertTitle>
              <AlertDescription>
                {provincesQuery.error instanceof Error
                  ? provincesQuery.error.message
                  : "Terjadi kesalahan."}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kode</TableHead>
                    <TableHead>Provinsi</TableHead>
                    <TableHead className="text-right">Penduduk</TableHead>
                    <TableHead className="text-right">Konsumsi</TableHead>
                    <TableHead className="text-right">Padi (GKG)</TableHead>
                    <TableHead className="text-right">Beras</TableHead>
                    <TableHead className="text-right">Kebutuhan</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Rasio</TableHead>
                    <TableHead>Status</TableHead>
                    {isDraft ? <TableHead className="text-right">Aksi</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProvinces.map((row) => {
                    const st = tampilanStatus(row.status)
                    return (
                      <TableRow key={row.kode_bps}>
                        <TableCell className="font-mono text-xs">{row.kode_bps}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{row.provinsi}</span>
                            {row.is_edited ? (
                              <Badge
                                className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300"
                                variant="outline"
                              >
                                Diedit
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatJiwa(row.penduduk_jiwa)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatAngka(row.konsumsi_kg_kapita_tahun, 1)} kg/kap/thn
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatTon(row.produksi_padi_ton_gkg, 1)}
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
                        {isDraft ? (
                          <TableCell className="text-right">
                            <Button
                              onClick={() => openEditDialog(row)}
                              size="xs"
                              type="button"
                              variant="outline"
                            >
                              <Pencil aria-hidden="true" className="size-3" />
                              Edit
                            </Button>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent className="mt-4" value="recommendations">
          {recommendationsQuery.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : recommendationsQuery.error ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Gagal memuat rekomendasi</AlertTitle>
              <AlertDescription>
                {recommendationsQuery.error instanceof Error
                  ? recommendationsQuery.error.message
                  : "Terjadi kesalahan."}
              </AlertDescription>
            </Alert>
          ) : recommendations.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Tidak ada rekomendasi distribusi pada versi ini.
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Dari (Surplus)</TableHead>
                    <TableHead>Ke (Defisit)</TableHead>
                    <TableHead className="text-right">Alokasi</TableHead>
                    <TableHead className="text-right">Jarak</TableHead>
                    <TableHead className="text-right">Tutup Defisit</TableHead>
                    <TableHead>Penjelasan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recommendations.map((rec) => (
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
                      <TableCell className="max-w-md whitespace-normal text-xs text-muted-foreground">
                        {rec.explanation}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent className="mt-4 space-y-4" value="validation">
          <div className="space-y-3">
            {validasi.aturan.map((rule) => {
              const formatted = formatValidationDetail(rule)
              return (
                <Card key={rule.kode}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{rule.label}</CardTitle>
                        <CardDescription className="font-mono text-xs">{rule.kode}</CardDescription>
                      </div>
                      <RuleBadge status={rule.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground">{formatted.summary}</p>
                    {formatted.rows.length > 0 ? (
                      <dl className="grid gap-1.5 rounded-md bg-muted/40 p-2.5 text-xs sm:grid-cols-2">
                        {formatted.rows.map((item) => (
                          <div key={item.label} className="flex justify-between gap-2">
                            <dt className="text-muted-foreground">{item.label}</dt>
                            <dd className={item.mono ? "font-mono" : "font-medium"}>
                              {item.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">File Sumber Tersimpan</CardTitle>
              <CardDescription>
                Referensi file mentah yang digunakan saat versi ini dibuat.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sourceList.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Tidak ada metadata file mentah tercatat.
                </p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {sourceList.map((sf) => (
                    <li
                      key={`${sf.key}-${sf.nama_file}`}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
                    >
                      <span className="font-medium">
                        {RAW_SOURCE_LABELS[sf.key] ?? sf.key}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {sf.nama_file}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent className="mt-4" value="history">
          {edits.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                <History aria-hidden="true" className="size-7 text-muted-foreground" />
                <p className="font-medium">Belum ada edit manual per provinsi</p>
                <p className="text-sm text-muted-foreground">
                  Seluruh angka pada versi ini masih berasal dari upload awal.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Provinsi</TableHead>
                    <TableHead>Kolom</TableHead>
                    <TableHead className="text-right">Nilai Lama</TableHead>
                    <TableHead className="text-right">Nilai Baru</TableHead>
                    <TableHead>Alasan</TableHead>
                    <TableHead>Admin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {edits.map((edit, idx) => (
                    <TableRow key={String(edit.id ?? `${edit.kode_bps}-${edit.field}-${idx}`)}>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatTanggalWaktuId(edit.edited_at ?? edit.created_at)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {edit.provinsi ? `${edit.provinsi} (${edit.kode_bps})` : edit.kode_bps}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{edit.field}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {edit.old_value ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold">
                        {edit.new_value ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-xs whitespace-normal text-sm">
                        {edit.reason}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {edit.edited_by_nama ||
                          edit.actor_nama ||
                          edit.edited_by ||
                          edit.actor ||
                          "Admin"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        onOpenChange={(open) => {
          if (!open) setEditingRow(null)
        }}
        open={Boolean(editingRow)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Edit Data {editingRow?.provinsi} ({editingRow?.kode_bps})
            </DialogTitle>
            <DialogDescription>
              Ubah kolom input di bawah. Kolom turunan (kebutuhan, rice balance, rasio, status) dan
              seluruh rekomendasi distribusi akan dihitung ulang otomatis oleh server.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={(e) => void handleSaveEdit(e)}>
            {editError ? (
              <Alert variant="destructive">
                <AlertCircle aria-hidden="true" />
                <AlertTitle>Gagal Menyimpan</AlertTitle>
                <AlertDescription>{editError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-penduduk">Penduduk (jiwa)</Label>
                <Input
                  id="edit-penduduk"
                  min={1}
                  onChange={(e) =>
                    setEditValues((prev) => ({ ...prev, penduduk_jiwa: e.target.value }))
                  }
                  required
                  step="1"
                  type="number"
                  value={editValues.penduduk_jiwa}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-konsumsi">Konsumsi (kg/kapita/tahun)</Label>
                <Input
                  id="edit-konsumsi"
                  min={0.01}
                  onChange={(e) =>
                    setEditValues((prev) => ({
                      ...prev,
                      konsumsi_kg_kapita_tahun: e.target.value,
                    }))
                  }
                  required
                  step="any"
                  type="number"
                  value={editValues.konsumsi_kg_kapita_tahun}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-padi">Produksi Padi (ton GKG)</Label>
                <Input
                  id="edit-padi"
                  min={0}
                  onChange={(e) =>
                    setEditValues((prev) => ({
                      ...prev,
                      produksi_padi_ton_gkg: e.target.value,
                    }))
                  }
                  required
                  step="any"
                  type="number"
                  value={editValues.produksi_padi_ton_gkg}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-beras">Produksi Beras (ton)</Label>
                <Input
                  id="edit-beras"
                  min={0}
                  onChange={(e) =>
                    setEditValues((prev) => ({
                      ...prev,
                      produksi_beras_ton: e.target.value,
                    }))
                  }
                  required
                  step="any"
                  type="number"
                  value={editValues.produksi_beras_ton}
                />
              </div>
            </div>

            {editingRow ? (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Kolom Turunan Saat Ini (Read-Only · Dihitung Ulang oleh Server)
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Kebutuhan Beras:</span>{" "}
                    <span className="font-mono font-medium">
                      {formatTon(editingRow.kebutuhan_beras_ton, 1)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Rice Balance:</span>{" "}
                    <span className="font-mono font-medium">
                      {formatTon(editingRow.rice_balance_ton, 1)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Rasio Swasembada:</span>{" "}
                    <span className="font-mono font-medium">
                      {formatAngka(editingRow.rasio_swasembada, 3)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>{" "}
                    <span className="font-medium">{tampilanStatus(editingRow.status).label}</span>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="edit-reason">Alasan Perubahan (Wajib)</Label>
              <Textarea
                id="edit-reason"
                onChange={(e) =>
                  setEditValues((prev) => ({ ...prev, reason: e.target.value }))
                }
                placeholder="Contoh: Koreksi angka rilis tetap BPS provinsi"
                required
                rows={2}
                value={editValues.reason}
              />
            </div>

            <DialogFooter>
              <Button
                disabled={savingEdit}
                onClick={() => setEditingRow(null)}
                type="button"
                variant="outline"
              >
                Batal
              </Button>
              <Button disabled={savingEdit} type="submit">
                {savingEdit ? (
                  <>
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan & Hitung Ulang"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog onOpenChange={setConfirmPublishOpen} open={confirmPublishOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Publish Versi</AlertDialogTitle>
            <AlertDialogDescription>
              {currentPublishedForYear
                ? `Anda akan mengganti versi published Tahun ${version.tahun}: v${currentPublishedForYear.version_no} (published saat ini → diarsipkan) menjadi v${version.version_no} (draft ini → published). Perubahan langsung terlihat di halaman publik.`
                : `Anda akan mempublikasikan Tahun ${version.tahun} v${version.version_no} sebagai versi aktif pertama untuk tahun ${version.tahun} di halaman publik.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={publishing}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={publishing}
              onClick={(e) => {
                e.preventDefault()
                void handlePublish()
              }}
            >
              {publishing ? "Mempublish..." : "Ya, Publish Sekarang"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog onOpenChange={setConfirmRollbackOpen} open={confirmRollbackOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Rollback Versi</AlertDialogTitle>
            <AlertDialogDescription>
              {currentPublishedForYear
                ? `Anda akan melakukan rollback Tahun ${version.tahun}: v${currentPublishedForYear.version_no} (published saat ini → diarsipkan) kembali ke v${version.version_no} (arsip ini → published). Tampilan publik akan berubah dalam beberapa detik.`
                : `Anda akan mempublikasikan ulang arsip Tahun ${version.tahun} v${version.version_no} menjadi versi published aktif.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rollingBack}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={rollingBack}
              onClick={(e) => {
                e.preventDefault()
                void handleRollback()
              }}
            >
              {rollingBack ? "Memproses Rollback..." : "Ya, Rollback ke Versi Ini"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog onOpenChange={setConfirmDeleteOpen} open={confirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Draft Versi?</AlertDialogTitle>
            <AlertDialogDescription>
              Draft Tahun {version.tahun} v{version.version_no} beserta seluruh baris provinsi dan
              rekomendasinya akan dihapus permanen. Tindakan ini tidak memengaruhi versi published
              yang sedang tayang.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault()
                void handleDeleteDraft()
              }}
            >
              {deleting ? "Menghapus..." : "Hapus Draft"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog onOpenChange={setDuplicateOpen} open={duplicateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplikat jadi Draft Baru</DialogTitle>
            <DialogDescription>
              Salin Tahun {version.tahun} v{version.version_no} menjadi draft baru agar dapat
              diedit tanpa mengganggu data publik.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => void handleDuplicate(e)}>
            <div className="space-y-1.5">
              <Label htmlFor="duplicate-notes">Catatan Draft Baru (Wajib)</Label>
              <Textarea
                id="duplicate-notes"
                onChange={(e) => setDuplicateNotes(e.target.value)}
                required
                rows={3}
                value={duplicateNotes}
              />
            </div>
            <DialogFooter>
              <Button
                disabled={duplicating}
                onClick={() => setDuplicateOpen(false)}
                type="button"
                variant="outline"
              >
                Batal
              </Button>
              <Button disabled={duplicating} type="submit">
                {duplicating ? (
                  <>
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                    Menduplikat...
                  </>
                ) : (
                  "Buat Draft Baru"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
