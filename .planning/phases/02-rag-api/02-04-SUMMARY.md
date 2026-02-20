---
phase: 02-rag-api
plan: "04"
subsystem: chat-endpoint
tags: [fastapi, sse, streaming, server-sent-events, streamingresponse, faiss, gemini, sqlite]

# Dependency graph
requires:
  - "02-03"  # Non-streaming POST /api/chat endpoint that this upgrades
  - "02-02"  # retrieve() + generate_response() services (unchanged)
provides:
  - "POST /api/chat as SSE StreamingResponse with status:thinking event before result"
  - "text/event-stream Content-Type on chat endpoint"
  - "Streaming expert recommendations verified end-to-end by human"
affects:
  - "03-frontend"  # Frontend must consume SSE stream (not plain JSON)

# Tech tracking
tech-stack:
  added:
    - "fastapi.responses.StreamingResponse"
    - "asyncio.get_event_loop().run_in_executor() for sync-in-async offload"
  patterns:
    - "SSE generator pattern: yield thinking → await work → yield result → yield done"
    - "run_in_executor() wrapping sync services (embed_query, generate_content) to avoid blocking event loop"
    - "_sse() helper formatting dicts as SSE data lines"
    - "Pydantic validation runs synchronously before streaming begins — 422 before any SSE events"

key-files:
  created: []
  modified:
    - app/routers/chat.py

key-decisions:
  - "StreamingResponse with media_type='text/event-stream' replaces JSONResponse — response_model removed from @router.post decorator since StreamingResponse bypasses Pydantic serialization"
  - "Sync services (embed_query, generate_content) offloaded via run_in_executor to avoid blocking asyncio event loop during SSE streaming"
  - "Cache-Control: no-cache and X-Accel-Buffering: no headers added to prevent Railway/nginx proxy buffering"
  - "thinking event emitted before any thread pool work begins — guarantees sub-100ms first event latency"
  - "SIMILARITY_THRESHOLD lowered from 0.65 to 0.60 and metadata key names corrected in retriever (fix committed separately as fix(retriever))"

patterns-established:
  - "SSE event sequence: status=thinking → result (full payload) → done (always)"
  - "Error path still emits done event in finally block — clients can always rely on done to close connection"

requirements-completed: [REC-02]

# Metrics
duration: "~7 min (includes human verification)"
completed: "2026-02-20"
tasks_completed: 2
files_changed: 1
---

# Phase 2 Plan 04: SSE Streaming Upgrade Summary

**POST /api/chat upgraded from blocking JSON to SSE StreamingResponse — status:thinking emitted within 100ms, verified end-to-end via curl --no-buffer with 7 logged conversations and 1,669-expert FAISS index**

## Performance

- **Duration:** ~7 min (includes human verification window)
- **Started:** 2026-02-20T12:05:56Z
- **Completed:** 2026-02-20T12:14:27Z
- **Tasks:** 2 (1 auto, 1 human-verify checkpoint)
- **Files modified:** 1

## Accomplishments

- Replaced blocking `JSONResponse` with `StreamingResponse` using an async generator that yields three SSE events: `status=thinking`, `result` (full JSON payload), and `done`
- Synchronous services (FAISS embed_query, Gemini generate_content) offloaded via `run_in_executor()` to prevent blocking the asyncio event loop during streaming
- Human verified all SSE tests: event order correct, DB logging confirmed (7 conversations), health endpoint intact, clarification path functional, 10+ domain queries returned plausible experts

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert POST /api/chat to SSE StreamingResponse** - `85b3b58` (feat)
2. **Task 2: Human verification — SSE streaming end-to-end** - checkpoint approved (no code commit required)

**Deviation — retriever fix:** `7cc4090` (fix(retriever): handle actual metadata key names and lower similarity threshold)

## Files Created/Modified

- `app/routers/chat.py` — Replaced blocking handler with `_stream_chat()` async generator and `StreamingResponse` wrapper; added `_sse()` helper; preserved DB logging, Pydantic validation, and multi-turn history

## Decisions Made

- `StreamingResponse` with `media_type='text/event-stream'` replaces `JSONResponse`; `response_model` removed from decorator since `StreamingResponse` bypasses Pydantic response serialization
- Sync services wrapped in `run_in_executor()` to keep the event loop free while FAISS and Gemini work runs in a thread pool
- SSE headers `Cache-Control: no-cache` and `X-Accel-Buffering: no` added to prevent Railway/nginx proxy from buffering the stream
- `thinking` event yielded before any thread pool work is dispatched — first event latency is deterministically sub-100ms

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected metadata key names and lowered similarity threshold in retriever**
- **Found during:** Human verification (Task 2) — retriever returned zero candidates for most queries
- **Issue:** Metadata dict keys used in `retriever.py` did not match actual CSV column names (snake_case vs space-separated); `SIMILARITY_THRESHOLD=0.65` was too strict for the normalized L2 distance scores
- **Fix:** Updated `_get()` key lookups to match real column names; lowered threshold from 0.65 to 0.60
- **Files modified:** `app/services/retriever.py`
- **Verification:** 10+ domain queries returned 3 plausible experts each; DB confirmed 7 conversations logged
- **Committed in:** `7cc4090` (fix(retriever) — committed as separate fix commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in retriever metadata key resolution)
**Impact on plan:** Fix was required for any query to return results. No scope creep.

## Issues Encountered

None beyond the retriever bug documented above.

## User Setup Required

None — no external service configuration required. All environment variables established in prior plans.

## Next Phase Readiness

- Phase 2 complete: all 4 plans executed, all success criteria verified by human
- Phase 2 success criteria met:
  1. POST /api/chat returns valid JSON with exactly 3 experts (name, title, company, hourly rate, profile URL, narrative)
  2. Endpoint streams as SSE — status:thinking arrives before result (confirmed via curl --no-buffer)
  3. 10+ manual test queries across different domains returned plausible experts
  4. Vague query ("help") triggered clarification response rather than forced match
- Phase 3 (Frontend) can begin — API contract is stable: SSE stream with thinking/result/done events

---
*Phase: 02-rag-api*
*Completed: 2026-02-20*
