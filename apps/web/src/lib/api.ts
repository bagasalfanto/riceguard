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
  const url = new URL(`${BASE_URL}${path}`)
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined || v === null || v === "") continue
    url.searchParams.set(k, String(v))
  }
  return url.toString()
}

export async function apiGet<T>(path: string, query?: Query): Promise<T> {
  const res = await fetch(bangunUrl(path, query), {
    headers: {
      Accept: "application/json",
      ...(tokenAdmin ? { Authorization: `Bearer ${tokenAdmin}` } : {}),
    },
  })

  if (!res.ok) {
    let body: ApiErrorBody | null = null
    try {
      body = (await res.json()) as ApiErrorBody
    } catch {
      body = null
    }
    throw new ApiError(res.status, body, `Permintaan gagal (${res.status})`)
  }

  return (await res.json()) as T
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(bangunUrl(path), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(tokenAdmin ? { Authorization: `Bearer ${tokenAdmin}` } : {}),
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    let errBody: ApiErrorBody | null = null
    try {
      errBody = (await res.json()) as ApiErrorBody
    } catch {
      errBody = null
    }
    throw new ApiError(res.status, errBody, `Permintaan gagal (${res.status})`)
  }

  return (await res.json()) as T
}
