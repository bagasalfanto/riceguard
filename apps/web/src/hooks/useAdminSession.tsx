import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { Session } from "@supabase/supabase-js"

import { ApiError, apiGet, setTokenAdmin } from "@/lib/api"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"

export interface AdminMe {
  user_id: string
  nama: string
  email: string
}

export type AdminSessionStatus =
  | "loading"
  | "unconfigured"
  | "unauthenticated"
  | "checking"
  | "authenticated"
  | "forbidden"
  | "error"

interface AdminSessionContextValue {
  isConfigured: boolean
  status: AdminSessionStatus
  session: Session | null
  admin: AdminMe | null
  authError: string | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  retryVerify: () => Promise<void>
  clearAuthError: () => void
}

const AdminSessionContext = createContext<AdminSessionContextValue | null>(null)

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AdminSessionStatus>(() =>
    isSupabaseConfigured && supabase ? "loading" : "unconfigured",
  )
  const [session, setSession] = useState<Session | null>(null)
  const [admin, setAdmin] = useState<AdminMe | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const verifySeqRef = useRef(0)

  const verifySession = useCallback(async (nextSession: Session | null) => {
    const seq = ++verifySeqRef.current
    setSession(nextSession)

    if (!nextSession?.access_token) {
      setTokenAdmin(null)
      setAdmin(null)
      setStatus(isSupabaseConfigured && supabase ? "unauthenticated" : "unconfigured")
      return
    }

    setTokenAdmin(nextSession.access_token)
    setStatus("checking")

    try {
      const me = await apiGet<AdminMe>("/admin/me")
      if (verifySeqRef.current !== seq) return
      setAdmin(me)
      setAuthError(null)
      setStatus("authenticated")
    } catch (err) {
      if (verifySeqRef.current !== seq) return
      setAdmin(null)

      if (err instanceof ApiError && err.status === 401) {
        setTokenAdmin(null)
        setSession(null)
        setAuthError("Sesi Anda telah berakhir atau tidak valid. Silakan login kembali.")
        setStatus("unauthenticated")
        if (supabase) {
          await supabase.auth.signOut().catch(() => undefined)
        }
        return
      }

      if (err instanceof ApiError && err.status === 403) {
        setAuthError(
          err.message || "Akun ini tidak terdaftar sebagai admin RiceGuard (403 Forbidden).",
        )
        setStatus("forbidden")
        return
      }

      setAuthError(
        err instanceof Error
          ? err.message
          : "Gagal memverifikasi sesi admin ke server API.",
      )
      setStatus("error")
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setTokenAdmin(null)
      setStatus("unconfigured")
      return
    }

    let mounted = true
    const client = supabase

    void client.auth.getSession().then(({ data, error }) => {
      if (!mounted) return
      if (error) {
        setTokenAdmin(null)
        setAuthError(error.message)
        setStatus("unauthenticated")
        return
      }
      void verifySession(data.session)
    })

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return
      if (event === "SIGNED_OUT") {
        verifySeqRef.current += 1
        setTokenAdmin(null)
        setSession(null)
        setAdmin(null)
        setStatus("unauthenticated")
        return
      }
      void verifySession(nextSession)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
      setTokenAdmin(null)
    }
  }, [verifySession])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      throw new Error(
        "Supabase belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY terlebih dahulu.",
      )
    }
    setAuthError(null)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) {
      throw new Error(error.message)
    }
    if (data.session) {
      await verifySession(data.session)
    }
  }, [verifySession])

  const signOut = useCallback(async () => {
    verifySeqRef.current += 1
    setTokenAdmin(null)
    setSession(null)
    setAdmin(null)
    setAuthError(null)
    if (supabase) {
      await supabase.auth.signOut().catch(() => undefined)
      setStatus("unauthenticated")
    } else {
      setStatus("unconfigured")
    }
  }, [])

  const retryVerify = useCallback(async () => {
    await verifySession(session)
  }, [session, verifySession])

  const clearAuthError = useCallback(() => {
    setAuthError(null)
  }, [])

  const value = useMemo<AdminSessionContextValue>(
    () => ({
      isConfigured: isSupabaseConfigured,
      status,
      session,
      admin,
      authError,
      signIn,
      signOut,
      retryVerify,
      clearAuthError,
    }),
    [status, session, admin, authError, signIn, signOut, retryVerify, clearAuthError],
  )

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>
}

export function useAdminSession(): AdminSessionContextValue {
  const ctx = useContext(AdminSessionContext)
  if (!ctx) {
    throw new Error("useAdminSession harus digunakan di dalam AdminSessionProvider")
  }
  return ctx
}
