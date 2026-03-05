---
phase: 01-foundation
plan: 02
subsystem: infra
tags: [python, faiss, google-genai, embedder, numpy, tenacity, ingestion]

# Dependency graph
requires:
  - phase: 01-01
    provides: ".gitignore, requirements.txt pinning google-genai==1.64.* and faiss-cpu==1.13.*"
provides:
  - app/config.py: OUTPUT_DIM=768 and EMBEDDING_MODEL=gemini-embedding-001 as single source of truth
  - app/services/embedder.py: embed_query() for runtime query embedding (reused by Phase 2 retriever)
  - scripts/ingest.py: offline CSV -> embeddings -> FAISS index + metadata JSON pipeline
  - data/faiss.index (generated on demand): binary FAISS IndexFlatIP on disk
  - data/metadata.json (generated on demand): position-aligned metadata array
affects:
  - 01-03 (FastAPI server will import embed_query from app.services.embedder)
  - Phase 2 (retriever imports embed_query directly)
  - All phases (OUTPUT_DIM=768 locked in config.py — changing requires full reindex)

# Tech tracking
tech-stack:
  added:
    - faiss-cpu==1.13.2 (installed during execution — was in requirements.txt but not yet installed)
    - FAISS IndexFlatIP (inner product with L2 normalization = cosine similarity)
    - tenacity retry with exponential backoff for embedding API 429 errors
    - numpy float32 arrays for FAISS vector storage
  patterns:
    - Lazy client initialization: genai.Client() deferred to first call so module imports without API key
    - Task type asymmetry: RETRIEVAL_DOCUMENT for indexing, RETRIEVAL_QUERY for runtime queries
    - L2 normalization required on truncated 768-dim vectors (not pre-normalized by Google)
    - Absolute path constants in config.py to avoid CWD-relative path failures
    - sys.path.insert(0, ...) in scripts/ for app package imports without installation

key-files:
  created:
    - app/__init__.py
    - app/config.py
    - app/services/__init__.py
    - app/services/embedder.py
    - scripts/ingest.py
  modified: []

key-decisions:
  - "Lazy genai.Client() initialization in embedder.py: deferred to first call so module is importable without GOOGLE_API_KEY set (critical for testing and CI)"
  - "L2 normalization required before all FAISS operations: truncated 768-dim vectors are NOT pre-normalized by Google; both ingest.py and embedder.py call faiss.normalize_L2()"
  - "Task type asymmetry enforced: RETRIEVAL_DOCUMENT for ingest batch, RETRIEVAL_QUERY for runtime embed_query() — using wrong type degrades retrieval quality"

patterns-established:
  - "Config-first: shared constants (OUTPUT_DIM, EMBEDDING_MODEL) imported from app.config — never hardcoded in downstream modules"
  - "Offline-only ingestion: scripts/ingest.py must NEVER be called at API startup; index built once and loaded on startup"
  - "Batch + retry pattern: embed_batch() wraps API calls with tenacity for production-grade rate limit handling"

requirements-completed:
  - REC-01

# Metrics
duration: 3min
completed: 2026-02-20
---

# Phase 1 Plan 02: Embedder Service and FAISS Ingestion Pipeline Summary

