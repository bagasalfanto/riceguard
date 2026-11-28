import { useLocation, useNavigate } from "react-router-dom"

import { LimitationBanner } from "@/components/layout/LimitationBanner"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OfficialRecommendationsTab } from "@/features/recommendations/OfficialRecommendationsTab"
import { useRecommendations } from "@/features/recommendations/recommendationsData"
import { SimulationTab } from "@/features/recommendations/SimulationTab"
import { useTahun } from "@/hooks/useTahun"

export function RekomendasiPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { tahun } = useTahun()

  const activeTab = location.pathname.startsWith("/rekomendasi/simulasi") ? "simulasi" : "resmi"
  const metaQuery = useRecommendations(tahun)
  const activeYear = metaQuery.data?.tahun ?? tahun ?? 2025
  const versionNo = metaQuery.data?.version?.version_no

  const handleTabChange = (nextTab: string) => {
    const targetPath = nextTab === "simulasi" ? "/rekomendasi/simulasi" : "/rekomendasi"
    if (location.pathname !== targetPath) {
      navigate(`${targetPath}${location.search}`, { replace: true })
    }
  }

  return (
    <>
      <LimitationBanner />

      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Rekomendasi Distribusi &amp; Simulasi
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Pasangan alokasi potensial dari provinsi surplus ke defisit serta pengujian skenario
              perubahan ambang, jarak maksimum, produksi, dan konsumsi.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className="text-xs tabular-nums" variant="secondary">
              Tahun {activeYear}
              {versionNo !== undefined ? ` · v${versionNo}` : ""}
            </Badge>
            <Badge className="text-xs" variant="outline">
              Bukan rencana logistik
            </Badge>
          </div>
        </div>

        <Tabs className="space-y-5" onValueChange={handleTabChange} value={activeTab}>
          <TabsList>
            <TabsTrigger value="resmi">Rekomendasi resmi</TabsTrigger>
            <TabsTrigger value="simulasi">Simulasi skenario</TabsTrigger>
          </TabsList>

          <TabsContent value="resmi">
            <OfficialRecommendationsTab />
          </TabsContent>

          <TabsContent value="simulasi">
            <SimulationTab />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
