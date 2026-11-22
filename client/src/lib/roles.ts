import type { UserRole } from "../types/auth"

export function roleHomePath(role: UserRole): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/admin"
    case "TEACHER":
      return "/teacher"
    case "STUDENT":
      return "/student"
  }
}

export function roleLabel(role: UserRole): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "Super Admin"
    case "TEACHER":
      return "Teacher"
    case "STUDENT":
      return "Student"
  }
}

export function roleBadgeClass(role: UserRole): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "bg-amber-100 text-amber-900"
    case "TEACHER":
      return "bg-sky-100 text-sky-900"
    case "STUDENT":
      return "bg-emerald-100 text-emerald-900"
  }
}
