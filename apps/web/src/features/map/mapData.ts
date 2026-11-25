/**
 * Kontrak data dan query TanStack untuk halaman Peta WebGIS (`/peta`) dan komponen peta.
 * Default membaca API (`/provinces`, `/map/layers`, `/recommendations`);
 * set `VITE_USE_API_MAP=false` untuk memakai snapshot statis `public/data/*.json`
 * (mode demo tanpa backend). Kalau API gagal, snapshot statis dipakai sebagai cadangan.
 */
import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import type { FeatureCollection, Geometry } from "geojson"

import { apiGet } from "@/lib/api"
import { formatAngka } from "@/lib/format"
import { SEMUA_STATUS, tampilanStatus, type StatusProvinsi } from "@/lib/status"

export type MapLayerId = "status" | "produksi" | "kebutuhan" | "kepadatan"
export type BasemapId = "auto" | "esri-light" | "esri-dark" | "osm" | "satellite" | "minimal"

export interface ProvinceRecord {
  tahun: number
  kode_bps: string
  kode_kemendagri: string
  provinsi: string
  pulau: string
  lat: number
  lng: number
  penduduk_jiwa: number
  konsumsi_kg_kapita_tahun: number
  produksi_padi_ton_gkg: number
  produksi_beras_ton: number
  kebutuhan_beras_ton: number
  rice_balance_ton: number
  rasio_swasembada: number
  status: StatusProvinsi
}

export interface DistributionFlow {
  urutan: number
  dari_kode: string
  dari: string
  ke_kode: string
  ke: string
  ton: number
  jarak_km: number
}

export interface MapLayerClass {
  min: number | null
  max: number | null
  key?: StatusProvinsi
  label: string
  color_token: string
  pola?: "solid" | "garis" | "titik"
}

export interface MapLayerResponse {
  layer: MapLayerId
  tahun: number
  satuan: string
  values: Record<string, string | number | null>
  classes: MapLayerClass[]
  min: number | null
  max: number | null
  unavailable_reason?: string
}

export interface ProvinceGeoProperties {
  kode_bps: string
  kode_kemendagri: string
  provinsi: string
  pulau: string
  lat: number
  lng: number
}

export type ProvinceGeoJSON = FeatureCollection<Geometry, ProvinceGeoProperties>

const USE_API_MAP = import.meta.env.VITE_USE_API_MAP !== "false"

const SEQ_TOKENS = ["--seq-1", "--seq-2", "--seq-3", "--seq-4", "--seq-5"] as const

const STATUS_TOKEN_BY_KEY: Record<StatusProvinsi, string> = {
  surplus: "--status-surplus",
  balanced: "--status-balanced",
  defisit: "--status-defisit",
}

async function fetchStaticJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" } })
  if (!res.ok) {
    throw new Error(`Gagal memuat ${url} (${res.status})`)
  }
  return (await res.json()) as T
}

/**
 * Mengelompokkan nilai numerik provinsi menjadi hingga 5 kelas kuantil (kontrak T3.2).
 * Hanya untuk pengelompokan visual layer peta dari dataset statis.
 */
function buildQuantileClasses(
  provinces: ProvinceRecord[],
  field: "produksi_beras_ton" | "kebutuhan_beras_ton",
  tahun: number,
  layer: "produksi" | "kebutuhan",
): MapLayerResponse {
  const values: Record<string, number | null> = {}
  const nums: number[] = []

  for (const p of provinces) {
    const val = p[field]
    values[p.kode_bps] = Number.isFinite(val) ? val : null
    if (Number.isFinite(val)) nums.push(val)
  }

  if (nums.length === 0) {
    return { layer, tahun, satuan: "ton", values, classes: [], min: null, max: null }
  }

  const sorted = [...nums].sort((a, b) => a - b)
  const rawCuts: number[] = []
  const nBins = 5
  for (let i = 0; i <= nBins; i += 1) {
    const idx = Math.min(sorted.length - 1, Math.floor((i / nBins) * (sorted.length - 1)))
    rawCuts.push(sorted[idx])
  }

  // Gabungkan batas kembar agar tidak ada kelas kosong / tumpang tindih
  const uniqueCuts: number[] = []
  for (const cut of rawCuts) {
    if (uniqueCuts.length === 0 || cut > uniqueCuts[uniqueCuts.length - 1]) {
      uniqueCuts.push(cut)
    }
  }

  const classes: MapLayerClass[] = []
  if (uniqueCuts.length === 1) {
    const only = uniqueCuts[0]
    classes.push({
      min: only,
      max: only,
      label: `${formatAngka(Math.round(only))} ton`,
      color_token: SEQ_TOKENS[SEQ_TOKENS.length - 1],
    })
  } else {
    const binCount = uniqueCuts.length - 1
    for (let i = 0; i < binCount; i += 1) {
      const cMin = uniqueCuts[i]
      const cMax = uniqueCuts[i + 1]
      const tokenIdx = Math.min(
        SEQ_TOKENS.length - 1,
        Math.round((i / Math.max(1, binCount - 1)) * (SEQ_TOKENS.length - 1)),
      )
      classes.push({
        min: cMin,
        max: cMax,
        label: `${formatAngka(Math.round(cMin))} – ${formatAngka(Math.round(cMax))} ton`,
        color_token: SEQ_TOKENS[tokenIdx],
      })
    }
  }

  return {
    layer,
    tahun,
    satuan: "ton",
    values,
    classes,
    min: sorted[0],
    max: sorted[sorted.length - 1],
  }
}

