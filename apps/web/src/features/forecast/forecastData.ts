/**
 * Kontrak data dan query TanStack untuk halaman Prediksi Produksi (AI) (`/prediksi`).
 * Terpisah sepenuhnya dari cache dan komponen data resmi.
 */
import { useQuery } from "@tanstack/react-query"

import { ApiError, apiGet } from "@/lib/api"

export interface ForecastItem {
  kode_bps: string
  provinsi: string
  nilai: number
  interval_bawah: number | null
  interval_atas: number | null
}

export interface ForecastModelInfo {
  nama: string
  versi: string | null
}

export interface ForecastDetails {
  kode_tanpa_prediksi?: string[]
  tahun_tersedia?: number[]
  [k: string]: unknown
}

export interface ForecastResponse {
  tahun: number
  satuan: string
  items: ForecastItem[]
  model: ForecastModelInfo | null
  details: ForecastDetails
}

const FORECAST_STALE_TIME_MS = 5 * 60 * 1000

/**
 * Mengecek ketersediaan fitur prediksi sekali dan menyimpannya di cache agar
 * menu navigasi tidak memicu permintaan berulang pada setiap render.
 */
export function useForecastStatus() {
  return useQuery({
    queryKey: ["forecast-status"],
    queryFn: () => apiGet<ForecastResponse>("/forecast"),
    staleTime: FORECAST_STALE_TIME_MS,
    retry: false,
  })
}

export function useForecast(tahun?: number) {
  return useQuery({
    queryKey: ["forecast", tahun],
    queryFn: () => apiGet<ForecastResponse>("/forecast", tahun !== undefined ? { tahun } : undefined),
    staleTime: FORECAST_STALE_TIME_MS,
    retry: false,
  })
}

export function isForecastUnavailableError(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.status === 503 || error.code === "AI_UNAVAILABLE")
}

export function extractForecastUnavailableReason(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null
  if (typeof error.details !== "object" || error.details === null) return null
  const alasan = (error.details as Record<string, unknown>).alasan
  if (typeof alasan === "string" && alasan.trim().length > 0) {
    return alasan.trim()
  }
  return null
}
