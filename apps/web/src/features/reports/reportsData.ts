/**
 * Kontrak data, query TanStack, dan helper unduhan untuk halaman Reports & Export (`/laporan`).
 * Semua angka dan teks berasal dari API — tidak ada rumus atau kalkulasi di sini.
 */
import { useQuery } from "@tanstack/react-query"

import {
  downloadExportFile,
  formatTanggalId,
  formatTanggalWaktuId,
  getValidationVersionNo,
  useDataSources,
  useMetaYears,
  useTransparencyContent,
  useValidationReport,
  type ValidationResponse,
} from "@/features/data/dataTransparencyData"
import { ApiError, apiGet, apiUrl, type Query } from "@/lib/api"
import type { ProvincesResponse } from "@/lib/tipe-api"

export type { ValidationResponse }
export {
  downloadExportFile,
  formatTanggalId,
  formatTanggalWaktuId,
  getValidationVersionNo,
  useDataSources,
  useMetaYears,
  useTransparencyContent,
  useValidationReport,
}

export type JenisLaporan = "nasional" | "provinsi" | "surplus-defisit" | "rekomendasi"
export type FormatLaporan = "pdf" | "csv" | "excel"

export interface KonfigurasiLaporan {
  jenis: JenisLaporan
  judul: string
  deskripsi: string
  formatTersedia: FormatLaporan[]
  butuhProvinsi: boolean
  /** Seksi isi yang tercetak pada laporan, untuk kartu pratinjau. */
  seksi: string[]
}

export const KONFIGURASI_LAPORAN: KonfigurasiLaporan[] = [
  {
    jenis: "nasional",
    judul: "National Rice Security Report",
    deskripsi:
      "Ringkasan ketahanan pangan beras nasional: KPI utama, peta surplus–defisit, peringkat 5 provinsi tertinggi/terendah, serta batasan klaim.",
    formatTersedia: ["pdf"],
    butuhProvinsi: false,
    seksi: [
      "KPI Nasional (produksi, kebutuhan, balance, rasio)",
      "Peta Surplus–Defisit 38 Provinsi",
      "Top-5 Provinsi Surplus & Defisit",
      "Ringkasan per Pulau & Batasan Klaim",
    ],
  },
  {
    jenis: "provinsi",
    judul: "Regional Analysis Report",
    deskripsi:
      "Analisis satu provinsi: angka produksi, penduduk, konsumsi, rumus terisi, distribusi terkait, dan ringkasan kondisi wilayah.",
    formatTersedia: ["pdf"],
    butuhProvinsi: true,
    seksi: [
      "Profil Wilayah (kode BPS, pulau, jumlah penduduk)",
      "Angka Produksi, Kebutuhan, Balance, Rasio & Status",
      "Langkah Perhitungan Terisi dari API",
      "Daftar Rekomendasi Distribusi Terkait Provinsi",
    ],
  },
  {
    jenis: "surplus-defisit",
    judul: "Surplus-Deficit Report",
    deskripsi:
      "Daftar lengkap 38 provinsi dikelompokkan per status (surplus, balanced, defisit) beserta peta sebaran status.",
    formatTersedia: ["pdf", "csv", "excel"],
    butuhProvinsi: false,
    seksi: [
      "Ringkasan Jumlah Provinsi per Status",
      "Daftar 38 Provinsi per Status (Surplus / Balanced / Defisit)",
      "Peta Sebaran Status Surplus–Defisit",
    ],
  },
  {
    jenis: "rekomendasi",
    judul: "Distribution Recommendation Report",
    deskripsi:
      "Tabel rekomendasi distribusi antarprovinsi, penjelasan deterministik tiap alokasi, dan peta garis aliran distribusi.",
    formatTersedia: ["pdf", "csv", "excel"],
    butuhProvinsi: false,
    seksi: [
      "Ringkasan Total Alokasi & Pasangan Provinsi",
      "Tabel Rekomendasi Distribusi (Asal, Tujuan, Volume, Jarak)",
      "Penjelasan Alokasi & Peta Garis Aliran",
    ],
  },
]

/** Endpoint ekspor CSV/Excel Wave 8 (dipakai ulang tanpa duplikasi logika). */
export const ENDPOINT_EKSPOR_LAPORAN: Record<
  "surplus-defisit" | "rekomendasi",
  { csv: string; excel: string; csvFallbackPrefix: string; excelFallbackPrefix: string }
> = {
  "surplus-defisit": {
    csv: "/exports/provinces.csv",
    excel: "/exports/provinces.xlsx",
    csvFallbackPrefix: "riceguard-provinces",
    excelFallbackPrefix: "riceguard-provinces",
  },
  rekomendasi: {
    csv: "/exports/recommendations.csv",
    excel: "/exports/recommendations.xlsx",
    csvFallbackPrefix: "riceguard-recommendations",
    excelFallbackPrefix: "riceguard-recommendations",
  },
}

export function useProvincesReport(tahun?: number) {
  return useQuery({
    queryKey: ["provinces-report", tahun ?? null],
    queryFn: () =>
      apiGet<ProvincesResponse>("/provinces", {
        tahun,
        sort: "provinsi",
        order: "asc",
        limit: 100,
      }),
    staleTime: 5 * 60 * 1000,
  })
}

export interface ReportDownloadErrorInfo {
  kode: string
  message: string
}

export function describeReportError(err: unknown): ReportDownloadErrorInfo {
  if (err instanceof ApiError) {
    if (err.code === "NO_PUBLISHED_VERSION" || err.code === "NOT_FOUND" || err.status === 404) {
      return {
        kode: err.code,
        message:
          err.message ||
          "Data laporan atau versi published untuk tahun/provinsi tersebut tidak ditemukan.",
      }
    }
    if (err.code === "INVALID_PARAMS" || err.status === 400) {
      return {
        kode: err.code,
        message: err.message || "Parameter laporan tidak valid (400 INVALID_PARAMS).",
      }
    }
    return {
      kode: err.code,
      message: err.message || `Gagal membuka laporan (${err.status}).`,
    }
  }
  if (err instanceof Error) {
    return {
      kode: "UNKNOWN",
      message: err.message || "Gagal membuka laporan.",
    }
  }
  return {
    kode: "UNKNOWN",
    message: "Terjadi kesalahan saat membuka laporan.",
  }
}

/**
 * Membuka laporan HTML siap-cetak (`GET /api/v1/reports/{jenis}.html`) di tab baru.
 * Browser yang menyimpan PDF lewat dialog cetak, jadi tidak ada PDF yang dirender server.
 *
 * shortcut: tidak mengirim token admin, sehingga pratinjau draft `?version_id=` tidak
 * didukung; ganti ke fetch + blob bila suatu saat halaman ini perlu pratinjau draft.
 */
export function bukaLaporanCetak(jenis: JenisLaporan, query: Query): void {
  // `noopener` tidak dipakai di features: dengan itu window.open() mengembalikan null
  // walau tab berhasil dibuka, sehingga cek popup-blocked jadi selalu gagal.
  const jendela = window.open(apiUrl(`/reports/${jenis}.html`, query), "_blank")
  if (!jendela) {
    throw new Error(
      "Tab baru diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.",
    )
  }
  jendela.opener = null
}
