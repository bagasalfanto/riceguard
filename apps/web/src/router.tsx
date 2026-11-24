import { lazy, Suspense } from "react"
import { createBrowserRouter, RouterProvider } from "react-router-dom"

import { PublicLayout } from "@/components/layout/PublicLayout"
import { Skeleton } from "@/components/ui/skeleton"

const LandingPage = lazy(() => import("@/features/landing/LandingPage").then((m) => ({ default: m.LandingPage })))
const DashboardPage = lazy(() =>
  import("@/features/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })),
)
const PetaPage = lazy(() => import("@/features/map/PetaPage").then((m) => ({ default: m.PetaPage })))
const AnalisisPage = lazy(() =>
  import("@/features/analysis/AnalisisPage").then((m) => ({ default: m.AnalisisPage })),
)
const DistribusiPage = lazy(() =>
  import("@/features/distribution/DistribusiPage").then((m) => ({ default: m.DistribusiPage })),
)
const RekomendasiPage = lazy(() =>
  import("@/features/recommendations/RekomendasiPage").then((m) => ({ default: m.RekomendasiPage })),
)
const TrenPage = lazy(() => import("@/features/trends/TrenPage").then((m) => ({ default: m.TrenPage })))
const DataPage = lazy(() => import("@/features/data/DataPage").then((m) => ({ default: m.DataPage })))
const LaporanPage = lazy(() =>
  import("@/features/reports/LaporanPage").then((m) => ({ default: m.LaporanPage })),
)
const AdminLoginPage = lazy(() =>
  import("@/features/admin/AdminLoginPage").then((m) => ({ default: m.AdminLoginPage })),
)

function Fallback() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-3 px-4 py-8">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <PublicLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "peta", element: <PetaPage /> },
      { path: "analisis", element: <AnalisisPage /> },
      { path: "analisis/:kode", element: <AnalisisPage /> },
      { path: "distribusi", element: <DistribusiPage /> },
      { path: "rekomendasi", element: <RekomendasiPage /> },
      { path: "rekomendasi/simulasi", element: <RekomendasiPage /> },
      { path: "tren", element: <TrenPage /> },
      { path: "data", element: <DataPage /> },
      { path: "laporan", element: <LaporanPage /> },
      { path: "admin/login", element: <AdminLoginPage /> },
      {
        path: "*",
        element: (
          <div className="mx-auto max-w-3xl px-4 py-16 text-center">
            <h1 className="text-2xl font-semibold">Halaman tidak ditemukan</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Periksa kembali alamatnya, atau kembali ke Dashboard.
            </p>
          </div>
        ),
      },
    ],
  },
])

export function Router() {
  return (
    <Suspense fallback={<Fallback />}>
      <RouterProvider router={router} />
    </Suspense>
  )
}
