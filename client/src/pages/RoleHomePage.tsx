import { BookOpen, Shield, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import Markdown from "react-markdown"
import { useAuth } from "../context/useAuth"
import type { UserRole } from "../types/auth"

const HOME_COPY: Record<UserRole, { title: string; icon: LucideIcon; markdown: string }> = {
  SUPER_ADMIN: {
    title: "Administration",
    icon: Shield,
    markdown: `## School administration

This workspace is for the super admin account.

- Create standards and subjects
- Add teachers and assign each one a standard
- Review how class material is organized`,
  },
  TEACHER: {
    title: "Classroom",
    icon: BookOpen,
    markdown: `## Your classroom

This workspace is for teachers.

- Upload documents for your assigned standard
- Keep each subject’s source material current
- Students can only ask about those published files`,
  },
  STUDENT: {
    title: "Study",
    icon: Users,
    markdown: `## Ask your class materials

This workspace is for students.

- Questions stay inside your assigned standard
- Answers come from documents your teacher uploaded
- Start a chat once your class materials are ready`,
  },
}

export function RoleHomePage({ role }: { role: UserRole }) {
  const { user } = useAuth()
  const copy = HOME_COPY[role]
  const Icon = copy.icon

  return (
    <section className="rounded-2xl border border-line bg-card p-6 shadow-sm sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-paper text-navy">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm text-muted">Signed in as {user?.email}</p>
          <h1 className="font-display text-2xl tracking-tight">{copy.title}</h1>
        </div>
      </div>
      <div className="markdown">
        <Markdown>{copy.markdown}</Markdown>
      </div>
    </section>
  )
}
