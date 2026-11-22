# School RAG client

React + TypeScript + Vite frontend for the School RAG assistant.

## Setup

```bash
npm install
npm run dev
```

`VITE_API_URL` in `.env` points at the API (`http://localhost:5000/api`). Login posts to `/api/auth/login`.

- Super admins land on `/admin`
- Teachers land on `/teacher`
- Students land on `/student`
