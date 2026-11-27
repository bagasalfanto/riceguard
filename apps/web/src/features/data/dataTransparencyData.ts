/**
 * Kontrak data, query TanStack, pemformatan rincian validasi, dan helper unduhan
 * untuk halaman Data Management & Transparency (`/data`).
 */
import { useQuery } from "@tanstack/react-query"

import { ApiError, apiDownload, apiGet, unduhBlob, type Query } from "@/lib/api"
import { formatAngka, formatJiwa, formatPersen, formatTon } from "@/lib/format"
import type { ContentItem, MetaYears, SourceItem } from "@/lib/tipe-api"

export type ValidationRuleStatus = "lulus" | "peringatan" | "gagal"

export interface ValidationVersionRef {
  id: string
  version_no: number
}

export interface ValidationRuleItem {
  kode: string
  label: string
  status: ValidationRuleStatus
  detail: unknown
}

export interface RawSourceFileItem {
  key: string
  nama_file: string
}

export interface ValidationResponse {
  tahun: number
  version?: ValidationVersionRef | null
  version_no?: number | null
  version_id?: string | null
  published_at: string | null
  published_by: string | null
  published_by_nama: string | null
  notes: string | null
  lulus: boolean
  diperiksa_pada: string | null
  aturan: ValidationRuleItem[]
  source_files: RawSourceFileItem[]
}

export interface ValidationDetailRow {
  label: string
  value: string
  mono?: boolean
}

export interface ValidationRuleDisplay {
  summary: string
  rows: ValidationDetailRow[]
}

export interface DownloadErrorInfo {
  code: string | null
  message: string
  isStorageUnavailable: boolean
}

export const RAW_SOURCE_LABELS: Record<string, string> = {
  produksi: "Produksi Padi & Beras (BPS)",
  penduduk: "Jumlah Penduduk (BPS SUPAS)",
  konsumsi: "Konsumsi Beras per Kapita (Bapanas)",
  referensi: "Referensi Provinsi & Titik Pusat",
}

export function useMetaYears() {
  return useQuery({
    queryKey: ["meta-years"],
    queryFn: () => apiGet<MetaYears>("/meta/years"),
    staleTime: 5 * 60 * 1000,
  })
}

export function useValidationReport(tahun?: number) {
  return useQuery({
    queryKey: ["validation", tahun ?? null],
    queryFn: () => apiGet<ValidationResponse>("/validation", { tahun }),
    retry: (failureCount, err) => {
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) return false
      return failureCount < 1
    },
  })
}

export function useDataSources() {
  return useQuery({
    queryKey: ["sources"],
    queryFn: () => apiGet<SourceItem[]>("/sources"),
  })
}

export function useTransparencyContent() {
  return useQuery({
    queryKey: ["content", "methodology,limitations"],
    queryFn: () => apiGet<ContentItem[]>("/content", { keys: "methodology,limitations" }),
  })
}

export function getValidationVersionNo(data: ValidationResponse | undefined): number | null {
  if (!data) return null
  return data.version?.version_no ?? data.version_no ?? null
}

export function getValidationVersionId(data: ValidationResponse | undefined): string | null {
  if (!data) return null
  return data.version?.id ?? data.version_id ?? null
}

export function getOverallValidationStatus(data: ValidationResponse): ValidationRuleStatus {
  if (!data.lulus || data.aturan.some((rule) => rule.status === "gagal")) {
    return "gagal"
  }
  if (data.aturan.some((rule) => rule.status === "peringatan")) {
    return "peringatan"
  }
  return "lulus"
}

export function formatTanggalWaktuId(iso: string | null | undefined): string {
  if (!iso) return "—"
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(parsed)
}

export function formatTanggalId(isoDate: string | null | undefined): string {
  if (!isoDate) return "—"
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim())
  if (dateOnly) {
    const utcDate = new Date(
      Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])),
    )
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(utcDate)
  }
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed)
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function formatTotalMetricValue(kode: string, nilai: number): string {
  if (kode === "total_produksi") return formatTon(nilai, 2)
  if (kode === "total_penduduk") return formatJiwa(nilai)
  return formatAngka(nilai, 2)
}

function formatProvinceEntry(item: unknown): string {
  if (typeof item === "string") return item
  if (isPlainRecord(item)) {
    const kode = typeof item.kode_bps === "string" ? item.kode_bps : null
    const nama = typeof item.provinsi === "string" ? item.provinsi : null
    const pct = toFiniteNumber(item.perubahan_persen)
    const prefix = nama && kode ? `${nama} (${kode})` : (nama ?? (kode ? `Kode ${kode}` : "Provinsi"))
    if (pct !== null) {
      return `${prefix}: ${formatPersen(pct, 2)}`
    }
    return prefix
  }
  return String(item)
}

function formatGenericValue(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "string") return value
  if (typeof value === "number") return Number.isFinite(value) ? formatAngka(value, 2) : "—"
  if (typeof value === "boolean") return value ? "Ya" : "Tidak"
  if (Array.isArray(value)) {
    if (value.length === 0) return "Tidak ada"
    return value.map(formatProvinceEntry).join(", ")
  }
  if (isPlainRecord(value)) {
    return Object.entries(value)
      .map(([k, v]) => `${k.replaceAll("_", " ")}: ${formatGenericValue(v)}`)
      .join(" · ")
  }
  return String(value)
}

