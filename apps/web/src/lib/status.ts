/**
 * Status dari API selalu huruf kecil (`surplus` | `balanced` | `defisit`).
 * FE hanya mengubah tampilannya, tidak pernah menurunkan status dari tanda balance.
 */
export type StatusProvinsi = "surplus" | "balanced" | "defisit"

type TampilanStatus = {
  label: string
  /** Kelas teks + border, dipakai Badge. */
  kelas: string
  /** Warna garis/isi grafik. */
  warna: string
  /** Pola untuk legenda dan cetak hitam-putih, supaya tidak bergantung warna saja. */
  pola: "solid" | "garis" | "titik"
  keterangan: string
}

const TAMPILAN: Record<StatusProvinsi, TampilanStatus> = {
  surplus: {
    label: "Surplus",
    kelas: "border-status-surplus/40 bg-status-surplus/10 text-status-surplus",
    warna: "var(--status-surplus)",
    pola: "solid",
    keterangan: "Produksi beras melebihi kebutuhan",
  },
  balanced: {
    label: "Balanced",
    kelas: "border-status-balanced/40 bg-status-balanced/10 text-status-balanced",
    warna: "var(--status-balanced)",
    pola: "garis",
    keterangan: "Produksi memenuhi 90–100% kebutuhan (kriteria swasembada FAO 1999)",
  },
  defisit: {
    label: "Defisit",
    kelas: "border-status-defisit/40 bg-status-defisit/10 text-status-defisit",
    warna: "var(--status-defisit)",
    pola: "titik",
    keterangan: "Produksi beras kurang dari 90% kebutuhan",
  },
}

export function tampilanStatus(status: string): TampilanStatus {
  return TAMPILAN[(status as StatusProvinsi) in TAMPILAN ? (status as StatusProvinsi) : "defisit"]
}

export const SEMUA_STATUS: StatusProvinsi[] = ["surplus", "balanced", "defisit"]
