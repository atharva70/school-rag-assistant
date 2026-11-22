import { GraduationCap } from "lucide-react"
import { type FormEvent, useState } from "react"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../context/useAuth"
import { ApiError } from "../lib/api"
import { roleHomePath } from "../lib/roles"

type LoginLocationState = {
  from?: string
}

export function LoginPage() {
  const { isAuthenticated, user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (isAuthenticated && user) {
    return <Navigate to={roleHomePath(user.role)} replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setError("Enter a valid email address.")
      return
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }

    setSubmitting(true)
    try {
      const signedIn = await login(trimmedEmail, password)
      const from = (location.state as LoginLocationState | null)?.from
      const home = roleHomePath(signedIn.role)
      const destination = from && from.startsWith(home) ? from : home
      navigate(destination, { replace: true })
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message)
      } else {
        setError("Could not reach the server. Check that the API is running.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
      <section className="relative hidden overflow-hidden bg-navy text-paper lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_42%)]" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-white/10">
            <GraduationCap className="size-6" aria-hidden="true" />
          </span>
          <p className="font-display text-2xl">School RAG</p>
        </div>
        <div className="relative max-w-md">
          <h1 className="font-display text-5xl leading-tight font-medium tracking-tight">
            Answers from your own class materials.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-paper/80">
            Teachers publish documents by standard. Students ask questions that stay inside that
            curriculum.
          </p>
        </div>
        <p className="relative text-sm text-paper/60">Sign in with the account your school issued.</p>
      </section>

      <main className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-navy text-paper">
              <GraduationCap className="size-5" aria-hidden="true" />
            </span>
            <p className="font-display text-2xl">School RAG</p>
          </div>

          <h2 className="font-display text-3xl tracking-tight">Sign in</h2>
          <p className="mt-2 text-muted">Use your school email and password.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/20"
                placeholder="you@school.edu"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                className="w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/20"
                placeholder="At least 6 characters"
              />
            </label>

            {error ? (
              <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-navy px-4 py-2.5 font-semibold text-paper transition hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
