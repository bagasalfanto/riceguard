import { BelumTersedia, HalamanFitur } from "@/components/common/HalamanFitur"

export function AdminLoginPage() {
  return (
    <HalamanFitur judul="Login Admin" deskripsi="Autentikasi admin">
      <BelumTersedia fitur="Autentikasi admin" wave={10} />
    </HalamanFitur>
  )
}