import { ArrowUpRight } from "lucide-react"
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
import type { SurplusProvinceItem } from "@/features/distribution/distributionData"
import { formatPersen, formatTon } from "@/lib/format"
import { cn } from "@/lib/utils"

export interface SurplusTableProps {
  items: SurplusProvinceItem[]
  totalSurplusTon: number
  totalTerpakaiTon: number
  totalSisaTon: number
  tahunParam?: number
}

export function SurplusTable({
  items,
  totalSurplusTon,
  totalTerpakaiTon,
  totalSisaTon,
  tahunParam,
}: SurplusTableProps) {
  const tahunSuffix = tahunParam ? `?tahun=${tahunParam}` : ""

  return (
    <Card className="gap-3 overflow-hidden py-4">
      <CardHeader className="px-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowUpRight aria-hidden="true" className="size-4 text-status-surplus" />
              Provinsi Pemasok (Surplus)
            </CardTitle>
            <CardDescription className="mt-1">
              Urut surplus terbesar. Menunjukkan porsi surplus yang terpakai vs sisa cadangan.
            </CardDescription>
          </div>
          <Badge
            className="border-status-surplus/40 bg-status-surplus/10 text-status-surplus tabular-nums"
            variant="outline"
          >
            {items.length} provinsi
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="px-0">
        {items.length === 0 ? (
          <div className="mx-4 rounded-lg border bg-muted/35 p-4 text-xs text-muted-foreground">
            Tidak ada provinsi berstatus surplus pada versi dataset ini.
          </div>
        ) : (
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 pl-4">#</TableHead>
                <TableHead>Provinsi</TableHead>
                <TableHead className="text-right">Surplus</TableHead>
                <TableHead className="text-right">Terpakai</TableHead>
                <TableHead className="text-right">Sisa</TableHead>
                <TableHead className="w-28 pr-4 text-right">Utilisasi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row, idx) => {
                const utilPct =
                  row.rice_balance_ton > 0
                    ? Math.min(100, Math.max(0, (row.terpakai_ton / row.rice_balance_ton) * 100))
                    : 0
                const fullyUsed = row.sisa_ton <= 0.01

                return (
                  <TableRow key={row.kode_bps}>
                    <TableCell className="pl-4 text-muted-foreground tabular-nums">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      <Link
                        className="group inline-flex flex-col hover:underline"
                        to={`/analisis/${row.kode_bps}${tahunSuffix}`}
                      >
                        <span className="font-medium text-foreground group-hover:text-primary">
                          {row.provinsi}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {row.pulau} &middot; BPS {row.kode_bps}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-status-surplus tabular-nums">
                      {formatTon(row.rice_balance_ton)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatTon(row.terpakai_ton)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        fullyUsed ? "text-muted-foreground" : "font-medium text-foreground",
                      )}
                    >
                      {formatTon(row.sisa_ton)}
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[11px] font-medium tabular-nums">
                          {formatPersen(utilPct, 1)}
                        </span>
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              utilPct >= 99.5
                                ? "bg-status-surplus"
                                : utilPct > 0
                                  ? "bg-primary"
                                  : "bg-muted-foreground/30",
                            )}
                            style={{ width: `${utilPct}%` }}
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
                  Total {items.length} Provinsi Surplus
                </TableCell>
                <TableCell className="text-right text-status-surplus tabular-nums">
                  {formatTon(totalSurplusTon)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatTon(totalTerpakaiTon)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatTon(totalSisaTon)}
                </TableCell>
                <TableCell className="pr-4 text-right tabular-nums">
                  {formatPersen(
                    totalSurplusTon > 0 ? (totalTerpakaiTon / totalSurplusTon) * 100 : 0,
                    1,
                  )}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