/**
 * Mengubah field `detail` dari `/validation` menjadi ringkasan terstruktur berbahasa Indonesia
 * tanpa pernah mencetak `[object Object]`.
 */
export function formatValidationDetail(rule: ValidationRuleItem): ValidationRuleDisplay {
  const { kode, detail } = rule

  if (detail === null || detail === undefined || detail === "") {
    return { summary: "Tidak ada catatan tambahan.", rows: [] }
  }

  if (typeof detail === "string") {
    return { summary: detail, rows: [] }
  }

  if (typeof detail === "number" || typeof detail === "boolean") {
    return { summary: formatGenericValue(detail), rows: [] }
  }

  if (Array.isArray(detail)) {
    if (detail.length === 0) {
      return { summary: "Tidak ada temuan anomali.", rows: [] }
    }
    return {
      summary: `${formatAngka(detail.length, 0)} temuan tercatat`,
      rows: [{ label: "Daftar", value: detail.map(formatProvinceEntry).join(", ") }],
    }
  }

  if (!isPlainRecord(detail)) {
    return { summary: String(detail), rows: [] }
  }

  if (kode === "jumlah_provinsi") {
    const jumlah = toFiniteNumber(detail.jumlah)
    if (jumlah !== null) {
      return {
        summary: `Tercatat ${formatAngka(jumlah, 0)} dari target 38 provinsi referensi.`,
        rows: [
          { label: "Provinsi tervalidasi", value: `${formatAngka(jumlah, 0)} provinsi`, mono: true },
        ],
      }
    }
  }

  if (kode === "total_produksi" || kode === "total_penduduk") {
    const nilai = toFiniteNumber(detail.nilai)
    const acuan = toFiniteNumber(detail.acuan_bps)
    const selisih = toFiniteNumber(detail.selisih_persen)
    if (nilai !== null || acuan !== null || selisih !== null) {
      const rows: ValidationDetailRow[] = []
      if (nilai !== null) {
        rows.push({
          label: "Total 38 provinsi (Σ)",
          value: formatTotalMetricValue(kode, nilai),
          mono: true,
        })
      }
      if (acuan !== null) {
        rows.push({
          label: 'Acuan BPS ("Indonesia")',
          value: formatTotalMetricValue(kode, acuan),
          mono: true,
        })
      }
      if (selisih !== null) {
        rows.push({
          label: "Selisih terhadap acuan",
          value: `${formatPersen(selisih, 4)} (toleransi ≤ 0,1000%)`,
          mono: true,
        })
      }
      return {
        summary: "Perbandingan agregat 38 provinsi terhadap baris total Indonesia BPS.",
        rows,
      }
    }
  }

  if (kode === "nilai_positif" || kode === "perubahan_besar") {
    const list = Array.isArray(detail.provinsi) ? detail.provinsi : null
    if (list !== null) {
      if (list.length === 0) {
        return {
          summary:
            kode === "nilai_positif"
              ? "Seluruh provinsi memenuhi batas nilai valid (penduduk & konsumsi > 0, produksi ≥ 0)."
              : "Tidak ada provinsi dengan lonjakan atau penurunan produksi > 30% dibanding versi sebelumnya.",
          rows: [],
        }
      }
      return {
        summary:
          kode === "nilai_positif"
            ? `${formatAngka(list.length, 0)} provinsi memiliki nilai tidak valid.`
            : `${formatAngka(list.length, 0)} provinsi mengalami perubahan produksi > 30%.`,
        rows: [
          {
            label: "Provinsi terdampak",
            value: list.map(formatProvinceEntry).join(", "),
          },
        ],
      }
    }
  }

  const rows: ValidationDetailRow[] = Object.entries(detail).map(([k, v]) => ({
    label: k.replaceAll("_", " "),
    value: formatGenericValue(v),
  }))

  return {
    summary: rows.length > 0 ? "Rincian pemeriksaan:" : "Tidak ada rincian tambahan.",
    rows,
  }
}

export async function downloadExportFile(
  path: string,
  query: Query | undefined,
  fallbackFilename: string,
): Promise<string> {
  const { blob, filename } = await apiDownload(path, query)
  const resolved = filename || fallbackFilename
  unduhBlob(blob, resolved)
  return resolved
}

export function describeDownloadError(err: unknown): DownloadErrorInfo {
  if (err instanceof ApiError) {
    const isStorageUnavailable = err.code === "STORAGE_UNAVAILABLE" || err.status === 503
    if (isStorageUnavailable) {
      return {
        code: err.code,
        isStorageUnavailable: true,
        message:
          "Penyimpanan file mentah belum dikonfigurasi pada server ini (503 STORAGE_UNAVAILABLE). Anda tetap dapat mengunduh dataset terproses (CSV / Excel).",
      }
    }
    return {
      code: err.code,
      isStorageUnavailable: false,
      message: err.message || `Gagal mengunduh file (${err.status}).`,
    }
  }
  if (err instanceof Error) {
    return {
      code: null,
      isStorageUnavailable: false,
      message: err.message || "Gagal mengunduh file.",
    }
  }
  return {
    code: null,
    isStorageUnavailable: false,
    message: "Terjadi kesalahan saat mengunduh file.",
  }
}
