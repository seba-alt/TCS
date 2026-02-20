# Architecture Patterns

**Domain:** RAG-based AI expert-matching chatbot (CSV source, Google GenAI embeddings, FastAPI backend, React frontend)
**Researched:** 2026-02-20
**Confidence:** MEDIUM — based on established RAG patterns and Google GenAI API documentation; external verification was unavailable during this session due to tool restrictions. All claims reflect well-established, stable patterns.

---

## Recommended Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         BUILD TIME                              │
│                                                                 │
│  experts.csv ──► CSV Ingestor ──► Embedding Service ──►        │
│                                   (Google GenAI                 │
│                                    text-embedding-004)          │
│                                         │                       │
│                                         ▼                       │
│                                  Vector Store                   │
│                              (FAISS index + metadata            │
│                               JSON sidecar, persisted           │
│                               to disk as .index/.json)          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         RUNTIME                                 │
│                                                                 │
│  React Frontend                                                 │
│  ┌────────────────┐                                             │
│  │  Chat UI       │  POST /api/chat { query, history }         │
│  │  Result Cards  │ ─────────────────────────────────────────► │
│  │  Filter Panel  │                                             │
│  └────────────────┘       FastAPI Backend                       │
│                           ┌──────────────────────────────────┐  │
│                           │  /api/chat  (ChatRouter)         │  │
│                           │     │                            │  │
│                           │     ▼                            │  │
│                           │  Query Embedder                  │  │
│                           │  (Google GenAI embed)            │  │
│                           │     │                            │  │
│                           │     ▼                            │  │
│                           │  Vector Retriever                │  │
│                           │  (FAISS cosine search, top-k)    │  │
│                           │     │                            │  │
│                           │     ▼                            │  │
│                           │  Prompt Builder                  │  │
│                           │  (retrieved profiles + query     │  │
│                           │   + system prompt)               │  │
│                           │     │                            │  │
│                           │     ▼                            │  │
│                           │  Gemini 1.5 Flash / Pro          │  │
│                           │  (generate answer, stream)       │  │
│                           │     │                            │  │
│                           │  Response (text + expert refs)   │  │
│                           └──────────────────────────────────┘  │
│  ◄───────────────────── SSE stream / JSON response ─────────── │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **CSV Ingestor** (offline script) | Parse `experts.csv`, validate fields, normalise text into embeddable strings per profile | Embedding Service (writes), Vector Store (writes) |
| **Embedding Service** (offline + online) | Call `google-generativeai` `embed_content` with `text-embedding-004`; batch 1,600 rows at build time; embed single query at request time | Google GenAI API (outbound), Vector Store (read/write) |
| **Vector Store** (FAISS + metadata sidecar) | Persist 768-dim float32 vectors + row-level metadata JSON; serve cosine nearest-neighbour lookups | Embedding Service (write at build), Retriever (read at runtime) |
| **FastAPI Backend** | Expose HTTP API; orchestrate query embedding → retrieval → prompt construction → LLM call → response streaming | React frontend (inbound), Google GenAI API (outbound), Vector Store (read) |
| **ChatRouter** (`/api/chat`) | Validate request schema, call orchestration chain, stream or return response | FastAPI backend internals |
| **HealthRouter** (`/api/health`) | Liveness check; confirm vector store loaded, GenAI API reachable | FastAPI backend internals |
| **Prompt Builder** | Merge retrieved expert profiles into a structured prompt with system instructions and conversation history | Retriever output, LLM client |
| **Gemini LLM Client** | Call `gemini-1.5-flash` (default) or `gemini-1.5-pro` (fallback) via `google-generativeai`; handle streaming | Google GenAI API (outbound), FastAPI router |
| **React Frontend** | Chat UI, expert result cards, optional filter sidebar; consumes FastAPI REST/SSE | FastAPI backend (outbound) |
| **State Layer** (frontend) | Conversation history (local state or Zustand), last retrieved experts, filter state | React components |

---

## Data Flow

### Build-Time Flow (run once, or when CSV changes)

