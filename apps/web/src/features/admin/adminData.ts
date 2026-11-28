import { useQuery, type QueryClient } from "@tanstack/react-query"

import type { ValidationRuleItem } from "@/features/data/dataTransparencyData"
import { apiGet } from "@/lib/api"
import type { ContentItem, ProvinceItem, RecommendationItem } from "@/lib/tipe-api"

export type VersionStatus = "draft" | "published" | "archived"

export interface AdminVersionItem {
  id: string
  tahun: number
  version_no: number
  status: VersionStatus
  notes: string | null
  created_by: string | null
  created_at: string
  published_by: string | null
  published_by_nama: string | null
  published_at: string | null
  lulus_validasi: boolean
}

export interface AdminVersionsResponse {
  items: AdminVersionItem[]
}

export interface AdminProvinceRow extends ProvinceItem {
  is_edited?: boolean
}

export interface AdminEditItem {
  id?: string | number
  kode_bps: string
  provinsi?: string | null
  field: string
  old_value: number | string | null
  new_value: number | string | null
  reason: string
  edited_by?: string | null
  edited_by_nama?: string | null
  edited_at?: string | null
  actor?: string | null
  actor_nama?: string | null
  created_at?: string | null
}

export interface AdminRingkasan {
  produksi_beras_ton?: number
  kebutuhan_beras_ton?: number
  rice_balance_ton?: number
  rasio_swasembada?: number | null
  jumlah_status?: {
    surplus: number
    balanced: number
    defisit: number
  }
  total_dialokasikan_ton?: number
  [key: string]: unknown
}

export interface AdminValidationResult {
  lulus: boolean
  aturan: ValidationRuleItem[]
}

export interface AdminValidateResponse {
  validasi: AdminValidationResult
  pratinjau: AdminProvinceRow[]
  ringkasan: AdminRingkasan
  rekomendasi: RecommendationItem[]
}

export interface AdminCreateVersionResponse {
  version: AdminVersionItem
  validasi: AdminValidationResult
  ringkasan: AdminRingkasan
}

export interface AdminVersionDetailResponse {
  version: AdminVersionItem
  validasi: AdminValidationResult
  ringkasan: AdminRingkasan
  source_files: Record<string, string> | Array<{ key: string; nama_file: string }> | null
  edits: AdminEditItem[]
}

export interface AdminVersionProvincesResponse {
  version_id: string
  tahun: number
  status: VersionStatus
  items: AdminProvinceRow[]
}

export interface AdminVersionRecommendationsResponse {
  version_id: string
  tahun: number
  items: RecommendationItem[]
}

export interface AdminPatchProvinceBody {
  penduduk_jiwa?: number
  konsumsi_kg_kapita_tahun?: number
  produksi_padi_ton_gkg?: number
  produksi_beras_ton?: number
  reason: string
}

export interface AdminPatchProvinceResponse {
  edited: boolean | AdminEditItem
  version: AdminVersionItem
  validasi: AdminValidationResult
  ringkasan: AdminRingkasan
}

export interface AdminVersionMutationResponse {
  version: AdminVersionItem
  validasi?: AdminValidationResult
  ringkasan?: AdminRingkasan
}

export interface AdminDeleteVersionResponse {
  deleted: boolean
  id: string
}

export const AUDIT_ACTIONS = [
  "upload",
  "edit_provinsi",
  "recompute",
  "publish",
  "rollback",
  "duplicate",
  "hapus_draft",
  "edit_konten",
  "edit_sumber",
] as const

export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export interface AuditLogItem {
  id: string | number
  created_at: string
  actor: string | null
  actor_nama: string | null
  action: AuditAction | string
  entity: string
  entity_id: string | null
  detail: unknown
}

export interface AuditLogResponse {
  items: AuditLogItem[]
  total: number
  page: number
  limit: number
}

export const VERSION_STATUS_META: Record<
  VersionStatus,
  { label: string; badgeClass: string; description: string }
> = {
  draft: {
    label: "Draft",
    badgeClass: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    description: "Dapat diedit per provinsi, dihitung ulang, di-preview, dipublish, atau dihapus.",
  },
  published: {
    label: "Published",
    badgeClass:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    description: "Aktif ditampilkan ke publik. Hanya dapat diduplikat menjadi draft baru atau diunduh.",
  },
  archived: {
    label: "Archived",
    badgeClass: "border-border bg-muted text-muted-foreground",
    description: "Versi terdahulu. Dapat di-rollback menjadi published, diduplikat, atau diunduh.",
  },
}

export const AUDIT_ACTION_META: Record<
  string,
  { label: string; badgeClass: string }