export function buildLayerFromProvinces(
  provinces: ProvinceRecord[],
  layer: MapLayerId,
  tahun: number,
): MapLayerResponse {
  if (layer === "kepadatan") {
    const values: Record<string, null> = {}
    for (const p of provinces) values[p.kode_bps] = null
    return {
      layer,
      tahun,
      satuan: "jiwa/km²",
      values,
      classes: [],
      min: null,
      max: null,
      unavailable_reason: "Data luas wilayah (km²) belum tersedia",
    }
  }

  if (layer === "produksi") {
    return buildQuantileClasses(provinces, "produksi_beras_ton", tahun, "produksi")
  }

  if (layer === "kebutuhan") {
    return buildQuantileClasses(provinces, "kebutuhan_beras_ton", tahun, "kebutuhan")
  }

  const values: Record<string, StatusProvinsi> = {}
  for (const p of provinces) {
    values[p.kode_bps] = p.status
  }

  const classes: MapLayerClass[] = SEMUA_STATUS.map((key) => {
    const info = tampilanStatus(key)
    return {
      key,
      min: null,
      max: null,
      label: info.label,
      color_token: STATUS_TOKEN_BY_KEY[key],
      pola: info.pola,
    }
  })

  return {
    layer: "status",
    tahun,
    satuan: "kategori",
    values,
    classes,
    min: null,
    max: null,
  }
}

export function resolveFillColor(layerData: MapLayerResponse | undefined, kodeBps: string): string {
  if (!layerData) return "var(--muted)"
  const val = layerData.values[kodeBps]
  if (val === null || val === undefined) return "var(--muted)"

  if (layerData.layer === "status" && typeof val === "string") {
    const token = STATUS_TOKEN_BY_KEY[val as StatusProvinsi]
    return token ? `var(${token})` : "var(--muted)"
  }

  if (typeof val === "number" && layerData.classes.length > 0) {
    for (let i = 0; i < layerData.classes.length; i += 1) {
      const cls = layerData.classes[i]
      if (cls.min === null || cls.max === null) continue
      const isLast = i === layerData.classes.length - 1
      if (isLast ? val >= cls.min && val <= cls.max : val >= cls.min && val < cls.max) {
        return `var(${cls.color_token})`
      }
    }
    return `var(${layerData.classes[0].color_token})`
  }

  return "var(--muted)"
}

export function useProvincesGeoJSON() {
  return useQuery({
    queryKey: ["geo", "provinsi-38"],
    queryFn: () => fetchStaticJson<ProvinceGeoJSON>("/geo/provinsi-38.min.geojson"),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  })
}

export function useMapProvinces(tahun = 2025) {
  const query = useQuery({
    queryKey: ["provinces", tahun],
    queryFn: async () => {
      if (USE_API_MAP) {
        try {
          const res = await apiGet<{ items: ProvinceRecord[] }>("/provinces", { tahun, limit: 100 })
          return res.items
        } catch {
          // API belum siap (mis. demo tanpa backend): pakai snapshot statis.
        }
      }
      return fetchStaticJson<ProvinceRecord[]>("/data/provinces-2025.json")
    },
    staleTime: 5 * 60 * 1000,
  })

  const byCode = useMemo(() => {
    const map = new Map<string, ProvinceRecord>()
    for (const item of query.data ?? []) {
      map.set(item.kode_bps, item)
    }
    return map
  }, [query.data])

  const pulauList = useMemo(() => {
    const set = new Set<string>()
    for (const item of query.data ?? []) {
      if (item.pulau) set.add(item.pulau)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "id-ID"))
  }, [query.data])

  return { ...query, byCode, pulauList }
}

export function useMapLayer(
  layer: MapLayerId,
  tahun = 2025,
  provinces?: ProvinceRecord[],
) {
  return useQuery({
    queryKey: ["map-layer", layer, tahun],
    queryFn: async () => {
      if (USE_API_MAP) {
        try {
          return await apiGet<MapLayerResponse>("/map/layers", { tahun, layer })
        } catch {
          // 409 LAYER_UNAVAILABLE atau API mati: jatuh ke snapshot statis.
        }
      }
      return buildLayerFromProvinces(provinces ?? [], layer, tahun)
    },
    enabled: USE_API_MAP || Boolean(provinces && provinces.length > 0),
    staleTime: 5 * 60 * 1000,
  })
}

export function useDistributionFlows(tahun = 2025) {
  return useQuery({
    queryKey: ["distribution-flows", tahun],
    queryFn: async () => {
      if (USE_API_MAP) {
        try {
          const res = await apiGet<{ items: DistributionFlow[] }>("/recommendations", { tahun })
          return res.items
        } catch {
          // Endpoint rekomendasi belum ada (wave 5): pakai snapshot statis.
        }
      }
      return fetchStaticJson<DistributionFlow[]>("/data/distribution-2025.json")
    },
    staleTime: 5 * 60 * 1000,
  })
}
