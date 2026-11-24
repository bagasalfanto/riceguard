import { AlertTriangle } from "lucide-react"
import { Link } from "react-router-dom"

import { Alert, AlertDescription } from "@/components/ui/alert"

/**
 * Banner satu baris batasan klaim (PRD bagian 4). Wajib di Dashboard, Peta, Distribusi, Rekomendasi.
 */
export function LimitationBanner() {
  return (
    <Alert className="rounded-none border-x-0 border-t-0 bg-muted/60 py-2">
      <AlertTriangle aria-hidden="true" className="size-4" />
      <AlertDescription className="text-xs sm:text-sm">
        Balance = produksi − estimasi konsumsi, bukan stok aktual. Rekomendasi bersifat potensial,
        bukan rencana logistik.{" "}
        <Link className="underline underline-offset-2" to="/data#batasan">
          Baca batasan lengkap
        </Link>
      </AlertDescription>
    </Alert>
  )
}
