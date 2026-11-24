/**
 * Format angka Bahasa Indonesia. Satuan selalu ditulis di pemanggil, bukan di sini.
 */
const angka = new Intl.NumberFormat("id-ID")

const angkaDesimal = (desimal: number) =>
  new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: desimal,
    maximumFractionDigits: desimal,
  })

export function formatTon(nilai: number | null | undefined, desimal = 0): string {
  if (nilai === null || nilai === undefined || Number.isNaN(nilai)) return "—"
  return `${angkaDesimal(desimal).format(nilai)} ton`
}

export function formatJiwa(nilai: number | null | undefined): string {
  if (nilai === null || nilai === undefined || Number.isNaN(nilai)) return "—"
  return `${angka.format(nilai)} jiwa`
}

export function formatKm(nilai: number | null | undefined, desimal = 1): string {
  if (nilai === null || nilai === undefined || Number.isNaN(nilai)) return "—"
  return `${angkaDesimal(desimal).format(nilai)} km`
}

export function formatPersen(nilai: number | null | undefined, desimal = 1): string {
  if (nilai === null || nilai === undefined || Number.isNaN(nilai)) return "—"
  return `${angkaDesimal(desimal).format(nilai)}%`
}

export function formatAngka(nilai: number | null | undefined, desimal = 0): string {
  if (nilai === null || nilai === undefined || Number.isNaN(nilai)) return "—"
  return angkaDesimal(desimal).format(nilai)
}