> = {
  upload: {
    label: "Upload",
    badgeClass: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  edit_provinsi: {
    label: "Edit Provinsi",
    badgeClass: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  recompute: {
    label: "Hitung Ulang",
    badgeClass: "border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  },
  publish: {
    label: "Publish",
    badgeClass:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  rollback: {
    label: "Rollback",
    badgeClass: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  },
  duplicate: {
    label: "Duplikat",
    badgeClass: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  hapus_draft: {
    label: "Hapus Draft",
    badgeClass: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  },
  edit_konten: {
    label: "Edit Konten",
    badgeClass: "border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-300",
  },
  edit_sumber: {
    label: "Edit Sumber",
    badgeClass: "border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  },
}

export const CONTENT_KEY_PRESETS: Array<{ key: string; label: string }> = [
  { key: "hero", label: "Hero Landing" },
  { key: "about", label: "Tentang RiceGuard" },
  { key: "sdg2", label: "Konteks SDG 2" },
  { key: "how_it_works", label: "Cara Kerja" },
  { key: "methodology", label: "Metodologi" },
  { key: "limitations", label: "Batasan Klaim" },
]

export function parseSourceFiles(
  raw: Record<string, string> | Array<{ key: string; nama_file: string }> | null | undefined,
): Array<{ key: string; nama_file: string }> {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw.filter((item) => Boolean(item?.key && item?.nama_file))
  }
  return Object.entries(raw)
    .filter(([, value]) => typeof value === "string" && value.length > 0)
    .map(([key, nama_file]) => ({ key, nama_file }))
}

export function useAdminVersions(filters?: { tahun?: number; status?: string }) {
  return useQuery({
    queryKey: ["admin-versions", filters?.tahun ?? null, filters?.status ?? null],
    queryFn: () =>
      apiGet<AdminVersionsResponse>("/admin/versions", {
        tahun: filters?.tahun,
        status: filters?.status,
      }),
    staleTime: 30 * 1000,
  })
}

export function useAdminVersionDetail(id?: string) {
  return useQuery({
    queryKey: ["admin-version", id],
    queryFn: () => apiGet<AdminVersionDetailResponse>(`/admin/versions/${id}`),
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  })
}

export function useAdminVersionProvinces(id?: string) {
  return useQuery({
    queryKey: ["admin-version-provinces", id],
    queryFn: () => apiGet<AdminVersionProvincesResponse>(`/admin/versions/${id}/provinces`),
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  })
}

export function useAdminVersionRecommendations(id?: string) {
  return useQuery({
    queryKey: ["admin-version-recommendations", id],
    queryFn: () =>
      apiGet<AdminVersionRecommendationsResponse>(`/admin/versions/${id}/recommendations`),
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  })
}

export function useAdminContent() {
  return useQuery({
    queryKey: ["admin-content"],
    queryFn: () => apiGet<ContentItem[]>("/admin/content"),
    staleTime: 30 * 1000,
  })
}

export function useAdminAuditLog(filters: {
  action?: string
  actor?: string
  page?: number
  limit?: number
}) {
  return useQuery({
    queryKey: [
      "admin-audit-log",
      filters.action ?? "",
      filters.actor ?? "",
      filters.page ?? 1,
      filters.limit ?? 25,
    ],
    queryFn: () =>
      apiGet<AuditLogResponse>("/admin/audit-log", {
        action: filters.action,
        actor: filters.actor,
        page: filters.page ?? 1,
        limit: filters.limit ?? 25,
      }),
    staleTime: 15 * 1000,
  })
}

export async function invalidateDatasetQueries(queryClient: QueryClient, tahun?: number) {
  const keys: unknown[][] = [
    ["admin-versions"],
    ["admin-audit-log"],
    ["meta-years"],
    ["summary"],
    ["provinces"],
    ["rankings"],
    ["map-layers"],
    ["recommendations"],
    ["rice-balance"],
    ["validation"],
    ["trends"],
    ["province-detail"],
  ]
  if (tahun !== undefined) {
    keys.push(["summary", tahun], ["provinces", tahun], ["validation", tahun])
  }
  await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
}

export async function invalidateVersionDetailQueries(queryClient: QueryClient, versionId: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["admin-version", versionId] }),
    queryClient.invalidateQueries({ queryKey: ["admin-version-provinces", versionId] }),
    queryClient.invalidateQueries({ queryKey: ["admin-version-recommendations", versionId] }),
    queryClient.invalidateQueries({ queryKey: ["admin-versions"] }),
    queryClient.invalidateQueries({ queryKey: ["admin-audit-log"] }),
  ])
}

export async function invalidateContentQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["admin-content"] }),
    queryClient.invalidateQueries({ queryKey: ["content"] }),
    queryClient.invalidateQueries({ queryKey: ["sources"] }),
    queryClient.invalidateQueries({ queryKey: ["admin-audit-log"] }),
  ])
}