```
experts.csv
  │
  ▼ 1. Parse
CSV Ingestor: read rows, combine fields into a single text string per expert
              e.g. "Name: Jane Doe. Title: ML Engineer. Skills: Python, NLP.
                    Industry: FinTech. Bio: ..."
  │
  ▼ 2. Batch embed
Embedding Service: chunk rows into batches of ≤100 (API rate limit)
                   POST embed_content(model="models/text-embedding-004",
                                      task_type="RETRIEVAL_DOCUMENT",
                                      content=text)
                   → 768-dim vector per row
  │
  ▼ 3. Index
FAISS IndexFlatIP (inner product on L2-normalised vectors = cosine similarity)
  + metadata_store.json  [{ "id": 0, "name": "...", "title": "...", ... }, ...]
  │
  ▼ 4. Persist to disk
faiss.index  (binary)
metadata.json  (array, position-aligned with FAISS IDs)
```

### Runtime Flow (per chat request)

```
User types query in React
  │
  ▼ HTTP POST /api/chat
  { "query": "...", "history": [...] }
  │
  ▼ FastAPI ChatRouter validates schema
  │
  ▼ Query Embedder
  embed_content(model="models/text-embedding-004",
                task_type="RETRIEVAL_QUERY",
                content=query)
  → 768-dim query vector
  │
  ▼ Vector Retriever
  faiss_index.search(query_vector, k=5)  →  [(score, id), ...]
  metadata_store[id]  →  5 expert profile dicts
  │
  ▼ Prompt Builder
  system_prompt + formatted_profiles + conversation_history + user_query
  → final_prompt string
  │
  ▼ Gemini LLM Client
  generate_content(model="gemini-1.5-flash", contents=final_prompt, stream=True)
  │
  ▼ FastAPI streams SSE chunks back
  │
  ▼ React EventSource receives chunks, renders incrementally
  + Expert result cards rendered from retrieved profile metadata
```

---

## Key Architectural Decisions

### Decision 1: Pre-Compute Embeddings vs On-Demand

**Recommendation: Pre-compute at build time.**

With 1,600 profiles, computing embeddings takes roughly 16-20 API batches (100 items each) and 30-60 seconds total. This is a one-time cost. Embedding on demand at query time would add ~1-2 seconds of latency per request and multiply API costs linearly with traffic. Pre-compute once, persist to disk, load into memory at server startup.

**Rebuild trigger:** Run the ingestion script whenever `experts.csv` changes. Add a Makefile target or CI step.

### Decision 2: In-Memory vs Persistent Vector Store

**Recommendation: FAISS on disk, loaded into memory at startup.**

At 1,600 profiles with 768-dim float32 vectors, the index is approximately 5 MB. This fits comfortably in RAM (even a 512 MB Fly.io container). FAISS is loaded once at FastAPI startup via a lifespan event handler and held in an application-level singleton. No external vector database service (Pinecone, Weaviate, Chroma) is needed at this scale — they add operational cost and network latency for no benefit below ~100K documents.

If the dataset grows beyond ~50K profiles, migrate to ChromaDB (persistent, embedded, no external service) or Qdrant (self-hosted).

### Decision 3: Streaming vs Batch Response

**Recommendation: Server-Sent Events (SSE) streaming.**

Gemini generation can take 2-8 seconds for a full response. Streaming via SSE means users see the first tokens within ~500ms, dramatically improving perceived responsiveness. FastAPI supports SSE via `StreamingResponse` with `text/event-stream` content type. React consumes with the native `EventSource` API or `fetch` with `ReadableStream`.

**Alternative:** If SSE adds frontend complexity that slows the MVP, start with a non-streaming JSON response and upgrade later. The backend change is trivial; only the frontend needs updating.

### Decision 4: Retrieval Strategy

**Recommendation: Top-k cosine similarity (k=5), no re-ranker for MVP.**

With 1,600 profiles, FAISS brute-force search (IndexFlatIP) is fast enough (<10ms). A re-ranker (cross-encoder) would improve relevance but adds a second model call and latency. Start without one; add if retrieval quality is poor post-launch.

**Metadata filtering:** Apply Python-level post-filtering on retrieved results (e.g. filter by industry or skill) rather than FAISS filtered search, which requires a more complex index type. At k=5 to k=20 retrieval + Python filter, this is negligible overhead.

---

## Patterns to Follow

### Pattern 1: Lifespan-Managed Singletons (FastAPI)

Load the FAISS index and metadata store once at application startup using FastAPI's `lifespan` context manager. Store in `app.state`. Inject via dependency into routers. Never reload per-request.

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
import faiss, json, numpy as np

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    app.state.index = faiss.read_index("data/faiss.index")
    with open("data/metadata.json") as f:
        app.state.metadata = json.load(f)
    yield
    # Shutdown (nothing to clean up for FAISS in-memory)

