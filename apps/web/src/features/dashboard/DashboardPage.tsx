import { AlertCircle, ArrowDownRight, ArrowUpRight } from "lucide-react"
import { Link } from "react-router-dom"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { ChartContainer } from "@/components/charts/ChartContainer"
import { LimitationBanner } from "@/components/layout/LimitationBanner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useProvinces,
  useRankings,
  useSummary,
  type ByRanking,
} from "@/features/dashboard/dashboardData"
import { useTahun } from "@/hooks/useTahun"
import { formatAngka, formatPersen, formatTon } from "@/lib/format"
import { SEMUA_STATUS, tampilanStatus, type StatusProvinsi } from "@/lib/status"
import type { ProvinceItem, PulauBreakdown } from "@/lib/tipe-api"

const WARNA: Record<StatusProvinsi, string> = {
  surplus: "var(--status-surplus)",
  balanced: "var(--status-balanced)",
  defisit: "var(--status-defisit)",
}

const LABEL_RANKING: Record<ByRanking, string> = {
  produksi: "Produksi tertinggi",
  kebutuhan: "Kebutuhan terbesar",
  surplus: "Surplus tertinggi",
  defisit: "Defisit terbesar",
}

function juta(nilai: number): string {
  return formatAngka(nilai / 1_000_000, 1)
}

function singkat(nama: string): string {
  return nama.length > 12 ? `${nama.slice(0, 11)}…` : nama
}

