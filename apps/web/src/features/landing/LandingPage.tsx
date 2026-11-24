import { Link } from "react-router-dom"
import { Sprout } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function LandingPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12">
      <section className="max-w-3xl">
        <p className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sprout aria-hidden="true" className="size-3.5" />
          SDG 2 — Zero Hunger
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Beras surplus secara nasional, tetapi tidak merata.
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          RiceGuard memetakan keseimbangan produksi dan kebutuhan beras 38 provinsi, lalu menunjukkan
          dari provinsi surplus mana kekurangan itu bisa ditutup.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/dashboard">Buka Dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/peta">Lihat Peta</Link>
          </Button>
        </div>
      </section>

      <Card className="mt-10">
        <CardHeader>
          <CardTitle>Konten landing menyusul</CardTitle>
          <CardDescription>
            Hero, About, SDG 2, How it works, sumber data, dan batasan diisi dari endpoint
            <code className="mx-1">/summary</code>,<code className="mx-1">/sources</code>, dan
            <code className="mx-1">/content</code> di wave 1.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Lihat <code>docs/tickets/wave-1-landing.md</code>.
        </CardContent>
      </Card>
    </div>
  )
}