app = FastAPI(lifespan=lifespan)
```

### Pattern 2: Separate Ingestion Script from API Server

The CSV-to-embeddings pipeline is a one-off build step, not part of the API server. Keep it as a standalone script (`scripts/ingest.py`) that writes `data/faiss.index` and `data/metadata.json`. The API server only reads these files. This separation makes the pipeline independently testable and runnable.

```
scripts/
  ingest.py        # CSV → embeddings → FAISS + metadata.json
  validate_index.py  # sanity-check index shape, sample queries
app/
  main.py          # FastAPI app, mounts routers
  routers/
    chat.py
    health.py
  services/
    embedder.py    # wraps google-generativeai embed_content
    retriever.py   # wraps FAISS search + metadata lookup
    llm.py         # wraps Gemini generate_content
  models/
    schemas.py     # Pydantic request/response models
data/
  faiss.index      # binary, gitignored
  metadata.json    # gitignored (contains PII)
  experts.csv      # source of truth, gitignored
```

### Pattern 3: Structured Expert Text for Embedding

Do not embed raw CSV rows. Construct a human-readable, semantically rich string per expert before embedding. This significantly improves retrieval quality because the embedding model aligns the document representation with how users ask questions.

```python
def expert_to_text(row: dict) -> str:
    return (
        f"Name: {row['name']}. "
        f"Title: {row['title']}. "
        f"Industry: {row['industry']}. "
        f"Skills: {row['skills']}. "
        f"Bio: {row['bio']}."
    )
```

### Pattern 4: Conversation History in Prompt, Not State

Do not maintain server-side session state. The React frontend tracks conversation history as an array and sends it with each request. The Prompt Builder incorporates the last N turns (default: 4) into the prompt. This keeps the backend stateless and horizontally scalable.

```python
class ChatRequest(BaseModel):
    query: str
    history: list[dict] = []  # [{"role": "user"|"model", "content": "..."}]
