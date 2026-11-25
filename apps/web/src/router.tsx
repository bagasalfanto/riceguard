import { lazy, Suspense } from "react"
import { createBrowserRouter, Outlet, RouterProvider } from "react-router-dom"

import { PublicLayout } from "@/components/layout/PublicLayout"
import { Skeleton } from "@/components/ui/skeleton"

const AdminSessionProvider = lazy(() =>
  import("@/hooks/useAdminSession").then((m) => ({ default: m.AdminSessionProvider })),
)
const AdminLayout = lazy(() =>
  import("@/components/layout/AdminLayout").then((m) => ({ default: m.AdminLayout })),
)

const LandingPage = lazy(() =>
  import("@/features/landing/LandingPage").then((m) => ({ default: m.LandingPage })),
)
const DashboardPage = lazy(() =>
  import("@/features/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })),
)
const PetaPage = lazy(() =>
  import("@/features/map/PetaPage").then((m) => ({ default: m.PetaPage })),
)
const AnalisisPage = lazy(() =>
  import("@/features/analysis/AnalisisPage").then((m) => ({ default: m.AnalisisPage })),
)
const DistribusiPage = lazy(() =>
  import("@/features/distribution/DistribusiPage").then((m) => ({ default: m.DistribusiPage })),
)
const RekomendasiPage = lazy(() =>
  import("@/features/recommendations/RekomendasiPage").then((m) => ({
    default: m.RekomendasiPage,
  })),
)
const TrenPage = lazy(() =>
  import("@/features/trends/TrenPage").then((m) => ({ default: m.TrenPage })),
)
const DataPage = lazy(() =>
  import("@/features/data/DataPage").then((m) => ({ default: m.DataPage })),
)
const LaporanPage = lazy(() =>
  import("@/features/reports/LaporanPage").then((m) => ({ default: m.LaporanPage })),
)
const PrediksiPage = lazy(() =>
  import("@/features/forecast/PrediksiPage").then((m) => ({ default: m.PrediksiPage })),
)
const AdminLoginPage = lazy(() =>
  import("@/features/admin/AdminLoginPage").then((m) => ({ default: m.AdminLoginPage })),
)
const AdminDashboardPage = lazy(() =>
  import("@/features/admin/AdminDashboardPage").then((m) => ({ default: m.AdminDashboardPage })),
)
const AdminVersionsPage = lazy(() =>
  import("@/features/admin/AdminVersionsPage").then((m) => ({ default: m.AdminVersionsPage })),
)
const AdminUploadWizardPage = lazy(() =>
  import("@/features/admin/AdminUploadWizardPage").then((m) => ({
    default: m.AdminUploadWizardPage,
  })),
)
const AdminVersionDetailPage = lazy(() =>
  import("@/features/admin/AdminVersionDetailPage").then((m) => ({
    default: m.AdminVersionDetailPage,
  })),
)
const AdminContentPage = lazy(() =>
  import("@/features/admin/AdminContentPage").then((m) => ({ default: m.AdminContentPage })),
)
const AdminAuditLogPage = lazy(() =>
  import("@/features/admin/AdminAuditLogPage").then((m) => ({ default: m.AdminAuditLogPage })),
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

function AdminSessionBoundary() {
  return (
    <AdminSessionProvider>
      <Outlet />
    </AdminSessionProvider>
  )
}

const router = createBrowserRouter([
  {
    element: <AdminSessionBoundary />,
    children: [
      { path: "/admin/login", element: <AdminLoginPage /> },
      {
        path: "/admin",
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminDashboardPage /> },
          { path: "versi", element: <AdminVersionsPage /> },
          { path: "versi/baru", element: <AdminUploadWizardPage /> },
          { path: "versi/:id", element: <AdminVersionDetailPage /> },
          { path: "konten", element: <AdminContentPage /> },
          { path: "log", element: <AdminAuditLogPage /> },
          {
            path: "*",
            element: (
              <div className="py-16 text-center">
                <h1 className="text-2xl font-semibold">Halaman admin tidak ditemukan</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Periksa kembali alamat halaman admin atau pilih menu di sebelah kiri.
                </p>
              </div>
            ),
          },
        ],
      },
    ],
  },
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
      { path: "prediksi", element: <PrediksiPage /> },
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