**gemini-embedding-001 embedder service with lazy client init, 768-dim L2-normalized FAISS IndexFlatIP, and offline ingestion pipeline with tenacity retry**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-20T09:50:22Z
- **Completed:** 2026-02-20T09:53:02Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- app/config.py established as single source of truth for OUTPUT_DIM=768 and EMBEDDING_MODEL=gemini-embedding-001; all downstream code imports constants rather than hardcoding
- app/services/embedder.py provides embed_query() with lazy genai.Client() initialization so it imports cleanly without GOOGLE_API_KEY set; returns L2-normalized 768-dim vector
- scripts/ingest.py implements full offline pipeline: CSV load (utf-8-sig) -> batch embed with RETRIEVAL_DOCUMENT task type -> L2 normalize -> FAISS IndexFlatIP -> write index + metadata JSON; tenacity handles 429 rate limit retries
- faiss-cpu==1.13.2 installed into environment (was pinned in requirements.txt, not yet installed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create app/config.py and app/services/embedder.py** - `7824f4f` (feat)
2. **Task 2: Create ingest.py and run ingestion** - `ce61ab2` (feat)

**Plan metadata:** (to be added in final commit)

## Files Created/Modified

- `app/__init__.py` - Package init (empty)
- `app/config.py` - OUTPUT_DIM=768, EMBEDDING_MODEL, INGEST_BATCH_SIZE, FAISS_INDEX_PATH, METADATA_PATH constants
- `app/services/__init__.py` - Package init (empty)
- `app/services/embedder.py` - embed_query(text) -> list[float]: lazy client, RETRIEVAL_QUERY task type, L2 normalized
- `scripts/ingest.py` - Offline ingestion: CSV -> batch embeddings -> FAISS IndexFlatIP + metadata JSON

## Decisions Made

- **Lazy client initialization:** genai.Client() moved from module-level to _get_client() helper so embedding module can be imported without GOOGLE_API_KEY. This is critical for testability and CI pipelines.
- **L2 normalization in both paths:** ingest.py normalizes before adding to FAISS; embedder.py normalizes at query time. Both required because 768-dim truncated vectors are not pre-normalized by the Google API.
- **Task type asymmetry enforced:** RETRIEVAL_DOCUMENT for batch ingest (better indexing signal), RETRIEVAL_QUERY for runtime embed_query (better retrieval signal). Plan explicitly documented this and code follows it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Lazy genai.Client() initialization in embedder.py**
- **Found during:** Task 1 (verification step — import check)
- **Issue:** Plan specified `_client = genai.Client()` at module level. The google-genai SDK raises `ValueError: Missing key inputs argument!` on Client() construction if GOOGLE_API_KEY is not set in the environment. This caused the import check `python -c "from app.services.embedder import embed_query"` to fail, breaking the plan's own verification criterion.
- **Fix:** Moved client construction into a `_get_client()` lazy initializer. `_client` is now `None` at import time and constructed on first call to embed_query().
- **Files modified:** app/services/embedder.py
- **Verification:** `python -c "from app.services.embedder import embed_query; print('import OK')"` succeeds without GOOGLE_API_KEY
- **Committed in:** 7824f4f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix — lazy initialization)
**Impact on plan:** Required for the plan's own import verification to pass. No scope creep; behavior at runtime with API key set is identical.

## Issues Encountered

- faiss-cpu was pinned in requirements.txt from Plan 01 but not installed in the environment. Installed during Task 1 verification (`pip3 install "faiss-cpu==1.13.*"`). This is a normal dev environment bootstrap, not a code issue.

## User Setup Required

**External service requires configuration before embed_query() and ingest.py can make real API calls.**

To run ingestion and enable runtime embeddings, add to `.env`:
```
GOOGLE_API_KEY=<your-key-from-aistudio.google.com>
```

Then place `data/experts.csv` and run:
```bash
python scripts/ingest.py
```

Verify:
```bash
python -c "import faiss; idx = faiss.read_index('data/faiss.index'); assert idx.d == 768; print(f'FAISS OK: {idx.ntotal} vectors')"
```

## Next Phase Readiness

- embed_query() importable and ready for Phase 2 retriever to use
- ingest.py ready to run the moment experts.csv and GOOGLE_API_KEY are provided
- FAISS index and metadata JSON will be generated then — Phase 2 FastAPI server can load them on startup
- No blockers for Plan 01-03 (FastAPI server scaffold); it does not require the index to exist yet

---
*Phase: 01-foundation*
*Completed: 2026-02-20*

## Self-Check: PASSED

- FOUND: app/__init__.py
- FOUND: app/config.py
- FOUND: app/services/__init__.py
- FOUND: app/services/embedder.py
- FOUND: scripts/ingest.py
- FOUND: .planning/phases/01-foundation/01-02-SUMMARY.md
- FOUND: 7824f4f (Task 1 commit — feat: config.py and embedder service)
- FOUND: ce61ab2 (Task 2 commit — feat: offline ingestion pipeline)