```

### Pattern 5: Decouple Retrieved Profiles from LLM Narrative

Return expert profiles as structured data alongside the LLM narrative in the API response. Do not ask the LLM to format expert data — it will hallucinate details. The LLM writes the connecting narrative; the metadata from retrieval populates the expert cards.

```json
{
  "answer": "Based on your interest in ML for fintech...",
  "experts": [
    { "id": 42, "name": "Jane Doe", "title": "ML Engineer", ... },
    { "id": 107, "name": "John Smith", "title": "Data Scientist", ... }
  ]
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Re-embedding the CSV on Every Server Start

**What:** Loading `experts.csv` at server startup, calling the embedding API each time.
**Why bad:** ~30-60 seconds startup time, costs API credits on every deploy, blocks requests during startup.
**Instead:** Pre-compute and persist the FAISS index to disk. Load the binary index file at startup (milliseconds).

### Anti-Pattern 2: Storing API Keys in Application Code or Committed Files

**What:** Hardcoding `GOOGLE_API_KEY` in source files or committing `.env` to git.
**Why bad:** Credential exposure, rotation requires code changes.
**Instead:** Load from environment variables via `python-dotenv` locally, and from platform secrets (Fly.io secrets, Railway env vars) in production. Add `.env` to `.gitignore` immediately.

### Anti-Pattern 3: Asking Gemini to Return Expert Data as JSON

**What:** Prompting the LLM to produce a JSON list of matching experts.
**Why bad:** LLMs hallucinate structured data — names, titles, skills will be fabricated or subtly wrong. JSON parsing will break on malformed output.
**Instead:** Retrieve expert data from FAISS (ground truth) and pass the structured metadata directly to the frontend. Let the LLM only write natural language narrative.

### Anti-Pattern 4: Single-Turn Prompts Without System Instructions

**What:** Sending only the user query to Gemini with no system prompt.
**Why bad:** The model has no persona, no constraints, no output format guidance. Responses will be generic and inconsistent.
**Instead:** Always include a system prompt that defines the assistant's role (expert matcher), tone (professional), output format (narrative + expert references), and what to do when no good match exists ("I couldn't find a strong match because...").

### Anti-Pattern 5: CORS Wildcard in Production

**What:** Setting `allow_origins=["*"]` in FastAPI CORS middleware for the deployed API.
**Why bad:** Allows any website to call your API, enabling abuse and credential theft if auth is added later.
**Instead:** Set `allow_origins` to the exact frontend domain in production. Use `["*"]` only in local development.

---

## Suggested Build Order

The following order reflects hard dependencies — each layer must exist before the next is useful.

```
1. Data pipeline (ingest.py)
   └─ Reason: Everything downstream depends on the FAISS index existing.
              Validate retrieval quality before building the API.

2. FastAPI skeleton + health endpoint
   └─ Reason: Establishes project structure, confirms server runs,
              testable immediately.

3. Embedding + retrieval service (embedder.py, retriever.py)
   └─ Reason: Core RAG logic. Must work correctly before adding LLM.
              Test with direct Python calls first.

4. Gemini LLM integration + prompt builder (llm.py)
   └─ Reason: Requires retriever output as input to prompt.
              Test response quality with hardcoded retrieved profiles first.

5. /api/chat endpoint (non-streaming first)
   └─ Reason: Wires services together into a real HTTP endpoint.
              Easier to debug than streaming during initial integration.

6. SSE streaming upgrade
   └─ Reason: Polish step. Non-streaming must be correct before adding
              streaming complexity.

7. React frontend — basic chat UI
   └─ Reason: Requires working API. Start with fetch-based non-streaming
              against the live dev server.

8. React frontend — streaming + expert cards
   └─ Reason: Requires streaming endpoint. Add EventSource consumption
              and expert card components.

9. Deployment configuration
   └─ Reason: Last because it requires all components to be stable.
```

---

## Scalability Considerations

| Concern | Current scale (1,600 profiles) | At 10K profiles | At 100K profiles |
|---------|-------------------------------|-----------------|------------------|
| Vector store | FAISS in-memory, ~5 MB | FAISS in-memory, ~30 MB — still fine | Migrate to ChromaDB or Qdrant |
| Embedding at build time | ~60s, ~16 API batches | ~6 min, ~100 batches | Consider async parallel batching |
| Retrieval latency | <10ms (FAISS brute force) | <50ms — still acceptable | Consider FAISS IVF index |
| LLM latency | 2-8s (dominant cost) | Same — LLM is bottleneck regardless | Streaming hides this; no change needed |
| Concurrency | FastAPI async handles well | Add Gunicorn workers or Uvicorn workers | Horizontal scaling |
| API rate limits (Google GenAI) | Build-time only concern | Build-time concern; add exponential backoff | Same |

---

## Technology Decisions (Architecture-Relevant)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Vector store | FAISS (faiss-cpu) | No external service, in-memory at this scale, fast cosine search |
| Embedding model | `text-embedding-004` (Google GenAI) | Same vendor as LLM, 768 dims, optimised for retrieval tasks |
| LLM | `gemini-1.5-flash` | Fast, cheap, sufficient quality; upgrade to Pro if response quality poor |
| API framework | FastAPI | Async-native, SSE support built-in, Pydantic validation, Python ecosystem |
| Frontend state | React useState + useReducer | Sufficient for conversation history; Zustand only if complexity grows |
| Frontend streaming | Native `EventSource` or `fetch` with `ReadableStream` | No library needed for SSE consumption |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| RAG pipeline structure | HIGH | Well-established pattern; FAISS + batch embedding is standard |
| FAISS at 1,600 profiles | HIGH | Trivially small; no concerns about performance or memory |
| Google GenAI embedding API | MEDIUM | API details (batch size limits, model names) based on training knowledge through Aug 2025; verify current limits in official docs |
| FastAPI SSE streaming | HIGH | Stable FastAPI feature, well-documented |
| Gemini model selection | MEDIUM | Model naming may have changed; verify current recommended model in Google AI Studio |
| React EventSource | HIGH | Standard browser API, no library needed |

---

## Sources

- Google GenAI Embeddings API: https://ai.google.dev/gemini-api/docs/embeddings (verify current model names and batch limits)
- FAISS: https://github.com/facebookresearch/faiss (stable library, IndexFlatIP for cosine on normalised vectors)
- FastAPI lifespan events: https://fastapi.tiangolo.com/advanced/events/ (startup/shutdown pattern)
- FastAPI StreamingResponse: https://fastapi.tiangolo.com/advanced/custom-response/#streamingresponse
- Gemini API (Python SDK): https://github.com/google-gemini/generative-ai-python
- RAG architecture patterns: established industry pattern (Lewis et al. 2020, "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks")
