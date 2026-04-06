# Adhikar-AI

Adhikar AI is a Constitution-focused legal assistant. It answers using only the uploaded Indian Constitution content with source-linked retrieval.

## What This Project Does

- Builds a hierarchical index of `Indian Constitution.pdf`.
- Uses hybrid retrieval (dense FAISS + sparse BM25) and reranking.
- Applies a strict system prompt so responses stay within Indian constitutional law context.
- Exposes a Flask API and a separate browser UI.

## Prerequisites

- Windows PowerShell
- Python 3.10+
- Node.js 18+
- Gemini API key (recommended for production), OR Ollama for local offline inference

If using Ollama locally, start Ollama and pull a model (one-time):

```powershell
ollama serve
```

In a new PowerShell terminal:

```powershell
ollama pull qwen2.5:7b
```

Optional model selection for this app (current PowerShell session):

```powershell
$env:OLLAMA_MODEL="qwen2.5:7b"
```

If using Gemini, set the API key and provider:

```powershell
$env:GEMINI_API_KEY="your_gemini_api_key"
$env:LLM_PROVIDER="gemini"
```

Optional response style (current PowerShell session):

```powershell
$env:ADHIKAR_RESPONSE_STYLE="friendly_concise"
```

Available values:

- `short_formal`
- `friendly_concise`
- `student_friendly`

## Run Everything With One Command

### Local Environment Setup (Recommended)

Create local env files once:

```powershell
Copy-Item .env.example .env
Copy-Item .\ui\.env.local.example .\ui\.env.local
```

Then edit `.env` for your provider choice:

- Gemini local run: set `GEMINI_API_KEY` and `LLM_PROVIDER=gemini`
- Ollama local run: set `LLM_PROVIDER=ollama` and ensure Ollama is running

Backend automatically loads `.env`, and Next.js automatically loads `ui/.env.local`.

For the UI proxy, you can set `BACKEND_API_URL=http://127.0.0.1:5000` in `ui/.env.local` for local dev, but it is optional because the UI defaults to localhost in development.

For Docker Compose, the root `.env` is used automatically if present, but it is optional because the compose file has safe defaults. The UI defaults to the `backend` service name inside the container network unless you override `BACKEND_API_URL`.

```powershell
.\dev.ps1
```

This script will:

- Create `.venv` if missing
- Install all dependencies from `requirements.txt`
- Install Next.js UI dependencies in `ui/`
- Start backend at `http://127.0.0.1:5000`
- Start UI at `http://127.0.0.1:5500`

Press `Ctrl+C` in the same terminal to stop both.

## Production Run With Docker

Use Docker when you want the backend, UI, vector indexes, and chat database to live in a containerized setup with persistent volumes:

```powershell
docker compose up --build
```

This starts:

- Backend API on `http://127.0.0.1:5000`
- UI on `http://127.0.0.1:5500`
- Persistent chat storage in `data/adhikar.sqlite3`
- Persistent vector data through the mounted `vectorstore/` directory

The UI reuses the same session ID in browser storage, and the backend saves every turn to SQLite so chat history survives refreshes and restarts.

LLM selection behavior:

- If `LLM_PROVIDER=gemini`, backend uses Gemini.
- If `LLM_PROVIDER=ollama`, backend uses Ollama.
- If `LLM_PROVIDER` is not set, backend auto-selects Gemini when `GEMINI_API_KEY` is present; otherwise it uses Ollama.

## Deploy To Railway (Recommended)

This repository now uses a same-origin UI proxy, so Railway only needs the backend URL inside the UI service.

### 1) Create a Railway project

- Sign in to Railway and connect GitHub
- Create a new project from this repository

### 2) Deploy two services

- Service 1: backend from repo root using [Dockerfile.backend](Dockerfile.backend)
- Service 2: UI from [ui/Dockerfile](ui/Dockerfile) with `rootDir` set to `ui`

### 3) Set Railway environment variables

Backend service:

- `LLM_PROVIDER=gemini`
- `GEMINI_API_KEY=your_api_key`
- `GEMINI_MODEL=gemini-1.5-flash`
- `ADHIKAR_CORS_ORIGINS=<your-ui-url>`
- `ADHIKAR_DATA_DIR=/app/data`
- `ADHIKAR_DB_PATH=/app/data/adhikar.sqlite3`

UI service:

- `BACKEND_API_URL=<your-backend-url>`

### 4) Add persistence if available

- If your Railway plan supports volumes, mount persistent storage for `/app/data`
- If not, the app still runs, but chats reset when the backend container restarts

### 5) Validate

- Backend health: `https://<backend-url>/health`
- UI: `https://<ui-url>`

### Local vs Railway behavior

- The browser talks only to the UI service
- The UI proxies `/api/chat` and `/api/sessions/...` to the backend
- That means you do not need a public `NEXT_PUBLIC_API_BASE_URL` anymore

## Deploy To Render (Docker, Production)

This repository includes a Render Blueprint at `render.yaml` for two Docker web services:

- `adhikar-backend` (Flask + Gunicorn)
- `adhikar-ui` (Next.js production server)

### 1) Push repository to GitHub

Render deploys from your GitHub repo, so commit these files first.

### 2) Create Blueprint on Render

- In Render, choose **New +** -> **Blueprint**
- Select this repository
- Render will detect `render.yaml` and create both services

### 3) Set required environment variables in Render

For `adhikar-backend`:

- `GEMINI_API_KEY` = your Gemini API key
- `GEMINI_MODEL` = Gemini model ID (default: `gemini-1.5-flash`)
- `LLM_PROVIDER` = `gemini`
- `ADHIKAR_CORS_ORIGINS` = your UI URL(s), comma-separated
  - Example: `https://adhikar-ui.onrender.com`

For `adhikar-ui`:

- `BACKEND_API_URL` = backend public URL
  - Example: `https://adhikar-backend.onrender.com`

### 4) Persistent data on Render

- Chat/session database is persisted on Render Disk at `/app/data/adhikar.sqlite3`
- This ensures user chats survive container restarts and deploys

### 5) Validate deployment

- Backend health: `https://<backend-url>/health`
- UI: `https://<ui-url>`

Note: You can still run Ollama for local development, but for Render production Gemini key-based inference is the simpler setup.

## Manual Commands (Optional)

Build index explicitly:

```powershell
.\.venv\Scripts\python.exe create_memory_for_llm.py
```

Start backend:

```powershell
.\.venv\Scripts\python.exe AdhikarAI.py
```

Start UI:

```powershell
cd .\ui; npm install; npm run dev -- --hostname 127.0.0.1 --port 5500
```

## API

Endpoint: `POST /chat`

Request body:

```json
{
  "query": "What does Article 14 provide?",
  "session_id": "abc12345"
}
```

Response body:

```json
{
  "response": "...",
  "sources": [
    {
      "source_id": 1,
      "section_hint": "Article 14",
      "page": 21,
      "source": "Indian Constitution.pdf"
    }
  ],
  "session_id": "abc12345"
}
```
