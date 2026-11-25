/**
 * Query TanStack untuk halaman Regional Analysis (`/analisis` dan `/analisis/:kode`).
 * Semua angka, pengurutan, filter, dan perhitungan berasal dari API FastAPI.
 */
import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"

import { ApiError, apiGet } from "@/lib/api"
import type {
  ProvinceDetailResponse,
  ProvincesResponse,
  RankingsResponse,
} from "@/lib/tipe-api"

export type AnalysisSortField =
  | "provinsi"
  | "penduduk"
  | "produksi"
  | "kebutuhan"
  | "balance"
  | "rasio"
  | "peringkat"

export type SortOrder = "asc" | "desc"
export type AnalysisRankingBy = "produksi" | "kebutuhan" | "balance"

export interface AnalysisFilterParams {
  tahun?: number
  status?: string
  pulau?: string
  q?: string
  sort?: AnalysisSortField
  order?: SortOrder
}

export function useAnalysisProvinces(params: AnalysisFilterParams) {
  const { tahun, status, pulau, q, sort = "peringkat", order = "desc" } = params

  return useQuery({
    queryKey: ["analysis-provinces", tahun, status || "", pulau || "", q || "", sort, order],
    queryFn: () =>
      apiGet<ProvincesResponse>("/provinces", {
        tahun,
        status: status || undefined,
        pulau: pulau || undefined,
        q: q || undefined,
        sort,
        order,
        limit: 100,
      }),
  })
}

export function usePulauOptions(tahun?: number) {
  const query = useQuery({
    queryKey: ["analysis-pulau-options", tahun],
    queryFn: () =>
      apiGet<ProvincesResponse>("/provinces", {
        tahun,
        sort: "provinsi",
        order: "asc",
        limit: 100,
      }),
  })

  const pulauList = useMemo(() => {
    const set = new Set<string>()
    for (const item of query.data?.items ?? []) {
      if (item.pulau) set.add(item.pulau)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "id-ID"))
  }, [query.data])

  return pulauList
}

export function useAnalysisRankings(by: AnalysisRankingBy, tahun?: number, limit = 38) {
  return useQuery({
    queryKey: ["analysis-rankings", by, tahun, limit],
    queryFn: () => apiGet<RankingsResponse>("/rankings", { by, tahun, limit }),
  })
}

export function useProvinceDetail(kodeBps: string, tahun?: number) {
  return useQuery({
    queryKey: ["province-detail", kodeBps, tahun],
    queryFn: () => apiGet<ProvinceDetailResponse>(`/provinces/${encodeURIComponent(kodeBps)}`, { tahun }),
    enabled: Boolean(kodeBps),
    retry: (failureCount, err) => {
      if (err instanceof ApiError && err.status === 404) return false
      return failureCount < 1
    },
  })
}
