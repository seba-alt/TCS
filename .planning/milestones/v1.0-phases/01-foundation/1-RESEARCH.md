# Phase 1: Foundation - Research

**Researched:** 2026-02-20
**Domain:** Python RAG backend scaffold — CSV ingestion, FAISS index, FastAPI health endpoint, secrets management
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REC-01 | Backend embeds the user's query using Google GenAI (`text-embedding-004`) and semantically searches the expert CSV database | CRITICAL UPDATE: `text-embedding-004` was shut down January 14, 2026. Use `gemini-embedding-001` instead. Embedding API, FAISS index construction, and FastAPI lifespan singleton all researched and verified. |
</phase_requirements>

---

## Summary

Phase 1 builds the foundation everything else depends on: a pre-computed FAISS index of expert embeddings on disk and a running FastAPI server that loads it at startup. The work is almost entirely well-documented, standard Python patterns — except for one critical breaking change that prior research missed.

**Breaking change discovered during research:** `text-embedding-004` was shut down on January 14, 2026 (the prior research's stated cutoff was August 2025, so this happened after). The replacement is `gemini-embedding-001`, which outputs 3072-dimensional vectors by default but can be truncated to 768 at ~0.26% quality loss. This changes the FAISS index dimensionality from 768 to 768 (if truncated) or 3072 (if using defaults). The choice affects index size on disk and RAM. Similarly, `gemini-2.0-flash` is deprecated (shutdown June 2026); Phase 1 does not call the LLM, but Phase 2 must use `gemini-2.5-flash` instead.

Beyond the model updates, the stack is stable: `google-genai` 1.64.0 is the active SDK (confirmed on PyPI), FastAPI 0.129.0 is current, faiss-cpu 1.13.2 is actively maintained. The FastAPI lifespan singleton pattern for loading FAISS at startup is the current recommended pattern per official FastAPI docs. All secrets must live only in `.env` (gitignored) locally and in Railway environment variables in production — the SDK picks up either `GOOGLE_API_KEY` or `GEMINI_API_KEY` automatically from the environment; use `GOOGLE_API_KEY` to match the project's existing naming.

**Primary recommendation:** Use `gemini-embedding-001` with `output_dimensionality=768` (not the 3072 default) — 25% of the storage cost with only 0.26% quality loss. Build the FAISS index offline with `scripts/ingest.py`, persist as `data/faiss.index` + `data/metadata.json`, load at startup via lifespan singleton. Keep `GOOGLE_API_KEY` off the frontend and out of git history from day one.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `google-genai` | `^1.64` (PyPI latest) | Gemini embedding API calls | Google's current active SDK; `google-generativeai` is deprecated. Active development, version 1.64.0 released February 19, 2026. |
| `faiss-cpu` | `^1.13.2` | In-memory vector index, persisted to disk | Compiled C++ with SIMD (AVX2/AVX-512) — faster than NumPy for brute-force search. Reads/writes binary index files natively. Actively maintained (Dec 2025 release). |
| `pandas` | `^2.2` | CSV ingestion and column selection | Standard library for CSV-to-DataFrame pipelines. |
| `numpy` | `^1.26` or `^2.0` | Float32 array manipulation for FAISS | FAISS requires `np.float32` arrays; NumPy is a hard dependency. |
| `FastAPI` | `^0.129` | API server with lifespan management | Async-native, built-in CORS middleware, Pydantic v2 integration. 0.129.0 released Feb 12, 2026. |
| `uvicorn[standard]` | `^0.29` | ASGI server | Required to run FastAPI. `[standard]` includes `httptools` and `uvloop` for performance. |
| `pydantic` | `v2` (`^2.7`) | Request/response validation, schema models | Bundled with FastAPI 0.100+; Pydantic v2 is faster than v1. |
| `python-dotenv` | `^1.0` | Load `.env` in local development | Standard for loading env vars in dev; never used in production (Railway injects directly). |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tenacity` | `^8.4` | Retry + exponential backoff | Wrap embedding API calls — rate limit 429s happen during batch ingestion of 1,600 rows. |
| `structlog` | `^24.2` | Structured JSON logging | Railway's log viewer parses JSON logs. Use from Phase 1 onward for consistent observability. |
| `chardet` | `^5.2` | CSV encoding detection | Detect non-UTF-8 CSVs (Windows-1252, BOM). Use if initial `pd.read_csv()` throws UnicodeDecodeError. |
| `ruff` | latest | Linter + formatter | Fast, replaces black + flake8. Use as dev dependency. |
| `pytest` | `^8.2` | Test runner | Phase 1 verification: test that `ingest.py` produces a valid index. |
| `pytest-asyncio` | `^0.23` | Async test support | Required for testing async FastAPI routes. |
| `httpx` | `^0.27` | Async HTTP test client | `httpx.AsyncClient` with `ASGITransport` for FastAPI integration tests. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `faiss-cpu` | NumPy cosine similarity | NumPy is simpler (no C++ compilation) but FAISS is faster (SIMD optimizations) and persists binary files natively. Prior research flip-flopped — FAISS wins for Phase 1 because disk persistence is a first-class requirement. |
| `faiss-cpu` | ChromaDB | ChromaDB adds persistent storage complexity; doesn't survive Railway ephemeral container restarts without a mounted volume. Overkill for 1,600 profiles. |
| `gemini-embedding-001` at 3072 dims | 768 dims (truncated) | Default 3072 dims = ~18 MB index; 768 dims = ~4.7 MB index. Quality loss is 0.26% at 768 dims. Use 768 — it matches the prior architecture and saves memory. Note: non-3072 truncated dims require explicit L2 normalization before FAISS IndexFlatIP search. |

**Installation:**

```bash
# Create virtual environment
python -m venv .venv && source .venv/bin/activate

# Core backend
pip install \
  "fastapi[standard]==0.129.*" \
  "uvicorn[standard]==0.29.*" \
  "pydantic==2.7.*" \
  "google-genai==1.64.*" \
  "faiss-cpu==1.13.*" \
  "pandas==2.2.*" \
  "numpy==1.26.*" \
  "python-dotenv==1.0.*" \
  "tenacity==8.4.*" \
  "structlog==24.2.*"

# Dev dependencies
pip install \
  "pytest==8.2.*" \
  "pytest-asyncio==0.23.*" \
  "httpx==0.27.*" \
  "ruff"

# Freeze
pip freeze > requirements.txt
```

---

## Architecture Patterns

### Recommended Project Structure

```
/                           # repo root
├── scripts/
│   ├── ingest.py           # CSV → embeddings → FAISS index (run offline, NOT at API startup)
│   └── validate_csv.py     # CSV quality check (run before ingest.py)
├── app/
│   ├── main.py             # FastAPI app, lifespan, CORS, mounts routers
│   ├── routers/
│   │   └── health.py       # GET /api/health
│   └── services/
│       └── embedder.py     # wraps google-genai embed_content (used by ingest + future chat)
├── data/
│   ├── experts.csv         # source of truth — gitignored
│   ├── faiss.index         # binary FAISS index — gitignored (generated by ingest.py)
│   └── metadata.json       # position-aligned metadata array — gitignored
├── .env                    # local secrets — gitignored
├── .gitignore
├── requirements.txt
└── Procfile                # web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### Pattern 1: Lifespan-Managed FAISS Singleton

Load the FAISS index and metadata once at startup using the `@asynccontextmanager` lifespan pattern. Store on `app.state`. This is the current FastAPI-recommended approach (replaces deprecated `@app.on_event("startup")`).

```python
# app/main.py
# Source: https://fastapi.tiangolo.com/advanced/events/
from contextlib import asynccontextmanager
from fastapi import FastAPI
import faiss
import json
import numpy as np
import structlog

log = structlog.get_logger()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---
    log.info("Loading FAISS index...")
    app.state.faiss_index = faiss.read_index("data/faiss.index")
    with open("data/metadata.json", "r") as f:
        app.state.metadata = json.load(f)
    log.info("FAISS index loaded", vectors=app.state.faiss_index.ntotal)
    yield
    # --- Shutdown (nothing to clean up for in-memory FAISS) ---

app = FastAPI(lifespan=lifespan)
```

**Route handlers access state via `request.app.state`:**

```python
# app/routers/health.py
from fastapi import APIRouter, Request

router = APIRouter()

@router.get("/api/health")
async def health(request: Request):
    index = request.app.state.faiss_index
    return {
        "status": "ok",
        "index_vectors": index.ntotal,
    }
```

### Pattern 2: Offline Ingestion Script (ingest.py)

The ingestion script is a one-off build step, not part of the API server. It runs locally (or in CI), writes `data/faiss.index` and `data/metadata.json`, and exits. The API server only reads these files.

```python
# scripts/ingest.py
# Source: https://ai.google.dev/gemini-api/docs/embeddings
import pandas as pd
import numpy as np
import faiss
import json
from google import genai
from google.genai import types

client = genai.Client()  # picks up GOOGLE_API_KEY from environment

EMBEDDING_MODEL = "gemini-embedding-001"
OUTPUT_DIM = 768          # Truncate from 3072; 0.26% quality loss, 75% storage savings
BATCH_SIZE = 100          # Respect API limits

def expert_to_text(row: dict) -> str:
    """Construct semantically rich text for embedding — don't embed raw CSV rows."""
    return (
        f"{row['title']} at {row['company']}. "
        f"Industry: {row.get('industry', '')}. "
        f"{row.get('bio', '')[:300]}"
    )

def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts. Returns list of OUTPUT_DIM-length float vectors."""
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=texts,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_DOCUMENT",
            output_dimensionality=OUTPUT_DIM,
        ),
    )
    return [e.values for e in result.embeddings]

def build_index(df: pd.DataFrame) -> tuple[faiss.IndexFlatIP, list[dict]]:
    all_vectors = []
    metadata = []

    for i in range(0, len(df), BATCH_SIZE):
        batch = df.iloc[i:i + BATCH_SIZE]
        texts = [expert_to_text(row) for _, row in batch.iterrows()]
        vectors = embed_batch(texts)
        all_vectors.extend(vectors)
        for _, row in batch.iterrows():
            metadata.append(row.to_dict())
        print(f"Embedded {min(i + BATCH_SIZE, len(df))}/{len(df)} experts")

    # L2-normalize: required for cosine similarity via IndexFlatIP when using truncated dims
    matrix = np.array(all_vectors, dtype=np.float32)
    faiss.normalize_L2(matrix)

    index = faiss.IndexFlatIP(OUTPUT_DIM)
    index.add(matrix)
    return index, metadata

if __name__ == "__main__":
    df = pd.read_csv("data/experts.csv", encoding="utf-8-sig")
    index, metadata = build_index(df)
    faiss.write_index(index, "data/faiss.index")
    with open("data/metadata.json", "w") as f:
        json.dump(metadata, f)
    print(f"Index built: {index.ntotal} vectors at {OUTPUT_DIM} dims")
```

**Note on normalization:** The Google docs state that 3072-dim `gemini-embedding-001` vectors are already normalized, but truncated dimensions (768, 1536) require explicit L2 normalization before using `IndexFlatIP`. Always call `faiss.normalize_L2()` before adding vectors.

### Pattern 3: Structured Expert Text for Embedding

Do not embed raw CSV row strings. Weight the embedding text by field importance. Title and company carry more retrieval signal than a long bio.

```python
def expert_to_text(row: dict) -> str:
    # Title and specialization carry the most signal
    # Bio is truncated to 300 chars to prevent long bios dominating the embedding
    return (
        f"{row['title']} at {row['company']}. "
        f"Industry: {row.get('industry', '')}. "
        f"{row.get('bio', '')[:300]}"
    )
```

### Pattern 4: CORS Middleware (Configure Before Routes)

```python
# app/main.py — add before route definitions
# Source: https://fastapi.tiangolo.com/tutorial/cors/
import os
from fastapi.middleware.cors import CORSMiddleware

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,   # NEVER ["*"] in production
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
```

Use `ALLOWED_ORIGINS` environment variable (comma-separated) so Railway can inject the Vercel URL without a code change.

### Pattern 5: Environment Variable Strategy

```python
# app/main.py (or app/config.py)
from dotenv import load_dotenv
import os

load_dotenv()  # No-op in production (Railway injects vars); loads .env in local dev

# google-genai SDK picks up GOOGLE_API_KEY automatically — no need to pass explicitly
# client = genai.Client()  ← works if GOOGLE_API_KEY or GEMINI_API_KEY is set
```

```
# .env (local dev only — gitignored)
GOOGLE_API_KEY=your_key_here
ALLOWED_ORIGINS=http://localhost:5173
```

```
# .gitignore (must exist before first commit)
.env
.env.*
data/faiss.index
data/metadata.json
data/experts.csv
```

### Pattern 6: Embedder Service (Reusable in Phase 2)

```python
# app/services/embedder.py
from google import genai
from google.genai import types

client = genai.Client()

EMBEDDING_MODEL = "gemini-embedding-001"
OUTPUT_DIM = 768

def embed_query(text: str) -> list[float]:
    """Embed a single query string for retrieval at runtime."""
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_QUERY",   # Different task_type from RETRIEVAL_DOCUMENT
            output_dimensionality=OUTPUT_DIM,
        ),
    )
    return result.embeddings[0].values
```

Note the asymmetry: indexing uses `RETRIEVAL_DOCUMENT`, query-time uses `RETRIEVAL_QUERY`. Using the wrong task type degrades retrieval quality.

### Anti-Patterns to Avoid

- **Embedding at API startup:** Never call the Google embedding API during FastAPI startup. It costs 16+ API batches, takes 60+ seconds, and will timeout Railway's health check. Startup must only call `faiss.read_index()` (milliseconds).
- **`@app.on_event("startup")` decorator:** This is deprecated in FastAPI 0.90+. Use the `lifespan` parameter with `@asynccontextmanager` instead.
- **Committing `.env` before `.gitignore` is in place:** The gitignore file must exist before the first `git add`. If `.env` ever enters git history, key rotation alone is insufficient — history must be purged with `git filter-branch` or `bfg-repo-cleaner`.
- **Using `VITE_GOOGLE_API_KEY` anywhere:** The `VITE_` prefix means "embed in browser bundle." The API key must never be in the frontend.
- **Using `["*"]` in production CORS:** Allows any website to call the API. Use explicit origins only.
- **Hardcoding `data/` paths:** Use `pathlib.Path(__file__).parent.parent / "data"` or an env var to locate data files — avoids path breakage when the server process CWD differs from repo root.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Vector similarity search | Custom numpy dot-product loop | `faiss-cpu` IndexFlatIP | FAISS handles SIMD optimizations, L2 normalization, binary persistence, and `k` nearest-neighbor search. The hand-rolled version misses hardware acceleration. |
| API retry / backoff | `time.sleep()` loops | `tenacity` | Exponential backoff with jitter, max retries, exception filtering — embedding 1,600 rows will hit 429s without proper backoff. |
| CSV encoding detection | `try/except` around multiple encodings | `chardet` + `encoding="utf-8-sig"` | `utf-8-sig` handles BOM; `chardet` handles Windows-1252. Two lines replace a fragile manual approach. |
| CORS middleware | Custom response headers | FastAPI `CORSMiddleware` | Handles preflight OPTIONS requests, wildcard patterns, credential handling. Middleware is one `add_middleware()` call. |
| Structured JSON logging | `print()` / `logging.basicConfig()` | `structlog` | Railway log viewer expects JSON lines. `structlog` outputs JSON with zero configuration after initial setup. |

**Key insight:** Phase 1 components are almost all "plumbing" — FAISS, FastAPI, and `google-genai` handle the hard parts. The planner's job is wiring them together correctly, not building alternatives.

---

## Common Pitfalls

### Pitfall 1: `text-embedding-004` is Shut Down (Breaking)
**What goes wrong:** Any code that calls `text-embedding-004` will receive an API error. The model was shut down January 14, 2026.
**Why it happens:** Prior research (August 2025 cutoff) documented `text-embedding-004` as the current model.
**How to avoid:** Use `gemini-embedding-001` with `output_dimensionality=768`. Do not reference `text-embedding-004` anywhere in code, comments, or documentation.
**Warning signs:** `google.genai.errors.ClientError: 404 Model not found` or similar when calling the embedding API.

### Pitfall 2: 3072 vs 768 Dimension Mismatch
**What goes wrong:** `gemini-embedding-001` outputs 3072-dim vectors by default. The FAISS index is built with dimension D. At query time, the query vector must be the same dimension as the index. If `ingest.py` uses 3072 but `embedder.py` uses 768 (or vice versa), FAISS raises a dimension error.
**Why it happens:** Developers set `output_dimensionality` in one place but forget to set it consistently everywhere.
**How to avoid:** Define `OUTPUT_DIM = 768` as a single constant (e.g., in `app/config.py`) imported by both `scripts/ingest.py` and `app/services/embedder.py`.
**Warning signs:** `AssertionError: query dimension 768 != index dimension 3072` at runtime.

### Pitfall 3: L2 Normalization Required for Truncated Dimensions
**What goes wrong:** `IndexFlatIP` computes inner product, which equals cosine similarity only on L2-normalized vectors. At 3072 dims, Google pre-normalizes the vectors. At 768 dims (truncated), they are NOT pre-normalized — raw inner product will not equal cosine similarity, and retrieval quality degrades silently.
**Why it happens:** Documentation notes normalization is built-in only at full 3072 dims.
**How to avoid:** Always call `faiss.normalize_L2(matrix)` before `index.add(matrix)` during ingestion, and `faiss.normalize_L2(query_vector)` before `index.search()` at query time.
**Warning signs:** Top-K results are plausible but ranked wrong; manual similarity checks don't match FAISS rankings.

### Pitfall 4: API Key in Git History
**What goes wrong:** `.env` gets committed before `.gitignore` is configured.
**Why it happens:** Developer runs `git add .` before adding `.gitignore`.
**How to avoid:** Create `.gitignore` with `.env` in it as the very first commit, before any other files.
**Warning signs:** `git status` shows `.env` as an untracked file without the gitignored indicator.

### Pitfall 5: CORS Blocking at Deploy Time
**What goes wrong:** FastAPI runs on Railway, React on Vercel. Without CORS middleware, 100% of browser API calls fail with a CORS error. The error appears in the browser console, not FastAPI logs.
**Why it happens:** Local dev uses the same origin (`localhost`) so CORS never fires. The issue is invisible until deploy.
**How to avoid:** Add `CORSMiddleware` in Phase 1 backend scaffold, before writing any routes. Use an `ALLOWED_ORIGINS` env var so the Vercel URL can be injected without a code change.
**Warning signs:** API works in Postman/curl but fails in the browser with "blocked by CORS policy."

### Pitfall 6: CSV Data Quality Breaks Embedding
**What goes wrong:** Empty bios produce near-zero embeddings that match everything weakly. Malformed URLs break clickable cards in Phase 3. Rate fields in mixed formats appear as `$NaN/hr`.
**Why it happens:** CSV data is never clean on first inspection.
**How to avoid:** Run `scripts/validate_csv.py` as the absolute first action in Phase 1 — before any embedding. Assert required columns, flag empty bios, validate `profile_url` patterns, normalize rate format.
**Warning signs:** `pandas` encoding errors on load; `$NaN/hr` in rendered cards; 404s on profile links.

### Pitfall 7: Hardcoded Data File Paths
**What goes wrong:** `faiss.read_index("data/faiss.index")` fails when uvicorn is launched from a directory other than the repo root, because `data/` is resolved relative to the CWD.
**Why it happens:** Relative paths are CWD-dependent; process CWD is not always the repo root.
**How to avoid:** Use `pathlib.Path(__file__).resolve().parent.parent / "data" / "faiss.index"` or read the path from an environment variable.
**Warning signs:** `FileNotFoundError: data/faiss.index` at startup in environments that work fine locally.

---

## Code Examples

Verified patterns from official sources:

### Embedding API Call (google-genai 1.x)

```python
# Source: https://ai.google.dev/gemini-api/docs/embeddings
from google import genai
from google.genai import types

client = genai.Client()  # reads GOOGLE_API_KEY or GEMINI_API_KEY from env

# Batch embed multiple documents
result = client.models.embed_content(
    model="gemini-embedding-001",
    contents=["Expert bio text 1", "Expert bio text 2"],
    config=types.EmbedContentConfig(
        task_type="RETRIEVAL_DOCUMENT",
        output_dimensionality=768,     # Truncated from 3072; normalize manually
    ),
)
# result.embeddings is a list of ContentEmbedding objects
vectors = [e.values for e in result.embeddings]  # list[list[float]]
```

### FAISS Index Build and Persist

```python
# Source: https://github.com/facebookresearch/faiss
import numpy as np
import faiss

dim = 768  # must match output_dimensionality above

# Build
matrix = np.array(vectors, dtype=np.float32)
faiss.normalize_L2(matrix)  # required for cosine similarity on truncated dims
index = faiss.IndexFlatIP(dim)
index.add(matrix)

# Persist
faiss.write_index(index, "data/faiss.index")
```

### FAISS Index Load at Startup

```python
# Source: https://fastapi.tiangolo.com/advanced/events/
import faiss
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.faiss_index = faiss.read_index("data/faiss.index")
    with open("data/metadata.json") as f:
        app.state.metadata = json.load(f)
    yield

app = FastAPI(lifespan=lifespan)
```

### Health Endpoint

```python
# app/routers/health.py
from fastapi import APIRouter, Request

router = APIRouter()

@router.get("/api/health")
async def health(request: Request):
    index = request.app.state.faiss_index
    return {
        "status": "ok",
        "index_size": index.ntotal,
    }
```

### Direct Python Verification of Embedder (Success Criterion 4)

```python
# Verify embedder returns 768-dim vector — run directly, not via HTTP
from app.services.embedder import embed_query

vector = embed_query("I need an ML engineer for my startup")
assert len(vector) == 768, f"Expected 768, got {len(vector)}"
print(f"Embedder OK: {len(vector)}-dim vector")
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `text-embedding-004` (768 dim) | `gemini-embedding-001` (768 dim truncated, or 3072 default) | Jan 14, 2026 — shutdown | Must use `output_dimensionality=768` in config; add `faiss.normalize_L2()` call |
| `gemini-2.0-flash` | `gemini-2.5-flash` | Deprecated mid-2025, shutdown June 2026 | Phase 2 must use `gemini-2.5-flash` model string |
| `@app.on_event("startup")` | `lifespan` + `@asynccontextmanager` | FastAPI 0.90+ (2023) | The old decorator is deprecated and removed in recent FastAPI versions |
| `google-generativeai` SDK | `google-genai` SDK | Mid-2024 | Entirely different import path: `from google import genai` |
| `google-generativeai` env var | `GOOGLE_API_KEY` (or `GEMINI_API_KEY`) | With new SDK | Both accepted; `GOOGLE_API_KEY` takes precedence if both set |

**Deprecated/outdated:**
- `text-embedding-004`: Shut down January 14, 2026. Do not use.
- `gemini-2.0-flash`: Deprecated. Shutdown June 1, 2026. Do not start new code with this model.
- `@app.on_event("startup")`: Deprecated in FastAPI. Use `lifespan` parameter.
- `google-generativeai` package: Deprecated by Google in favor of `google-genai`.

---

## Open Questions

1. **CSV column names unknown**
   - What we know: The CSV has ~1,600 expert profiles with fields including name, title, company, bio, hourly_rate, and profile_url (per REQUIREMENTS.md and prior research assumptions).
   - What's unclear: The actual CSV column header names, encoding, and data quality are unknown until the file is opened. Missing or differently-named columns would require changes to `ingest.py`.
   - Recommendation: Make `validate_csv.py` the absolute first task in Phase 1. It should print column names and sample data before any other work proceeds.

2. **Batch size limit for `gemini-embedding-001`**
   - What we know: The Google Embeddings cookbook shows passing a list to `embed_content`, and the prior architecture notes say 100 items per batch. The official docs only state a 2,048 token input limit per item, not a per-batch item count limit.
   - What's unclear: Whether 100 items per `contents` list is a hard limit or a conservative guideline.
   - Recommendation: Start with batches of 100 items as the architecture recommends. Monitor for 429 errors during ingestion; `tenacity` handles retries automatically.

3. **`gemini-embedding-001` free tier rate limits**
   - What we know: Free tier for generation models is 15 RPM / 1,500 RPD. Embedding models may differ.
   - What's unclear: Exact RPM/RPD limits for `gemini-embedding-001` on the free tier.
   - Recommendation: Add `tenacity` with exponential backoff from day one. If ingestion is rate-limited, add a `time.sleep(1)` between batches as a simple throttle while backoff is triggered.

---

## Sources

### Primary (HIGH confidence)

- **PyPI: google-genai 1.64.0** — https://pypi.org/project/google-genai/ — Confirmed active SDK, released Feb 19, 2026
- **PyPI: faiss-cpu 1.13.2** — https://pypi.org/project/faiss-cpu/ — Confirmed active, released Dec 2025
- **PyPI: FastAPI 0.129.0** — https://pypi.org/project/fastapi/ — Confirmed current version, released Feb 12, 2026
- **Google AI deprecations page** — https://ai.google.dev/gemini-api/docs/deprecations — Confirmed `text-embedding-004` shut down Jan 14, 2026; `gemini-2.0-flash` deprecated (shutdown June 2026)
- **Google AI embeddings docs** — https://ai.google.dev/gemini-api/docs/embeddings — Confirmed `gemini-embedding-001`, task_types, output_dimensionality parameter, method signature
- **Google AI models page** — https://ai.google.dev/gemini-api/docs/models — Confirmed `gemini-2.5-flash` is current stable production model
- **FastAPI lifespan docs** — https://fastapi.tiangolo.com/advanced/events/ — Confirmed `@asynccontextmanager` lifespan pattern, `app.state` storage

### Secondary (MEDIUM confidence)

- **Google Gemini Embeddings cookbook** — https://github.com/google-gemini/cookbook/blob/main/quickstarts/Embeddings.ipynb — Batch embedding example using `contents=[]` list
- **FAISS GitHub issues** — https://github.com/facebookresearch/faiss/issues/95 — Confirmed IndexFlatIP + L2 normalization = cosine similarity; normalization must be done manually
- **Google deprecation blog post** — https://developers.googleblog.com/gemini-embedding-available-gemini-api/ — 768 dim at 0.26% quality loss vs 3072, normalization requirement for truncated dims

### Tertiary (LOW confidence)

- **Community reports on `text-embedding-004` deprecation** — https://community.n8n.io/t/google-deprecating-text-embedding-004-but-gemini-embedding-001-doesnt-work/262008 — Real-world breakage reports; aligns with deprecation page
- **Medium article on NumPy vs FAISS** — https://medium.com/@asifali1090/scaling-vector-search-for-ai-tutors-numpy-vs-faiss-flatl2-hnsw-a4f426a186f1 — FAISS SIMD advantages over NumPy brute-force; directional, not benchmarked against this specific dataset

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All versions verified against PyPI (google-genai 1.64.0, faiss-cpu 1.13.2, FastAPI 0.129.0) on 2026-02-20
- Architecture: HIGH — FastAPI lifespan singleton and FAISS read/write patterns verified against official docs
- Embedding model: HIGH — `text-embedding-004` shutdown confirmed from official deprecations page; `gemini-embedding-001` confirmed as replacement
- LLM model (Phase 2 preview): HIGH — `gemini-2.0-flash` deprecation and `gemini-2.5-flash` replacement confirmed
- Pitfalls: MEDIUM — Normalization requirement for truncated dims confirmed from official docs + community reports; batch size limits are LOW confidence (official docs don't state a per-call item count limit)

**Research date:** 2026-02-20
**Valid until:** 2026-03-22 (30 days — model availability changes quickly; re-verify embedding model before Phase 2)
