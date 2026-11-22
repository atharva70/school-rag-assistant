# 🎓 EduRAG — Multi-Tenant AI Study & Knowledge Base Assistant

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB_Atlas-Vector_Search-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/products/platform/atlas-vector-search)
[![React](https://img.shields.io/badge/React-Vite_%2B_Tailwind-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Google Gemini](https://img.shields.io/badge/AI-Google_Gemini_RAG-8E75B2?style=flat-square&logo=googlegemini&logoColor=white)](https://ai.google.dev/)

**EduRAG** is a full-stack **MERN + Retrieval-Augmented Generation (RAG)** web application built specifically for K–12 schools. Unlike generic PDF chatbots that allow unrestricted queries across mixed documents, EduRAG enforces **strict curriculum and grade-level isolation**—ensuring students only receive AI-generated answers grounded in teacher-approved study materials for their specific **Standard (Grade)** and **Subject**, complete with page-level source citations.

🔗 **Live Demo:** [Add Your Vercel Frontend URL Here]  
⚙️ **Backend API:** [Add Your Render Backend URL Here]

---

## 🏗️ System Architecture

```text
┌───────────────────┐       HTTPS / JWT        ┌───────────────────────────────────────┐
│   React Client    │ ◄──────────────────────► │        Express + TypeScript API       │
│  (Vite + Tailwind)│    SSE Token Streaming   │  (Helmet, Rate Limiting, Zero-Trust)  │
└───────────────────┘                          └───────────────────┬───────────────────┘
                                                                   │
                       ┌───────────────────────────────────────────┴───────────────┐
                       ▼                                                           ▼
      ┌─────────────────────────────────┐                         ┌─────────────────────────────────┐
      │     Google Gemini AI Engine     │                         │       MongoDB Atlas (M0)        │
      │ • Embeddings (Vector Creation)  │                         │ • Operational Data (Users,      │
      │ • Gemini Flash (Grounded Chat)  │                         │   Standards, ChatSessions)      │
      └─────────────────────────────────┘                         │ • Atlas Vector Search Index     │
                                                                  │   (Pre-filtered Cosine Search)  │
                                                                  └─────────────────────────────────┘
```

### Key Architectural Highlights
* **Unified Operational & Vector Storage:** Uses **MongoDB Atlas** to store both relational-style school hierarchies (`Standards`, `Users`, `Documents`) and 768-dimensional vector embeddings (`DocumentChunks`), eliminating the operational overhead of maintaining a separate vector database.
* **Pre-Filtered Semantic Retrieval:** Every `$vectorSearch` aggregation pipeline pre-filters vectors by `standardId` and `subjectName` *before* computing cosine similarity—preventing cross-grade data leakage and boosting retrieval accuracy.
* **Real-Time Token Streaming:** Streams AI responses chunk-by-chunk over Server-Sent Events (SSE) using the browser's native `ReadableStream` API for low-latency, ChatGPT-style UX.
* **Zero-Trust Multi-Tenant RBAC:** Role-based access control (`SUPER_ADMIN`, `TEACHER`, `STUDENT`) enforced at the middleware and service layers using server-decoded JWT claims rather than client-supplied IDs.

---

## 🚀 Phase 1: Implemented Features (Current Release)

### 1. Hierarchical Role-Based Access Control (RBAC)
* **Super Admin:** Creates academic **Standards** (e.g., *Grade 9, Grade 10*), manages **Subjects** per standard, and provisions **Teacher** accounts mapped to specific standards.
* **Teachers:** Manage study materials (upload/delete curriculum PDFs per subject) and onboard **Student** accounts assigned to their standard.
* **Students:** Access a subject-scoped AI study workspace containing only reference PDFs approved for their grade level.

### 2. Automated PDF Ingestion & RAG Pipeline
* **Document Processing:** Extracts text page-by-page using `pdf-parse`, splits content into overlapping semantic chunks via LangChain (`RecursiveCharacterTextSplitter`), and generates vector embeddings via Google Gemini.
* **Grounded Citations:** Instructs Gemini to answer strictly from retrieved `<context>` blocks and attaches clickable **Document Title & Page Number** citation badges beneath every response so students can verify facts directly against their textbook.

### 3. Production Security & OWASP LLM Hardening
* **IDOR & Tenant Isolation:** Server strictly derives `standardId` from verified JWT tokens for students and validates ownership before teachers can upload/delete documents or register students.
* **API & Input Defense:** Protected with `helmet` security headers, strict CORS allowlisting, `express-mongo-sanitize` (NoSQL injection prevention), and tiered `express-rate-limit` rules on login and AI chat endpoints.
* **File & Prompt Guardrails:** Validates binary `%PDF-` magic bytes on file uploads (preventing spoofed file extensions) and wraps user queries in XML delimiters (`<user_query>`) to mitigate prompt injection attacks.

---

## 🗺️ Phase 2: Production School Readiness Roadmap

To transition EduRAG from a functional MVP into a daily-use platform deployed across a real school campus, the following enhancements are planned for Phase 2:

### 🏫 Academic & Classroom Workflows
* [ ] **Multi-Standard Teacher Mapping:** Upgrade `User.standardId` to an array (`standardIds: ObjectId[]`) so subject specialists (e.g., a Physics teacher teaching Grades 9, 10, and 11) can manage multiple standards from one login.
* [ ] **Chapter-Level Tagging & Syllabus Filters:** Allow teachers to tag uploaded PDFs by *Chapter Name* or *Term* so students can narrow AI revision sessions to specific exam topics.
* [ ] **AI Quiz & Practice Worksheet Generator:** Enable teachers and students to generate auto-graded MCQs, short-answer questions, and flashcards directly from selected textbook chapters.
* [ ] **Bulk Student Onboarding (CSV Import):** Allow teachers/admins to upload a class roster CSV to batch-create student accounts and send automated welcome credentials.

### 📊 Analytics & Pedagogical Insights
* [ ] **Teacher Doubt-Analytics Dashboard:** Aggregate anonymized student queries per subject to highlight *"Most Asked Topics"* and *"Knowledge Gaps"*, helping teachers identify which chapters students struggle with before exams.
* [ ] **Parent / Guardian Read-Only Portal:** Weekly summary emails showing study engagement and topics revised without exposing private chat logs.

### ⚡ Infrastructure & Scale
* [ ] **Asynchronous Background Job Queue:** Offload heavy textbook PDF chunking and embedding generation to **BullMQ + Redis** so large 200-page textbooks process reliably in the background without HTTP timeouts.
* [ ] **Cloud Object Storage (AWS S3 / Cloudflare R2):** Store original uploaded PDFs in object storage with signed URLs so students can open an inline split-screen PDF viewer alongside the AI chat.
* [ ] **Hybrid Search (Vector + Keyword BM25):** Combine MongoDB Atlas `$vectorSearch` with full-text `$search` using Reciprocal Rank Fusion (RRF) for exact-match queries like chemical formulas, dates, and theorem names.
* [ ] **Audit Logging & Password Reset Flow:** Add immutable audit trails for document deletions and SMTP-based password recovery.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, React Router, `react-markdown`, Lucide Icons |
| **Backend** | Node.js, Express.js, TypeScript, Mongoose ODM, Multer, `pdf-parse` |
| **Database & Search** | MongoDB Atlas (Operational Collections + Atlas Vector Search Index) |
| **AI & Orchestration** | Google Gemini API (`@google/genai`), LangChain Text Splitters, Server-Sent Events (SSE) |
| **Security** | JWT (`jsonwebtoken`), `bcryptjs`, `helmet`, `express-rate-limit`, `express-mongo-sanitize` |
| **Deployment** | Vercel (Frontend SPA) & Render (Backend Web Service) |

---

## ⚙️ Local Development Setup

### Prerequisites
* Node.js (`v18+`)
* Free **MongoDB Atlas** cluster with a Vector Search Index (`vector_index`) configured on `documentchunks`
* Free **Google Gemini API Key** from [Google AI Studio](https://aistudio.google.com)

### 1. Clone & Configure Backend (`/server`)
```bash
git clone https://github.com/atharva70/school-rag-assistant.git
cd school-rag-assistant/server
npm install
```
Create a `.env` file inside `/server`:
```env
PORT=5000
MONGO_URI=your_mongodb_atlas_connection_string
GEMINI_API_KEY=your_gemini_api_key
JWT_SECRET=your_super_secret_jwt_key
CLIENT_URL=http://localhost:5173
```
Seed the initial Super Admin and start the backend:
```bash
npm run seed
npm run dev
```

### 2. Configure Frontend (`/client`)
```bash
cd ../client
npm install
```
Create a `.env` file inside `/client`:
```env
VITE_API_URL=http://localhost:5000/api
```
Start the React dev server:
```bash
npm run dev
```

---

## 📄 License
This project is licensed under the MIT License.
