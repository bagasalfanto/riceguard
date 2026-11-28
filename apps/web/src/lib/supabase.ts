import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? "").trim()
const supabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "").trim()

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)

/**
 * Inisialisasi client Supabase hanya jika env terisi agar halaman publik
 * dan proses build tidak gagal saat kredensial admin belum disiapkan.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
