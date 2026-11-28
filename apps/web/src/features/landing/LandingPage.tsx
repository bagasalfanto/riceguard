import { useQuery } from "@tanstack/react-query"
import { AlertCircle, Database, Leaf, ListOrdered, Sprout, TrendingUp } from "lucide-react"
import { Link } from "react-router-dom"

import { LimitationBanner } from "@/components/layout/LimitationBanner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useTahun } from "@/hooks/useTahun"
import { apiGet } from "@/lib/api"
import { formatTon } from "@/lib/format"
import { tampilanStatus } from "@/lib/status"
import type { ContentItem, SourceItem, SummaryResponse } from "@/lib/tipe-api"

function Teks({ children }: { children: string }) {
  return <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{children}</p>
}

/** Langkah bernomor dari `body_md` (`1. ...` per baris). */
function Langkah({ body }: { body: string }) {
  const langkah = body
    .split("\n")
    .map((baris) => baris.trim())
    .filter(Boolean)
    .map((baris) => baris.replace(/^\d+\.\s*/, ""))
  return (
    <ol className="grid gap-3 sm:grid-cols-2">
      {langkah.map((isi, i) => (
        <li className="flex gap-3 text-sm text-muted-foreground" key={isi}>
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {i + 1}
          </span>
          <span>{isi}</span>
        </li>
      ))}
    </ol>
  )
}

function AngkaHero({ label, nilai, keterangan }: { label: string; nilai: string; keterangan: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{nilai}</p>
      <p className="mt-1 text-xs text-muted-foreground">{keterangan}</p>
    </div>
  )
}

export function LandingPage() {
  const { tahun } = useTahun()

  const summary = useQuery({
    queryKey: ["summary", tahun],
    queryFn: () => apiGet<SummaryResponse>("/summary", { tahun }),
  })
  const content = useQuery({
    queryKey: ["content"],
    queryFn: () => apiGet<ContentItem[]>("/content"),
  })
  const sources = useQuery({
    queryKey: ["sources"],
    queryFn: () => apiGet<SourceItem[]>("/sources"),
  })

  const teks = new Map((content.data ?? []).map((c) => [c.key, c]))
  const error = summary.error ?? content.error ?? sources.error
  const loading = summary.isLoading || content.isLoading

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12">
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Gagal memuat halaman</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{error instanceof Error ? error.message : "Terjadi kesalahan saat memuat data."}</span>
            <Button
              onClick={() => {
                void summary.refetch()
                void content.refetch()
                void sources.refetch()
              }}
              size="sm"
              variant="outline"
            >
              Coba lagi
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (loading || !summary.data) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-12">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-5 w-full max-w-xl" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const data = summary.data
  const hero = teks.get("hero")
  const about = teks.get("about")
  const sdg2 = teks.get("sdg2")
  const caraKerja = teks.get("how_it_works")
  const batasan = teks.get("limitations")

  return (
    <>
      <LimitationBanner />

      <div className="mx-auto w-full max-w-7xl space-y-12 px-4 py-12">
        <section className="max-w-3xl">
          {sdg2 ? (
            <Badge className="gap-1.5" variant="outline">
              <Sprout aria-hidden="true" className="size-3.5" />
              {sdg2.title}
            </Badge>
          ) : null}
          {hero ? (
            <>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{hero.title}</h1>
              <p className="mt-3 text-base text-muted-foreground">{hero.body_md}</p>
            </>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/dashboard">Buka Dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/peta">Lihat Peta</Link>
            </Button>
          </div>
        </section>

        <section aria-label={`Angka nasional ${data.tahun}`}>
          <div className="grid gap-4 sm:grid-cols-3">
            <AngkaHero
              keterangan={`Total 38 provinsi, data ${data.tahun}`}
              label="Produksi beras"
              nilai={formatTon(data.produksi_beras_ton)}
            />
            <AngkaHero
              keterangan="Penduduk x konsumsi per kapita"
              label="Kebutuhan beras"
              nilai={formatTon(data.kebutuhan_beras_ton)}
            />
            <AngkaHero
              keterangan={data.rice_balance_ton >= 0 ? "Surplus nasional" : "Defisit nasional"}
              label="Rice balance"
              nilai={formatTon(data.rice_balance_ton)}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Sebaran status:</span>
            {(["surplus", "balanced", "defisit"] as const).map((status) => (
              <Badge className={tampilanStatus(status).kelas} key={status} variant="outline">
                {tampilanStatus(status).label} {data.jumlah_status[status]}
              </Badge>
            ))}
            <span className="tabular-nums">
              Rasio swasembada {data.rasio_swasembada?.toFixed(4) ?? "—"}
            </span>
          </div>
        </section>

        {about ? (
          <section>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Leaf aria-hidden="true" className="size-4 text-primary" />
                  {about.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Teks>{about.body_md}</Teks>
              </CardContent>
            </Card>
          </section>
        ) : null}

        {caraKerja ? (
          <section>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ListOrdered aria-hidden="true" className="size-4 text-primary" />
              {caraKerja.title}
            </h2>
            <div className="mt-4">
              <Langkah body={caraKerja.body_md} />
            </div>
          </section>
        ) : null}

        {sources.data && sources.data.length > 0 ? (
          <section>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Database aria-hidden="true" className="size-4 text-primary" />
              Sumber data
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {sources.data.map((s) => (
                <Card key={s.id}>
                  <CardHeader>
                    <CardDescription>{s.instansi}</CardDescription>
                    <CardTitle className="text-base">{s.nama}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    <p>{s.tabel_resmi ?? "—"}</p>
                    <p className="mt-1 tabular-nums">
                      {s.tahun ? `Tahun ${s.tahun}` : "Tahun —"}
                      {s.diperbarui ? ` · diperbarui ${s.diperbarui}` : ""}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {batasan ? (
          <section>
            <Alert>
              <TrendingUp aria-hidden="true" />
              <AlertTitle>{batasan.title}</AlertTitle>
              <AlertDescription>
                <Teks>{batasan.body_md}</Teks>
              </AlertDescription>
            </Alert>
          </section>
        ) : null}
      </div>
    </>
  )
}
