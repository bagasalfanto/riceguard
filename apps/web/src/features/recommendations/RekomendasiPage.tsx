import { BelumTersedia, HalamanFitur } from "@/components/common/HalamanFitur"

export function RekomendasiPage() {
  return (
    <HalamanFitur batasan judul="Recommendations" deskripsi="Rekomendasi resmi dan simulasi skenario">
      <BelumTersedia fitur="Rekomendasi resmi dan simulasi skenario" wave={6} />
    </HalamanFitur>
  )
}