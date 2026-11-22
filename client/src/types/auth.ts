export const USER_ROLES = ["SUPER_ADMIN", "TEACHER", "STUDENT"] as const

export type UserRole = (typeof USER_ROLES)[number]

export type AuthUser = {
  id: string
  email: string
  role: UserRole
  standardId: string | null
}

export function isUserRole(value: unknown): value is UserRole {
  return value === "SUPER_ADMIN" || value === "TEACHER" || value === "STUDENT"
}
