import { Link } from "react-router-dom"

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          Sumber: BPS (produksi, penduduk), Bapanas (konsumsi), referensi provinsi tim WebGIS
          RiceGuard.
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Versi dataset tampil di setiap halaman data.</span>
          <Link className="underline underline-offset-2" to="/data">
            Metodologi
          </Link>
          <a
            className="underline underline-offset-2"
            href="https://github.com/bagasalfanto/riceguard"
            rel="noreferrer"
            target="_blank"
          >
            Repo
          </a>
        </div>
      </div>
    </footer>
  )
}
