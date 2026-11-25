import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Bingkai grafik: tinggi tetap (wajib untuk Recharts v3) dan label aksesibel.
 * Semua grafik Dashboard memakai ini supaya tinggi dan pembacaan seragam.
 */
export function ChartContainer({
  label,
  height = 320,
  className,
  children,
}: {
  label: string
  height?: number
  className?: string
  children: ReactNode
}) {
  return (
    <figure aria-label={label} className={cn("m-0 w-full", className)} role="group">
      <div style={{ height }} className="w-full">
        {children}
      </div>
    </figure>
  )
}
