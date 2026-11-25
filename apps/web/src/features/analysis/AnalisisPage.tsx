import { useParams } from "react-router-dom"

import { AnalisisDetailView } from "@/features/analysis/AnalisisDetailView"
import { AnalisisListView } from "@/features/analysis/AnalisisListView"

export function AnalisisPage() {
  const { kode } = useParams<{ kode?: string }>()
  if (kode) return <AnalisisDetailView kode={kode} />
  return <AnalisisListView />
}
