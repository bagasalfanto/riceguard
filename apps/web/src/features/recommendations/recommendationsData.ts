/**
 * Kontrak data, query/mutation TanStack, serialisasi URL skenario, dan ekspor CSV
 * untuk halaman Rekomendasi & Simulasi (`/rekomendasi`, `/rekomendasi/simulasi`).
 */
import { useMutation, useQuery } from "@tanstack/react-query"

import { apiGet, apiPost } from "@/lib/api"
import type { StatusProvinsi } from "@/lib/status"
import type {
  RecommendationItem,
  RecommendationsResponse,
  RecommendationSummary,
} from "@/lib/tipe-api"

export { useMapProvinces, useProvincesGeoJSON } from "@/features/map/mapData"
export type { RecommendationItem, RecommendationsResponse, RecommendationSummary }

export interface SimulationRequest {
  tahun?: number
  ambang_swasembada: number
  persen_surplus_dilepas: number
  jarak_maks_km: number | null
  kecualikan_pemasok: string[]
  kecualikan_penerima: string[]
  perubahan_produksi: Record<string, number>
  perubahan_konsumsi_persen: number
  mode: "greedy_v1"
}

export type SimulationFormParams = Omit<SimulationRequest, "tahun">

export interface SimulatedProvinceItem {
  kode_bps: string
  provinsi: string
  pulau: string
  status: StatusProvinsi
  produksi_beras_ton: number
  kebutuhan_beras_ton: number
  rice_balance_ton: number
  rasio_swasembada: number
}

export interface SimulationStatusChange {
  kode_bps: string
  provinsi: string
  dari: string
  ke: string
}

export interface SimulationUnmetDeficit {
  kode_bps: string
  provinsi: string
  defisit_ton: number
  terpenuhi_ton: number
  sisa_defisit_ton: number
}

export interface SimulationComparison {
  delta_ton: number
  delta_ton_km: number
  status_berubah: SimulationStatusChange[]
  defisit_tidak_tertutup: SimulationUnmetDeficit[]
}

export interface SimulationResponse {
  tahun: number
  version: { id: string; version_no: number }
  rekomendasi: RecommendationItem[]
  provinsi: SimulatedProvinceItem[]
  ringkasan: RecommendationSummary
  banding_resmi: SimulationComparison
}

export const DEFAULT_SIMULATION_PARAMS: SimulationFormParams = {
  ambang_swasembada: 0.9,
  persen_surplus_dilepas: 100,
  jarak_maks_km: null,
  kecualikan_pemasok: [],
  kecualikan_penerima: [],
  perubahan_produksi: {},
  perubahan_konsumsi_persen: 0,
  mode: "greedy_v1",
}

export const SIMULATION_LIMITS = {
  ambangMin: 0.8,
  ambangMax: 1.0,
  surplusMin: 10,
  surplusMax: 100,
  jarakMin: 100,
  jarakMax: 4000,
  jarakDefaultAktif: 500,
  produksiMin: -50,
  produksiMax: 50,
  konsumsiMin: -20,
  konsumsiMax: 20,
} as const

export function useRecommendations(tahun?: number, dariKode?: string, keKode?: string) {
  return useQuery({
    queryKey: ["recommendations", tahun ?? null, dariKode ?? "", keKode ?? ""],
    queryFn: () =>
      apiGet<RecommendationsResponse>("/recommendations", {
        tahun,
        dari_kode: dariKode || undefined,
        ke_kode: keKode || undefined,
      }),
  })
}

export function useSimulateRecommendations() {
  return useMutation({
    mutationFn: (payload: SimulationRequest) =>
      apiPost<SimulationResponse>("/recommendations/simulate", payload),
  })
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val))
}

function parseCodeList(raw: string | null): string[] {
  if (!raw) return []
  const seen = new Set<string>()
  for (const part of raw.split(",")) {
    const clean = part.trim()
    if (/^\d{2}$/.test(clean)) seen.add(clean)
  }
  return Array.from(seen)
}

function parseProductionOverrides(raw: string | null): Record<string, number> {
  if (!raw) return {}
  const out: Record<string, number> = {}
  for (const token of raw.split(",")) {
    const [kodeRaw, pctRaw] = token.split(":")
    const kode = kodeRaw?.trim()
    const pct = Number(pctRaw)
    if (kode && /^\d{2}$/.test(kode) && Number.isFinite(pct)) {
      const clamped = Math.round(clamp(pct, SIMULATION_LIMITS.produksiMin, SIMULATION_LIMITS.produksiMax))
      if (clamped !== 0) out[kode] = clamped
    }
  }
  return out
}

