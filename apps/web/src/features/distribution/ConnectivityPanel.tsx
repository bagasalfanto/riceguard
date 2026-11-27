import { useMemo } from "react"
import { AlertCircle, Anchor, Compass, MapPin } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type {
  RecommendationItem,
  RecommendationSummary,
} from "@/features/distribution/distributionData"
import { formatAngka, formatKm, formatPersen, formatTon } from "@/lib/format"

export interface ConnectivityPanelProps {
  items: RecommendationItem[]
  summary?: RecommendationSummary
  isLoading: boolean
  error?: unknown
  onRetry: () => void
}

export function ConnectivityPanel({
  items,
  summary,
  isLoading,
  error,
  onRetry,
}: ConnectivityPanelProps) {
  const stats = useMemo(() => {
    let satuCount = 0
    let satuTon = 0
    let lintasCount = 0
    let lintasTon = 0

    for (const item of items) {
      if (item.satu_pulau) {
        satuCount += 1
        satuTon += item.ton
      } else {
        lintasCount += 1
        lintasTon += item.ton
      }
    }

    const totalCount = items.length
    const totalTon = satuTon + lintasTon
    const satuTonShare = totalTon > 0 ? (satuTon / totalTon) * 100 : 0
    const lintasTonShare = totalTon > 0 ? (lintasTon / totalTon) * 100 : 0
    const satuCountShare = totalCount > 0 ? (satuCount / totalCount) * 100 : 0
    const lintasCountShare = totalCount > 0 ? (lintasCount / totalCount) * 100 : 0

    const lintasPreview = items
      .filter((item) => !item.satu_pulau)
      .slice()
      .sort((a, b) => b.ton - a.ton)
      .slice(0, 4)

    return {
      satuCount,
      satuTon,
      satuTonShare,
      satuCountShare,
      lintasCount,
      lintasTon,
      lintasTonShare,
      lintasCountShare,
      totalCount,
      totalTon,
      lintasPreview,
    }
  }, [items])

  return (
    <Card className="flex h-full flex-col gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Compass aria-hidden="true" className="size-4 text-primary" />
          Konektivitas Pulau
        </CardTitle>
        <CardDescription>
          Proporsi pasangan alur dalam klaster pulau yang sama vs lintas pulau.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between gap-4 px-4">
        {error ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Gagal memuat ringkasan konektivitas</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {error instanceof Error
                  ? error.message
                  : "Terjadi kesalahan saat mengambil daftar rekomendasi."}
              </span>
              <Button onClick={onRetry} size="sm" type="button" variant="outline">
                Coba lagi
              </Button>
            </AlertDescription>
          </Alert>
        ) : isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : stats.totalCount === 0 ? (
          <div className="rounded-lg border bg-muted/35 p-4 text-xs text-muted-foreground">
            Belum ada pasangan rekomendasi distribusi untuk dianalisis konektivitasnya.
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {/* Proporsi volume ton 100% bertumpuk */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">Porsi Volume Alokasi</span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatTon(stats.totalTon)}
                  </span>
                </div>
                <div
                  aria-label={`Satu pulau ${formatPersen(stats.satuTonShare, 1)}, Lintas pulau ${formatPersen(stats.lintasTonShare, 1)}`}
                  className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
                  role="img"
                >
                  <div
                    className="h-full bg-status-surplus transition-all"
                    style={{ width: `${stats.satuTonShare}%` }}
                  />
                  <div
                    className="h-full bg-status-balanced transition-all"
                    style={{ width: `${stats.lintasTonShare}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                  <span>Satu pulau {formatPersen(stats.satuTonShare, 1)}</span>
                  <span>Lintas pulau {formatPersen(stats.lintasTonShare, 1)}</span>
                </div>
              </div>

              {/* Kartu Satu Pulau */}
              <div className="rounded-lg border border-status-surplus/30 bg-status-surplus/5 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <MapPin aria-hidden="true" className="size-4 text-status-surplus" />
                    Satu Pulau
                  </span>
                  <Badge className="tabular-nums" variant="secondary">
                    {formatAngka(stats.satuCount)} pasangan (
                    {formatPersen(stats.satuCountShare, 1)})
                  </Badge>
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Total volume</span>
                  <span className="text-base font-semibold text-foreground tabular-nums">
                    {formatTon(stats.satuTon)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                  <span>Porsi volume nasional</span>
                  <span className="font-medium text-foreground tabular-nums">
                    {formatPersen(stats.satuTonShare, 1)}
                  </span>
                </div>
              </div>

              {/* Kartu Lintas Pulau */}
              <div className="rounded-lg border border-status-balanced/40 bg-status-balanced/10 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Anchor aria-hidden="true" className="size-4 text-status-balanced" />
                    Lintas Pulau
                  </span>
                  <Badge className="tabular-nums" variant="outline">
                    {formatAngka(stats.lintasCount)} pasangan (
                    {formatPersen(stats.lintasCountShare, 1)})
                  </Badge>
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Total volume</span>
                  <span className="text-base font-semibold text-foreground tabular-nums">
                    {formatTon(stats.lintasTon)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                  <span>Porsi volume nasional</span>
                  <span className="font-medium text-foreground tabular-nums">
                    {formatPersen(stats.lintasTonShare, 1)}
                  </span>
                </div>
              </div>

              {/* Contoh koneksi lintas pulau terbesar */}
              {stats.lintasPreview.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-foreground">
                    Alur Lintas Pulau Terbesar
                  </div>
                  <ul className="space-y-1.5">
                    {stats.lintasPreview.map((item) => (
                      <li
                        className="flex items-center justify-between gap-2 rounded-md border bg-muted/25 px-2.5 py-1.5 text-xs"
                        key={item.urutan}
                      >
                        <span className="truncate font-medium">
                          {item.dari} &rarr; {item.ke}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                          {formatTon(item.ton)} &middot; {formatKm(item.jarak_km)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            {summary?.rata_jarak_tertimbang_ton !== null &&
            summary?.rata_jarak_tertimbang_ton !== undefined ? (
              <div className="rounded-lg border bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
                <div className="flex items-center justify-between gap-2">
                  <span>Rata-rata jarak tertimbang volume</span>
                  <strong className="text-foreground tabular-nums">
                    {formatKm(summary.rata_jarak_tertimbang_ton)}
                  </strong>
                </div>
                <p className="mt-1 text-[11px]">
                  Pasangan lintas pulau memerlukan angkutan antar-pulau; jarak pada sistem dihitung
                  sebagai jarak garis lurus.
                </p>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
