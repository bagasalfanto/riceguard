/**
 * Kontrak data dan query TanStack untuk halaman Historical Trends (`/tren`).
 * Seluruh metrik, deret multi-tahun, dan delta antar tahun berasal langsung dari API.
 */
import { useQuery } from "@tanstack/react-query"

import { ApiError, apiGet } from "@/lib/api"
import type { MetaYears, ProvincesResponse } from "@/lib/tipe-api"

export type TrendMetric = "produksi" | "kebutuhan" | "balance" | "rasio"

export interface TrendYearPoint {
  tahun: number
  nasional: number
  per_provinsi: Record<string, number | null>
}

export interface TrendProvinceMeta {
  kode_bps: string
  nama: string
}

export interface TrendsResponse {
  metric: TrendMetric
  butuh_minimal_2_tahun: boolean
  alasan: string | null
  tahun_tersedia: number[]
  deret: TrendYearPoint[]
  provinsi_meta: TrendProvinceMeta[]
}

export interface CompareNationalSummary {
  produksi_a: number
  produksi_b: number
  delta_produksi: number
  delta_produksi_persen: number | null
  kebutuhan_a: number
  kebutuhan_b: number
  delta_kebutuhan: number
  balance_a: number
  balance_b: number
  delta_balance: number
  surplus_count_a: number
  surplus_count_b: number
  defisit_count_a: number
  defisit_count_b: number
  balanced_count_a: number
  balanced_count_b: number
}

export interface CompareProvinceItem {
  kode_bps: string
  nama: string
  pulau: string
  status_a: string | null
  status_b: string | null
  produksi_a: number | null
  produksi_b: number | null
  delta_produksi: number | null
  delta_produksi_persen: number | null
  kebutuhan_a: number | null
  kebutuhan_b: number | null
  delta_kebutuhan: number | null
  balance_a: number | null
  balance_b: number | null
  delta_balance: number | null
  rasio_a: number | null
  rasio_b: number | null
  delta_rasio: number | null
}

export interface CompareStatusChange {
  kode_bps: string
  nama: string
  status_a: string
  status_b: string
  delta_produksi: number | null
  delta_balance: number | null
}

export interface CompareResponse {
  tahun_a: number | null
  tahun_b: number | null
  butuh_minimal_2_tahun: boolean
  alasan: string | null
  nasional: CompareNationalSummary | null
  items: CompareProvinceItem[]
  status_berubah: CompareStatusChange[]
}

export function useMetaYears() {
  return useQuery({
    queryKey: ["meta-years"],
    queryFn: () => apiGet<MetaYears>("/meta/years"),
    staleTime: 5 * 60 * 1000,
  })
}

export function useTrends(
  metric: TrendMetric,
  kodeBpsList: string[] = [],
  enabled = true,
) {
  const kodeParam = kodeBpsList.length > 0 ? kodeBpsList.join(",") : undefined

  return useQuery({
    queryKey: ["trends", metric, kodeParam ?? ""],
    queryFn: () =>
      apiGet<TrendsResponse>("/trends", {
        metric,
        kode_bps: kodeParam,
      }),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, err) => {
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) return false
      return failureCount < 1
    },
  })
}

export function useCompare(tahunA?: number, tahunB?: number, enabled = true) {
  return useQuery({
    queryKey: ["compare", tahunA ?? null, tahunB ?? null],
    queryFn: () =>
      apiGet<CompareResponse>("/compare", {
        tahun_a: tahunA,
        tahun_b: tahunB,
      }),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, err) => {
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) return false
      return failureCount < 1
    },
  })
}

export function useProvincesList(tahun?: number, enabled = true) {
  return useQuery({
    queryKey: ["trends-provinces", tahun ?? "latest"],
    queryFn: () =>
      apiGet<ProvincesResponse>("/provinces", {
        tahun,
        sort: "provinsi",
        order: "asc",
        limit: 100,
      }),
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}

export function formatApiErrorDetail(
  err: unknown,
  fallback: string,
): { message: string; alasan: string | null } {
  if (err instanceof ApiError) {
    const details =
      err.details && typeof err.details === "object"
        ? (err.details as { alasan?: unknown })
        : null
    const alasan =
      typeof details?.alasan === "string" && details.alasan.trim() !== ""
        ? details.alasan
        : null
    return { message: err.message, alasan }
  }
  if (err instanceof Error) {
    return { message: err.message, alasan: null }
  }
  return { message: fallback, alasan: null }
}
