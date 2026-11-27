# AGENTS.md — Frontend (React + TypeScript)

Panduan tambahan untuk berkas di `apps/web/`. Aturan root di `../../AGENTS.md` tetap berlaku; berkas terdekat ini menang bila berselisih.

## Kosakata & Integritas Angka (Kritikal)

- **Dilarang menghitung rumus beras di frontend.** Seluruh angka, rasio, status, dan alokasi datang dari FastAPI via `src/lib/api.ts`.
- **Kosakata antarmuka:** patuhi `../../docs/KAMUS_KOSAKATA.md` dan `../../GLOSSARY.md` untuk setiap label, judul, tombol, toast, tooltip, dan parameter URL.
- **Larangan kata "rute":** jangan gunakan kata `"rute"` di UI, label peta, tooltip, atau deskripsi (gunakan `"Alur alokasi"` dan `"jarak garis lurus"`).
- **Status & Format:** tampilkan status lewat `tampilanStatus()` (`src/lib/status.ts`, selalu memakai kolom `status`, bukan tanda `rice_balance_ton`) dan angka lewat `formatTon`, `formatJiwa`, `formatKm`, `formatPersen`, `formatAngka` (`src/lib/format.ts`, `Intl.NumberFormat("id-ID")`). Angka bisnis memakai `tabular-nums`; `font-mono` hanya untuk kode/UUID/JSON teknis.
- **Tema:** gunakan token CSS OKLCH di `src/styles/index.css` (mendukung mode terang & `.dark`); hindari hardcoded hex warna di TSX.

## Struktur `src/`

| Path | Isi |
|---|---|
| `router.tsx` | 12 rute publik (`PublicLayout`) + `/admin/login` + 6 rute admin (`AdminLayout`), semua halaman `React.lazy` |
| `features/*` | Halaman dan hook data per domain (`landing`, `dashboard`, `map`, `analysis`, `distribution`, `recommendations`, `trends`, `data`, `reports`, `forecast`, `admin`) |
| `components/ui/` | Primitif shadcn/ui (Radix + Tailwind CSS v4) |
| `components/layout/` | `PublicLayout`, `AdminLayout`, `Header`, `Footer`, `YearSelect`, `LimitationBanner` |
| `components/map/` | `BaseMap`, `ProvinceLayer`, `FlowLines`, `MapLegend`, `ProvinceSearch` (Leaflet + GeoJSON) |
| `components/charts/` | `ChartContainer` (tinggi tetap), `TrendLineChart` (Recharts) |
| `hooks/` | `useTahun`, `useTema`, `useAdminSession` |
| `lib/` | `api.ts`, `api-types.ts`, `tipe-api.ts`, `format.ts`, `status.ts`, `supabase.ts`, `utils.ts` |

- `src/lib/api-types.ts` dihasilkan lewat `npm run api:types` — jangan edit manual.
- `src/lib/supabase.ts` hanya untuk Supabase Auth admin dan wajib aman bernilai `null` saat env Supabase kosong.

## Gaya & Verifikasi

- Linter: `oxlint` (`npm run lint:web`); TypeScript strict build: `npm run build:web` (`tsc -b && vite build`).
- Setiap halaman data wajib punya state loading (`Skeleton`), error (`Alert` destruktif + `"Coba lagi"`), dan kosong (`EmptyState` / pesan tahun belum dipublikasi). Detail desain: `../../docs/DESIGN.md` & `../../docs/RULES.md`.
