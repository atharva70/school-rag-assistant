import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  FolderOpen,
  GraduationCap,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Send,
  Sparkles,
  StopCircle,
  User,
} from "lucide-react"
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react"
import Markdown from "react-markdown"
import { useAuth } from "../context/useAuth"
import { apiBaseUrl, ApiError, apiFetch, AUTH_LOGOUT_EVENT } from "../lib/api"
import { clearStoredSession, readStoredToken } from "../lib/authStorage"
import type { ChatMessage, Citation, DocumentItem, Standard, Subject } from "../types/dashboard"

export function StudentChat() {
  const { user } = useAuth()
  const studentStandardId = user?.standardId

  // Standard and Subjects State
  const [standard, setStandard] = useState<Standard | null>(null)
  const [standardLoading, setStandardLoading] = useState(true)
  const [standardError, setStandardError] = useState<string | null>(null)
  const [activeSubject, setActiveSubject] = useState<string>("")

  // Reference Documents for Active Subject
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [docsError, setDocsError] = useState<string | null>(null)

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputQuestion, setInputQuestion] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [chatError, setChatError] = useState<string | null>(null)

  // Citations Expansion State: maps messageId -> expanded citation index (or null)
  const [expandedCitations, setExpandedCitations] = useState<Record<string, number | null>>({})

  // Mobile sidebar visibility toggle
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Abort controller ref for stopping generation if needed
  const abortControllerRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // -----------------------------------------------------------------
  // 1. Fetch Student's Standard & Subjects (GET /api/standards)
  // -----------------------------------------------------------------
  const fetchStandard = useCallback(async () => {
    if (!studentStandardId) {
      setStandardLoading(false)
      return
    }

    setStandardLoading(true)
    setStandardError(null)

    try {
      let targetStandard: Standard | null = null

      try {
        targetStandard = await apiFetch<Standard>(`/standards/${studentStandardId}`)
      } catch {
        // Fallback to fetch all and match
        const allStandards = await apiFetch<Standard[]>("/standards")
        targetStandard = allStandards.find((s) => s._id === studentStandardId) || null
      }

      setStandard(targetStandard)

      if (targetStandard && targetStandard.subjects && targetStandard.subjects.length > 0) {
        // Select first subject by default if not set
        setActiveSubject((prev) => prev || targetStandard.subjects[0].name)
      }
    } catch (caught) {
      if (caught instanceof ApiError) {
        setStandardError(caught.message)
      } else {
        setStandardError("Failed to fetch curriculum standards.")
      }
    } finally {
      setStandardLoading(false)
    }
  }, [studentStandardId])

  useEffect(() => {
    fetchStandard()
  }, [fetchStandard])

  // -----------------------------------------------------------------
  // 2. Fetch Reference Documents for Active Subject (GET /api/documents)
  // -----------------------------------------------------------------
  const fetchSubjectDocuments = useCallback(async () => {
    if (!studentStandardId || !activeSubject) {
      setDocuments([])
      return
    }

    setDocsLoading(true)
    setDocsError(null)

    try {
      const query = `?standardId=${encodeURIComponent(studentStandardId)}&subjectName=${encodeURIComponent(
        activeSubject,
      )}`
      const docs = await apiFetch<DocumentItem[]>(`/documents${query}`)
      setDocuments(docs || [])
    } catch (caught) {
      if (caught instanceof ApiError) {
        setDocsError(caught.message)
      } else {
        setDocsError("Could not load reference study materials.")
      }
    } finally {
      setDocsLoading(false)
    }
  }, [studentStandardId, activeSubject])

  useEffect(() => {
    fetchSubjectDocuments()
  }, [fetchSubjectDocuments])

  // Reset chat session and messages when switching subjects
  const handleSelectSubject = (subjectName: string) => {
    if (isStreaming) {
      abortControllerRef.current?.abort()
      setIsStreaming(false)
    }
    setActiveSubject(subjectName)
    setMessages([])
    setSessionId(null)
    setChatError(null)
    setExpandedCitations({})
  }

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isStreaming])

  // Toggle citation snippet box
  const toggleCitation = (messageId: string, citationIdx: number) => {
    setExpandedCitations((prev) => {
      const current = prev[messageId]
      return {
        ...prev,
        [messageId]: current === citationIdx ? null : citationIdx,
      }
    })
  }

  // -----------------------------------------------------------------
  // 3. Send Question to POST /api/chat & Read SSE Stream
  // -----------------------------------------------------------------
  const handleSendMessage = async (e?: FormEvent, promptText?: string) => {
    if (e) e.preventDefault()

    const questionToSend = (promptText || inputQuestion).trim()
    if (!questionToSend || isStreaming) return

    // Client-side guardrail: max 600 characters
    if (questionToSend.length > 600) {
      setChatError("Question cannot exceed 600 characters.")
      return
    }

    if (!activeSubject) {
      setChatError("Please select a subject from the sidebar first.")
      return
    }
    if (!studentStandardId) {
      setChatError("You do not have an assigned standard. Please contact your teacher.")
      return
    }

    setChatError(null)
    setInputQuestion("")

    const userMessageId = `user-${Date.now()}`
    const assistantMessageId = `assistant-${Date.now()}`

    const userMsg: ChatMessage = {
      id: userMessageId,
      role: "user",
      content: questionToSend,
      timestamp: new Date().toISOString(),
    }

    const assistantMsgPlaceholder: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      citations: [],
      isStreaming: true,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMsg, assistantMsgPlaceholder])
    setIsStreaming(true)

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const token = readStoredToken()
      const url = `${apiBaseUrl()}/chat`

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          subjectName: activeSubject,
          question: questionToSend,
          sessionId: sessionId || undefined,
        }),
        signal: controller.signal,
      })

      if (response.status === 401 && token) {
        clearStoredSession()
        window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT))
        throw new Error("Session expired. Please sign in again.")
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const msg = errorData?.message || `Chat request failed (${response.status})`
        throw new Error(msg)
      }

      if (!response.body) {
        throw new Error("Response body is not readable for SSE streaming.")
      }

      // Read Server-Sent Events (SSE) stream via response.body.getReader()
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let streamBuffer = ""
      let accumulatedText = ""
      let receivedCitations: Citation[] = []

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        streamBuffer += decoder.decode(value, { stream: true })
        const events = streamBuffer.split("\n\n")
        streamBuffer = events.pop() || "" // Keep trailing incomplete event in buffer

        for (const eventBlock of events) {
          const lines = eventBlock.split("\n")
          for (const rawLine of lines) {
            const line = rawLine.trim()
            if (!line.startsWith("data:")) continue

            const dataStr = line.replace(/^data:\s*/, "")

            if (dataStr === "[DONE]") {
              // End of stream signal
              continue
            }

            try {
              const parsed = JSON.parse(dataStr)

              if (parsed.type === "token") {
                accumulatedText += parsed.content
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: accumulatedText, isStreaming: true }
                      : msg,
                  ),
                )
              } else if (parsed.type === "citations") {
                if (Array.isArray(parsed.citations)) {
                  receivedCitations = parsed.citations
                }
                if (parsed.sessionId) {
                  setSessionId(parsed.sessionId)
                }
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, citations: receivedCitations }
                      : msg,
                  ),
                )
              } else if (parsed.type === "done") {
                if (parsed.sessionId) {
                  setSessionId(parsed.sessionId)
                }
              } else if (parsed.type === "error") {
                setChatError(parsed.message || "An error occurred during generation.")
              }
            } catch {
              // Ignore non-json lines
            }
          }
        }
      }

      // Mark streaming complete
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: accumulatedText,
                citations: receivedCitations,
                isStreaming: false,
              }
            : msg,
        ),
      )
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, isStreaming: false }
              : msg,
          ),
        )
      } else {
        const errorMsg = err instanceof Error ? err.message : "Failed to receive response"
        setChatError(errorMsg)
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content:
                    msg.content ||
                    "Sorry, I couldn't generate an answer from the course materials. Please try again.",
                  isStreaming: false,
                }
              : msg,
          ),
        )
      }
    } finally {
      setIsStreaming(false)
      abortControllerRef.current = null
      textareaRef.current?.focus()
    }
  }

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const activeSubjectObj = standard?.subjects?.find((s) => s.name === activeSubject)

  return (
    <div className="flex h-[calc(100svh-7.5rem)] min-h-[620px] overflow-hidden rounded-2xl border border-line bg-card shadow-xs">
      {/* ============================================================== */}
      {/* LEFT SIDEBAR                                                   */}
      {/* ============================================================== */}
      <aside
        className={`${
          sidebarOpen ? "w-80 border-r border-line" : "w-0 overflow-hidden border-none"
        } flex shrink-0 flex-col bg-paper/50 transition-all duration-200 ease-in-out`}
      >
        <div className="flex h-full w-80 flex-col">
          {/* Sidebar Top: Standard Name Banner */}
          <div className="border-b border-line p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted uppercase tracking-wider">
                <GraduationCap className="size-4 text-navy" />
                <span>Your Standard</span>
              </span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="grid size-7 place-items-center rounded-lg text-muted hover:bg-card hover:text-ink sm:hidden"
                title="Hide sidebar"
              >
                <PanelLeftClose className="size-4" />
              </button>
            </div>

            <div className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-card p-3 shadow-2xs">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-navy text-paper font-semibold text-sm">
                <Layers className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-base font-bold text-ink">
                  {standardLoading
                    ? "Loading curriculum…"
                    : standard
                      ? standard.name
                      : studentStandardId
                        ? `Standard: ${studentStandardId}`
                        : "No Standard Assigned"}
                </p>
                <p className="truncate text-xs text-muted">
                  {standard?.subjects?.length || 0} Academic Subjects
                </p>
              </div>
            </div>

            {!studentStandardId && (
              <p className="mt-2 text-xs text-amber-800">
                Your student account has not been assigned to a standard. Please contact your teacher.
              </p>
            )}
          </div>

          {/* Sidebar Middle: Clickable Subject Buttons */}
          <div className="border-b border-line p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                Subjects
              </span>
              <button
                type="button"
                onClick={fetchStandard}
                disabled={standardLoading}
                className="text-[11px] font-medium text-navy hover:underline disabled:opacity-50"
                title="Reload subjects"
              >
                <RefreshCw className={`size-3 ${standardLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {standardLoading ? (
              <div className="py-4 text-center text-xs text-muted">
                <RefreshCw className="mx-auto mb-1.5 size-4 animate-spin text-navy" />
                Loading subjects…
              </div>
            ) : !standard || !standard.subjects || standard.subjects.length === 0 ? (
              <p className="py-2 text-xs italic text-muted">
                No subjects registered for your standard yet.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {standard.subjects.map((subj: Subject) => {
                  const isActive = activeSubject === subj.name

                  return (
                    <button
                      key={subj._id || subj.code}
                      type="button"
                      onClick={() => handleSelectSubject(subj.name)}
                      className={`group flex items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                        isActive
                          ? "bg-navy font-semibold text-paper shadow-2xs"
                          : "border border-transparent bg-transparent text-ink hover:border-line hover:bg-card"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <BookOpen
                          className={`size-4 shrink-0 ${
                            isActive ? "text-paper" : "text-muted group-hover:text-navy"
                          }`}
                        />
                        <span className="truncate">{subj.name}</span>
                      </div>
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                          isActive
                            ? "bg-white/20 text-paper"
                            : "bg-paper text-muted border border-line"
                        }`}
                      >
                        {subj.code}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Sidebar Bottom: Uploaded Reference PDFs */}
          <div className="flex flex-1 flex-col overflow-hidden p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                Study Materials
              </span>
              <span className="rounded-full bg-paper border border-line px-2 py-0.5 text-[10px] font-bold text-navy">
                {documents.length} {documents.length === 1 ? "PDF" : "PDFs"}
              </span>
            </div>

            <p className="mb-3 text-[11px] text-muted">
              Reference documents uploaded by your teacher for{" "}
              <span className="font-semibold text-ink">{activeSubject || "this subject"}</span>:
            </p>

            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              {docsLoading ? (
                <div className="py-6 text-center text-xs text-muted">
                  <RefreshCw className="mx-auto mb-1.5 size-4 animate-spin text-navy" />
                  Loading course materials…
                </div>
              ) : docsError ? (
                <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700">
                  {docsError}
                </div>
              ) : documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FolderOpen className="size-8 text-muted/50" />
                  <p className="mt-2 text-xs text-muted">
                    No reference PDFs uploaded for {activeSubject || "this subject"} yet.
                  </p>
                </div>
              ) : (
                documents.map((doc) => {
                  const docId = doc._id || doc.id || doc.title

                  return (
                    <div
                      key={docId}
                      className="group rounded-xl border border-line bg-card p-2.5 shadow-2xs transition hover:border-navy"
                    >
                      <div className="flex items-start gap-2">
                        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-red-100 text-red-700">
                          <FileText className="size-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-ink" title={doc.title}>
                            {doc.title}
                          </p>
                          <p
                            className="truncate text-[10px] text-muted"
                            title={doc.fileName}
                          >
                            {doc.fileName}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5">
                            {doc.status === "READY" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                                <CheckCircle2 className="size-2.5" />
                                <span>Indexed</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                                <span>Processing</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ============================================================== */}
      {/* MAIN CHAT PANEL                                                */}
      {/* ============================================================== */}
      <main className="flex flex-1 flex-col overflow-hidden bg-card">
        {/* Main Panel Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-line px-5">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="grid size-8 place-items-center rounded-lg border border-line bg-paper text-ink transition hover:border-navy hover:text-navy"
                title="Open subject & reference materials sidebar"
              >
                <PanelLeftOpen className="size-4" />
              </button>
            )}

            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-paper text-navy">
                <Sparkles className="size-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-base font-bold text-ink">
                    {activeSubject || "Select a Subject"}
                  </h2>
                  {activeSubjectObj?.code && (
                    <span className="rounded bg-navy/10 px-1.5 py-0.2 font-mono text-[10px] font-bold text-navy">
                      {activeSubjectObj.code}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted">
                  AI Study Assistant grounded in {standard?.name || "your standard"} documents
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setMessages([])
                  setSessionId(null)
                  setChatError(null)
                }}
                disabled={isStreaming}
                className="rounded-lg border border-line bg-paper px-2.5 py-1 text-xs font-medium text-ink transition hover:border-navy hover:text-navy disabled:opacity-50"
              >
                New Conversation
              </button>
            )}

            {sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="hidden grid-cols-1 size-8 place-items-center rounded-lg border border-line bg-paper text-muted transition hover:border-navy hover:text-navy sm:grid"
                title="Collapse sidebar for full screen view"
              >
                <PanelLeftClose className="size-4" />
              </button>
            )}
          </div>
        </header>

        {/* Global Chat Error Notification */}
        {chatError && (
          <div className="flex items-center justify-between bg-red-50 px-5 py-2 text-xs text-red-800 border-b border-red-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0 text-red-600" />
              <span>{chatError}</span>
            </div>
            <button
              type="button"
              onClick={() => setChatError(null)}
              className="text-xs font-semibold text-red-700 hover:text-red-900"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Messages Stream Container */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="relative mb-4">
                <span className="grid size-14 place-items-center rounded-2xl bg-paper text-navy shadow-sm">
                  <Sparkles className="size-7" />
                </span>
                <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-navy text-[10px] text-paper font-bold">
                  AI
                </span>
              </div>

              <h3 className="font-display text-2xl font-semibold tracking-tight text-ink">
                What are we studying in {activeSubject || "class"} today?
              </h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
                Ask questions about concepts, definitions, formulas, or homework problems. Answers
                are sourced strictly from your class materials with cited page numbers.
              </p>

              {/* Starter Question Chips */}
              {activeSubject && (
                <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-lg">
                  <button
                    type="button"
                    onClick={() =>
                      handleSendMessage(
                        undefined,
                        `Can you give me an overview of the key concepts covered in the ${activeSubject} materials?`,
                      )
                    }
                    className="rounded-full border border-line bg-paper px-3.5 py-1.5 text-xs text-ink transition hover:border-navy hover:text-navy hover:shadow-2xs"
                  >
                    📖 Overview of key concepts
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleSendMessage(
                        undefined,
                        `What are the important formulas or definitions I need to memorize in ${activeSubject}?`,
                      )
                    }
                    className="rounded-full border border-line bg-paper px-3.5 py-1.5 text-xs text-ink transition hover:border-navy hover:text-navy hover:shadow-2xs"
                  >
                    📝 Formulas & definitions
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleSendMessage(
                        undefined,
                        `Give me 3 practice quiz questions based on our ${activeSubject} textbook materials.`,
                      )
                    }
                    className="rounded-full border border-line bg-paper px-3.5 py-1.5 text-xs text-ink transition hover:border-navy hover:text-navy hover:shadow-2xs"
                  >
                    🎯 3 practice quiz questions
                  </button>
                </div>
              )}
            </div>
          ) : (
            messages.map((message) => {
              const isUser = message.role === "user"
              const expandedIdx = expandedCitations[message.id]

              return (
                <div
                  key={message.id}
                  className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {!isUser && (
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-navy text-paper shadow-2xs">
                      <Sparkles className="size-4" />
                    </span>
                  )}

                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-2xs ${
                      isUser
                        ? "bg-navy text-paper"
                        : "border border-line bg-paper/50 text-ink"
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {message.content}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {/* Live real-time Markdown output (OWASP LLM10 hardened: no rehype-raw, no dangerouslySetInnerHTML, safe link protocol validation) */}
                        <div className="markdown text-sm leading-relaxed">
                          <Markdown
                            components={{
                              a: ({ href, children, ...props }) => {
                                const trimmed = href?.trim() || ""
                                const isSafe =
                                  /^(https?:|mailto:|tel:|\/|#)/i.test(trimmed) &&
                                  !/^(javascript|vbscript|data):/i.test(trimmed)

                                if (!isSafe) {
                                  return (
                                    <span
                                      className="font-medium underline text-muted"
                                      title="Blocked unsafe link"
                                    >
                                      {children}
                                    </span>
                                  )
                                }
                                return (
                                  <a
                                    href={trimmed}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-semibold text-navy underline hover:opacity-80"
                                    {...props}
                                  >
                                    {children}
                                  </a>
                                )
                              },
                              script: () => null,
                              iframe: () => null,
                              embed: () => null,
                              object: () => null,
                            }}
                          >
                            {message.content}
                          </Markdown>
                          {message.isStreaming && (
                            <span className="inline-block size-2.5 rounded-full bg-navy animate-ping ml-1" />
                          )}
                        </div>

                        {/* Citation Pills & Expandable Snippets Section */}
                        {message.citations && message.citations.length > 0 && (
                          <div className="border-t border-line/60 pt-3">
                            <p className="mb-2 text-[11px] font-semibold text-muted uppercase tracking-wider">
                              Sources & Citations:
                            </p>

                            <div className="flex flex-wrap gap-1.5">
                              {message.citations.map((citation, cIdx) => {
                                const isExpanded = expandedIdx === cIdx

                                return (
                                  <button
                                    key={`${citation.documentTitle}-${citation.pageNumber}-${cIdx}`}
                                    type="button"
                                    onClick={() => toggleCitation(message.id, cIdx)}
                                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                                      isExpanded
                                        ? "bg-navy text-paper shadow-2xs"
                                        : "border border-line bg-card text-ink hover:border-navy hover:text-navy"
                                    }`}
                                    title={`Click to view source snippet from ${citation.documentTitle} (Page ${citation.pageNumber})`}
                                  >
                                    <FileText className="size-3" />
                                    <span>
                                      [{citation.documentTitle} - p. {citation.pageNumber}]
                                    </span>
                                    {isExpanded ? (
                                      <ChevronUp className="size-3" />
                                    ) : (
                                      <ChevronDown className="size-3" />
                                    )}
                                  </button>
                                )
                              })}
                            </div>

                            {/* Expandable Source Text Snippet Box */}
                            {typeof expandedIdx === "number" &&
                              message.citations[expandedIdx] && (
                                <div className="mt-3 rounded-xl border border-line bg-card p-3.5 shadow-2xs animate-in fade-in duration-150">
                                  <div className="mb-2 flex items-center justify-between border-b border-line/70 pb-2">
                                    <div className="flex items-center gap-2">
                                      <FileText className="size-3.5 text-navy shrink-0" />
                                      <span className="font-semibold text-xs text-ink truncate max-w-[200px] sm:max-w-xs">
                                        {message.citations[expandedIdx].documentTitle}
                                      </span>
                                      <span className="rounded bg-navy/10 px-1.5 py-0.5 text-[10px] font-bold text-navy">
                                        Page {message.citations[expandedIdx].pageNumber}
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => toggleCitation(message.id, expandedIdx)}
                                      className="text-[11px] font-medium text-muted hover:text-ink cursor-pointer"
                                    >
                                      Close
                                    </button>
                                  </div>

                                  <div className="rounded-lg border border-line/60 bg-paper/60 p-3">
                                    <p className="mb-1 text-[10px] font-bold text-muted uppercase tracking-wider">
                                      Exact Source Excerpt:
                                    </p>
                                    <p className="font-serif text-xs italic leading-relaxed text-ink/90 whitespace-pre-wrap">
                                      "{message.citations[expandedIdx].snippet}"
                                    </p>
                                  </div>
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-paper border border-line text-ink">
                      <User className="size-4" />
                    </span>
                  )}
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Chat Input Form */}
        <div className="border-t border-line bg-card p-4">
          <form onSubmit={handleSendMessage} className="space-y-2">
            <div className="relative flex items-end rounded-2xl border border-line bg-paper px-3 py-2 shadow-2xs transition focus-within:border-navy focus-within:ring-2 focus-within:ring-navy/20">
              <textarea
                ref={textareaRef}
                value={inputQuestion}
                onChange={(e) => setInputQuestion(e.target.value.slice(0, 600))}
                onKeyDown={handleKeyDown}
                rows={1}
                maxLength={600}
                disabled={isStreaming || !activeSubject}
                placeholder={
                  !activeSubject
                    ? "Choose a subject on the left to start asking questions…"
                    : `Ask a question about ${activeSubject} (max 600 chars)…`
                }
                className="max-h-32 min-h-[38px] w-full resize-none bg-transparent py-1.5 pr-12 text-sm text-ink outline-none placeholder:text-muted disabled:opacity-50"
              />

              <div className="absolute right-2.5 bottom-2 flex items-center gap-1">
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={handleStopStreaming}
                    className="grid size-8 place-items-center rounded-xl bg-red-100 text-red-700 transition hover:bg-red-200"
                    title="Stop generating"
                  >
                    <StopCircle className="size-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isStreaming || !inputQuestion.trim() || inputQuestion.length > 600 || !activeSubject}
                    className="grid size-8 place-items-center rounded-xl bg-navy text-paper shadow-2xs transition hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Send question (Enter)"
                  >
                    <Send className="size-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between px-1 text-[11px] text-muted">
              <span>
                Press <kbd className="rounded border border-line bg-paper px-1 py-0.5 font-mono text-[10px]">Enter</kbd> to send, <kbd className="rounded border border-line bg-paper px-1 py-0.5 font-mono text-[10px]">Shift + Enter</kbd> for new line.
              </span>
              <div className="flex items-center gap-2.5">
                <span className={inputQuestion.length >= 600 ? "font-bold text-red-600" : "text-muted"}>
                  {inputQuestion.length}/600
                </span>
                <span>•</span>
                <span>Grounded in school study materials</span>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
export default StudentChat
