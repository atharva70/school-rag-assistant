import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { AUTH_LOGOUT_EVENT, ApiError, apiFetch } from "../lib/api"
import {
  clearStoredSession,
  isJwtExpired,
  parseAuthUser,
  readStoredSession,
  writeStoredSession,
} from "../lib/authStorage"
import type { UserRole } from "../types/auth"
import { AuthContext, type AuthContextValue } from "./auth-context"

type LoginResult = {
  token: string
  user: {
    id: string
    email: string
    role: UserRole
    standardId: unknown
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(readStoredSession)

  // On app load: decode JWT exp claim; if expired, clear localStorage and redirect to /login
  useEffect(() => {
    const stored = readStoredSession()
    if (!stored.token || !stored.user || isJwtExpired(stored.token)) {
      clearStoredSession()
      setSession({ token: null, user: null })
      if (window.location.pathname !== "/login") {
        window.location.replace("/login")
      }
    }
  }, [])

  // Listen for 401 Unauthorized or auth logout events to clear storage and redirect
  useEffect(() => {
    const handleLogout = () => {
      clearStoredSession()
      setSession({ token: null, user: null })
      if (window.location.pathname !== "/login") {
        window.location.replace("/login")
      }
    }
    window.addEventListener(AUTH_LOGOUT_EVENT, handleLogout)
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, handleLogout)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<LoginResult>("/auth/login", {
      method: "POST",
      auth: false,
      body: { email, password },
    })

    const user = parseAuthUser({
      id: data.user?.id,
      email: data.user?.email,
      role: data.user?.role,
      standardId: data.user?.standardId,
    })

    if (!data.token || !user) {
      throw new ApiError("Login response was missing a user or token", 500)
    }

    writeStoredSession(data.token, user)
    setSession({ token: data.token, user })
    return user
  }, [])

  const logout = useCallback(() => {
    clearStoredSession()
    setSession({ token: null, user: null })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session.user,
      token: session.token,
      isAuthenticated: Boolean(session.user && session.token),
      login,
      logout,
    }),
    [session, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
