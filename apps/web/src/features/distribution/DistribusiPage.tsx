import { useCallback, useMemo } from "react"
import { AlertCircle } from "lucide-react"
import { useSearchParams } from "react-router-dom"

import { LimitationBanner } from "@/components/layout/LimitationBanner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ConnectivityPanel } from "@/features/distribution/ConnectivityPanel"
import { DeficitTable } from "@/features/distribution/DeficitTable"
import { DistanceMatrix } from "@/features/distribution/DistanceMatrix"
import {
  useDistributionOverview,
  useDistributionRecommendations,
  useMapProvinces,
  useProvincesGeoJSON,
} from "@/features/distribution/distributionData"
import { SupplyDemandMap } from "@/features/distribution/SupplyDemandMap"
import { SurplusTable } from "@/features/distribution/SurplusTable"
import { useTahun } from "@/hooks/useTahun"
import { formatAngka, formatPersen, formatTon } from "@/lib/format"

function KpiCard({
  label,
  value,
  hint,
  accentClass,
}: {
  label: string
  value: string
  hint: string
  accentClass?: string
}) {
  return (
    <Card className="gap-1.5 py-4">
      <CardHeader className="px-4">
        <CardDescription className="text-xs">{label}</CardDescription>
        <CardTitle className={`text-xl tabular-nums ${accentClass ?? ""}`}>{value}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 text-xs text-muted-foreground tabular-nums">{hint}</CardContent>
    </Card>
  )
}

