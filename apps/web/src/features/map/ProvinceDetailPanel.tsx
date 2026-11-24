import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  MapPin,
  Minus,
  MousePointerClick,
  Users,
  X,
} from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProvinceRecord } from "@/features/map/mapData"
import { formatAngka, formatJiwa, formatPersen, formatTon } from "@/lib/format"
import { tampilanStatus } from "@/lib/status"
import { cn } from "@/lib/utils"

function StatusIcon({ status }: { status: string }) {
  if (status === "surplus") return <ArrowUpRight aria-hidden="true" className="size-4" />
  if (status === "balanced") return <Minus aria-hidden="true" className="size-4" />
  return <ArrowDownRight aria-hidden="true" className="size-4" />
}

export interface ProvinceDetailPanelProps {
  province: ProvinceRecord | null
  summaryCounts: { surplus: number; balanced: number; defisit: number }
  totalProvinces: number
  tahun?: number
  onClose?: () => void
  inDrawer?: boolean
}

export function ProvinceDetailPanel({
  province,
  summaryCounts,
  totalProvinces,
  tahun,
  onClose,
  inDrawer = false,
}: ProvinceDetailPanelProps) {
  const tahunSuffix = tahun ? `?tahun=${tahun}` : ""

  if (!province) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MousePointerClick aria-hidden="true" className="size-4 text-primary" />
            Pilih Provinsi di Peta
          </CardTitle>
          <CardDescription>
            Klik salah satu poligon provinsi pada peta atau gunakan pencarian di atas (tekan Enter)
            untuk melihat neraca beras dan rinciannya.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-3.5 text-xs">
            <div className="font-medium text-foreground">
              Cakupan Nasional ({totalProvinces} Provinsi)
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border bg-card p-2">
                <div className="text-base font-semibold text-status-surplus tabular-nums">
                  {summaryCounts.surplus}
                </div>
                <div className="text-[11px] text-muted-foreground">Surplus</div>
              </div>
              <div className="rounded-md border bg-card p-2">
                <div className="text-base font-semibold text-status-balanced tabular-nums">
                  {summaryCounts.balanced}
                </div>
                <div className="text-[11px] text-muted-foreground">Balanced</div>
              </div>
              <div className="rounded-md border bg-card p-2">
                <div className="text-base font-semibold text-status-defisit tabular-nums">
                  {summaryCounts.defisit}
                </div>
                <div className="text-[11px] text-muted-foreground">Defisit</div>
              </div>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Gunakan pilihan layer di atas untuk berpindah antara kategori{" "}
            <strong className="text-foreground">Surplus &amp; Defisit</strong>,{" "}
            <strong className="text-foreground">Produksi Beras</strong>, dan{" "}
            <strong className="text-foreground">Kebutuhan Beras</strong>.
          </p>
        </CardContent>
      </Card>
    )
  }

  const statusInfo = tampilanStatus(province.status)
  const balanceSign = province.rice_balance_ton > 0 ? "+" : ""

  const roleNote =
    province.status === "surplus"
      ? "Provinsi ini memiliki surplus dan berpotensi menjadi pemasok terdekat (jarak garis lurus) bagi provinsi defisit."
      : province.status === "defisit"
        ? "Provinsi ini mengalami defisit dan berpotensi menerima alokasi dari provinsi surplus terdekat berdasarkan jarak garis lurus."
        : "Produksi beras provinsi ini memenuhi 90–100% kebutuhan (ambang batas seimbang kriteria swasembada FAO 1999)."

  return (
    <Card className={cn("flex h-full flex-col", inDrawer && "border-0 shadow-none")}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin aria-hidden="true" className="size-3.5 text-primary" />
              <span>
                Kode BPS {province.kode_bps} &middot; {province.pulau}
              </span>
            </div>
            <CardTitle className="mt-1 text-lg">{province.provinsi}</CardTitle>
          </div>
          {onClose ? (
            <Button
              aria-label="Tutup panel detail"
              onClick={onClose}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" className="size-4" />
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        <div className="space-y-4">
          {/* Status & Rice Balance */}
          <div className={cn("rounded-lg border p-3.5", statusInfo.kelas)}>
            <div className="flex items-center justify-between gap-2">
              <Badge className={cn("gap-1 border-current/30 bg-background/70", statusInfo.kelas)} variant="outline">
                <StatusIcon status={province.status} />
                {statusInfo.label}
              </Badge>
              <span className="text-[11px] font-medium opacity-85">Tahun {province.tahun}</span>
            </div>
            <div className="mt-2 text-xl font-semibold tracking-tight tabular-nums">
              {balanceSign}
              {formatTon(province.rice_balance_ton)}
            </div>
            <p className="mt-1 text-xs leading-snug opacity-90">{statusInfo.keterangan}</p>
          </div>

          {/* Grid Angka Utama */}
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="rounded-lg border bg-muted/35 p-2.5">
              <div className="text-muted-foreground">Produksi Beras</div>
              <div className="mt-0.5 text-sm font-semibold tabular-nums">
                {formatTon(province.produksi_beras_ton)}
              </div>
            </div>
            <div className="rounded-lg border bg-muted/35 p-2.5">
              <div className="text-muted-foreground">Estimasi Kebutuhan</div>
              <div className="mt-0.5 text-sm font-semibold tabular-nums">
                {formatTon(province.kebutuhan_beras_ton)}
              </div>
            </div>
            <div className="rounded-lg border bg-muted/35 p-2.5">
              <div className="text-muted-foreground">Rasio Swasembada</div>
              <div className="mt-0.5 text-sm font-semibold tabular-nums">
                {formatPersen(province.rasio_swasembada * 100, 1)}
              </div>
            </div>
            <div className="rounded-lg border bg-muted/35 p-2.5">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Users aria-hidden="true" className="size-3" />
                Penduduk
              </div>
              <div className="mt-0.5 text-sm font-semibold tabular-nums">
                {formatJiwa(province.penduduk_jiwa)}
              </div>
            </div>
            <div className="rounded-lg border bg-muted/35 p-2.5">
              <div className="text-muted-foreground">Konsumsi / Kapita</div>
              <div className="mt-0.5 text-sm font-semibold tabular-nums">
                {formatAngka(province.konsumsi_kg_kapita_tahun, 1)} kg/thn
              </div>
            </div>
            <div className="rounded-lg border bg-muted/35 p-2.5">
              <div className="text-muted-foreground">Produksi Padi (GKG)</div>
              <div className="mt-0.5 text-sm font-semibold tabular-nums">
                {formatTon(province.produksi_padi_ton_gkg)}
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/25 p-3 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Peran potensial: </span>
            {roleNote}
          </div>
        </div>

        <Button asChild className="w-full">
          <Link to={`/analisis/${province.kode_bps}${tahunSuffix}`}>
            Analisis lengkap
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
