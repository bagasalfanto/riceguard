import { BelumTersedia, HalamanFitur } from "@/components/common/HalamanFitur"

export function TrenPage() {
  return (
    <HalamanFitur judul="Historical Trends" deskripsi="Tren dan perbandingan tahun">
      <BelumTersedia fitur="Tren dan perbandingan tahun" wave={7} />
    </HalamanFitur>
  )
}