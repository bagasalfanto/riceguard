/**
 * Satu-satunya jalan FE ke data. Semua angka berasal dari API, tidak ada rumus di sini.
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1"

export type ApiErrorBody = {
  error: { code: string; message: string; details: unknown }
}

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details: unknown

  constructor(status: number, body: ApiErrorBody | null, fallback: string) {
    super(body?.error?.message ?? fallback)
    this.name = "ApiError"
    this.status = status
    this.code = body?.error?.code ?? "UNKNOWN"
    this.details = body?.error?.details ?? null
  }
}

let tokenAdmin: string | null = null

export function setTokenAdmin(token: string | null) {
  tokenAdmin = token
}

export function getTokenAdmin() {
  return tokenAdmin
}

export type Query = Record<string, string | number | boolean | undefined | null>

function bangunUrl(path: string, query?: Query) {
  const origin = typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:8000"
  const url = new URL(`${BASE_URL}${path}`, origin)
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined || v === null || v === "") continue
    url.searchParams.set(k, String(v))
  }
  return url.toString()
}

export function apiUrl(path: string, query?: Query): string {
  return bangunUrl(path, query)
}

async function lemparJikaGagal(res: Response): Promise<void> {
  if (res.ok) return
  let errBody: ApiErrorBody | null = null
  try {
    errBody = (await res.json()) as ApiErrorBody
  } catch {
    errBody = null
  }
  throw new ApiError(res.status, errBody, `Permintaan gagal (${res.status})`)
}

function authHeader(): Record<string, string> {
  return tokenAdmin ? { Authorization: `Bearer ${tokenAdmin}` } : {}
}

async function requestJson<T>(
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const hasBody = body !== undefined
  const res = await fetch(bangunUrl(path), {
    method,
    headers: {
      Accept: "application/json",
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...authHeader(),
    },
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
  })

  await lemparJikaGagal(res)
  return (await res.json()) as T
}

function bacaNamaFile(disposition: string | null): string | null {
  if (!disposition) return null
  const utf8Match = /filename\*\s*=\s*UTF-8''([^;\n]+)/i.exec(disposition)
  if (utf8Match?.[1]) {
    const clean = utf8Match[1].trim().replace(/^["']|["']$/g, "")
    try {
      return decodeURIComponent(clean)
    } catch {
      return clean
    }
  }
  const match = /filename\s*=\s*(?:"([^"]+)"|'([^']+)'|([^;\n]+))/i.exec(disposition)
  const raw = match?.[1] ?? match?.[2] ?? match?.[3]
  return raw ? raw.trim() : null
}

export async function apiGet<T>(path: string, query?: Query): Promise<T> {
  const res = await fetch(bangunUrl(path, query), {
    headers: {
      Accept: "application/json",
      ...authHeader(),
    },
  })

  await lemparJikaGagal(res)
  return (await res.json()) as T
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>("POST", path, body)
}

export async function apiPostForm<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(bangunUrl(path), {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...authHeader(),
    },
    body: formData,
  })

  await lemparJikaGagal(res)
  return (await res.json()) as T
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>("PATCH", path, body)
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>("PUT", path, body)
}

export async function apiDelete<T>(path: string): Promise<T> {
  return requestJson<T>("DELETE", path)
}

export async function apiDownload(
  path: string,
  query?: Query,
): Promise<{ blob: Blob; filename: string | null }> {
  const res = await fetch(bangunUrl(path, query), {
    headers: {
      ...authHeader(),
    },
  })

  await lemparJikaGagal(res)
  const blob = await res.blob()
  const filename = bacaNamaFile(res.headers.get("content-disposition"))
  return { blob, filename }
}

export function unduhBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
