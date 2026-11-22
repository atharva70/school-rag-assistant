import type { UserRole } from "./auth"

export type Subject = {
  _id?: string
  name: string
  code: string
}

export type Standard = {
  _id: string
  name: string
  subjects: Subject[]
  createdAt?: string
  updatedAt?: string
}

export type TeacherUser = {
  id: string
  email: string
  role: UserRole
  standardId: string | { _id: string; name: string } | null
  createdAt?: string
}

export type StudentUser = {
  id: string
  email: string
  role: UserRole
  standardId: string | { _id: string; name: string } | null
  createdAt?: string
}

export type DocumentStatus = "PROCESSING" | "READY" | "FAILED"

export type DocumentItem = {
  _id?: string
  id?: string
  title: string
  fileName: string
  standardId: string | { _id: string; name: string }
  subjectName: string
  uploadedBy?: string
  status: DocumentStatus
  createdAt: string
}

export type Citation = {
  documentTitle: string
  pageNumber: number
  snippet: string
}

export type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  citations?: Citation[]
  isStreaming?: boolean
  timestamp?: string
}
