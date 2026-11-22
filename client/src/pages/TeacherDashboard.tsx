import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  FileUp,
  FolderOpen,
  GraduationCap,
  Layers,
  Lock,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from "lucide-react"
import { type DragEvent, type FormEvent, useCallback, useEffect, useRef, useState } from "react"
import { useAuth } from "../context/useAuth"
import { ApiError, apiFetch } from "../lib/api"
import type { DocumentItem, Standard, StudentUser } from "../types/dashboard"

const STUDENTS_STORAGE_KEY_PREFIX = "school_rag_teacher_students_"

export function TeacherDashboard() {
  const { user } = useAuth()
  const teacherStandardId = user?.standardId

  // Tab State
  const [activeTab, setActiveTab] = useState<"materials" | "students">("materials")

  // Standard details for the teacher
  const [standard, setStandard] = useState<Standard | null>(null)
  const [standardLoading, setStandardLoading] = useState(true)
  const [standardError, setStandardError] = useState<string | null>(null)

  // -------------------------------------------------------------
  // Tab 1: Study Materials State
  // -------------------------------------------------------------
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [docsLoading, setDocsLoading] = useState(true)
  const [docsRefreshing, setDocsRefreshing] = useState(false)
  const [docsError, setDocsError] = useState<string | null>(null)
  const [docFilterSubject, setDocFilterSubject] = useState<string>("ALL")

  // Upload Form State
  const [uploadSubject, setUploadSubject] = useState<string>("")
  const [customTitle, setCustomTitle] = useState<string>("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Document Deletion State
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // -------------------------------------------------------------
  // Tab 2: Students State
  // -------------------------------------------------------------
  const [students, setStudents] = useState<StudentUser[]>([])
  const [studentsLoading, setStudentsLoading] = useState(true)
  const [studentsRefreshing, setStudentsRefreshing] = useState(false)
  const [studentsError, setStudentsError] = useState<string | null>(null)
  const [studentSearch, setStudentSearch] = useState("")

  // Create Student Form State
  const [studentEmail, setStudentEmail] = useState("")
  const [studentPassword, setStudentPassword] = useState("")
  const [creatingStudent, setCreatingStudent] = useState(false)
  const [studentFormSuccess, setStudentFormSuccess] = useState<string | null>(null)
  const [studentFormError, setStudentFormError] = useState<string | null>(null)

  // -------------------------------------------------------------
  // 1. Fetch Teacher's Standard Details
  // -------------------------------------------------------------
  const fetchStandardInfo = useCallback(async () => {
    if (!teacherStandardId) {
      setStandardLoading(false)
      return
    }

    setStandardLoading(true)
    setStandardError(null)

    try {
      // Try to get specific standard or find from all
      let targetStd: Standard | null = null
      try {
        targetStd = await apiFetch<Standard>(`/standards/${teacherStandardId}`)
      } catch {
        const all = await apiFetch<Standard[]>("/standards")
        targetStd = all.find((s) => s._id === teacherStandardId) || null
      }

      setStandard(targetStd)
      if (targetStd && targetStd.subjects && targetStd.subjects.length > 0) {
        setUploadSubject(targetStd.subjects[0].name)
      }
    } catch (caught) {
      if (caught instanceof ApiError) {
        setStandardError(caught.message)
      } else {
        setStandardError("Failed to fetch assigned standard details.")
      }
    } finally {
      setStandardLoading(false)
    }
  }, [teacherStandardId])

  useEffect(() => {
    fetchStandardInfo()
  }, [fetchStandardInfo])

  // -------------------------------------------------------------
  // 2. Fetch Documents for Standard
  // -------------------------------------------------------------
  const fetchDocuments = useCallback(
    async (silent = false) => {
      if (!teacherStandardId) {
        setDocsLoading(false)
        return
      }

      if (!silent) {
        setDocsRefreshing(true)
      }
      setDocsError(null)

      try {
        const query = `?standardId=${encodeURIComponent(teacherStandardId)}`
        const res = await apiFetch<DocumentItem[]>(`/documents${query}`)
        setDocuments(res || [])
      } catch (caught) {
        if (!silent) {
          if (caught instanceof ApiError) {
            setDocsError(caught.message)
          } else {
            setDocsError("Could not retrieve documents.")
          }
        }
      } finally {
        setDocsLoading(false)
        setDocsRefreshing(false)
      }
    },
    [teacherStandardId],
  )

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // Poll for document status updates if any document is in PROCESSING status
  useEffect(() => {
    const hasProcessing = documents.some((d) => d.status === "PROCESSING")
    if (!hasProcessing) return

    const interval = setInterval(() => {
      fetchDocuments(true)
    }, 4000)

    return () => clearInterval(interval)
  }, [documents, fetchDocuments])

  // -------------------------------------------------------------
  // 3. Fetch Students for Standard
  // -------------------------------------------------------------
  const fetchStudents = useCallback(
    async (isRefresh = false) => {
      if (!teacherStandardId) {
        setStudentsLoading(false)
        return
      }

      if (isRefresh) setStudentsRefreshing(true)
      else setStudentsLoading(true)
      setStudentsError(null)

      const storageKey = `${STUDENTS_STORAGE_KEY_PREFIX}${teacherStandardId}`

      try {
        const data = await apiFetch<StudentUser[]>("/teacher/students")
        setStudents(data)
        localStorage.setItem(storageKey, JSON.stringify(data))
      } catch {
        // Fallback to local storage if GET /teacher/students fails or 404
        const cached = localStorage.getItem(storageKey)
        if (cached) {
          try {
            setStudents(JSON.parse(cached))
          } catch {
            // ignore JSON error
          }
        }
      } finally {
        setStudentsLoading(false)
        setStudentsRefreshing(false)
      }
    },
    [teacherStandardId],
  )

  useEffect(() => {
    fetchStudents()
  }, [fetchStudents])

  // -------------------------------------------------------------
  // File Dropzone Event Handlers
  // -------------------------------------------------------------
  const validateAndSetFile = (file: File) => {
    setUploadError(null)
    setUploadSuccess(null)

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("Only PDF files are supported. Please select a .pdf document.")
      return
    }

    // 25MB file size limit check
    if (file.size > 25 * 1024 * 1024) {
      setUploadError("File size exceeds 25MB limit. Please choose a smaller PDF.")
      return
    }

    setSelectedFile(file)
    if (!customTitle.trim()) {
      // Default title to filename without extension
      const defaultName = file.name.replace(/\.[^/.]+$/, "")
      setCustomTitle(defaultName)
    }
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0])
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0])
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setCustomTitle("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // -------------------------------------------------------------
  // Document Upload Submit (POST /api/documents/upload using FormData)
  // -------------------------------------------------------------
  const handleUploadDocument = async (e: FormEvent) => {
    e.preventDefault()
    setUploadError(null)
    setUploadSuccess(null)

    if (!teacherStandardId) {
      setUploadError("Cannot upload: you do not have an assigned standard.")
      return
    }
    if (!uploadSubject) {
      setUploadError("Please select a subject from your standard.")
      return
    }
    if (!selectedFile) {
      setUploadError("Please select or drop a PDF file to upload.")
      return
    }

    const formData = new FormData()
    formData.append("file", selectedFile)
    formData.append("standardId", teacherStandardId)
    formData.append("subjectName", uploadSubject)
    if (customTitle.trim()) {
      formData.append("title", customTitle.trim())
    }

    setUploading(true)
    try {
      const result = await apiFetch<DocumentItem>("/documents/upload", {
        method: "POST",
        body: formData,
      })

      setUploadSuccess(`"${selectedFile.name}" uploaded successfully! RAG indexing in progress.`)
      handleRemoveFile()

      // Add to documents list or refetch
      if (result) {
        setDocuments((prev) => [result, ...prev.filter((d) => (d._id || d.id) !== (result._id || result.id))])
      }
      fetchDocuments(true)
    } catch (caught) {
      if (caught instanceof ApiError) {
        setUploadError(caught.message)
      } else {
        setUploadError("Failed to upload document. Please try again.")
      }
    } finally {
      setUploading(false)
    }
  }

  // -------------------------------------------------------------
  // Document Delete Action (DELETE /api/documents/:id)
  // -------------------------------------------------------------
  const handleDeleteDocument = async (id: string) => {
    setDeletingId(id)
    try {
      await apiFetch(`/documents/${id}`, {
        method: "DELETE",
      })

      setDocuments((prev) => prev.filter((d) => (d._id || d.id) !== id))
      setDeleteConfirmId(null)
    } catch (caught) {
      if (caught instanceof ApiError) {
        alert(`Failed to delete document: ${caught.message}`)
      } else {
        alert("Failed to delete document.")
      }
    } finally {
      setDeletingId(null)
    }
  }

  // -------------------------------------------------------------
  // Create Student Submit (POST /api/teacher/students)
  // -------------------------------------------------------------
  const handleCreateStudent = async (e: FormEvent) => {
    e.preventDefault()
    setStudentFormError(null)
    setStudentFormSuccess(null)

    if (!teacherStandardId) {
      setStudentFormError("Cannot create students: you do not have an assigned standard.")
      return
    }

    const trimmedEmail = studentEmail.trim().toLowerCase()
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setStudentFormError("Please enter a valid student email address.")
      return
    }
    if (
      studentPassword.length < 8 ||
      !/[A-Z]/.test(studentPassword) ||
      !/[0-9]/.test(studentPassword)
    ) {
      setStudentFormError(
        "Password must be at least 8 characters long and contain at least one uppercase letter and one number.",
      )
      return
    }

    setCreatingStudent(true)
    try {
      const createdStudent = await apiFetch<StudentUser>("/teacher/students", {
        method: "POST",
        body: {
          email: trimmedEmail,
          password: studentPassword,
          standardId: teacherStandardId,
        },
      })

      const updated = [createdStudent, ...students]
      setStudents(updated)

      const storageKey = `${STUDENTS_STORAGE_KEY_PREFIX}${teacherStandardId}`
      localStorage.setItem(storageKey, JSON.stringify(updated))

      setStudentEmail("")
      setStudentPassword("")
      setStudentFormSuccess(`Student account "${trimmedEmail}" enrolled successfully!`)
    } catch (caught) {
      if (caught instanceof ApiError) {
        setStudentFormError(caught.message)
      } else {
        setStudentFormError("Could not create student account.")
      }
    } finally {
      setCreatingStudent(false)
    }
  }

  // Filtered documents
  const filteredDocuments = documents.filter((doc) => {
    if (docFilterSubject === "ALL") return true
    return doc.subjectName.toLowerCase() === docFilterSubject.toLowerCase()
  })

  // Filtered students
  const filteredStudents = students.filter((s) =>
    s.email.toLowerCase().includes(studentSearch.toLowerCase()),
  )

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Teacher Header Card */}
      <div className="rounded-2xl border border-line bg-card p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-xl bg-navy text-paper shadow-xs">
              <BookOpen className="size-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
                  Teacher Dashboard
                </h1>
                <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-900">
                  Teacher Portal
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                Signed in as <span className="font-medium text-ink">{user?.email}</span>
              </p>
            </div>
          </div>

          {/* Assigned Standard Badge */}
          <div className="flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-2.5">
            <Layers className="size-4 text-navy shrink-0" />
            <div>
              <p className="text-[10px] font-semibold tracking-wider text-muted uppercase">
                Assigned Standard
              </p>
              <p className="font-display text-sm font-bold text-ink">
                {standardLoading
                  ? "Loading standard…"
                  : standard
                    ? standard.name
                    : teacherStandardId
                      ? `Standard ID: ${teacherStandardId}`
                      : "Unassigned"}
              </p>
            </div>
          </div>
        </div>

        {/* Warning if teacher has no standard assigned */}
        {!teacherStandardId && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertCircle className="size-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">Standard Assignment Required</p>
              <p className="mt-0.5 text-xs">
                Your teacher account is not assigned to a curriculum standard yet. Uploads and student
                enrollment require an assigned standard. Please ask your school Super Admin to bind a
                standard to your email.
              </p>
            </div>
          </div>
        )}

        {standardError && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-800">
            <AlertCircle className="size-4 shrink-0 text-red-600" />
            <span>{standardError}</span>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-line">
        <nav className="flex space-x-4" aria-label="Tabs">
          <button
            type="button"
            onClick={() => setActiveTab("materials")}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === "materials"
                ? "border-navy text-navy"
                : "border-transparent text-muted hover:border-line hover:text-ink"
            }`}
          >
            <FileText className="size-4" />
            <span>Study Materials</span>
            <span
              className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                activeTab === "materials" ? "bg-navy text-paper" : "bg-paper text-muted"
              }`}
            >
              {documents.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("students")}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === "students"
                ? "border-navy text-navy"
                : "border-transparent text-muted hover:border-line hover:text-ink"
            }`}
          >
            <Users className="size-4" />
            <span>Students</span>
            <span
              className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                activeTab === "students" ? "bg-navy text-paper" : "bg-paper text-muted"
              }`}
            >
              {students.length}
            </span>
          </button>
        </nav>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: STUDY MATERIALS                                       */}
      {/* ============================================================ */}
      {activeTab === "materials" && (
        <div className="space-y-8">
          {/* Upload Study Material Card */}
          <div className="rounded-2xl border border-line bg-card p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-paper text-navy">
                  <FileUp className="size-4" />
                </span>
                <div>
                  <h2 className="font-display text-lg font-semibold text-ink">
                    Upload Study Material
                  </h2>
                  <p className="text-xs text-muted">
                    Upload PDF textbooks, lecture notes, or syllabi for your assigned standard.
                  </p>
                </div>
              </div>

              <span className="text-[11px] font-mono text-muted">POST /api/documents/upload</span>
            </div>

            <form onSubmit={handleUploadDocument} className="mt-6 space-y-5" noValidate>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Subject Selector */}
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-ink uppercase tracking-wide">
                    Select Subject *
                  </span>
                  <select
                    value={uploadSubject}
                    onChange={(e) => setUploadSubject(e.target.value)}
                    required
                    disabled={!teacherStandardId || !standard || standard.subjects?.length === 0}
                    className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/20 disabled:opacity-50"
                  >
                    {!standard || standard.subjects?.length === 0 ? (
                      <option value="">No subjects configured in your standard</option>
                    ) : (
                      standard.subjects.map((subj) => (
                        <option key={subj._id || subj.code} value={subj.name}>
                          {subj.name} ({subj.code})
                        </option>
                      ))
                    )}
                  </select>
                </label>

                {/* Optional Title */}
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-ink uppercase tracking-wide">
                    Document Title (Optional)
                  </span>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="e.g. Chapter 1 - Real Numbers"
                    className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/20"
                  />
                </label>
              </div>

              {/* PDF File Dropzone */}
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-ink uppercase tracking-wide">
                  PDF Document File *
                </span>

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition ${
                    isDragging
                      ? "border-navy bg-navy/5 scale-[1.005]"
                      : selectedFile
                        ? "border-emerald-400 bg-emerald-50/30"
                        : "border-line bg-paper hover:border-navy hover:bg-paper/70"
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileInputChange}
                    accept=".pdf,application/pdf"
                    className="hidden"
                  />

                  {selectedFile ? (
                    <div className="flex flex-col items-center">
                      <span className="grid size-12 place-items-center rounded-xl bg-emerald-100 text-emerald-800">
                        <FileText className="size-6" />
                      </span>
                      <p className="mt-3 font-medium text-sm text-ink">{selectedFile.name}</p>
                      <p className="mt-0.5 text-xs text-muted">{formatFileSize(selectedFile.size)}</p>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveFile()
                        }}
                        className="mt-3 inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                      >
                        <X className="size-3.5" />
                        <span>Remove file</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <span className="grid size-12 place-items-center rounded-xl bg-paper text-navy shadow-2xs">
                        <Upload className="size-6" />
                      </span>
                      <p className="mt-3 font-semibold text-sm text-ink">
                        Drag and drop your PDF here, or{" "}
                        <span className="text-navy underline">browse files</span>
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        Only PDF documents are supported (up to 25MB).
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {uploadError && (
                <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-800">
                  <AlertCircle className="size-4 shrink-0 text-red-600" />
                  <span>{uploadError}</span>
                </div>
              )}

              {uploadSuccess && (
                <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  <span>{uploadSuccess}</span>
                </div>
              )}

              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={uploading || !selectedFile || !uploadSubject || !teacherStandardId}
                  className="inline-flex items-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-sm font-semibold text-paper shadow-xs transition hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FileUp className="size-4" />
                  <span>{uploading ? "Uploading & Ingesting…" : "Upload PDF Material"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Uploaded Documents Table */}
          <div className="rounded-2xl border border-line bg-card p-6 shadow-xs">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-ink">Uploaded Documents</h3>
                <p className="text-xs text-muted">
                  Study materials indexed for question answering within this standard.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Subject Filter Dropdown */}
                {standard?.subjects && standard.subjects.length > 0 && (
                  <select
                    value={docFilterSubject}
                    onChange={(e) => setDocFilterSubject(e.target.value)}
                    className="rounded-xl border border-line bg-paper px-3 py-1.5 text-xs text-ink outline-none transition focus:border-navy"
                  >
                    <option value="ALL">All Subjects ({documents.length})</option>
                    {standard.subjects.map((s) => (
                      <option key={s._id || s.code} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="button"
                  onClick={() => fetchDocuments(false)}
                  disabled={docsRefreshing || docsLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink transition hover:border-navy hover:text-navy disabled:opacity-50"
                >
                  <RefreshCw className={`size-3.5 ${docsRefreshing ? "animate-spin text-navy" : ""}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {docsError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-800">
                <AlertCircle className="size-4 shrink-0 text-red-600" />
                <span>{docsError}</span>
              </div>
            )}

            <div className="mt-5 overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-paper text-xs font-semibold text-muted uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Document Title</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">RAG Status</th>
                    <th className="px-4 py-3">Uploaded</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {docsLoading ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-sm text-muted">
                        <RefreshCw className="mx-auto mb-2 size-5 animate-spin text-navy" />
                        Loading classroom documents…
                      </td>
                    </tr>
                  ) : filteredDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-sm text-muted">
                        <FolderOpen className="mx-auto mb-2 size-8 text-muted/60" />
                        {documents.length === 0
                          ? "No study materials uploaded yet. Use the dropzone above to upload your first PDF."
                          : "No documents found for the selected subject."}
                      </td>
                    </tr>
                  ) : (
                    filteredDocuments.map((doc) => {
                      const id = doc._id || doc.id || ""
                      const isDeleting = deletingId === id
                      const isConfirming = deleteConfirmId === id

                      return (
                        <tr key={id} className="transition hover:bg-paper/50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-red-100 text-red-700">
                                <FileText className="size-4" />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-ink">{doc.title}</p>
                                <p className="truncate text-xs text-muted">{doc.fileName}</p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-lg bg-paper border border-line px-2.5 py-0.5 text-xs font-semibold text-navy">
                              {doc.subjectName}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            {doc.status === "READY" ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                                <CheckCircle2 className="size-3.5" />
                                <span>READY</span>
                              </span>
                            ) : doc.status === "PROCESSING" ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 animate-pulse">
                                <Clock className="size-3.5 animate-spin" />
                                <span>PROCESSING</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
                                <AlertCircle className="size-3.5" />
                                <span>FAILED</span>
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-xs text-muted">
                            {doc.createdAt
                              ? new Date(doc.createdAt).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Recently"}
                          </td>

                          <td className="px-4 py-3 text-right">
                            {isConfirming ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDocument(id)}
                                  disabled={isDeleting}
                                  className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white shadow-xs hover:bg-red-700 disabled:opacity-50"
                                >
                                  {isDeleting ? "Deleting…" : "Confirm"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="rounded-lg border border-line bg-paper px-2 py-1 text-xs text-ink hover:border-ink"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(id)}
                                disabled={isDeleting}
                                className="inline-flex items-center gap-1 rounded-lg border border-line bg-paper px-2.5 py-1 text-xs font-medium text-red-700 transition hover:border-red-400 hover:bg-red-50"
                                title="Delete document and its indexed vector chunks"
                              >
                                <Trash2 className="size-3.5" />
                                <span>Delete</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: STUDENTS                                              */}
      {/* ============================================================ */}
      {activeTab === "students" && (
        <div className="space-y-8">
          {/* Create Student Form Card */}
          <div className="rounded-2xl border border-line bg-card p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-paper text-navy">
                  <UserPlus className="size-4" />
                </span>
                <div>
                  <h2 className="font-display text-lg font-semibold text-ink">
                    Enroll Student Account
                  </h2>
                  <p className="text-xs text-muted">
                    Create credentials for a student in your assigned standard.
                  </p>
                </div>
              </div>

              <span className="text-[11px] font-mono text-muted">POST /api/teacher/students</span>
            </div>

            <form onSubmit={handleCreateStudent} className="mt-6 space-y-4" noValidate>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* Email */}
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-ink uppercase tracking-wide">
                    Student Email *
                  </span>
                  <input
                    type="email"
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    placeholder="student@school.edu"
                    autoComplete="off"
                    required
                    className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/20"
                  />
                </label>

                {/* Password */}
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-ink uppercase tracking-wide">
                    Initial Password *
                  </span>
                  <input
                    type="password"
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                    placeholder="Min. 8 chars, 1 uppercase, 1 number"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/20"
                  />
                </label>

                {/* Standard (Auto-Selected & Locked to Teacher's Standard) */}
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink uppercase tracking-wide">
                    <span>Standard</span>
                    <Lock className="size-3 text-muted" />
                    <span className="text-[10px] text-muted normal-case font-normal">
                      (auto-assigned)
                    </span>
                  </span>
                  <div className="flex h-[42px] items-center rounded-xl border border-line bg-paper/60 px-3.5 text-sm font-medium text-ink cursor-not-allowed">
                    {standard ? standard.name : teacherStandardId || "No standard assigned"}
                  </div>
                </label>
              </div>

              {studentFormError && (
                <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-800">
                  <AlertCircle className="size-4 shrink-0 text-red-600" />
                  <span>{studentFormError}</span>
                </div>
              )}

              {studentFormSuccess && (
                <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  <span>{studentFormSuccess}</span>
                </div>
              )}

              <div className="flex items-center justify-end pt-2">
                <button
                  type="submit"
                  disabled={creatingStudent || !teacherStandardId}
                  className="inline-flex items-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-sm font-semibold text-paper shadow-xs transition hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <UserPlus className="size-4" />
                  <span>{creatingStudent ? "Enrolling Student…" : "Enroll Student"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Enrolled Students Table */}
          <div className="rounded-2xl border border-line bg-card p-6 shadow-xs">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-ink">
                  Enrolled Students in {standard ? standard.name : "Assigned Standard"}
                </h3>
                <p className="text-xs text-muted">
                  Students authorized to query RAG study materials within this standard.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-full sm:w-60">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    placeholder="Search student email…"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full rounded-xl border border-line bg-paper py-2 pr-3 pl-9 text-xs text-ink outline-none transition focus:border-navy focus:ring-1 focus:ring-navy"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => fetchStudents(true)}
                  disabled={studentsRefreshing || studentsLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-paper px-3 py-2 text-xs font-medium text-ink transition hover:border-navy hover:text-navy disabled:opacity-50"
                >
                  <RefreshCw className={`size-3.5 ${studentsRefreshing ? "animate-spin text-navy" : ""}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {studentsError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-800">
                <AlertCircle className="size-4 shrink-0 text-red-600" />
                <span>{studentsError}</span>
              </div>
            )}

            <div className="mt-5 overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-paper text-xs font-semibold text-muted uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Standard</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Enrolled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {studentsLoading ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-sm text-muted">
                        <RefreshCw className="mx-auto mb-2 size-5 animate-spin text-navy" />
                        Loading enrolled students…
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-sm text-muted">
                        <Users className="mx-auto mb-2 size-8 text-muted/60" />
                        {students.length === 0
                          ? "No students enrolled in this standard yet. Use the form above to enroll students."
                          : "No students match your search filter."}
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((st, idx) => (
                      <tr key={st.id || `student-${idx}`} className="transition hover:bg-paper/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="grid size-8 place-items-center rounded-lg bg-emerald-100 text-emerald-900 font-semibold text-xs">
                              <GraduationCap className="size-4" />
                            </span>
                            <span className="font-medium text-ink">{st.email}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full bg-paper border border-line px-2.5 py-0.5 text-xs font-semibold text-navy">
                            {standard ? standard.name : teacherStandardId || "Assigned Standard"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
                            Student
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted">
                          {st.createdAt
                            ? new Date(st.createdAt).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })
                            : "Recently Enrolled"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default TeacherDashboard
