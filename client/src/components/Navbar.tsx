import { GraduationCap, LogOut } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../context/useAuth"
import { roleBadgeClass, roleLabel } from "../lib/roles"

export function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const handleLogout = () => {
    logout()
    navigate("/login", { replace: true })
  }

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2.5 transition hover:opacity-90">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-navy text-paper">
            <GraduationCap className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-base leading-none text-ink">School RAG</p>
            <p className="mt-1 truncate text-xs text-muted">Classroom assistant</p>
          </div>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <p className="hidden max-w-56 truncate text-sm text-ink sm:block">{user.email}</p>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide ${roleBadgeClass(user.role)}`}
          >
            {roleLabel(user.role)}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm font-medium text-ink transition hover:border-navy hover:text-navy cursor-pointer"
          >
            <LogOut className="size-4" aria-hidden="true" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  )
}
