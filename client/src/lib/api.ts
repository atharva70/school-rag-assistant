import { clearStoredSession, isJwtExpired, readStoredToken } from "./authStorage"

export const AUTH_LOGOUT_EVENT = "auth:logout"

type ApiSuccess<T> = {
  success: true
  message?: string
  data: T
}

type ApiFailure = {
  success: false
  message?: string
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown
  auth?: boolean
}

export function apiBaseUrl(): string {
  const url = import.meta.env.VITE_API_URL
  if (!url) {
    throw new Error("VITE_API_URL is not set")
  }
  return url.replace(/\/$/, "")
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body, auth = true, headers, ...rest } = options
  const token = auth ? readStoredToken() : null

  // Before authenticated API requests: verify JWT has not expired
  if (auth && (!token || isJwtExpired(token))) {
    clearStoredSession()
    window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT))
    throw new ApiError("Authentication session expired. Please sign in again.", 401)
  }

  const requestHeaders = new Headers(headers)
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData

  if (body !== undefined && !isFormData && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json")
  }

  if (token) {
    requestHeaders.set("Authorization", `Bearer ${token}`)
  }

  const response = await fetch(`${apiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`, {
    ...rest,
    headers: requestHeaders,
    body: body !== undefined ? (isFormData ? (body as FormData) : JSON.stringify(body)) : undefined,
  })

  const payload = (await response.json().catch(() => null)) as ApiSuccess<T> | ApiFailure | null

  if (response.status === 401) {
    clearStoredSession()
    window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT))
  }

  if (!response.ok || !payload || payload.success !== true) {
    const message =
      payload && "message" in payload && payload.message
        ? payload.message
        : `Request failed (${response.status})`
    throw new ApiError(message, response.status)
  }

  return payload.data
}
