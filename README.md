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
- Ollama installed and running
- A local Ollama model (example: `mistral:latest`)

Start Ollama and pull a model (one-time):

```powershell
ollama serve
```

In a new PowerShell terminal:

```powershell
ollama pull mistral:latest
```

Optional model selection for this app (current PowerShell session):

```powershell
$env:OLLAMA_MODEL="mistral:latest"
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
