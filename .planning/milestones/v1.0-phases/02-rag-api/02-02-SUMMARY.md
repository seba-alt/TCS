---
phase: 02-rag-api
plan: 02
subsystem: api
tags: [faiss, gemini, genai, retrieval, embeddings, llm, json-mode]

# Dependency graph
requires:
  - phase: 02-rag-api/02-01
    provides: embedder.py with embed_query() — used by retriever for query-time embedding
  - phase: 01-foundation
    provides: app/config.py with OUTPUT_DIM and FAISS index loaded into app.state
provides:
  - app/services/retriever.py — retrieve() for FAISS-based expert candidate search
  - app/services/llm.py — generate_response() for Gemini JSON-mode structured recommendations
  - RetrievedExpert dataclass with score and raw metadata
  - Expert and ChatResponse dataclasses matching API response schema
affects: [02-03-chat-endpoint, 02-04-sse-streaming]

# Tech tracking
tech-stack:
  added: [structlog (logging)]
  patterns: [lazy-genai-client, dual-confidence-check, exponential-backoff-retry, sliding-history-window]

key-files:
  created:
    - app/services/retriever.py
    - app/services/llm.py
  modified: []

key-decisions:
  - "SIMILARITY_THRESHOLD=0.65 chosen as conservative value — dual-check (score + LLM judgment) prevents over-triggering clarification path"
  - "GENERATION_MODEL=gemini-2.5-flash — not gemini-2.0-flash which is deprecated and shuts down June 2026"
  - "Lazy genai.Client() pattern from embedder.py applied to LLM service — no GOOGLE_API_KEY needed at import time"
  - "TOP_K=5 retrieval gives LLM room to skip low-quality matches while always providing 3 recommendations"
  - "Defensive _get() helper in retriever handles snake_case/space/TitleCase column variants from CSV"
  - "Retry strategy: MAX_RETRIES=3 with exponential backoff (1s, 2s, 4s) on Gemini API failure"
  - "HISTORY_WINDOW=3 turns (configurable) for multi-turn conversation context"

patterns-established:
  - "Lazy client: _client: genai.Client | None = None initialized on first call, never at import"
  - "Dual-confidence check: fast score threshold first, then LLM judgment for borderline cases"
  - "Column normalization: _get() helper tries multiple key variants to handle CSV column name uncertainty"
  - "Retry with exponential backoff: attempt 0->1s, 1->2s, 2->4s; raise RuntimeError after exhaustion"

requirements-completed: [REC-02]

# Metrics
duration: 1min
completed: 2026-02-20
---

# Phase 2 Plan 02: RAG Services Summary

**FAISS retriever returning up to 5 scored expert candidates and Gemini JSON-mode LLM service generating 3 ranked expert recommendations with retry and dual low-confidence detection**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-20T10:34:38Z
- **Completed:** 2026-02-20T10:35:50Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- retriever.py: embed_query + FAISS IndexFlatIP search returning up to TOP_K=5 RetrievedExpert candidates with scores; incomplete experts (missing name/title/company/hourly_rate) filtered out; profile_url missing is allowed
- llm.py: generate_response() calls gemini-2.5-flash with JSON mode (response_mime_type="application/json"); dual low-confidence path (score check first, then LLM judgment); exponential backoff retries; HISTORY_WINDOW=3 sliding context window
- Both services importable without GOOGLE_API_KEY set (lazy client pattern)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create retriever service** - `7551338` (feat)
2. **Task 2: Create LLM generation service with Gemini JSON mode** - `20cc602` (feat)

## Files Created/Modified

- `app/services/retriever.py` - FAISS-based expert candidate retrieval with embed_query, score filtering, incomplete-expert omission, and defensive column normalization
- `app/services/llm.py` - Gemini JSON-mode generation service with retry, dual confidence check, history windowing, and Expert/ChatResponse dataclasses

## Decisions Made

- GENERATION_MODEL set to gemini-2.5-flash (not deprecated gemini-2.0-flash) — plan explicitly flags shutdown June 2026
- Lazy client pattern from embedder.py applied identically — ensures both services can be imported in CI without API keys
- SIMILARITY_THRESHOLD=0.65 conservative threshold — dual-check prevents over-triggering clarification on borderline queries

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all verifications passed on first attempt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- retriever.py and llm.py are standalone service functions ready to be wired into the POST /api/chat route handler (Plan 03)
- Both services verified importable without API keys — safe for CI and testing
- Integration test (live FAISS search + Gemini call) deferred to Plan 03 when the endpoint is wired
- No blockers for Plan 03

---
*Phase: 02-rag-api*
*Completed: 2026-02-20*

## Self-Check: PASSED

- app/services/retriever.py: FOUND
- app/services/llm.py: FOUND
- Commit 7551338 (retriever): VERIFIED
- Commit 20cc602 (llm): VERIFIED
