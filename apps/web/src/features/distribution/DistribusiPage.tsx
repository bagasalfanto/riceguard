import { BelumTersedia, HalamanFitur } from "@/components/common/HalamanFitur"

export function DistribusiPage() {
  return (
    <HalamanFitur batasan judul="Distribution Analysis" deskripsi="Pemasok, penerima, dan matriks jarak">
      <BelumTersedia fitur="Pemasok, penerima, dan matriks jarak" wave={5} />
    </HalamanFitur>
  )
}