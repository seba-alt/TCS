# Technology Stack

**Project:** TCS RAG-Based AI Expert-Matching Concierge Chatbot
**Researched:** 2026-02-20
**Research Mode:** Ecosystem (Greenfield)
**Note:** External tool access was unavailable during this research session. All findings are based on training data (knowledge cutoff August 2025) and are annotated with confidence levels. VERIFY all version numbers against PyPI/npm before pinning in requirements files.

---

## Recommended Stack

### Core AI / LLM Layer

| Technology | Version (verify) | Purpose | Why |
|------------|-----------------|---------|-----|
| `google-genai` (new SDK) | `^1.0` | Gemini LLM calls + embeddings | Google deprecated `google-generativeai` in favor of `google-genai` in 2025. The new SDK has better async support, native streaming, and unified API for models + embeddings. Use this, NOT `google-generativeai`. |
| `gemini-1.5-flash` or `gemini-2.0-flash` | model string | LLM for chat responses | Flash models give low-latency streaming at low cost. Use `gemini-2.0-flash` if available for the project's API key tier; fall back to `gemini-1.5-flash`. Do NOT use Pro for real-time chat — latency is too high for streaming UX. |
| `text-embedding-004` | model string | Generating embeddings from expert CSV data | Google's current recommended embedding model. 768-dim output, outperforms `embedding-001` on retrieval tasks. Use for both indexing (CSV ingestion) and query-time embedding. |

**Confidence: MEDIUM** — The SDK rename from `google-generativeai` to `google-genai` was announced mid-2024 and was in progress as of August 2025 training cutoff. Verify on PyPI: `pip index versions google-genai` and check https://ai.google.dev/gemini-api/docs for current SDK guidance.

---

### Backend Framework

| Technology | Version (verify) | Purpose | Why |
|------------|-----------------|---------|-----|
| Python | `3.11+` | Runtime | 3.11 gives significant perf improvements over 3.10. 3.12 is stable but library compatibility is wider on 3.11. |
| FastAPI | `^0.111` | API server | Async-native, automatic OpenAPI docs, StreamingResponse for SSE, excellent Pydantic integration. The standard choice for Python AI APIs in 2025. |
| Uvicorn | `^0.29` | ASGI server | Required to run FastAPI. Use with `--host 0.0.0.0` on Railway. |
| Pydantic | `v2` (`^2.7`) | Request/response validation | FastAPI 0.100+ ships with Pydantic v2. Faster validation than v1. Define all request/response models with Pydantic — it integrates directly into FastAPI route signatures. |

**Confidence: HIGH** — FastAPI + Uvicorn + Pydantic v2 is the dominant Python AI backend stack as of 2025.

---

### RAG / Vector Similarity Layer

This is the most consequential decision. The choice between NumPy, FAISS, and ChromaDB depends on data size, persistence requirements, and operational complexity.

#### Recommendation: NumPy + cosine similarity (no vector DB)

| Technology | Version (verify) | Purpose | Why |
|------------|-----------------|---------|-----|
| `numpy` | `^1.26` or `^2.0` | In-memory cosine similarity over CSV embeddings | For small-to-medium expert datasets (under ~50K entries), pure NumPy is fastest, has zero operational overhead, and deployments stay stateless. Pre-compute embedding matrix at startup, store in RAM, dot-product at query time. |
| `pandas` | `^2.2` | CSV ingestion and data manipulation | Standard library for CSV -> DataFrame -> embedding pipeline. Clean column selection and row filtering before embedding. |
| `scipy` | `^1.13` | Optional: `scipy.spatial.distance.cosine` | Use only if NumPy cosine distance becomes a bottleneck; usually unnecessary at this scale. |

**Why NOT FAISS:**
- Adds a C++ compiled dependency (faiss-cpu) that complicates Railway/Docker builds.
- Overkill for datasets under ~500K vectors — NumPy matrix multiplication is faster for small corpora because FAISS has per-query overhead.
- No persistence benefit if embeddings are re-generated from CSV at startup.

**Why NOT ChromaDB (for this project):**
- ChromaDB is a local vector database that requires persistent storage (disk). Railway/Render ephemeral containers lose this on restart.
- If you need persistence, you'd need a mounted volume or external DB — which adds infrastructure complexity for no gain over NumPy at this scale.
- Adds 200MB+ to container image size.

**When to reconsider:** If the expert dataset grows beyond ~100K rows, or if embedding pre-computation at startup becomes too slow (>10s), introduce pgvector (see below).

**Alternative Path: pgvector on PostgreSQL**

