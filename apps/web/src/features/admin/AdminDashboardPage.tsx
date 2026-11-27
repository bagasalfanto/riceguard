import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileText,
  History,
  Layers,
  Upload,
} from "lucide-react"
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
  AUDIT_ACTION_META,
  useAdminAuditLog,
  useAdminVersions,
  VERSION_STATUS_META,
} from "@/features/admin/adminData"
import { formatTanggalWaktuId } from "@/features/data/dataTransparencyData"
import { useAdminSession } from "@/hooks/useAdminSession"
import { formatAngka } from "@/lib/format"

export function AdminDashboardPage() {
  const { admin } = useAdminSession()
  const versionsQuery = useAdminVersions()
  const auditQuery = useAdminAuditLog({ page: 1, limit: 5 })

  const versions = versionsQuery.data?.items ?? []
  const publishedYears = new Set(
    versions.filter((v) => v.status === "published").map((v) => v.tahun),
  ).size
  const draftVersions = versions.filter((v) => v.status === "draft")
  const totalVersions = versions.length
  const recentLogs = auditQuery.data?.items ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ringkasan Panel Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Selamat datang, {admin?.nama ?? "Admin"}. Kelola versi dataset, konten narasi, dan
            pantau jejak audit RiceGuard.
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/versi/baru">
            <Upload aria-hidden="true" className="size-4" />
            Upload Versi Baru
          </Link>
        </Button>
      </div>

      {versionsQuery.error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Gagal memuat ringkasan versi</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {versionsQuery.error instanceof Error
                ? versionsQuery.error.message
                : "Terjadi kesalahan saat mengambil daftar versi."}
            </span>
            <Button onClick={() => void versionsQuery.refetch()} size="sm" variant="outline">
              Coba Lagi
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tahun Published</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {versionsQuery.isLoading ? <Skeleton className="h-9 w-16" /> : formatAngka(publishedYears)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Tahun data yang aktif tampil di halaman publik.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Draft Aktif</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {versionsQuery.isLoading ? (
                <Skeleton className="h-9 w-16" />
              ) : (
                formatAngka(draftVersions.length)
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Versi yang masih dapat diedit sebelum dipublish.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Versi Dataset</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {versionsQuery.isLoading ? <Skeleton className="h-9 w-16" /> : formatAngka(totalVersions)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Mencakup versi draft, published, dan archived.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload aria-hidden="true" className="size-4 text-primary" />
              Upload Versi Baru
            </CardTitle>
            <CardDescription>
              Unggah data produksi, penduduk, dan konsumsi lewat wizard validasi 4 langkah.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline">
              <Link to="/admin/versi/baru">
                Mulai Wizard
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText aria-hidden="true" className="size-4 text-primary" />
              Kelola Konten &amp; Sumber
            </CardTitle>
            <CardDescription>
              Perbarui teks Markdown halaman publik dan metadata sumber resmi BPS/Bapanas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline">
              <Link to="/admin/konten">
                Buka Editor Konten
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History aria-hidden="true" className="size-4 text-primary" />
              Log Aktivitas
            </CardTitle>
            <CardDescription>
              Telusuri riwayat upload, edit provinsi, publish, rollback, dan perubahan konten.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline">
              <Link to="/admin/log">
                Lihat Audit Log
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {draftVersions.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers aria-hidden="true" className="size-4 text-primary" />
                Draft Menunggu Review
              </CardTitle>
              <CardDescription>
                Versi draft berikut belum dipublikasikan ke halaman publik.
              </CardDescription>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link to="/admin/versi">Semua Versi</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="divide-y rounded-lg border">
              {draftVersions.slice(0, 5).map((v) => (
                <div
                  key={v.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        Tahun {v.tahun} · v{v.version_no}
                      </span>
                      <Badge className={VERSION_STATUS_META[v.status].badgeClass} variant="outline">
                        {VERSION_STATUS_META[v.status].label}
                      </Badge>
                      {v.lulus_validasi ? (
                        <Badge
                          className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          variant="outline"
                        >
                          <CheckCircle2 aria-hidden="true" className="size-3" />
                          Valid
                        </Badge>
                      ) : (
                        <Badge variant="destructive">Perlu Cek Validasi</Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {v.notes || "Tanpa catatan"} · Dibuat {formatTanggalWaktuId(v.created_at)}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/admin/versi/${v.id}`}>Buka Detail</Link>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">5 Aktivitas Terbaru</CardTitle>
            <CardDescription>Catatan audit terbaru di sistem admin.</CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/log">Lihat Semua</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {auditQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : auditQuery.error ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Gagal memuat log aktivitas</AlertTitle>
              <AlertDescription>
                {auditQuery.error instanceof Error ? auditQuery.error.message : "Terjadi kesalahan."}
              </AlertDescription>
            </Alert>
          ) : recentLogs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Belum ada aktivitas yang tercatat.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Aksi</TableHead>
                  <TableHead>Entitas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLogs.map((log) => {
                  const meta = AUDIT_ACTION_META[log.action]
                  return (
                    <TableRow key={String(log.id)}>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatTanggalWaktuId(log.created_at)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.actor_nama || log.actor || "Sistem"}
                      </TableCell>
                      <TableCell>
                        <Badge className={meta?.badgeClass} variant="outline">
                          {meta?.label ?? log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {log.entity}
                        {log.entity_id ? ` · ${log.entity_id}` : ""}
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