function Delta({ nilai, satuan = "%" }: { nilai: number | null | undefined; satuan?: string }) {
  if (nilai === null || nilai === undefined) return null
  const naik = nilai >= 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs tabular-nums ${
        naik ? "text-status-surplus" : "text-status-defisit"
      }`}
    >
      {naik ? <ArrowUpRight aria-hidden="true" className="size-3" /> : <ArrowDownRight aria-hidden="true" className="size-3" />}
      {satuan === "%" ? formatPersen(Math.abs(nilai)) : formatTon(Math.abs(nilai))}
    </span>
  )
}

function KartuKpi({
  judul,
  nilai,
  keterangan,
  delta,
}: {
  judul: string
  nilai: string
  keterangan: string
  delta?: number | null
}) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <CardDescription>{judul}</CardDescription>
        <CardTitle className="flex flex-wrap items-baseline gap-2 text-xl tabular-nums">
          {nilai}
          <Delta nilai={delta} />
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 text-xs text-muted-foreground">{keterangan}</CardContent>
    </Card>
  )
}

function GrafikProduksiKebutuhan({ data }: { data: ProvinceItem[] }) {
  const terurut = [...data].sort((a, b) => b.produksi_beras_ton - a.produksi_beras_ton)
  const lebar = Math.max(680, terurut.length * 28)

  return (
    <div className="overflow-x-auto pb-2">
      <div style={{ width: lebar }}>
        <ChartContainer height={340} label="Grafik produksi dan kebutuhan beras per provinsi">
          <BarChart
            accessibilityLayer
            data={terurut}
            height={340}
            margin={{ bottom: 56, left: 4, right: 8, top: 8 }}
            width={lebar}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              angle={-45}
              dataKey="provinsi"
              height={70}
              interval={0}
              textAnchor="end"
              tick={{ fontSize: 10 }}
              tickFormatter={singkat}
            />
            <YAxis
              label={{ angle: -90, position: "insideLeft", value: "juta ton", fontSize: 10 }}
              tick={{ fontSize: 10 }}
              tickFormatter={juta}
              width={48}
            />
            <Tooltip
              formatter={(nilai, nama) => [formatTon(Number(nilai ?? 0)), String(nama ?? "")]}
              labelFormatter={(label) => String(label ?? "")}
            />
            <Legend />
            <Bar dataKey="produksi_beras_ton" fill="var(--status-surplus)" name="Produksi" />
            <Bar dataKey="kebutuhan_beras_ton" fill="var(--status-defisit)" name="Kebutuhan" />
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  )
}

function GrafikBalance({ data }: { data: ProvinceItem[] }) {
  const terurut = [...data].sort((a, b) => b.rice_balance_ton - a.rice_balance_ton)

  return (
    <ChartContainer height={340} label="Grafik rice balance per provinsi, warna mengikuti status">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart
          accessibilityLayer
          data={terurut}
          margin={{ bottom: 56, left: 4, right: 8, top: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            angle={-45}
            dataKey="provinsi"
            height={70}
            interval={1}
            textAnchor="end"
            tick={{ fontSize: 10 }}
            tickFormatter={singkat}
          />
          <YAxis
            label={{ angle: -90, position: "insideLeft", value: "juta ton", fontSize: 10 }}
            tick={{ fontSize: 10 }}
            tickFormatter={juta}
            width={48}
          />
          <Tooltip
            formatter={(nilai) => [formatTon(Number(nilai ?? 0)), "Rice balance"]}
            labelFormatter={(label) => String(label ?? "")}
          />
          <Bar dataKey="rice_balance_ton" name="Rice balance">
            {terurut.map((p) => (
              <Cell fill={WARNA[p.status as StatusProvinsi]} key={p.kode_bps} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

function GrafikPulau({ pulau, provinsi }: { pulau: PulauBreakdown[]; provinsi: ProvinceItem[] }) {
  const baris = [
    Object.fromEntries([
      ["label", "Produksi"],
      ...pulau.map((p) => [p.pulau, Math.round(p.porsi_produksi * 1000) / 10]),
    ]),
  ]

  const perPulau = new Map<string, ProvinceItem[]>()
  for (const p of provinsi) {
    perPulau.set(p.pulau, [...(perPulau.get(p.pulau) ?? []), p])
  }

  return (
    <div className="space-y-3">
      <ChartContainer height={110} label="Kontribusi produksi beras per pulau, 100 persen bertumpuk">
        <ResponsiveContainer height="100%" width="100%">
          <BarChart data={baris} layout="vertical" margin={{ left: 0, right: 8 }}>
            <XAxis domain={[0, 100]} hide type="number" unit="%" />
            <YAxis dataKey="label" hide type="category" />
            <Tooltip formatter={(nilai) => [`${Number(nilai ?? 0).toFixed(1)}%`, "Porsi"]} />
            {pulau.map((p, i) => (
              <Bar
                dataKey={p.pulau}
                fill={`var(--seq-${Math.min(5, i + 1)})`}
                key={p.pulau}
                name={p.pulau}
                stackId="pulau"
              >
                {i === pulau.length - 1 ? (
                  <LabelList
                    dataKey={p.pulau}
                    fill="var(--background)"
                    fontSize={10}
                    formatter={(nilai) => `${Number(nilai ?? 0).toFixed(0)}%`}
                    position="center"
                  />
                ) : null}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>

      <ul className="grid gap-1.5 text-xs sm:grid-cols-2">
        {pulau.map((p, i) => {
          const anggota = (perPulau.get(p.pulau) ?? [])
            .sort((a, b) => b.produksi_beras_ton - a.produksi_beras_ton)
            .slice(0, 3)
          return (
            <li className="flex items-start gap-2" key={p.pulau}>
              <span
                aria-hidden="true"
                className="mt-1 size-2.5 shrink-0 rounded-sm"
                style={{ background: `var(--seq-${Math.min(5, i + 1)})` }}
              />
              <span>
                <span className="font-medium text-foreground">{p.pulau}</span>{" "}
                <span className="tabular-nums text-muted-foreground">
                  {formatPersen(p.porsi_produksi * 100)} · {p.jumlah_provinsi} provinsi
                </span>
                <span className="block text-muted-foreground">
                  {anggota.map((a) => a.provinsi).join(", ")}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function DaftarPeringkat({ by, tahun }: { by: ByRanking; tahun?: number }) {
  const query = useRankings(by, tahun)
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-sm">{LABEL_RANKING[by]}</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        {query.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <ol className="space-y-1.5">
            {(query.data?.items ?? []).map((item) => (
              <li key={item.kode_bps}>
                <Link
                  className="flex items-baseline justify-between gap-2 rounded px-1 py-0.5 text-sm hover:bg-accent"
                  to={`/analisis/${item.kode_bps}${tahun ? `?tahun=${tahun}` : ""}`}
                >
                  <span className="truncate">
                    <span className="mr-1.5 text-xs tabular-nums text-muted-foreground">
                      {item.peringkat}.
                    </span>
                    {item.provinsi}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatTon(item.nilai)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

export function DashboardPage() {
  const { tahun } = useTahun()
  const summary = useSummary(tahun)
  const provinces = useProvinces(tahun)

  const error = summary.error ?? provinces.error
  const loading = summary.isLoading || provinces.isLoading

  if (error) {
    return (
      <>
        <LimitationBanner />
        <div className="mx-auto w-full max-w-3xl px-4 py-8">
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Gagal memuat dashboard</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              <span>{error instanceof Error ? error.message : "Terjadi kesalahan saat memuat data."}</span>
              <Button
                onClick={() => {
                  void summary.refetch()
                  void provinces.refetch()
                }}
                size="sm"
                variant="outline"
              >
                Coba lagi
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </>
    )
  }

  if (loading || !summary.data || !provinces.data) {
    return (
      <>
        <LimitationBanner />
        <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-8">
          <Skeleton className="h-8 w-56" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton className="h-24 w-full" key={i} />
            ))}
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
      </>
    )
  }

  const data = summary.data
  const delta = data.delta_tahun_sebelumnya
  const items = provinces.data.items
  const jumlah = items.length
  const totalProduksi = items.reduce((n, p) => n + p.produksi_beras_ton, 0)
  const totalKebutuhan = items.reduce((n, p) => n + p.kebutuhan_beras_ton, 0)
  const selisih = Math.abs(totalProduksi - data.produksi_beras_ton)

  return (
    <>
      <LimitationBanner />

      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Main Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gambaran nasional produksi dan kebutuhan beras {jumlah} provinsi, data {data.tahun}.
          </p>
        </div>

        <section aria-label="KPI nasional" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KartuKpi
            delta={delta?.produksi_persen}
            judul="Produksi beras nasional"
            keterangan="ton, BPS"
            nilai={formatTon(data.produksi_beras_ton)}
          />
          <KartuKpi
            delta={delta?.kebutuhan_persen}
            judul="Estimasi kebutuhan nasional"
            keterangan="ton, penduduk × konsumsi"
            nilai={formatTon(data.kebutuhan_beras_ton)}
          />
          <KartuKpi
            delta={delta?.balance_persen}
            judul="Rice balance nasional"
            keterangan={`rasio swasembada ${data.rasio_swasembada?.toFixed(4) ?? "—"}`}
            nilai={formatTon(data.rice_balance_ton)}
          />
          <Card className="gap-2 py-4">
            <CardHeader className="px-4">
              <CardDescription>Provinsi surplus / balanced / defisit</CardDescription>
              <CardTitle className="text-xl tabular-nums">
                {data.jumlah_status.surplus} / {data.jumlah_status.balanced} / {data.jumlah_status.defisit}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1 px-4">
              {SEMUA_STATUS.map((status) => (
                <Link key={status} to={`/analisis?status=${status}${tahun ? `&tahun=${tahun}` : ""}`}>
                  <Badge className={tampilanStatus(status).kelas} variant="outline">
                    {tampilanStatus(status).label} {data.jumlah_status[status]}
                  </Badge>
                </Link>
              ))}
            </CardContent>
          </Card>
        </section>

        <section aria-label="Visualisasi statistik" className="grid gap-4 lg:grid-cols-2">
          <Card className="gap-3 py-4 lg:col-span-2">
            <CardHeader className="px-4">
              <CardTitle className="text-base">Produksi vs kebutuhan per provinsi</CardTitle>
              <CardDescription>Urut produksi menurun. Geser ke samping di layar sempit.</CardDescription>
            </CardHeader>
            <CardContent className="px-2">
              <GrafikProduksiKebutuhan data={items} />
            </CardContent>
          </Card>

          <Card className="gap-3 py-4">
            <CardHeader className="px-4">
              <CardTitle className="text-base">Rice balance per provinsi</CardTitle>
              <CardDescription>Warna mengikuti status, bukan tanda balance.</CardDescription>
            </CardHeader>
            <CardContent className="px-2">
              <GrafikBalance data={items} />
            </CardContent>
          </Card>

          <Card className="gap-3 py-4">
            <CardHeader className="px-4">
              <CardTitle className="text-base">Kontribusi produksi per pulau</CardTitle>
              <CardDescription>Tujuh pulau, porsi 100%.</CardDescription>
            </CardHeader>
            <CardContent className="px-4">
              <GrafikPulau provinsi={items} pulau={data.pulau_breakdown} />
            </CardContent>
          </Card>
        </section>

        <section aria-label="Statistik regional teratas" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DaftarPeringkat by="produksi" tahun={tahun} />
          <DaftarPeringkat by="kebutuhan" tahun={tahun} />
          <DaftarPeringkat by="surplus" tahun={tahun} />
          <DaftarPeringkat by="defisit" tahun={tahun} />
        </section>

        <p className="text-xs text-muted-foreground tabular-nums">
          Jumlah {jumlah} baris provinsi = {formatTon(totalProduksi)} produksi (selisih{" "}
          {formatTon(selisih)} dari /summary) dan {formatTon(totalKebutuhan)} kebutuhan.
        </p>
      </div>
    </>
  )
}
