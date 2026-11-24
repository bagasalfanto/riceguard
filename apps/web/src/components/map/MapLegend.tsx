import { useMemo, useState } from "react"
import { ArrowDownRight, ArrowUpRight, ChevronDown, ChevronUp, Info, Minus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { MapLayerResponse } from "@/features/map/mapData"
import type { StatusProvinsi } from "@/lib/status"

function StatusPatternIcon({ status }: { status?: StatusProvinsi }) {
  if (status === "surplus") {
    return <ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0" />
  }
  if (status === "balanced") {
    return <Minus aria-hidden="true" className="size-3.5 shrink-0" />
  }
  return <ArrowDownRight aria-hidden="true" className="size-3.5 shrink-0" />
}

function swatchPatternStyle(colorToken: string, pola?: "solid" | "garis" | "titik") {
  const color = `var(${colorToken})`
  if (pola === "garis") {
    return {
      backgroundColor: color,
      backgroundImage:
        "repeating-linear-gradient(45deg, transparent, transparent 2px, oklch(1 0 0 / 0.45) 2px, oklch(1 0 0 / 0.45) 4px)",
    }
  }
  if (pola === "titik") {
    return {
      backgroundColor: color,
      backgroundImage: "radial-gradient(oklch(1 0 0 / 0.55) 1px, transparent 1px)",
      backgroundSize: "4px 4px",
    }
  }
  return { backgroundColor: color }
}

export function MapLegend({ layerData }: { layerData?: MapLayerResponse }) {
  const [collapsed, setCollapsed] = useState(false)

  const statusCounts = useMemo(() => {
    const counts: Record<StatusProvinsi, number> = { surplus: 0, balanced: 0, defisit: 0 }
    if (!layerData || layerData.layer !== "status") return counts
    for (const val of Object.values(layerData.values)) {
      if (val === "surplus" || val === "balanced" || val === "defisit") {
        counts[val] += 1
      }
    }
    return counts
  }, [layerData])

  if (!layerData || layerData.classes.length === 0) return null

  const title =
    layerData.layer === "status"
      ? "Legenda Status Neraca"
      : layerData.layer === "produksi"
        ? "Legenda Produksi (Kuantil)"
        : "Legenda Kebutuhan (Kuantil)"

  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 z-[450] w-64 max-w-[calc(100%-5rem)] overflow-hidden rounded-xl border bg-card/95 text-card-foreground shadow-md backdrop-blur">
      <button
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold transition-colors hover:bg-accent/60"
        onClick={() => setCollapsed((c) => !c)}
        type="button"
      >
        <span className="flex items-center gap-1.5">
          <Info aria-hidden="true" className="size-3.5 text-primary" />
          {title}
        </span>
        {collapsed ? (
          <ChevronUp aria-hidden="true" className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown aria-hidden="true" className="size-3.5 text-muted-foreground" />
        )}
      </button>

      {!collapsed ? (
        <div className="space-y-1.5 border-t px-3 py-2.5 text-xs">
          {layerData.classes.map((cls, idx) => (
            <div
              className="flex items-center justify-between gap-2"
              key={`${cls.color_token}-${cls.label}`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-3.5 shrink-0 rounded-xs border border-border/80"
                  style={swatchPatternStyle(cls.color_token, cls.pola)}
                />
                {layerData.layer === "status" ? (
                  <span className="flex items-center gap-1 font-medium">
                    <StatusPatternIcon status={cls.key} />
                    {cls.label}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="inline-flex size-4 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-semibold tabular-nums">
                      {idx + 1}
                    </span>
                    <span className="truncate">{cls.label}</span>
                  </span>
                )}
              </div>

              {layerData.layer === "status" && cls.key ? (
                <Badge className="px-1.5 py-0 text-[10px] tabular-nums" variant="secondary">
                  {statusCounts[cls.key]}
                </Badge>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