export function parseSimulationSearchParams(searchParams: URLSearchParams): SimulationFormParams {
  const ambangRaw = Number(searchParams.get("ambang"))
  const ambang =
    searchParams.has("ambang") && Number.isFinite(ambangRaw)
      ? Math.round(clamp(ambangRaw, SIMULATION_LIMITS.ambangMin, SIMULATION_LIMITS.ambangMax) * 100) / 100
      : DEFAULT_SIMULATION_PARAMS.ambang_swasembada

  const surplusRaw = Number(searchParams.get("surplus"))
  const surplus =
    searchParams.has("surplus") && Number.isFinite(surplusRaw)
      ? Math.round(clamp(surplusRaw, SIMULATION_LIMITS.surplusMin, SIMULATION_LIMITS.surplusMax))
      : DEFAULT_SIMULATION_PARAMS.persen_surplus_dilepas

  const jarakRaw = searchParams.get("jarak")
  const jarakNum = jarakRaw !== null && jarakRaw !== "" ? Number(jarakRaw) : Number.NaN
  const jarak = Number.isFinite(jarakNum)
    ? Math.round(clamp(jarakNum, SIMULATION_LIMITS.jarakMin, SIMULATION_LIMITS.jarakMax))
    : null

  const konsumsiRaw = Number(searchParams.get("konsumsi"))
  const konsumsi =
    searchParams.has("konsumsi") && Number.isFinite(konsumsiRaw)
      ? Math.round(clamp(konsumsiRaw, SIMULATION_LIMITS.konsumsiMin, SIMULATION_LIMITS.konsumsiMax))
      : DEFAULT_SIMULATION_PARAMS.perubahan_konsumsi_persen

  return {
    ambang_swasembada: ambang,
    persen_surplus_dilepas: surplus,
    jarak_maks_km: jarak,
    kecualikan_pemasok: parseCodeList(searchParams.get("x_pemasok")),
    kecualikan_penerima: parseCodeList(searchParams.get("x_penerima")),
    perubahan_produksi: parseProductionOverrides(searchParams.get("prod")),
    perubahan_konsumsi_persen: konsumsi,
    mode: "greedy_v1",
  }
}

const SIM_QUERY_KEYS = [
  "ambang",
  "surplus",
  "jarak",
  "x_pemasok",
  "x_penerima",
  "prod",
  "konsumsi",
] as const

export function writeSimulationSearchParams(
  base: URLSearchParams,
  params: SimulationFormParams,
): URLSearchParams {
  const next = new URLSearchParams(base)
  for (const k of SIM_QUERY_KEYS) next.delete(k)

  if (Math.abs(params.ambang_swasembada - DEFAULT_SIMULATION_PARAMS.ambang_swasembada) > 1e-6) {
    next.set("ambang", params.ambang_swasembada.toFixed(2))
  }
  if (params.persen_surplus_dilepas !== DEFAULT_SIMULATION_PARAMS.persen_surplus_dilepas) {
    next.set("surplus", String(params.persen_surplus_dilepas))
  }
  if (params.jarak_maks_km !== null) {
    next.set("jarak", String(params.jarak_maks_km))
  }
  if (params.kecualikan_pemasok.length > 0) {
    next.set("x_pemasok", params.kecualikan_pemasok.join(","))
  }
  if (params.kecualikan_penerima.length > 0) {
    next.set("x_penerima", params.kecualikan_penerima.join(","))
  }
  const prodEntries = Object.entries(params.perubahan_produksi).filter(([, pct]) => pct !== 0)
  if (prodEntries.length > 0) {
    next.set(
      "prod",
      prodEntries.map(([kode, pct]) => `${kode}:${pct}`).join(","),
    )
  }
  if (params.perubahan_konsumsi_persen !== DEFAULT_SIMULATION_PARAMS.perubahan_konsumsi_persen) {
    next.set("konsumsi", String(params.perubahan_konsumsi_persen))
  }

  return next
}

function escapeCsvCell(value: string | number): string {
  const str = String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replaceAll('"', '""')}"`
  }
  return str
}

export function buildRecommendationsCsv(items: RecommendationItem[]): string {
  const header = "urutan,dari_kode,dari,ke_kode,ke,ton,jarak_km"
  const rows = items.map((item) =>
    [
      item.urutan,
      item.dari_kode,
      item.dari,
      item.ke_kode,
      item.ke,
      item.ton,
      item.jarak_km,
    ]
      .map(escapeCsvCell)
      .join(","),
  )
  return `\uFEFF${[header, ...rows].join("\r\n")}`
}

export function downloadRecommendationsCsv(items: RecommendationItem[], filename: string) {
  const csv = buildRecommendationsCsv(items)
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
