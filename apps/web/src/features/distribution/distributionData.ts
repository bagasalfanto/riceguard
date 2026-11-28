/**
 * Kontrak data dan query TanStack untuk halaman Supply & Distribution Analysis (`/distribusi`).
 * Semua angka dan pengurutan berasal dari API FastAPI; tidak ada rumus distribusi di FE.
 */
import { useQuery } from "@tanstack/react-query"

import { ApiError, apiGet } from "@/lib/api"
import type {
  RecommendationItem,
  RecommendationsResponse,
  RecommendationSummary,
} from "@/lib/tipe-api"

export { useMapProvinces, useProvincesGeoJSON } from "@/features/map/mapData"
export type { RecommendationItem, RecommendationsResponse, RecommendationSummary }

export interface DistributionVersion {
  id: string
  version_no: number
}

export interface SurplusProvinceItem {
  kode_bps: string
  provinsi: string
  pulau: string
  rice_balance_ton: number
  terpakai_ton: number
  sisa_ton: number
}

export interface DeficitProvinceItem {
  kode_bps: string
  provinsi: string
  pulau: string
  rice_balance_ton: number
  defisit_ton: number
  rasio_swasembada: number
  terpenuhi_ton: number
  persen_terpenuhi: number
  prioritas: number
}

export interface DistributionRingkasan {
  total_surplus_ton: number
  total_terpakai_ton: number
  total_sisa_ton: number
  total_defisit_ton: number
  total_terpenuhi_ton: number
  persen_defisit_tertutup: number
  jumlah_pasangan: number
}

export interface DistributionOverviewResponse {
  tahun: number
  version: DistributionVersion
  surplus: SurplusProvinceItem[]
  defisit: DeficitProvinceItem[]
  ringkasan: DistributionRingkasan
}

export interface SupplierRecipientInfo {
  kode_bps: string
  provinsi: string
  pulau: string
  defisit_ton: number
  terpenuhi_ton: number
}

export interface SupplierOptionItem {
  kode_bps: string
  provinsi: string
  pulau: string
  surplus_ton: number
  terpakai_ton: number
  sisa_ton: number
  jarak_km: number
  satu_pulau: boolean
  dipakai_di_rekomendasi: boolean
  alokasi_ton: number
}

export interface DistributionSuppliersResponse {
  tahun: number
  version: DistributionVersion
  penerima: SupplierRecipientInfo
  items: SupplierOptionItem[]
}

export interface DistanceMatrixResponse {
  tahun: number
  version: DistributionVersion
  baris: string[]
  kolom: string[]
  jarak_km: number[][]
  satuan: string
}

export function useDistributionOverview(tahun?: number) {
  return useQuery({
    queryKey: ["distribution", "overview", tahun],
    queryFn: () => apiGet<DistributionOverviewResponse>("/distribution/overview", { tahun }),
  })
}

export function useDistributionSuppliers(kodeBps: string, tahun?: number) {
  return useQuery({
    queryKey: ["distribution", "suppliers", kodeBps, tahun],
    queryFn: () =>
      apiGet<DistributionSuppliersResponse>(
        `/distribution/suppliers/${encodeURIComponent(kodeBps)}`,
        { tahun },
      ),
    enabled: Boolean(kodeBps),
    retry: (failureCount, err) => {
      if (err instanceof ApiError && (err.status === 400 || err.status === 404)) return false
      return failureCount < 1
    },
  })
}

export function useDistanceMatrix(tahun?: number) {
  return useQuery({
    queryKey: ["distribution", "distance-matrix", tahun],
    queryFn: () => apiGet<DistanceMatrixResponse>("/distribution/distance-matrix", { tahun }),
  })
}

export function useDistributionRecommendations(tahun?: number) {
  return useQuery({
    queryKey: ["distribution", "recommendations", tahun],
    queryFn: () => apiGet<RecommendationsResponse>("/recommendations", { tahun }),
  })
}
