import { useMemo, useState } from "react"
import { AlertCircle, CheckCircle2, Eye, Plus, Upload, XCircle } from "lucide-react"
import { Link } from "react-router-dom"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  useAdminVersions,
  VERSION_STATUS_META,
  type VersionStatus,
} from "@/features/admin/adminData"
import { formatTanggalWaktuId } from "@/features/data/dataTransparencyData"

export function AdminVersionsPage() {
  const [tahunFilter, setTahunFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<"" | VersionStatus>("")

  const parsedTahun = useMemo(() => {
    const trimmed = tahunFilter.trim()
    if (!trimmed) return undefined
    const n = Number(trimmed)
    return Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : undefined
  }, [tahunFilter])

  const versionsQuery = useAdminVersions({
    tahun: parsedTahun,
    status: statusFilter || undefined,
  })

  const items = versionsQuery.data?.items ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Daftar Versi Dataset</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Satu tahun dapat memiliki beberapa versi, tetapi hanya satu versi berstatus published
            yang tampil di situs publik.
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/versi/baru">
            <Plus aria-hidden="true" className="size-4" />
            Upload Versi Baru
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Filter Versi</CardTitle>
          <CardDescription>Saring daftar versi berdasarkan tahun atau status.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="filter-tahun">Tahun</Label>
              <Input
                id="filter-tahun"
                inputMode="numeric"
                max={2100}
                min={2000}
                onChange={(e) => setTahunFilter(e.target.value)}
                placeholder="Semua tahun (mis. 2025)"
                type="number"
                value={tahunFilter}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-status">Status</Label>
              <select
                id="filter-status"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                onChange={(e) => setStatusFilter(e.target.value as "" | VersionStatus)}
                value={statusFilter}
              >
                <option value="">Semua status</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="flex items-end">
              <Button
                disabled={!tahunFilter && !statusFilter}
                onClick={() => {
                  setTahunFilter("")
                  setStatusFilter("")
                }}
                type="button"
                variant="outline"
              >
                Reset Filter
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {versionsQuery.error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Gagal memuat daftar versi</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {versionsQuery.error instanceof Error
                ? versionsQuery.error.message
                : "Terjadi kesalahan saat mengambil data versi."}
            </span>
            <Button onClick={() => void versionsQuery.refetch()} size="sm" variant="outline">
              Coba Lagi
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Versi Tersimpan</CardTitle>
            <CardDescription>
              {versionsQuery.isLoading
                ? "Memuat daftar versi..."
                : `${items.length} versi ditemukan.`}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {versionsQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Upload aria-hidden="true" className="size-8 text-muted-foreground" />
              <div>
                <p className="font-medium">Belum ada versi yang cocok</p>
                <p className="text-sm text-muted-foreground">
                  Ubah filter pencarian atau unggah versi dataset baru.
                </p>
              </div>
              <Button asChild size="sm">
                <Link to="/admin/versi/baru">Upload Versi Baru</Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tahun</TableHead>
                  <TableHead>Versi</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Validasi</TableHead>
                  <TableHead>Catatan</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead>Dipublish</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((v) => {
                  const statusMeta = VERSION_STATUS_META[v.status]
                  return (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium tabular-nums">{v.tahun}</TableCell>
                      <TableCell className="font-mono text-xs">v{v.version_no}</TableCell>
                      <TableCell>
                        <Badge className={statusMeta.badgeClass} variant="outline">
                          {statusMeta.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {v.lulus_validasi ? (
                          <Badge
                            className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            variant="outline"
                          >
                            <CheckCircle2 aria-hidden="true" className="size-3" />
                            Lulus
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle aria-hidden="true" className="size-3" />
                            Gagal
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {v.notes || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatTanggalWaktuId(v.created_at)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {v.published_at ? (
                          <div>
                            <p>{formatTanggalWaktuId(v.published_at)}</p>
                            {v.published_by_nama ? (
                              <p className="text-[11px]">{v.published_by_nama}</p>
                            ) : null}
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/admin/versi/${v.id}`}>
                            <Eye aria-hidden="true" className="size-3.5" />
                            Detail
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
