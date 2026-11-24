import { FileDown, Menu, Moon, Sprout, Sun } from "lucide-react"
import { Link, NavLink } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useTema } from "@/hooks/useTema"
import { useTahun } from "@/hooks/useTahun"
import { YearSelect } from "@/components/layout/YearSelect"

const MENU = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/peta", label: "Rice Map" },
  { to: "/analisis", label: "Regional Analysis" },
  { to: "/distribusi", label: "Distribution Analysis" },
  { to: "/rekomendasi", label: "Recommendations" },
  { to: "/tren", label: "Historical Trends", butuhDuaTahun: true },
  { to: "/data", label: "Data & Methodology" },
]

function ToggleTema() {
  const { tema, toggle } = useTema()
  const gelap = tema === "gelap"
  return (
    <Button
      aria-label={gelap ? "Aktifkan tema terang" : "Aktifkan tema gelap"}
      onClick={toggle}
      size="icon"
      variant="ghost"
    >
      {gelap ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </Button>
  )
}

function TautanMenu({ onKlik }: { onKlik?: () => void }) {
  const { tahun } = useTahun()
  const suffix = tahun ? `?tahun=${tahun}` : ""
  return (
    <>
      {MENU.map((item) => (
        <NavLink
          key={item.to}
          className={({ isActive }) =>
            cn(
              "rounded-md px-2 py-2 text-[13px] font-medium whitespace-nowrap transition-colors hover:bg-accent hover:text-accent-foreground",
              isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )
          }
          onClick={onKlik}
          to={`${item.to}${suffix}`}
        >
          {item.label}
        </NavLink>
      ))}
    </>
  )
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4">
        <Link className="flex items-center gap-2 font-semibold" to="/">
          <Sprout aria-hidden="true" className="size-5 text-primary" />
          RiceGuard
        </Link>

        <Separator className="mx-2 hidden h-6 xl:block" orientation="vertical" />

        <nav aria-label="Navigasi utama" className="hidden flex-1 items-center gap-0.5 xl:flex">
          <TautanMenu />
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <YearSelect />
          <Button asChild size="sm" variant="outline">
            <Link aria-label="Unduh laporan" to="/laporan">
              <FileDown aria-hidden="true" />
              <span className="hidden 2xl:inline">Unduh laporan</span>
            </Link>
          </Button>
          <ToggleTema />
          <Sheet>
            <SheetTrigger asChild>
              <Button aria-label="Buka menu" className="xl:hidden" size="icon" variant="ghost">
                <Menu aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetTitle>Menu</SheetTitle>
              <nav aria-label="Navigasi utama (seluler)" className="mt-4 flex flex-col gap-1">
                <TautanMenu />
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
