import { useCallback, useMemo } from "react"
import { AlertCircle, Download, FileSpreadsheet, Info, RotateCcw } from "lucide-react"
import { Link, useSearchParams } from "react-router-dom"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AllocationExplorer } from "@/features/recommendations/AllocationExplorer"
import {
  downloadRecommendationsCsv,
  useMapProvinces,
  useProvincesGeoJSON,
  useRecommendations,
} from "@/features/recommendations/recommendationsData"
import { useTahun } from "@/hooks/useTahun"

export function OfficialRecommendationsTab() {
  const { tahun } = useTahun()
  const [searchParams, setSearchParams] = useSearchParams()

  const dariKode = searchParams.get("dari") ?? ""
  const keKode = searchParams.get("ke") ?? ""

  const recQuery = useRecommendations(tahun, dariKode || undefined, keKode || undefined)
  const activeYear = recQuery.data?.tahun ?? tahun ?? 2025

  const geoQuery = useProvincesGeoJSON()
  const provincesQuery = useMapProvinces(activeYear)

  const provinces = provincesQuery.data ?? []
  const provincesByCode = provincesQuery.byCode

  const items = recQuery.data?.items ?? []
  const ringkasan = recQuery.data?.ringkasan

  const supplierOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of provinces) {
      if (p.status === "surplus") map.set(p.kode_bps, p.provinsi)
    }
    for (const item of items) {
      if (!map.has(item.dari_kode)) map.set(item.dari_kode, item.dari)
    }
    return Array.from(map.entries())
      .map(([kode_bps, provinsi]) => ({ kode_bps, provinsi }))
      .sort((a, b) => a.provinsi.localeCompare(b.provinsi, "id-ID"))
  }, [provinces, items])

  const recipientOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of provinces) {
      if (p.status === "defisit") map.set(p.kode_bps, p.provinsi)
    }
    for (const item of items) {
      if (!map.has(item.ke_kode)) map.set(item.ke_kode, item.ke)
    }
    return Array.from(map.entries())
      .map(([kode_bps, provinsi]) => ({ kode_bps, provinsi }))
      .sort((a, b) => a.provinsi.localeCompare(b.provinsi, "id-ID"))
  }, [provinces, items])

  const updateFilter = useCallback(
    (key: "dari" | "ke", value: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (!value) next.delete(key)
          else next.set(key, value)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const resetFilters = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete("dari")
        next.delete("ke")
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

  const matchingCodes = useMemo(() => {
    if (!dariKode && !keKode) {
      const all = new Set<string>()
      for (const p of provinces) all.add(p.kode_bps)
      return all
    }
    const filtered = new Set<string>()
    if (dariKode) filtered.add(dariKode)
    if (keKode) filtered.add(keKode)
    for (const item of items) {
      filtered.add(item.dari_kode)
      filtered.add(item.ke_kode)
    }
    return filtered
  }, [dariKode, keKode, provinces, items])

  const tahunSuffix = tahun ? `?tahun=${tahun}` : ""
  const hasFilter = Boolean(dariKode || keKode)

  const handleDownloadCsv = () => {
    if (items.length === 0) return
    const parts = ["rekomendasi-beras", String(activeYear)]
    if (dariKode) parts.push(`dari-${dariKode}`)
    if (keKode) parts.push(`ke-${keKode}`)
    downloadRecommendationsCsv(items, `${parts.join("-")}.csv`)
  }

  return (
    <div className="space-y-5">
      <Card className="py-3">
        <CardContent className="flex flex-wrap items-center gap-3 px-4">
          <label className="flex items-center gap-2 text-xs">
            <span className="font-medium text-muted-foreground">Pemasok:</span>
            <select
              aria-label="Filter provinsi pemasok"
              className="h-8 rounded-md border bg-background px-2.5 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              onChange={(e) => updateFilter("dari", e.target.value)}
              value={dariKode}
            >
              <option value="">Semua pemasok</option>
              {supplierOptions.map((opt) => (
                <option key={opt.kode_bps} value={opt.kode_bps}>
                  {opt.provinsi}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs">
            <span className="font-medium text-muted-foreground">Penerima:</span>
            <select
              aria-label="Filter provinsi penerima"
              className="h-8 rounded-md border bg-background px-2.5 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              onChange={(e) => updateFilter("ke", e.target.value)}
              value={keKode}
            >
              <option value="">Semua penerima</option>
              {recipientOptions.map((opt) => (
                <option key={opt.kode_bps} value={opt.kode_bps}>
                  {opt.provinsi}
                </option>
              ))}
            </select>
          </label>

          {hasFilter ? (
            <Button
              className="h-8 gap-1.5 text-xs"
              onClick={resetFilters}
              size="sm"
              type="button"
              variant="ghost"
            >
              <RotateCcw aria-hidden="true" className="size-3.5" />
              Reset filter
            </Button>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <Button
              disabled={items.length === 0 || recQuery.isLoading}
              onClick={handleDownloadCsv}
              size="sm"
              type="button"
              variant="outline"
            >
              <Download aria-hidden="true" className="size-3.5" />
              Unduh CSV
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link to={`/laporan${tahunSuffix}`}>
                <FileSpreadsheet aria-hidden="true" className="size-3.5" />
                Laporan lengkap
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Alert className="border-primary/25 bg-primary/5">
        <Info aria-hidden="true" className="text-primary" />
        <AlertTitle>Rekomendasi potensial berbasis data tahunan, bukan rencana logistik</AlertTitle>
        <AlertDescription>
          Daftar pasangan disusun berdasarkan kedekatan jarak garis lurus dan keseimbangan beras
          tahunan versi published, bukan penjadwalan pengiriman atau kapasitas angkut nyata.
        </AlertDescription>
      </Alert>

      {recQuery.error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Gagal memuat rekomendasi resmi</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {recQuery.error instanceof Error
                ? recQuery.error.message
                : "Terjadi kesalahan saat mengambil rekomendasi dari API."}
            </span>
            <Button onClick={() => void recQuery.refetch()} size="sm" type="button" variant="outline">
              Coba lagi
            </Button>
          </AlertDescription>
        </Alert>
      ) : recQuery.isLoading || !ringkasan ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((idx) => (
              <Skeleton className="h-24 w-full rounded-xl" key={idx} />
            ))}
          </div>
          <Skeleton className="h-[460px] w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      ) : (
        <AllocationExplorer
          emptyAction={
            hasFilter ? (
              <Button onClick={resetFilters} size="sm" type="button" variant="outline">
                Reset filter
              </Button>
            ) : undefined
          }
          emptyMessage={
            hasFilter
              ? "Tidak ada alur alokasi yang cocok dengan filter pemasok atau penerima ini."
              : "Belum ada rekomendasi alokasi untuk versi dataset ini."
          }
          geoData={geoQuery.data}
          items={items}
          mapDescription="Garis menghubungkan centroid pemasok ke penerima berdasarkan jarak garis lurus. Klik garis atau baris tabel untuk membuka penjelasan."
          mapError={geoQuery.error ?? provincesQuery.error}
          mapLoading={geoQuery.isLoading || provincesQuery.isLoading}
          mapTitle={`Peta Alur Alokasi Resmi (${activeYear})`}
          matchingCodes={matchingCodes}
          onRetryMap={() => {
            void geoQuery.refetch()
            void provincesQuery.refetch()
          }}
          provinces={provinces}
          provincesByCode={provincesByCode}
          summary={ringkasan}
          tableDescription="Daftar pasangan pemasok dan penerima terurut sesuai urutan alokasi algoritma greedy v1. Klik baris untuk melihat penjelasan lengkap."
          tableTitle="Daftar Rekomendasi Resmi"
          tahun={activeYear}
          tahunParam={tahun}
        />
      )}
    </div>
  )
}
