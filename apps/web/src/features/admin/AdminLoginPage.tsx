import { useState, type FormEvent } from "react"
import { AlertCircle, ArrowLeft, Loader2, Lock, LogOut, ShieldAlert, Sprout } from "lucide-react"
import { Link, Navigate, useLocation } from "react-router-dom"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAdminSession } from "@/hooks/useAdminSession"

interface LocationState {
  from?: string
  reason?: string | null
}

export function AdminLoginPage() {
  const location = useLocation()
  const state = (location.state as LocationState | null) ?? null
  const { isConfigured, status, session, authError, signIn, signOut, clearAuthError } =
    useAdminSession()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  if (status === "authenticated") {
    const target = state?.from && state.from.startsWith("/admin") ? state.from : "/admin"
    return <Navigate replace to={target} />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email.trim() || !password) {
      setFormError("Masukkan email dan kata sandi admin.")
      return
    }
    setFormError(null)
    clearAuthError()
    setSubmitting(true)
    try {
      await signIn(email, password)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal masuk. Periksa email dan kata sandi.")
    } finally {
      setSubmitting(false)
    }
  }

  const displayError = formError ?? authError ?? state?.reason ?? null
  const isChecking = status === "loading" || status === "checking"

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/20 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Link className="inline-flex items-center gap-2 text-lg font-semibold" to="/">
            <Sprout aria-hidden="true" className="size-6 text-primary" />
            <span>RiceGuard</span>
          </Link>
          <p className="text-sm text-muted-foreground">
            Panel Admin Pengelolaan Dataset &amp; Konten
          </p>
        </div>

        {!isConfigured ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Supabase Belum Dikonfigurasi</AlertTitle>
            <AlertDescription className="space-y-1.5">
              <p>
                Login admin membutuhkan <code>VITE_SUPABASE_URL</code> dan{" "}
                <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> pada berkas{" "}
                <code>apps/web/.env</code>.
              </p>
              <p className="text-xs">
                Halaman publik tetap dapat diakses secara normal tanpa konfigurasi ini.
              </p>
            </AlertDescription>
          </Alert>
        ) : null}

        {status === "forbidden" ? (
          <Alert variant="destructive">
            <ShieldAlert aria-hidden="true" />
            <AlertTitle>Akses Admin Ditolak (403)</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                {authError ||
                  "Akun ini berhasil login di Supabase, tetapi tidak terdaftar pada tabel admin RiceGuard."}
              </p>
              {session?.user?.email ? (
                <p className="text-xs">
                  Email aktif: <span className="font-medium">{session.user.email}</span>
                </p>
              ) : null}
              <Button onClick={() => void signOut()} size="sm" variant="destructive">
                <LogOut aria-hidden="true" className="size-4" />
                Keluar dan Ganti Akun
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lock aria-hidden="true" className="size-4 text-primary" />
              Masuk Panel Admin
            </CardTitle>
            <CardDescription>
              Gunakan akun admin terdaftar. Pendaftaran mandiri dinonaktifkan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
              {displayError && status !== "forbidden" ? (
                <Alert variant="destructive">
                  <AlertCircle aria-hidden="true" />
                  <AlertTitle>Autentikasi Gagal</AlertTitle>
                  <AlertDescription>{displayError}</AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  autoComplete="email"
                  disabled={!isConfigured || submitting || isChecking}
                  id="admin-email"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@riceguard.id"
                  required
                  type="email"
                  value={email}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-password">Kata Sandi</Label>
                <Input
                  autoComplete="current-password"
                  disabled={!isConfigured || submitting || isChecking}
                  id="admin-password"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  type="password"
                  value={password}
                />
              </div>

              <Button
                className="w-full"
                disabled={!isConfigured || submitting || isChecking}
                type="submit"
              >
                {submitting || isChecking ? (
                  <>
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                    Memverifikasi...
                  </>
                ) : (
                  "Masuk"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button asChild size="sm" variant="ghost">
            <Link to="/">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Kembali ke Halaman Publik
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