export function DistribusiPage() {
  const { tahun } = useTahun()
  const [searchParams, setSearchParams] = useSearchParams()

  const overviewQuery = useDistributionOverview(tahun)
  const activeYear = overviewQuery.data?.tahun ?? tahun ?? 2025

  const recommendationsQuery = useDistributionRecommendations(activeYear)
  const geoQuery = useProvincesGeoJSON()
  const mapProvincesQuery = useMapProvinces(activeYear)

  const overview = overviewQuery.data
  const recommendations = recommendationsQuery.data?.items ?? []
  const recSummary = recommendationsQuery.data?.ringkasan

  const deficitCodes = useMemo(() => {
    const set = new Set<string>()
    for (const d of overview?.defisit ?? []) set.add(d.kode_bps)
    return set
  }, [overview?.defisit])

  const urlDeficit = searchParams.get("defisit")
  const selectedDeficitCode = useMemo(() => {
    const list = overview?.defisit ?? []
    if (list.length === 0) return ""
    if (urlDeficit && deficitCodes.has(urlDeficit)) return urlDeficit
    return list[0].kode_bps
  }, [overview?.defisit, urlDeficit, deficitCodes])

  const handleSelectDeficit = useCallback(
    (kodeBps: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (!kodeBps) next.delete("defisit")
          else next.set("defisit", kodeBps)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const connectivityCounts = useMemo(() => {
    let satu = 0
    let lintas = 0
    for (const item of recommendations) {
      if (item.satu_pulau) satu += 1
      else lintas += 1
    }
    return { satu, lintas }
  }, [recommendations])

  if (overviewQuery.error) {
    return (
      <>
        <LimitationBanner />
        <div className="mx-auto w-full max-w-4xl px-4 py-8">
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Gagal memuat analisis distribusi</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {overviewQuery.error instanceof Error
                  ? overviewQuery.error.message
                  : "Terjadi kesalahan saat menghubungi API distribusi."}
              </span>
              <Button
                onClick={() => void overviewQuery.refetch()}
                size="sm"
                type="button"
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

  if (overviewQuery.isLoading || !overview) {
    return (
      <>
        <LimitationBanner />
        <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-4 w-full max-w-xl" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[0, 1, 2, 3, 4].map((idx) => (
              <Skeleton className="h-24 w-full rounded-xl" key={idx} />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-12">
            <Skeleton className="h-[520px] w-full rounded-xl lg:col-span-8" />
            <Skeleton className="h-[520px] w-full rounded-xl lg:col-span-4" />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Skeleton className="h-96 w-full rounded-xl" />
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        </div>
      </>
    )
  }

  const { ringkasan, surplus, defisit, version } = overview
  const surplusUsedPct =
    ringkasan.total_surplus_ton > 0
      ? (ringkasan.total_terpakai_ton / ringkasan.total_surplus_ton) * 100
      : 0
  const surplusRemainingPct =
    ringkasan.total_surplus_ton > 0
      ? (ringkasan.total_sisa_ton / ringkasan.total_surplus_ton) * 100
      : 0

  const mapError = geoQuery.error ?? mapProvincesQuery.error ?? recommendationsQuery.error
  const mapLoading =
    geoQuery.isLoading || mapProvincesQuery.isLoading || recommendationsQuery.isLoading

  return (
    <>
      <LimitationBanner />

      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Supply &amp; Distribution Analysis
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pemetaan alokasi potensial dari {surplus.length} provinsi surplus ke{" "}
              {defisit.length} provinsi defisit tahun {activeYear} berdasarkan jarak garis lurus.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className="text-xs tabular-nums" variant="secondary">
              Tahun {activeYear} &middot; v{version.version_no}
            </Badge>
            <Badge className="text-xs tabular-nums" variant="outline">
              {surplus.length} surplus &middot; {defisit.length} defisit
            </Badge>
          </div>
        </div>

        {/* Strip KPI Ringkasan */}
        <section
          aria-label="Ringkasan alokasi distribusi beras"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          <KpiCard
            accentClass="text-status-surplus"
            hint={`Dari ${surplus.length} provinsi surplus`}
            label="Total Surplus"
            value={formatTon(ringkasan.total_surplus_ton)}
          />
          <KpiCard
            hint={`${formatPersen(surplusUsedPct, 1)} dari total surplus`}
            label="Dialokasikan"
            value={formatTon(ringkasan.total_terpakai_ton)}
          />
          <KpiCard
            hint={`${formatPersen(surplusRemainingPct, 1)} cadangan surplus`}
            label="Sisa Surplus"
            value={formatTon(ringkasan.total_sisa_ton)}
          />
          <KpiCard
            accentClass={
              ringkasan.persen_defisit_tertutup >= 100
                ? "text-status-surplus"
                : "text-status-balanced"
            }
            hint={`${formatTon(ringkasan.total_terpenuhi_ton)} / ${formatTon(ringkasan.total_defisit_ton)}`}
            label="Defisit Tertutup"
            value={formatPersen(ringkasan.persen_defisit_tertutup, 1)}
          />
          <KpiCard
            hint={
              recommendations.length > 0
                ? `${connectivityCounts.satu} satu pulau · ${connectivityCounts.lintas} lintas pulau`
                : `${defisit.length} provinsi penerima`
            }
            label="Pasangan Alur"
            value={`${formatAngka(ringkasan.jumlah_pasangan)} alur`}
          />
        </section>

        {/* Peta Alur + Panel Konektivitas Pulau */}
        <section
          aria-label="Peta alur alokasi dan konektivitas pulau"
          className="grid gap-4 lg:grid-cols-12"
        >
          <div className="lg:col-span-8">
            <SupplyDemandMap
              deficitCodes={deficitCodes}
              error={mapError}
              flows={recommendations}
              geoData={geoQuery.data}
              isLoading={mapLoading}
              onRetry={() => {
                void geoQuery.refetch()
                void mapProvincesQuery.refetch()
                void recommendationsQuery.refetch()
              }}
              onSelectDeficitProvince={handleSelectDeficit}
              provinces={mapProvincesQuery.data ?? []}
              provincesByCode={mapProvincesQuery.byCode}
              selectedDeficitCode={selectedDeficitCode || null}
              tahun={activeYear}
              tahunParam={tahun}
            />
          </div>

          <div className="lg:col-span-4">
            <ConnectivityPanel
              error={recommendationsQuery.error}
              isLoading={recommendationsQuery.isLoading}
              items={recommendations}
              onRetry={() => void recommendationsQuery.refetch()}
              summary={recSummary}
            />
          </div>
        </section>

        {/* Tabel Surplus & Defisit */}
        <section
          aria-label="Daftar provinsi surplus dan defisit"
          className="grid gap-4 xl:grid-cols-2"
        >
          <SurplusTable
            items={surplus}
            tahunParam={tahun}
            totalSisaTon={ringkasan.total_sisa_ton}
            totalSurplusTon={ringkasan.total_surplus_ton}
            totalTerpakaiTon={ringkasan.total_terpakai_ton}
          />
          <DeficitTable
            items={defisit}
            onSelectDeficit={handleSelectDeficit}
            persenDefisitTertutup={ringkasan.persen_defisit_tertutup}
            selectedDeficitCode={selectedDeficitCode}
            tahunParam={tahun}
            totalDefisitTon={ringkasan.total_defisit_ton}
            totalTerpenuhiTon={ringkasan.total_terpenuhi_ton}
          />
        </section>

        {/* Matriks Jarak & Peringkat Pemasok */}
        <DistanceMatrix
          defisitList={defisit}
          onSelectDeficit={handleSelectDeficit}
          recommendations={recommendations}
          selectedDeficitCode={selectedDeficitCode}
          surplusList={surplus}
          tahun={tahun}
        />
      </div>
    </>
  )
}
