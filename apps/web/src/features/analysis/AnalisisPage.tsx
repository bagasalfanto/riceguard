import { BelumTersedia, HalamanFitur } from "@/components/common/HalamanFitur"

export function AnalisisPage() {
  return (
    <HalamanFitur judul="Regional Analysis" deskripsi="Tabel ranking 38 provinsi">
      <BelumTersedia fitur="Tabel ranking 38 provinsi" wave={4} />
    </HalamanFitur>
  )
}