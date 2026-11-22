import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Layers,
  PlusCircle,
  RefreshCw,
  Search,
  Shield,
  UserPlus,
  Users,
} from "lucide-react"
import { type FormEvent, useCallback, useEffect, useState } from "react"
import { useAuth } from "../context/useAuth"
import { ApiError, apiFetch } from "../lib/api"
import type { Standard, Subject, TeacherUser } from "../types/dashboard"

const TEACHERS_STORAGE_KEY = "school_rag_admin_teachers_cache"

export function AdminDashboard() {
  const { user } = useAuth()

  // Main data state
  const [standards, setStandards] = useState<Standard[]>([])
  const [teachers, setTeachers] = useState<TeacherUser[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [generalError, setGeneralError] = useState<string | null>(null)

  // Form 1: Create Standard
  const [standardName, setStandardName] = useState("")
  const [creatingStandard, setCreatingStandard] = useState(false)
  const [standardSuccess, setStandardSuccess] = useState<string | null>(null)
  const [standardError, setStandardError] = useState<string | null>(null)

  // Form 2: Add Subject to Standard
  const [subjectStandardId, setSubjectStandardId] = useState("")
  const [subjectName, setSubjectName] = useState("")
  const [subjectCode, setSubjectCode] = useState("")
  const [addingSubject, setAddingSubject] = useState(false)
  const [subjectSuccess, setSubjectSuccess] = useState<string | null>(null)
  const [subjectError, setSubjectError] = useState<string | null>(null)

  // Form 3: Create Teacher Account
  const [teacherEmail, setTeacherEmail] = useState("")
  const [teacherPassword, setTeacherPassword] = useState("")
  const [teacherStandardId, setTeacherStandardId] = useState("")
  const [creatingTeacher, setCreatingTeacher] = useState(false)
  const [teacherSuccess, setTeacherSuccess] = useState<string | null>(null)
  const [teacherError, setTeacherError] = useState<string | null>(null)

  // Section 3 Search filters
  const [standardSearch, setStandardSearch] = useState("")
  const [teacherSearch, setTeacherSearch] = useState("")

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setGeneralError(null)

    try {
      // Fetch standards: try /admin/standards then /standards
      let standardsData: Standard[] = []
      try {
        standardsData = await apiFetch<Standard[]>("/admin/standards")
      } catch {
        standardsData = await apiFetch<Standard[]>("/standards")
      }
      setStandards(standardsData)

      // Fetch teachers: try /admin/teachers
      try {
        const teachersData = await apiFetch<TeacherUser[]>("/admin/teachers")
        setTeachers(teachersData)
        localStorage.setItem(TEACHERS_STORAGE_KEY, JSON.stringify(teachersData))
      } catch {
        // Fallback to locally stored teachers
        const cached = localStorage.getItem(TEACHERS_STORAGE_KEY)
        if (cached) {
          try {
            setTeachers(JSON.parse(cached))
          } catch {
            // ignore JSON parse error
          }
        }
      }
    } catch (caught) {
      if (caught instanceof ApiError) {
        setGeneralError(caught.message)
      } else {
        setGeneralError("Failed to communicate with the server.")
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Set default standard selection if empty and standards load
  useEffect(() => {
    if (standards.length > 0) {
      if (!subjectStandardId) {
        setSubjectStandardId(standards[0]._id)
      }
      if (!teacherStandardId) {
        setTeacherStandardId(standards[0]._id)
      }
    }
  }, [standards, subjectStandardId, teacherStandardId])

  // Submit Handler: Create Standard (POST /api/admin/standards)
  const handleCreateStandard = async (e: FormEvent) => {
    e.preventDefault()
    setStandardError(null)
    setStandardSuccess(null)

    const trimmed = standardName.trim()
    if (!trimmed) {
      setStandardError("Please enter a standard name.")
      return
    }

    setCreatingStandard(true)
    try {
      const created = await apiFetch<Standard>("/admin/standards", {
        method: "POST",
        body: { name: trimmed },
      })

      setStandards((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setStandardName("")
      setStandardSuccess(`Standard "${created.name}" created successfully!`)
      if (!subjectStandardId) setSubjectStandardId(created._id)
      if (!teacherStandardId) setTeacherStandardId(created._id)
    } catch (caught) {
      if (caught instanceof ApiError) {
        setStandardError(caught.message)
      } else {
        setStandardError("Could not create standard.")
      }
    } finally {
      setCreatingStandard(false)
    }
  }

  // Submit Handler: Add Subject to Standard (POST /api/admin/standards/:id/subjects)
  const handleAddSubject = async (e: FormEvent) => {
    e.preventDefault()
    setSubjectError(null)
    setSubjectSuccess(null)

    if (!subjectStandardId) {
      setSubjectError("Please select a standard.")
      return
    }
    const trimmedName = subjectName.trim()
    const trimmedCode = subjectCode.trim().toUpperCase()

    if (!trimmedName) {
      setSubjectError("Please enter a subject name.")
      return
    }
    if (!trimmedCode) {
      setSubjectError("Please enter a subject code (e.g. MATH101).")
      return
    }

    setAddingSubject(true)
    try {
      const updatedStandard = await apiFetch<Standard>(
        `/admin/standards/${subjectStandardId}/subjects`,
        {
          method: "POST",
          body: { name: trimmedName, code: trimmedCode },
        },
      )

      setStandards((prev) =>
        prev.map((s) => (s._id === updatedStandard._id ? updatedStandard : s)),
      )
      setSubjectName("")
      setSubjectCode("")
      setSubjectSuccess(`Subject "${trimmedName}" (${trimmedCode}) added successfully!`)
    } catch (caught) {
      if (caught instanceof ApiError) {
        setSubjectError(caught.message)
      } else {
        setSubjectError("Could not add subject to standard.")
      }
    } finally {
      setAddingSubject(false)
    }
  }

  // Submit Handler: Create Teacher Account (POST /api/admin/teachers)
  const handleCreateTeacher = async (e: FormEvent) => {
    e.preventDefault()
    setTeacherError(null)
    setTeacherSuccess(null)

    const trimmedEmail = teacherEmail.trim().toLowerCase()
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setTeacherError("Please enter a valid teacher email address.")
      return
    }
    if (
      teacherPassword.length < 8 ||
      !/[A-Z]/.test(teacherPassword) ||
      !/[0-9]/.test(teacherPassword)
    ) {
      setTeacherError(
        "Password must be at least 8 characters long and contain at least one uppercase letter and one number.",
      )
      return
    }
    if (!teacherStandardId) {
      setTeacherError("Please select a standard for this teacher.")
      return
    }

    setCreatingTeacher(true)
    try {
      const createdTeacher = await apiFetch<TeacherUser>("/admin/teachers", {
        method: "POST",
        body: {
          email: trimmedEmail,
          password: teacherPassword,
          standardId: teacherStandardId,
        },
      })

      const updated = [createdTeacher, ...teachers]
      setTeachers(updated)
      localStorage.setItem(TEACHERS_STORAGE_KEY, JSON.stringify(updated))

      setTeacherEmail("")
      setTeacherPassword("")
      setTeacherSuccess(`Teacher account "${trimmedEmail}" created successfully!`)
    } catch (caught) {
      if (caught instanceof ApiError) {
        setTeacherError(caught.message)
      } else {
        setTeacherError("Could not create teacher account.")
      }
    } finally {
      setCreatingTeacher(false)
    }
  }

  const resolveStandardName = (stdId: string | { _id: string; name: string } | null | undefined) => {
    if (!stdId) return "Unassigned"
    if (typeof stdId === "object" && stdId.name) return stdId.name
    const id = typeof stdId === "object" ? stdId._id : stdId
    const found = standards.find((s) => s._id === id)
    return found ? found.name : id
  }

  const totalSubjectsCount = standards.reduce(
    (acc, std) => acc + (std.subjects ? std.subjects.length : 0),
    0,
  )

  const filteredStandards = standards.filter((s) =>
    s.name.toLowerCase().includes(standardSearch.toLowerCase()) ||
    s.subjects?.some(
      (subj) =>
        subj.name.toLowerCase().includes(standardSearch.toLowerCase()) ||
        subj.code.toLowerCase().includes(standardSearch.toLowerCase()),
    ),
  )

  const filteredTeachers = teachers.filter((t) => {
    const term = teacherSearch.toLowerCase()
    const stdName = resolveStandardName(t.standardId).toLowerCase()
    return t.email.toLowerCase().includes(term) || stdName.includes(term)
  })

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-xl bg-navy text-paper shadow-sm">
              <Shield className="size-5" />
            </span>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
              Admin Dashboard
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted">
            Signed in as <span className="font-medium text-ink">{user?.email}</span> • Configure school curriculum standards, manage subjects, and onboard teacher accounts.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadData(true)}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-line bg-card px-3.5 py-2 text-sm font-medium text-ink shadow-xs transition hover:border-navy hover:text-navy disabled:opacity-50"
          title="Refresh curriculum and teacher records"
        >
          <RefreshCw className={`size-4 ${refreshing ? "animate-spin text-navy" : ""}`} />
          <span>{refreshing ? "Refreshing…" : "Refresh Data"}</span>
        </button>
      </div>

      {/* Global Error Banner */}
      {generalError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="size-5 shrink-0 text-red-600" />
          <div className="flex-1">
            <p className="font-semibold">Failed to fetch data</p>
            <p className="mt-0.5">{generalError}</p>
          </div>
          <button
            type="button"
            onClick={() => loadData(true)}
            className="text-xs font-semibold text-red-700 underline hover:text-red-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* Stats Counter Bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-2xl border border-line bg-card p-5 shadow-xs">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-paper text-navy">
            <Layers className="size-6" />
          </span>
          <div>
            <p className="text-xs font-medium tracking-wide text-muted uppercase">Standards</p>
            <p className="font-display text-2xl font-bold text-ink">{standards.length}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-line bg-card p-5 shadow-xs">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-paper text-navy">
            <BookOpen className="size-6" />
          </span>
          <div>
            <p className="text-xs font-medium tracking-wide text-muted uppercase">Subjects</p>
            <p className="font-display text-2xl font-bold text-ink">{totalSubjectsCount}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-line bg-card p-5 shadow-xs">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-paper text-navy">
            <Users className="size-6" />
          </span>
          <div>
            <p className="text-xs font-medium tracking-wide text-muted uppercase">Teachers</p>
            <p className="font-display text-2xl font-bold text-ink">{teachers.length}</p>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION 1: Create Standard & Add Subject                      */}
      {/* ============================================================ */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-line pb-2">
          <span className="rounded-md bg-paper px-2 py-0.5 text-xs font-bold text-navy">
            SECTION 1
          </span>
          <h2 className="font-display text-xl font-semibold text-ink">
            Curriculum & Subjects Management
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Card A: Create New Standard */}
          <div className="flex flex-col justify-between rounded-2xl border border-line bg-card p-6 shadow-xs">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-paper text-navy">
                  <PlusCircle className="size-4" />
                </span>
                <h3 className="font-display text-lg font-semibold text-ink">Create New Standard</h3>
              </div>
              <p className="mt-1 text-xs text-muted">
                Add an academic grade or curriculum class (e.g. "Standard 10", "Grade 11 - Science").
              </p>

              <form onSubmit={handleCreateStandard} className="mt-5 space-y-4" noValidate>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-ink uppercase tracking-wide">
                    Standard Name *
                  </span>
                  <input
                    type="text"
                    value={standardName}
                    onChange={(e) => setStandardName(e.target.value)}
                    placeholder="e.g. Standard 10"
                    required
                    className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/20"
                  />
                </label>

                {standardError && (
                  <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-800">
                    <AlertCircle className="size-4 shrink-0 text-red-600" />
                    <span>{standardError}</span>
                  </div>
                )}

                {standardSuccess && (
                  <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                    <span>{standardSuccess}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={creatingStandard}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-paper shadow-xs transition hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <PlusCircle className="size-4" />
                  <span>{creatingStandard ? "Creating Standard…" : "Create Standard"}</span>
                </button>
              </form>
            </div>
            <p className="mt-4 text-[11px] text-muted">Endpoint: POST /api/admin/standards</p>
          </div>

          {/* Card B: Add Subject to Selected Standard */}
          <div className="flex flex-col justify-between rounded-2xl border border-line bg-card p-6 shadow-xs">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-paper text-navy">
                  <BookOpen className="size-4" />
                </span>
                <h3 className="font-display text-lg font-semibold text-ink">Add Subject to Standard</h3>
              </div>
              <p className="mt-1 text-xs text-muted">
                Assign an academic subject code and title to a selected standard.
              </p>

              <form onSubmit={handleAddSubject} className="mt-5 space-y-4" noValidate>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-ink uppercase tracking-wide">
                    Target Standard *
                  </span>
                  <select
                    value={subjectStandardId}
                    onChange={(e) => setSubjectStandardId(e.target.value)}
                    required
                    disabled={standards.length === 0}
                    className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/20 disabled:opacity-50"
                  >
                    {standards.length === 0 ? (
                      <option value="">No standards available yet</option>
                    ) : (
                      standards.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name} ({s.subjects ? s.subjects.length : 0} subjects)
                        </option>
                      ))
                    )}
                  </select>
                </label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-ink uppercase tracking-wide">
                      Subject Name *
                    </span>
                    <input
                      type="text"
                      value={subjectName}
                      onChange={(e) => setSubjectName(e.target.value)}
                      placeholder="e.g. Mathematics"
                      required
                      className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/20"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-ink uppercase tracking-wide">
                      Subject Code *
                    </span>
                    <input
                      type="text"
                      value={subjectCode}
                      onChange={(e) => setSubjectCode(e.target.value.toUpperCase())}
                      placeholder="e.g. MATH10"
                      required
                      className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm font-mono text-ink uppercase outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/20"
                    />
                  </label>
                </div>

                {subjectError && (
                  <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-800">
                    <AlertCircle className="size-4 shrink-0 text-red-600" />
                    <span>{subjectError}</span>
                  </div>
                )}

                {subjectSuccess && (
                  <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                    <span>{subjectSuccess}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={addingSubject || standards.length === 0}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-paper shadow-xs transition hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <PlusCircle className="size-4" />
                  <span>{addingSubject ? "Adding Subject…" : "Add Subject"}</span>
                </button>
              </form>
            </div>
            <p className="mt-4 text-[11px] text-muted">
              Endpoint: POST /api/admin/standards/:id/subjects
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 2: Create Teacher Account                             */}
      {/* ============================================================ */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-line pb-2">
          <span className="rounded-md bg-paper px-2 py-0.5 text-xs font-bold text-navy">
            SECTION 2
          </span>
          <h2 className="font-display text-xl font-semibold text-ink">
            Teacher Accounts Onboarding
          </h2>
        </div>

        <div className="rounded-2xl border border-line bg-card p-6 shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-paper text-navy">
              <UserPlus className="size-4" />
            </span>
            <div>
              <h3 className="font-display text-lg font-semibold text-ink">
                Create Teacher Account
              </h3>
              <p className="mt-0.5 text-xs text-muted">
                Provision a teacher login and bind their access to an assigned standard.
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateTeacher} className="mt-6 space-y-4" noValidate>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-ink uppercase tracking-wide">
                  Teacher Email *
                </span>
                <input
                  type="email"
                  value={teacherEmail}
                  onChange={(e) => setTeacherEmail(e.target.value)}
                  placeholder="teacher@school.edu"
                  autoComplete="off"
                  required
                  className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/20"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-ink uppercase tracking-wide">
                  Initial Password *
                </span>
                <input
                  type="password"
                  value={teacherPassword}
                  onChange={(e) => setTeacherPassword(e.target.value)}
                  placeholder="Min. 8 chars, 1 uppercase, 1 number"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/20"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-ink uppercase tracking-wide">
                  Assigned Standard *
                </span>
                <select
                  value={teacherStandardId}
                  onChange={(e) => setTeacherStandardId(e.target.value)}
                  required
                  disabled={standards.length === 0}
                  className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/20 disabled:opacity-50"
                >
                  {standards.length === 0 ? (
                    <option value="">Create a standard first</option>
                  ) : (
                    standards.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
            </div>

            {teacherError && (
              <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-800">
                <AlertCircle className="size-4 shrink-0 text-red-600" />
                <span>{teacherError}</span>
              </div>
            )}

            {teacherSuccess && (
              <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                <span>{teacherSuccess}</span>
              </div>
            )}

            <div className="flex flex-col items-start justify-between gap-3 pt-2 sm:flex-row sm:items-center">
              <p className="text-[11px] text-muted">Endpoint: POST /api/admin/teachers</p>

              <button
                type="submit"
                disabled={creatingTeacher || standards.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-sm font-semibold text-paper shadow-xs transition hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <UserPlus className="size-4" />
                <span>{creatingTeacher ? "Provisioning Teacher…" : "Create Teacher"}</span>
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 3: Standards, Subjects & Registered Teachers Tables  */}
      {/* ============================================================ */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 border-b border-line pb-2">
          <span className="rounded-md bg-paper px-2 py-0.5 text-xs font-bold text-navy">
            SECTION 3
          </span>
          <h2 className="font-display text-xl font-semibold text-ink">
            Curriculum Standards & Registered Teachers Directory
          </h2>
        </div>

        {/* Existing Standards & Subjects Table / Cards */}
        <div className="rounded-2xl border border-line bg-card p-6 shadow-xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold text-ink">
                Standards & Curriculum Subjects
              </h3>
              <p className="text-xs text-muted">
                All standards registered in the school system along with their configured subjects.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Filter standards or subjects…"
                value={standardSearch}
                onChange={(e) => setStandardSearch(e.target.value)}
                className="w-full rounded-xl border border-line bg-paper py-2 pr-3 pl-9 text-xs text-ink outline-none transition focus:border-navy focus:ring-1 focus:ring-navy"
              />
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-line">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted">
                <RefreshCw className="mx-auto mb-2 size-5 animate-spin text-navy" />
                Loading standards and subjects…
              </div>
            ) : filteredStandards.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted">
                {standards.length === 0
                  ? "No standards have been created yet. Use the form above to add your first standard."
                  : "No standards or subjects match your search."}
              </div>
            ) : (
              <div className="divide-y divide-line">
                {filteredStandards.map((std) => (
                  <div key={std._id} className="p-4 transition hover:bg-paper/50">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-navy/10 text-navy font-semibold text-sm">
                          {std.name.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <h4 className="font-display text-base font-medium text-ink">{std.name}</h4>
                          <p className="text-xs text-muted">
                            {std.subjects ? std.subjects.length : 0}{" "}
                            {std.subjects?.length === 1 ? "Subject" : "Subjects"} registered
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSubjectStandardId(std._id)
                          window.scrollTo({ top: 300, behavior: "smooth" })
                        }}
                        className="inline-flex self-start sm:self-center items-center gap-1.5 rounded-lg border border-line bg-paper px-2.5 py-1 text-xs font-semibold text-navy transition hover:border-navy"
                      >
                        <PlusCircle className="size-3.5" />
                        <span>Add Subject</span>
                      </button>
                    </div>

                    {/* Subjects Badges */}
                    <div className="mt-3 flex flex-wrap items-center gap-2 pl-0 sm:pl-12">
                      {std.subjects && std.subjects.length > 0 ? (
                        std.subjects.map((subj: Subject, idx: number) => (
                          <span
                            key={subj._id || `${subj.code}-${idx}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-2.5 py-1 text-xs text-ink shadow-2xs"
                          >
                            <span className="font-semibold">{subj.name}</span>
                            <span className="rounded bg-navy/10 px-1 py-0.5 font-mono text-[10px] text-navy font-bold">
                              {subj.code}
                            </span>
                          </span>
                        ))
                      ) : (
                        <span className="text-xs italic text-muted">
                          No subjects added yet to this standard.
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Registered Teachers Directory Table */}
        <div className="rounded-2xl border border-line bg-card p-6 shadow-xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold text-ink">Registered Teachers</h3>
              <p className="text-xs text-muted">
                Active teacher accounts and their assigned educational standard.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Filter teachers by email or standard…"
                value={teacherSearch}
                onChange={(e) => setTeacherSearch(e.target.value)}
                className="w-full rounded-xl border border-line bg-paper py-2 pr-3 pl-9 text-xs text-ink outline-none transition focus:border-navy focus:ring-1 focus:ring-navy"
              />
            </div>
          </div>

          <div className="mt-5 overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-paper text-xs font-semibold text-muted uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Teacher</th>
                  <th className="px-4 py-3">Assigned Standard</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-sm text-muted">
                      <RefreshCw className="mx-auto mb-2 size-5 animate-spin text-navy" />
                      Loading teachers…
                    </td>
                  </tr>
                ) : filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-sm text-muted">
                      {teachers.length === 0
                        ? "No teachers registered yet. Use Section 2 to create teacher accounts."
                        : "No teachers match your search filter."}
                    </td>
                  </tr>
                ) : (
                  filteredTeachers.map((t, idx) => (
                    <tr
                      key={t.id || `teacher-${idx}`}
                      className="transition hover:bg-paper/50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="grid size-8 place-items-center rounded-lg bg-sky-100 text-sky-900 font-semibold text-xs">
                            <GraduationCap className="size-4" />
                          </span>
                          <span className="font-medium text-ink">{t.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-paper border border-line px-2.5 py-0.5 text-xs font-semibold text-navy">
                          {resolveStandardName(t.standardId)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900">
                          Teacher
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {t.createdAt
                          ? new Date(t.createdAt).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "Recently Added"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
export default AdminDashboard
