import { isUserRole, type AuthUser } from "../types/auth"

const TOKEN_KEY = "auth_token"
const USER_KEY = "auth_user"

export type StoredSession = {
  token: string | null
  user: AuthUser | null
}

function normalizeStandardId(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value
  if (value && typeof value === "object" && "_id" in value) {
    const id = (value as { _id: unknown })._id
    return typeof id === "string" && id.length > 0 ? id : null
  }
  return null
}

export function parseAuthUser(value: unknown): AuthUser | null {
  if (!value || typeof value !== "object") return null

  const record = value as Record<string, unknown>
  const id = typeof record.id === "string" ? record.id : ""
  const email = typeof record.email === "string" ? record.email : ""

  if (!id || !email || !isUserRole(record.role)) return null

  return {
    id,
    email,
    role: record.role,
    standardId: normalizeStandardId(record.standardId),
  }
}

export function isJwtExpired(token: string | null): boolean {
  if (!token) return true
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return true
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    )
    const decoded = JSON.parse(jsonPayload)
    if (typeof decoded.exp !== "number") return false
    const now = Math.floor(Date.now() / 1000)
    return decoded.exp <= now
  } catch {
    return true
  }
}

export function readStoredSession(): StoredSession {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const rawUser = localStorage.getItem(USER_KEY)

    // Decode and verify JWT expiration claim on load
    if (token && isJwtExpired(token)) {
      clearStoredSession()
      return { token: null, user: null }
    }

    const user = rawUser ? parseAuthUser(JSON.parse(rawUser)) : null

    if (!token || !user) {
      clearStoredSession()
      return { token: null, user: null }
    }
    return { token, user }
  } catch {
    clearStoredSession()
    return { token: null, user: null }
  }
}

export function readStoredToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token || isJwtExpired(token)) {
    clearStoredSession()
    return null
  }
  return token
}

export function writeStoredSession(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearStoredSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}