| Technology | Version (verify) | Purpose | Why |
|------------|-----------------|---------|-----|
| `pgvector` | extension `0.7+` | Persistent vector similarity on PostgreSQL | If Railway's PostgreSQL add-on is used, pgvector is available. Use `psycopg2` or `asyncpg` + `pgvector` Python client. Survives container restarts. Only choose this if CSV data changes frequently or dataset is large. |
| `asyncpg` | `^0.29` | Async PostgreSQL driver | Use over psycopg2 for FastAPI async routes. |

**Confidence: HIGH for NumPy recommendation for small datasets. MEDIUM for pgvector alternative (verify pgvector availability on Railway's managed Postgres).**

---

### Streaming: FastAPI SSE

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| FastAPI `StreamingResponse` | built-in | Server-Sent Events for streaming Gemini output | FastAPI's `StreamingResponse` with `media_type="text/event-stream"` is the standard pattern for LLM streaming. No extra library needed. |
| `sse-starlette` | `^2.1` | Optional SSE helper | Adds `EventSourceResponse` class for cleaner SSE formatting. Use if SSE reconnection / event-id support is needed. For basic streaming, raw `StreamingResponse` is simpler. |

**Pattern:**
```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import google.generativeai as genai  # or google.genai

async def stream_gemini(query: str):
    model = genai.GenerativeModel("gemini-2.0-flash")
    async for chunk in await model.generate_content_async(query, stream=True):
        yield f"data: {chunk.text}\n\n"

@app.post("/chat")
async def chat(request: ChatRequest):
    return StreamingResponse(
        stream_gemini(request.message),
        media_type="text/event-stream"
    )
```

**Confidence: HIGH** — This pattern is stable in FastAPI 0.100+.

---

### CORS Configuration

| Technology | Purpose | Config |
|------------|---------|--------|
| FastAPI `CORSMiddleware` | Allow React frontend (Vercel) to call Railway backend | Must set `allow_origins` to Vercel deployment URL in production. Use `["*"]` only in development. |

**Pattern:**
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",           # Vite dev server
        "https://your-app.vercel.app",    # Vercel preview/prod
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
```

Use an environment variable `ALLOWED_ORIGINS` (comma-separated) so Railway can inject production URLs without code changes.

**Confidence: HIGH**

---

### Frontend Framework

| Technology | Version (verify) | Purpose | Why |
|------------|-----------------|---------|-----|
| React | `^18.3` or `^19` | UI framework | Standard. React 19 was in RC as of August 2025 — use 18.3 for stability unless 19 is now stable (verify). |
| Vite | `^5.4` | Build tool | Vite is the standard React build tool in 2025, replacing CRA (deprecated). Fast HMR, excellent Vercel compatibility. |
| TypeScript | `^5.5` | Type safety | Use TypeScript. Types for API response shapes, chat message structures, and SSE event parsing catch errors at build time. |

**Confidence: HIGH** — React 18 + Vite + TypeScript is the dominant frontend stack.

---

### React Chat UI

#### Recommendation: Build your own with Tailwind CSS — do NOT use a pre-built chat library

**Why NOT `react-chatbot-kit`, `chatscope`, or similar:**
- Pre-built chat libraries have opinionated styling that fights Tailwind.
- They don't handle streaming (SSE) well — they expect complete messages.
- Customizing them for a branded expert-matching UI takes more time than building a simple component.

**What to build:**
- `ChatWindow.tsx` — scrolling message list
- `MessageBubble.tsx` — user vs assistant styling
- `ChatInput.tsx` — textarea + send button
- `useStreamingChat.ts` — custom hook managing SSE connection, message state, loading state

**Supporting libraries:**

| Technology | Version (verify) | Purpose | Why |
|------------|-----------------|---------|-----|
| Tailwind CSS | `^3.4` | Styling | Utility-first, excellent for chat UI. Vercel deploys Tailwind with zero config. |
| `react-markdown` | `^9.0` | Render Markdown in assistant responses | Gemini often returns Markdown. Render it properly in message bubbles. |
| `remark-gfm` | `^4.0` | GitHub Flavored Markdown plugin | Tables, strikethrough, task lists in Markdown responses. |

**Confidence: HIGH for Tailwind + react-markdown. MEDIUM for specific versions — verify on npm.**

---

### SSE Client (Frontend)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Native `EventSource` API | browser built-in | Receive SSE from FastAPI | `EventSource` is built into all modern browsers. No library needed for basic SSE. Does NOT support POST requests or custom headers — use `fetch` with `ReadableStream` instead if you need POST + auth headers. |
| `@microsoft/fetch-event-source` | `^2.0.1` | SSE over POST with headers | If the chat endpoint requires POST body (it will — you need to send the message), use this library. It wraps `fetch` with SSE parsing and supports POST, headers, reconnection. |

**Recommendation:** Use `@microsoft/fetch-event-source` because chat requires POST (to send the message body). Native `EventSource` only supports GET.

**Confidence: HIGH** — This is a known limitation of the EventSource API; the Microsoft library is the standard workaround.

---

### State Management

| Technology | Version (verify) | Purpose | Why |
|------------|-----------------|---------|-----|
| React `useState` + `useReducer` | built-in | Chat message state | For a single-page chatbot, local component state is sufficient. No Redux or Zustand needed. Keep it simple. |
| React Context | built-in | Share chat state across components | If the chat state needs to be accessed by header/sidebar components, wrap in a Context. |

**Why NOT Redux/Zustand:** Overkill for a single-feature chatbot UI. Adds complexity, increases bundle size, slows development. If the product expands to multi-session history or multi-user state, reconsider Zustand (`^4.5`).

**Confidence: HIGH**

---

### HTTP Client (Frontend)

| Technology | Version (verify) | Purpose | Why |
|------------|-----------------|---------|-----|
| Native `fetch` | browser built-in | API calls to FastAPI | Use native fetch for non-streaming requests (health check, metadata). No Axios needed. |
| `@microsoft/fetch-event-source` | `^2.0.1` | Streaming chat requests | See SSE Client section above. |

**Why NOT Axios:** Axios doesn't handle SSE streaming. Native fetch + fetch-event-source covers all use cases cleanly.

**Confidence: HIGH**

---

### Deployment: Vercel (Frontend)

| Technology | Version/Config | Purpose | Why |
|------------|---------------|---------|-----|
| Vercel | N/A | Host React/Vite app | Zero-config for Vite + React. Automatic preview deployments per PR. Edge CDN. Free tier sufficient for MVP. |
| `vercel.json` | N/A | Build config | Usually not needed for Vite. If needed: `{"buildCommand": "npm run build", "outputDirectory": "dist"}` |

**Environment variable:** Set `VITE_API_URL` to the Railway backend URL. Vite exposes env vars prefixed with `VITE_` to the browser bundle.

**Confidence: HIGH**

---

### Deployment: Railway (Backend)

| Technology | Version/Config | Purpose | Why |
|------------|---------------|---------|-----|
| Railway | N/A | Host FastAPI + Uvicorn | Supports Python natively, managed PostgreSQL add-on, environment variables, auto-deploys from GitHub. Better DX than Render for this stack in 2025. |
| `Dockerfile` or `railway.toml` | N/A | Deploy config | Railway detects Python via `requirements.txt` or `Pipfile`. Add a `Procfile`: `web: uvicorn main:app --host 0.0.0.0 --port $PORT`. Use `$PORT` env var — Railway injects this. |

**Environment variables on Railway:**
- `GOOGLE_API_KEY` — Gemini API key
- `ALLOWED_ORIGINS` — Vercel frontend URL(s)
- `PORT` — injected by Railway automatically

**Confidence: HIGH for Railway. MEDIUM for specific Procfile syntax — verify Railway's Python docs.**

---

### Supporting Python Libraries

| Library | Version (verify) | Purpose | When to Use |
|---------|-----------------|---------|-------------|
| `python-dotenv` | `^1.0` | Load `.env` in development | Use in dev only; Railway/Vercel inject env vars in production. Never commit `.env`. |
| `httpx` | `^0.27` | Async HTTP client | If backend needs to call external APIs (e.g., fetching expert profile enrichment). Async-native, unlike `requests`. |
| `tenacity` | `^8.4` | Retry logic for Gemini API calls | Gemini API has rate limits and occasional 503s. Wrap embedding + LLM calls with exponential backoff. |
| `structlog` | `^24.2` | Structured logging | JSON-formatted logs for Railway's log viewer. Easier to parse than print statements. |
| `pytest` | `^8.2` | Testing | Standard Python test runner. |
| `pytest-asyncio` | `^0.23` | Async test support | Required for testing async FastAPI routes. |
| `httpx` (test client) | `^0.27` | FastAPI test client | Use `httpx.AsyncClient` with FastAPI's `ASGITransport` for integration tests. |

**Confidence: MEDIUM** — Versions are approximate; verify on PyPI before pinning.

---

### Supporting Frontend Libraries

| Library | Version (verify) | Purpose | When to Use |
|---------|-----------------|---------|-------------|
| `clsx` | `^2.1` | Conditional class names | Cleaner than template literals for Tailwind conditional classes. |
| `tailwind-merge` | `^2.3` | Merge Tailwind classes without conflicts | Use with `clsx` to safely compose Tailwind utility classes. |
| `lucide-react` | `^0.400` | Icon library | Clean, tree-shakeable icons. Use for send button, loading spinner, etc. |
| `react-hot-toast` | `^2.4` | Toast notifications | Error messages when API calls fail. Lightweight alternative to full notification libraries. |

**Confidence: MEDIUM** — These are popular, stable libraries but verify versions on npm.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Python AI SDK | `google-genai` | `google-generativeai` | Deprecated by Google in favor of `google-genai`; migration risk if staying on old SDK |
| Vector store | NumPy in-memory | ChromaDB | Persistent storage not needed for static CSV data; adds 200MB+ image size and operational complexity |
| Vector store | NumPy in-memory | FAISS | C++ compilation complexity in Docker; overkill for <100K vectors |
| Vector store | NumPy in-memory | pgvector | Valid alternative if dataset is large or changes frequently; prefer for v2 if needed |
| LLM for chat | Gemini Flash | Gemini Pro | Latency too high for real-time streaming; 3-5x more expensive per token |
| Frontend build | Vite | Create React App | CRA is deprecated; Vite is the standard |
| CSS | Tailwind CSS | styled-components / Emotion | CSS-in-JS adds runtime overhead; Tailwind is better DX with Vite |
| Chat UI | Custom components | react-chatbot-kit / chatscope | Pre-built libraries fight streaming SSE; customization harder than building simple components |
| SSE client | fetch-event-source | Native EventSource | EventSource doesn't support POST; POST is required to send message body |
| Backend hosting | Railway | Render | Railway has better DX, faster deploys, and better PostgreSQL integration as of 2025 |
| State management | useState/Context | Redux / Zustand | Overkill for single-feature chatbot; add Zustand if product expands |

---

## Installation

### Backend (Python)

```bash
# Core dependencies
pip install \
  fastapi==0.111.* \
  uvicorn[standard]==0.29.* \
  pydantic==2.7.* \
  google-genai==1.* \
  numpy==1.26.* \
  pandas==2.2.* \
  python-dotenv==1.0.* \
  tenacity==8.4.* \
  httpx==0.27.* \
  structlog==24.2.*

# Dev dependencies
pip install \
  pytest==8.2.* \
  pytest-asyncio==0.23.* \
  ruff \
  mypy
```

**VERIFY all versions on PyPI before pinning in `requirements.txt`.**

### Frontend (Node)

```bash
# Create project
npm create vite@latest my-app -- --template react-ts
cd my-app

# Core dependencies
npm install \
  react-markdown \
  remark-gfm \
  @microsoft/fetch-event-source \
  clsx \
  tailwind-merge \
  lucide-react \
  react-hot-toast

# Dev dependencies
npm install -D \
  tailwindcss \
  postcss \
  autoprefixer \
  @types/react \
  @types/react-dom

# Initialize Tailwind
npx tailwindcss init -p
```

---

## Critical Verification Checklist

Before starting development, a developer MUST verify these items since this research was produced without live web access:

- [ ] Confirm `google-genai` is the current recommended Python SDK (vs `google-generativeai`): https://ai.google.dev/gemini-api/docs/quickstart?lang=python
- [ ] Confirm `text-embedding-004` is still the recommended embedding model: https://ai.google.dev/gemini-api/docs/models/gemini
- [ ] Confirm `gemini-2.0-flash` is available on the project's API key tier
- [ ] Verify FastAPI version on PyPI: https://pypi.org/project/fastapi/
- [ ] Verify React version on npm: `npm view react version`
- [ ] Verify `@microsoft/fetch-event-source` is maintained: https://www.npmjs.com/package/@microsoft/fetch-event-source
- [ ] Verify Railway supports Python 3.11+ natively (check Railway docs)
- [ ] Verify Vercel builds Vite apps without `vercel.json` (check Vercel docs)

---

## Sources

**Note:** All sources below are cited from training data knowledge (cutoff August 2025). Confidence levels reflect this limitation.

| Source | Confidence | Notes |
|--------|------------|-------|
| Google AI Python SDK migration announcement | MEDIUM | google-generativeai -> google-genai transition known as of mid-2024 |
| FastAPI official docs (fastapi.tiangolo.com) | HIGH | FastAPI 0.100+ StreamingResponse + SSE pattern is well-established |
| Pydantic v2 release (pydantic.dev) | HIGH | Pydantic v2 shipped mid-2023, stable throughout 2024-2025 |
| Vite official docs (vitejs.dev) | HIGH | Vite replaced CRA as standard; Vercel has first-class Vite support |
| NumPy vs vector DB comparison | MEDIUM | Based on community knowledge of scale thresholds; verify for your data size |
| Railway Python deployment docs | MEDIUM | Railway Procfile + $PORT pattern is standard PaaS convention |
| @microsoft/fetch-event-source npm | MEDIUM | Known solution for SSE over POST; verify package is still maintained |
