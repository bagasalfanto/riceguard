/**
 * Tahun aktif disimpan di URL (`?tahun=2025`) supaya link bisa dibagikan.
 */
import { useCallback } from "react"
import { useSearchParams } from "react-router-dom"

export function useTahun() {
  const [params, setParams] = useSearchParams()
  const mentah = params.get("tahun")
  const tahun = mentah && /^\d{4}$/.test(mentah) ? Number(mentah) : undefined

  const setTahun = useCallback(
    (baru: number | undefined) => {
      setParams(
        (lama) => {
          const next = new URLSearchParams(lama)
          if (baru === undefined) next.delete("tahun")
          else next.set("tahun", String(baru))
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  return { tahun, setTahun }
}
