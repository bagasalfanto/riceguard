import { BelumTersedia, HalamanFitur } from "@/components/common/HalamanFitur"

export function DashboardPage() {
  return (
    <HalamanFitur batasan judul="Dashboard" deskripsi="KPI nasional dan grafik per provinsi">
      <BelumTersedia fitur="KPI nasional dan grafik per provinsi" wave={2} />
    </HalamanFitur>
  )
}