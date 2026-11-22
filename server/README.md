# School RAG Assistant - Backend API

A production-grade, hardened Node.js + Express + TypeScript backend implementing a clean **Controller -> Service -> Mongoose Model** architecture, JWT authentication, zero-trust RBAC, PDF ingestion with magic-bytes verification, rate limiting, and MongoDB `$vectorSearch` with Server-Sent Events (SSE) streaming chat.

---

## 🛡️ Production Security Controls Implemented

### 1. HTTP Headers & Middleware Protection
- **`helmet`**: Configures secure HTTP headers (including `X-Content-Type-Options: nosniff`, `X-Frame-Options`, HSTS, etc.).
- **`cors`**: Restricted to `process.env.CLIENT_URL || 'http://localhost:5173'` with credential support.
- **`express-mongo-sanitize`**: Intercepts requests to strip `$` and `.` characters, completely preventing NoSQL operator injection.
- **Payload Limits**: `express.json({ limit: '50kb' })` and `express.urlencoded({ limit: '50kb' })` to mitigate body-overflow Denial-of-Service attacks.
- **Centralized Error Handler**: Never leaks stack traces in production (`NODE_ENV === 'production'`).

### 2. Rate Limiting (`express-rate-limit`)
- **Login Endpoint (`POST /api/auth/login`)**: Max **10 attempts per 15 minutes** per IP to defend against credential brute-forcing.
- **Chat Endpoint (`POST /api/chat`)**: Max **20 requests per 15 minutes** per authenticated user ID (`req.user.userId`) to manage AI quotas and protect downstream LLM budgets.

### 3. Zero-Trust RBAC & Ownership Checks
- **Strict Student Standard Enforcement**: On `GET /api/documents` and `POST /api/chat`, any `standardId` provided by a `STUDENT` is ignored; the backend strictly enforces `req.user.standardId` from the verified JWT.
- **Strict Teacher Standard Enforcement**:
  - `POST /api/documents/upload`: Verifies `teacher.standardId === standardId` (rejects with `403 Forbidden` on mismatch).
  - `DELETE /api/documents/:id`: Verifies target document belongs to the teacher's assigned standard (rejects with `403 Forbidden` on mismatch).
  - `POST /api/teacher/students`: Verifies student's standard matches teacher's standard (rejects with `403 Forbidden` on mismatch).
- **Strong Password Rules**: Enforces minimum 8 characters, at least 1 uppercase letter, and at least 1 number when creating Teacher or Student accounts.
- **Strip `passwordHash`**: Configured Mongoose schema `toJSON` transform to guarantee `passwordHash` is never exposed in any API response.

### 4. File Upload & Prompt Injection Guardrails
- **Magic Bytes Verification**: Checks `buffer.subarray(0, 5).toString() === '%PDF-'` in addition to MIME type and extension to reject spoofed files.
- **Max Question Length**: Enforces maximum 600 characters on chat questions.
- **Prompt Injection Defense**:
  - Retrieved chunks are wrapped strictly within `<context>` tags.
  - User query is isolated inside `<user_query>` tags.
  - Gemini/OpenAI is instructed to treat all `<user_query>` content strictly as untrusted data and refuse commands to ignore instructions or reveal system prompts.

---

## ⚡ Available Commands

- **Seed Database:** `npm run seed`
- **Dev Mode:** `npm run dev`
- **Build TypeScript:** `npm run build`
- **Run Security Verification Tests:** `npm test`
