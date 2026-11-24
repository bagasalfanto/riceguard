/**
 * Tema terang/gelap tanpa dependency tambahan: kelas `dark` di <html>, disimpan di localStorage.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

type Tema = "terang" | "gelap"

type KonteksTema = {
  tema: Tema
  toggle: () => void
}

const Kunci = "riceguard-tema"
const TemaContext = createContext<KonteksTema | null>(null)

function temaAwal(): Tema {
  const tersimpan = localStorage.getItem(Kunci)
  if (tersimpan === "terang" || tersimpan === "gelap") return tersimpan
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "gelap" : "terang"
}

export function TemaProvider({ children }: { children: React.ReactNode }) {
  const [tema, setTema] = useState<Tema>(() => temaAwal())

  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "gelap")
    document.documentElement.style.colorScheme = tema === "gelap" ? "dark" : "light"
    localStorage.setItem(Kunci, tema)
  }, [tema])

  const toggle = useCallback(() => setTema((t) => (t === "gelap" ? "terang" : "gelap")), [])

  const nilai = useMemo(() => ({ tema, toggle }), [tema, toggle])

  return <TemaContext.Provider value={nilai}>{children}</TemaContext.Provider>
}

export function useTema() {
  const ctx = useContext(TemaContext)
  if (!ctx) throw new Error("useTema harus dipakai di dalam TemaProvider")
  return ctx
}
