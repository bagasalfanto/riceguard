import { AlertTriangle, ArrowDownRight, ExternalLink } from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { DeficitProvinceItem } from "@/features/distribution/distributionData"
import { formatPersen, formatTon } from "@/lib/format"
import { cn } from "@/lib/utils"

export interface DeficitTableProps {
  items: DeficitProvinceItem[]
  selectedDeficitCode: string
  onSelectDeficit: (kodeBps: string) => void
  totalDefisitTon: number
  totalTerpenuhiTon: number
  persenDefisitTertutup: number
  tahunParam?: number
}

export function DeficitTable({
  items,
  selectedDeficitCode,
  onSelectDeficit,
  totalDefisitTon,
  totalTerpenuhiTon,
  persenDefisitTertutup,
  tahunParam,
}: DeficitTableProps) {
  const tahunSuffix = tahunParam ? `?tahun=${tahunParam}` : ""

  return (
    <Card className="gap-3 overflow-hidden py-4">
      <CardHeader className="px-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowDownRight aria-hidden="true" className="size-4 text-status-defisit" />
              Provinsi Penerima (Defisit)
            </CardTitle>
            <CardDescription className="mt-1">
              Urut prioritas defisit terdalam. Klik baris untuk memeriksa kandidat pemasok pada
              matriks jarak.
            </CardDescription>
          </div>
          <Badge
            className="border-status-defisit/40 bg-status-defisit/10 text-status-defisit tabular-nums"
            variant="outline"
          >
            {items.length} provinsi
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="px-0">
        {items.length === 0 ? (
          <div className="mx-4 rounded-lg border bg-muted/35 p-4 text-xs text-muted-foreground">
            Tidak ada provinsi berstatus defisit pada versi dataset ini.
          </div>
        ) : (
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 pl-4">Prioritas</TableHead>
                <TableHead>Provinsi</TableHead>
                <TableHead className="text-right">Defisit</TableHead>
                <TableHead className="text-right">Rasio Swasembada</TableHead>
                <TableHead className="pr-4 text-right">Terpenuhi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => {
                const isSelected = row.kode_bps === selectedDeficitCode
                const rasioPct = row.rasio_swasembada * 100
                const isUltraLow = row.rasio_swasembada < 0.05
                const isLow = row.rasio_swasembada < 0.3
                const fillPct = Math.min(100, Math.max(0, row.persen_terpenuhi))

                return (
                  <TableRow
                    aria-selected={isSelected}
                    className={cn(
                      "cursor-pointer",
                      isSelected && "bg-primary/10 hover:bg-primary/15",
                    )}
                    data-state={isSelected ? "selected" : undefined}
                    key={row.kode_bps}
                    onClick={() => onSelectDeficit(row.kode_bps)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        onSelectDeficit(row.kode_bps)
                      }
                    }}
                    tabIndex={0}
                  >
                    <TableCell className="pl-4 tabular-nums">
                      <span
                        className={cn(
                          "inline-flex size-6 items-center justify-center rounded-full text-[11px] font-semibold",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground",
                        )}
                      >
                        {row.prioritas}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <span className="truncate">{row.provinsi}</span>
                            {isSelected ? (
                              <Badge className="px-1.5 py-0 text-[10px]" variant="default">
                                Dipilih
                              </Badge>
                            ) : null}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {row.pulau} &middot; BPS {row.kode_bps}
                          </div>
                        </div>
                        <Link
                          aria-label={`Buka analisis lengkap ${row.provinsi}`}
                          className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          onClick={(e) => e.stopPropagation()}
                          title={`Buka analisis ${row.provinsi}`}
                          to={`/analisis/${row.kode_bps}${tahunSuffix}`}
                        >
                          <ExternalLink aria-hidden="true" className="size-3.5" />
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-status-defisit tabular-nums">
                      {formatTon(row.defisit_ton)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {isUltraLow ? (
                        <Badge
                          className="ml-auto gap-1 border-status-defisit/50 bg-status-defisit/15 px-1.5 py-0.5 text-[11px] font-semibold text-status-defisit"
                          variant="outline"
                        >
                          <AlertTriangle aria-hidden="true" className="size-3" />
                          {formatPersen(rasioPct, 1)}
                        </Badge>
                      ) : (
                        <span
                          className={cn(
                            "font-medium",
                            isLow ? "text-status-defisit" : "text-foreground",
                          )}
                        >
                          {formatPersen(rasioPct, 1)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-baseline gap-1.5 tabular-nums">
                          <span className="font-medium text-foreground">
                            {formatTon(row.terpenuhi_ton)}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            ({formatPersen(row.persen_terpenuhi, 1)})
                          </span>
                        </div>
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-status-surplus transition-all"
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="pl-4" colSpan={2}>
                  Total {items.length} Provinsi Defisit
                </TableCell>
                <TableCell className="text-right text-status-defisit tabular-nums">
                  {formatTon(totalDefisitTon)}
                </TableCell>
                <TableCell className="text-right text-[11px] text-muted-foreground">
                  &lt; 5% sangat rendah
                </TableCell>
                <TableCell className="pr-4 text-right tabular-nums">
                  {formatTon(totalTerpenuhiTon)} ({formatPersen(persenDefisitTertutup, 1)})
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
