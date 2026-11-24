import { BelumTersedia, HalamanFitur } from "@/components/common/HalamanFitur"

export function PetaPage() {
  return (
    <HalamanFitur batasan judul="Rice Map" deskripsi="Peta choropleth surplus-defisit">
      <BelumTersedia fitur="Peta choropleth surplus-defisit" wave={3} />
    </HalamanFitur>
  )
}