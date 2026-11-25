import { useQuery } from "@tanstack/react-query"
import { FileDown, Menu, Moon, Sprout, Sun } from "lucide-react"
import { Link, NavLink } from "react-router-dom"

import { YearSelect } from "@/components/layout/YearSelect"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useTahun } from "@/hooks/useTahun"
import { useTema } from "@/hooks/useTema"
import { apiGet } from "@/lib/api"
import type { MetaYears } from "@/lib/tipe-api"
import { cn } from "@/lib/utils"

interface MenuItem {
  to: string
  label: string
  butuhDuaTahun?: boolean
}

const MENU: MenuItem[] = [
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

function TautanMenu({
  items,
  onKlik,
}: {
  items: MenuItem[]
  onKlik?: () => void
}) {
  const { tahun } = useTahun()
  const suffix = tahun ? `?tahun=${tahun}` : ""
  return (
    <>
      {items.map((item) => (
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
  const { data: metaYears } = useQuery({
    queryKey: ["meta-years"],
    queryFn: () => apiGet<MetaYears>("/meta/years"),
    staleTime: 5 * 60 * 1000,
  })

  const showMultiYearMenu = metaYears?.butuh_minimal_2_tahun === false
  const visibleMenu = MENU.filter((item) => !item.butuhDuaTahun || showMultiYearMenu)

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4">
        <Link className="flex items-center gap-2 font-semibold" to="/">
          <Sprout aria-hidden="true" className="size-5 text-primary" />
          RiceGuard
        </Link>

        <Separator className="mx-2 hidden h-6 xl:block" orientation="vertical" />

        <nav aria-label="Navigasi utama" className="hidden flex-1 items-center gap-0.5 xl:flex">
          <TautanMenu items={visibleMenu} />
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
                <TautanMenu items={visibleMenu} />
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
