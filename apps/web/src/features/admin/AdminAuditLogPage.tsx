import { Fragment, useState } from "react"
import { AlertCircle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react"

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
  AUDIT_ACTIONS,
  AUDIT_ACTION_META,
  useAdminAuditLog,
} from "@/features/admin/adminData"
import { formatTanggalWaktuId } from "@/features/data/dataTransparencyData"
import { formatAngka } from "@/lib/format"

const PAGE_LIMIT = 25

function formatDetailJson(detail: unknown): string {
  if (detail === null || detail === undefined) return "Tidak ada rincian JSON."
  if (typeof detail === "string") return detail
  try {
    return JSON.stringify(detail, null, 2)
  } catch {
    return String(detail)
  }
}

export function AdminAuditLogPage() {
  const [actionFilter, setActionFilter] = useState("")
  const [actorInput, setActorInput] = useState("")
  const [actorFilter, setActorFilter] = useState("")
  const [page, setPage] = useState(1)
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})

  const auditQuery = useAdminAuditLog({
    action: actionFilter || undefined,
    actor: actorFilter || undefined,
    page,
    limit: PAGE_LIMIT,
  })

  const items = auditQuery.data?.items ?? []
  const total = auditQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT))

  function toggleRow(rowKey: string) {
    setExpandedIds((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Log Aktivitas Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Catatan audit bersifat insert-only (tidak dapat diubah atau dihapus) untuk seluruh aksi
          pengelolaan dataset dan konten.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Filter Log</CardTitle>
          <CardDescription>Saring aktivitas berdasarkan jenis aksi atau actor/admin.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="log-action">Jenis Aksi</Label>
              <select
                id="log-action"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                onChange={(e) => {
                  setActionFilter(e.target.value)
                  setPage(1)
                }}
                value={actionFilter}
              >
                <option value="">Semua aksi</option>
                {AUDIT_ACTIONS.map((action) => (
                  <option key={action} value={action}>
                    {AUDIT_ACTION_META[action]?.label ?? action} ({action})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="log-actor">Filter Admin / Actor</Label>
              <div className="flex gap-2">
                <Input
                  id="log-actor"
                  onChange={(e) => setActorInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      setActorFilter(actorInput.trim())
                      setPage(1)
                    }
                  }}
                  placeholder="UUID atau nama admin"
                  value={actorInput}
                />
                <Button
                  onClick={() => {
                    setActorFilter(actorInput.trim())
                    setPage(1)
                  }}
                  type="button"
                  variant="outline"
                >
                  Terapkan
                </Button>
              </div>
            </div>

            <div className="flex items-end">
              <Button
                disabled={!actionFilter && !actorFilter && !actorInput}
                onClick={() => {
                  setActionFilter("")
                  setActorInput("")
                  setActorFilter("")
                  setPage(1)
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

      {auditQuery.error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Gagal memuat audit log</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {auditQuery.error instanceof Error
                ? auditQuery.error.message
                : "Terjadi kesalahan saat mengambil log."}
            </span>
            <Button onClick={() => void auditQuery.refetch()} size="sm" variant="outline">
              Coba Lagi
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Riwayat Aksi</CardTitle>
            <CardDescription>
              {auditQuery.isLoading
                ? "Memuat catatan log..."
                : `Menampilkan ${items.length} dari total ${formatAngka(total)} entri.`}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {auditQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Tidak ada log yang cocok dengan filter saat ini.
            </p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Aksi</TableHead>
                    <TableHead>Entitas</TableHead>
                    <TableHead className="text-right">Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const rowKey = String(item.id)
                    const isExpanded = Boolean(expandedIds[rowKey])
                    const meta = AUDIT_ACTION_META[item.action]
                    return (
                      <Fragment key={rowKey}>
                        <TableRow>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatTanggalWaktuId(item.created_at)}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">
                              {item.actor_nama || "Admin"}
                            </div>
                            {item.actor ? (
                              <div className="font-mono text-[11px] text-muted-foreground">
                                {item.actor}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <Badge className={meta?.badgeClass} variant="outline">
                              {meta?.label ?? item.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            <span>{item.entity}</span>
                            {item.entity_id ? (
                              <span className="text-muted-foreground"> · {item.entity_id}</span>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              aria-expanded={isExpanded}
                              onClick={() => toggleRow(rowKey)}
                              size="xs"
                              type="button"
                              variant="ghost"
                            >
                              {isExpanded ? (
                                <>
                                  Tutup
                                  <ChevronUp aria-hidden="true" className="size-3.5" />
                                </>
                              ) : (
                                <>
                                  JSON
                                  <ChevronDown aria-hidden="true" className="size-3.5" />
                                </>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                        {isExpanded ? (
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={5}>
                              <pre className="max-h-72 overflow-auto rounded-md border bg-background p-3 font-mono text-xs whitespace-pre-wrap">
                                {formatDetailJson(item.detail)}
                              </pre>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <p className="text-xs text-muted-foreground">
              Halaman {page} dari {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                disabled={page <= 1 || auditQuery.isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                size="sm"
                type="button"
                variant="outline"
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
                Sebelumnya
              </Button>
              <Button
                disabled={page >= totalPages || auditQuery.isLoading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                size="sm"
                type="button"
                variant="outline"
              >
                Berikutnya
                <ChevronRight aria-hidden="true" className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
