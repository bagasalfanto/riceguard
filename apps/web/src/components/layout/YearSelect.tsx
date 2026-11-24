import { useQuery } from "@tanstack/react-query"
import { CalendarDays } from "lucide-react"

import { apiGet } from "@/lib/api"
import { useTahun } from "@/hooks/useTahun"
import type { MetaYears } from "@/lib/tipe-api"

/**
 * Pemilih tahun global. Selama hanya ada satu tahun, tampil sebagai label statis "Data 2025".
 */
export function YearSelect() {
  const { tahun, setTahun } = useTahun()
  const { data } = useQuery({
    queryKey: ["meta-years"],
    queryFn: () => apiGet<MetaYears>("/meta/years"),
    staleTime: 5 * 60 * 1000,
  })

  const daftar = data?.tahun ?? []
  const aktif = tahun ?? data?.tahun_terbaru ?? undefined

  if (daftar.length <= 1) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <CalendarDays aria-hidden="true" className="size-4" />
        {aktif ? `Data ${aktif}` : "Belum ada data"}
      </span>
    )
  }

  return (
    <label className="inline-flex items-center gap-1.5 text-sm">
      <CalendarDays aria-hidden="true" className="size-4 text-muted-foreground" />
      <span className="sr-only">Pilih tahun data</span>
      <select
        className="rounded-md border bg-background px-2 py-1 text-sm"
        value={aktif ?? ""}
        onChange={(e) => setTahun(Number(e.target.value))}
      >
        {daftar.map((t) => (
          <option key={t.tahun} value={t.tahun}>
            Data {t.tahun}
          </option>
        ))}
      </select>
    </label>
  )
}
