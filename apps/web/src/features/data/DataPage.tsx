import { BelumTersedia, HalamanFitur } from "@/components/common/HalamanFitur"

export function DataPage() {
  return (
    <HalamanFitur judul="Data & Methodology" deskripsi="Sumber, validasi, metodologi, unduhan">
      <BelumTersedia fitur="Sumber, validasi, metodologi, unduhan" wave={8} />
    </HalamanFitur>
  )
}