import { BelumTersedia, HalamanFitur } from "@/components/common/HalamanFitur"

export function LaporanPage() {
  return (
    <HalamanFitur judul="Laporan" deskripsi="Unduh laporan PDF, CSV, Excel">
      <BelumTersedia fitur="Unduh laporan PDF, CSV, Excel" wave={9} />
    </HalamanFitur>
  )
}