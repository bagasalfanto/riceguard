import type { ReactNode } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LimitationBanner } from "@/components/layout/LimitationBanner"

/** Kerangka halaman fitur: judul, deskripsi, dan isi. Dipakai semua halaman sampai wave-nya selesai. */
export function HalamanFitur({
  judul,
  deskripsi,
  batasan = false,
  children,
}: {
  judul: string
  deskripsi: string
  /** Tampilkan banner batasan klaim (Dashboard, Peta, Distribusi, Rekomendasi). */
  batasan?: boolean
  children?: ReactNode
}) {
  return (
    <>
      {batasan ? <LimitationBanner /> : null}
      <div className="mx-auto w-full max-w-7xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">{judul}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{deskripsi}</p>
        <div className="mt-6">{children}</div>
      </div>
    </>
  )
}

/** Penanda halaman yang belum punya data. Diganti per wave sesuai docs/tickets/. */
export function BelumTersedia({ wave, fitur }: { wave: number; fitur: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Belum tersedia</CardTitle>
        <CardDescription>
          {fitur} dikerjakan di wave {wave}. Kerangka rute, layout, dan format angka sudah aktif.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Lihat <code>docs/tickets/wave-{wave}-*.md</code> untuk rincian tiketnya.
      </CardContent>
    </Card>
  )
}
