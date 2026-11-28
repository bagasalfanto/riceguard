import { useState } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  FileText,
  History,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  ShieldAlert,
  Sprout,
  Sun,
  Upload,
  UserCheck,
} from "lucide-react"
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useAdminSession } from "@/hooks/useAdminSession"
import { useTema } from "@/hooks/useTema"
import { cn } from "@/lib/utils"

interface AdminNavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
}

const ADMIN_NAV: AdminNavItem[] = [
  { to: "/admin", label: "Ringkasan", icon: LayoutDashboard, end: true },
  { to: "/admin/versi", label: "Versi Dataset", icon: Layers, end: true },
  { to: "/admin/versi/baru", label: "Upload Versi Baru", icon: Upload, end: true },
  { to: "/admin/konten", label: "Konten & Sumber", icon: FileText, end: true },
  { to: "/admin/log", label: "Log Aktivitas", icon: History, end: true },
]

function AdminNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation()

  return (
    <nav aria-label="Navigasi panel admin" className="flex flex-col gap-1">
      {ADMIN_NAV.map((item) => {
        const Icon = item.icon
        const isVersionDetail =
          item.to === "/admin/versi" &&
          pathname.startsWith("/admin/versi/") &&
          pathname !== "/admin/versi/baru"

        return (
          <NavLink
            key={item.to}
            end={item.end}
            onClick={onNavigate}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive || isVersionDetail
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )
            }
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}

function ToggleTemaButton() {
  const { tema, toggle } = useTema()
  const gelap = tema === "gelap"
  return (
    <Button
      aria-label={gelap ? "Aktifkan tema terang" : "Aktifkan tema gelap"}
      onClick={toggle}
      size="icon-sm"
      variant="ghost"
    >
      {gelap ? <Sun aria-hidden="true" className="size-4" /> : <Moon aria-hidden="true" className="size-4" />}
    </Button>
  )
}

export function AdminLayout() {
  const location = useLocation()
  const { status, admin, session, authError, signOut, retryVerify } = useAdminSession()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (status === "loading" || status === "checking") {
    return (
      <div className="mx-auto flex min-h-svh max-w-5xl flex-col justify-center gap-4 px-4 py-12">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
    )
  }

  if (status === "unauthenticated" || status === "unconfigured") {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ from: location.pathname, reason: authError }}
      />
    )
  }

  if (status === "forbidden") {
    return (
      <div className="mx-auto flex min-h-svh max-w-lg flex-col justify-center px-4 py-12">
        <Alert variant="destructive">
          <ShieldAlert aria-hidden="true" />
          <AlertTitle>Akses Ditolak (403 Forbidden)</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              {authError ||
                "Akun Supabase yang sedang masuk tidak memiliki hak akses admin RiceGuard."}
            </p>
            {session?.user?.email ? (
              <p className="text-xs">
                Masuk sebagai: <span className="font-medium">{session.user.email}</span>
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={() => void signOut()} size="sm" variant="destructive">
                <LogOut aria-hidden="true" className="size-4" />
                Keluar Akun
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/">Kembali ke Situs Publik</Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="mx-auto flex min-h-svh max-w-lg flex-col justify-center px-4 py-12">
        <Alert variant="destructive">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>Gagal Memverifikasi Sesi Admin</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{authError || "Terjadi gangguan saat menghubungi API admin."}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={() => void retryVerify()} size="sm" variant="outline">
                Coba Lagi
              </Button>
              <Button onClick={() => void signOut()} size="sm" variant="ghost">
                Keluar
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card/40 lg:flex">
        <div className="flex h-14 items-center justify-between border-b px-4">
          <Link className="flex items-center gap-2 font-semibold" to="/admin">
            <Sprout aria-hidden="true" className="size-5 text-primary" />
            <span>RiceGuard</span>
            <Badge className="ml-1" variant="secondary">
              Admin
            </Badge>
          </Link>
          <ToggleTemaButton />
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <AdminNavLinks />
        </div>

        <div className="space-y-3 border-t p-4">
          <div className="flex items-start gap-2.5 rounded-lg border bg-background p-2.5">
            <UserCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{admin?.nama ?? "Admin"}</p>
              <p className="truncate text-xs text-muted-foreground">{admin?.email ?? ""}</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Button asChild className="justify-start" size="sm" variant="outline">
              <Link to="/">
                <ArrowLeft aria-hidden="true" className="size-4" />
                Lihat Situs Publik
              </Link>
            </Button>
            <Button
              className="justify-start text-destructive hover:text-destructive"
              onClick={() => void signOut()}
              size="sm"
              variant="ghost"
            >
              <LogOut aria-hidden="true" className="size-4" />
              Keluar
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2">
            <Sheet onOpenChange={setMobileOpen} open={mobileOpen}>
              <SheetTrigger asChild>
                <Button aria-label="Buka menu admin" size="icon-sm" variant="ghost">
                  <Menu aria-hidden="true" className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent className="flex flex-col p-0" side="left">
                <div className="flex h-14 items-center gap-2 border-b px-4">
                  <Sprout aria-hidden="true" className="size-5 text-primary" />
                  <SheetTitle>RiceGuard Admin</SheetTitle>
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-4">
                  <AdminNavLinks onNavigate={() => setMobileOpen(false)} />
                </div>
                <Separator />
                <div className="space-y-3 p-4">
                  <div className="rounded-lg border bg-card p-2.5">
                    <p className="truncate text-sm font-medium">{admin?.nama ?? "Admin"}</p>
                    <p className="truncate text-xs text-muted-foreground">{admin?.email ?? ""}</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Button asChild className="justify-start" size="sm" variant="outline">
                      <Link onClick={() => setMobileOpen(false)} to="/">
                        <ArrowLeft aria-hidden="true" className="size-4" />
                        Lihat Situs Publik
                      </Link>
                    </Button>
                    <Button
                      className="justify-start text-destructive hover:text-destructive"
                      onClick={() => {
                        setMobileOpen(false)
                        void signOut()
                      }}
                      size="sm"
                      variant="ghost"
                    >
                      <LogOut aria-hidden="true" className="size-4" />
                      Keluar
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <Link className="flex items-center gap-2 font-semibold" to="/admin">
              <Sprout aria-hidden="true" className="size-5 text-primary" />
              <span>Admin</span>
            </Link>
          </div>

          <div className="flex items-center gap-1.5">
            <Badge className="hidden sm:inline-flex" variant="outline">
              {admin?.nama ?? admin?.email ?? "Admin"}
            </Badge>
            <ToggleTemaButton />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
