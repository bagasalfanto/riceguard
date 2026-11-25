import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { ChartContainer } from "@/components/charts/ChartContainer"
import type { TrendMetric } from "@/features/trends/trendsData"
import { formatAngka, formatPersen, formatTon } from "@/lib/format"

export const TREND_LINE_COLORS = [
  "#0f766e",
  "#2563eb",
  "#d97706",
  "#9333ea",
  "#e11d48",
] as const

export interface TrendLineSeries {
  key: string
  label: string
  color: string
}

export interface TrendLineDatum {
  tahun: number
  [seriesKey: string]: number | null
}

export interface TrendLineChartProps {
  data: TrendLineDatum[]
  series: TrendLineSeries[]
  metric: TrendMetric
  ariaLabel: string
  height?: number
  showLegend?: boolean
}

export function formatTrendMetricValue(
  nilai: number | null | undefined,
  metric: TrendMetric,
): string {
  if (nilai === null || nilai === undefined || Number.isNaN(nilai)) return "—"
  if (metric === "rasio") {
    return formatPersen(nilai * 100, 1)
  }
  if (metric === "balance") {
    const prefix = nilai > 0 ? "+" : ""
    return `${prefix}${formatTon(nilai)}`
  }
  return formatTon(nilai)
}

function formatAxisTick(nilai: number, metric: TrendMetric): string {
  if (!Number.isFinite(nilai)) return "—"
  if (metric === "rasio") {
    return `${formatAngka(nilai * 100, 0)}%`
  }
  const abs = Math.abs(nilai)
  const sign = nilai < 0 ? "−" : ""
  if (abs >= 1_000_000) {
    return `${sign}${formatAngka(abs / 1_000_000, 1)} jt`
  }
  if (abs >= 1_000) {
    return `${sign}${formatAngka(abs / 1_000, 0)} rb`
  }
  return `${sign}${formatAngka(abs, 0)}`
}

export function TrendLineChart({
  data,
  series,
  metric,
  ariaLabel,
  height = 320,
  showLegend = true,
}: TrendLineChartProps) {
  const axisUnit = metric === "rasio" ? "rasio (%)" : "ton"

  return (
    <ChartContainer height={height} label={ariaLabel}>
      <ResponsiveContainer height="100%" width="100%">
        <LineChart
          accessibilityLayer
          data={data}
          margin={{ top: 12, right: 16, bottom: 8, left: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            allowDecimals={false}
            dataKey="tahun"
            padding={{ left: 16, right: 16 }}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            label={{
              angle: -90,
              fill: "var(--muted-foreground)",
              fontSize: 11,
              position: "insideLeft",
              value: axisUnit,
            }}
            tick={{ fontSize: 11 }}
            tickFormatter={(val) => formatAxisTick(Number(val), metric)}
            width={74}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--popover)",
              borderColor: "var(--border)",
              borderRadius: "var(--radius-md)",
              color: "var(--popover-foreground)",
              fontSize: "12px",
            }}
            formatter={(nilai, nama) => {
              if (nilai === null || nilai === undefined || Number.isNaN(Number(nilai))) {
                return ["Data tidak tersedia", String(nama ?? "")]
              }
              return [formatTrendMetricValue(Number(nilai), metric), String(nama ?? "")]
            }}
            labelFormatter={(label) => `Tahun ${String(label ?? "")}`}
          />
          {showLegend ? <Legend /> : null}
          {metric === "balance" ? (
            <ReferenceLine
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              y={0}
            />
          ) : null}
          {metric === "rasio" ? (
            <ReferenceLine
              stroke="var(--status-balanced)"
              strokeDasharray="4 4"
              y={0.9}
            />
          ) : null}
          {series.map((s) => (
            <Line
              activeDot={{ r: 6 }}
              connectNulls={false}
              dataKey={s.key}
              dot={{ r: 4, strokeWidth: 2 }}
              key={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2.5}
              type="linear"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
