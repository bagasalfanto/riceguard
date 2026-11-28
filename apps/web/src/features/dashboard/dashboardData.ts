/**
 * Query TanStack untuk Dashboard. Semua angka dari API, tidak ada rumus di FE.
 */
import { useQuery } from "@tanstack/react-query"

import { apiGet } from "@/lib/api"
import type {
  ProvincesResponse,
  RankingsResponse,
  SummaryResponse,
} from "@/lib/tipe-api"

export type ByRanking = "produksi" | "kebutuhan" | "surplus" | "defisit"

export function useSummary(tahun?: number) {
  return useQuery({
    queryKey: ["summary", tahun],
    queryFn: () => apiGet<SummaryResponse>("/summary", { tahun }),
  })
}

export function useProvinces(tahun?: number) {
  return useQuery({
    queryKey: ["provinces", tahun],
    queryFn: () => apiGet<ProvincesResponse>("/provinces", { tahun, limit: 100 }),
  })
}

export function useRankings(by: ByRanking, tahun?: number, limit = 5) {
  return useQuery({
    queryKey: ["rankings", by, tahun],
    queryFn: () => apiGet<RankingsResponse>("/rankings", { by, tahun, limit }),
  })
}
