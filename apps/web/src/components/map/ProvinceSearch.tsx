import { useId, useMemo, useRef, useState } from "react"
import { Search, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ProvinceRecord } from "@/features/map/mapData"
import { tampilanStatus } from "@/lib/status"
import { cn } from "@/lib/utils"

export interface ProvinceSearchProps {
  provinces: ProvinceRecord[]
  selectedCode?: string | null
  onSelect: (province: ProvinceRecord) => void
  className?: string
}

export function ProvinceSearch({
  provinces,
  selectedCode = null,
  onSelect,
  className,
}: ProvinceSearchProps) {
  const listboxId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...provinces].sort((a, b) => a.provinsi.localeCompare(b.provinsi, "id-ID"))
    if (!q) return sorted
    return sorted.filter(
      (p) =>
        p.provinsi.toLowerCase().includes(q) ||
        p.pulau.toLowerCase().includes(q) ||
        p.kode_bps.includes(q),
    )
  }, [provinces, query])

  const commitSelection = (province: ProvinceRecord) => {
    setQuery(province.provinsi)
    setOpen(false)
    onSelect(province)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setOpen(true)
      setActiveIndex((prev) => (filtered.length === 0 ? 0 : (prev + 1) % filtered.length))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setOpen(true)
      setActiveIndex((prev) =>
        filtered.length === 0 ? 0 : (prev - 1 + filtered.length) % filtered.length,
      )
    } else if (e.key === "Enter") {
      if (filtered.length > 0) {
        e.preventDefault()
        const target = filtered[Math.min(activeIndex, filtered.length - 1)]
        commitSelection(target)
      }
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  const activeOption = open && filtered[activeIndex] ? `${listboxId}-opt-${filtered[activeIndex].kode_bps}` : undefined

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          aria-activedescendant={activeOption}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          aria-label="Cari provinsi"
          className="pr-8 pl-8"
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 150)
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            setActiveIndex(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Cari provinsi (Enter untuk buka)..."
          ref={inputRef}
          role="combobox"
          type="text"
          value={query}
        />
        {query ? (
          <Button
            aria-label="Hapus pencarian provinsi"
            className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
            onClick={() => {
              setQuery("")
              setActiveIndex(0)
              setOpen(true)
              inputRef.current?.focus()
            }}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" className="size-3.5" />
          </Button>
        ) : null}
      </div>

      {open ? (
        <ul
          aria-label="Daftar provinsi"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
          id={listboxId}
          role="listbox"
        >
          {filtered.length === 0 ? (
            <li className="px-2.5 py-2 text-xs text-muted-foreground">
              Provinsi tidak ditemukan.
            </li>
          ) : (
            filtered.map((province, index) => {
              const statusInfo = tampilanStatus(province.status)
              const isActive = index === activeIndex
              const isSelected = province.kode_bps === selectedCode

              return (
                <li
                  aria-selected={isSelected}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                    isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                    isSelected && "font-semibold",
                  )}
                  id={`${listboxId}-opt-${province.kode_bps}`}
                  key={province.kode_bps}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    commitSelection(province)
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  role="option"
                >
                  <div className="min-w-0">
                    <div className="truncate">{province.provinsi}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {province.pulau} &middot; BPS {province.kode_bps}
                    </div>
                  </div>
                  <Badge className={cn("shrink-0 text-[10px]", statusInfo.kelas)} variant="outline">
                    {statusInfo.label}
                  </Badge>
                </li>
              )
            })
          )}
        </ul>
      ) : null}
    </div>
  )
}
