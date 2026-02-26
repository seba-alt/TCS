---
phase: 42-backend-error-hardening
plan: 01
subsystem: api
tags: [fastapi, httpx, fts5, sqlite, gemini, structlog, error-handling]

# Dependency graph
requires:
  - phase: 41-expert-email-purge
    provides: Clean expert data without PII
provides:
  - Photo proxy returns 404 instead of 502 on upstream failure
  - FTS5 MATCH in explorer.py wrapped with try/except safety net
  - FTS5 MATCH in suggest.py logs warnings via structlog on failure
  - Deprecated gemini-2.0-flash-lite replaced with gemini-2.5-flash-lite
affects: [43-frontend-error-fixes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Belt-and-suspenders FTS5 guard: _safe_fts_query() sanitizes input + try/except around MATCH as final safety net
    - Graceful degradation: photo proxy returns 404 (not 502) so frontend onError handler works silently

key-files:
  created: []
  modified:
    - app/routers/browse.py
    - app/services/explorer.py
    - app/routers/suggest.py
    - app/services/pilot_service.py

key-decisions:
  - "Photo proxy returns 404 (not 502) — frontend ExpertCard.tsx already handles any non-200 with onError callback showing monogram fallback"
  - "FTS5 try/except in explorer.py continues without BM25 scores on failure — FAISS results are still valid for ranking"
  - "structlog warnings added to both FTS5 except blocks for observability in production logs"

patterns-established:
  - "FTS5 safety net: always wrap MATCH queries in try/except even when input is pre-sanitized"

requirements-completed: [ERR-01, ERR-03, ERR-04]

# Metrics
duration: 5min
completed: 2026-02-26
---

# Phase 42 Plan 01: Backend Error Hardening Summary

**Photo proxy downgraded from 502 to 404, FTS5 MATCH queries wrapped with try/except safety nets in explorer and suggest, gemini-2.0-flash-lite replaced with gemini-2.5-flash-lite**

## Performance

- **Duration:** 5 min
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Photo proxy in browse.py now returns 404 on upstream failure — eliminates Sentry 502 noise, frontend shows monogram fallback silently (ERR-01)
- FTS5 MATCH in explorer.py wrapped with try/except that logs warning and continues with FAISS-only results (ERR-03)
- FTS5 MATCH in suggest.py except block now logs structured warning via structlog for production observability (ERR-03)
- Deprecated gemini-2.0-flash-lite model string replaced with gemini-2.5-flash-lite in pilot_service.py (ERR-04)

## Files Created/Modified
- `app/routers/browse.py` - Changed both HTTPException raises from status_code=502 to status_code=404 with detail="Photo not found"
- `app/services/explorer.py` - Wrapped FTS5 MATCH block (lines 223-242) in try/except with structlog warning "explore.fts5_match_failed"
- `app/routers/suggest.py` - Added structlog import + module logger; added log.warning("suggest.fts5_match_failed") in existing except block
- `app/services/pilot_service.py` - Changed model string from "gemini-2.0-flash-lite" to "gemini-2.5-flash-lite" in _detect_and_translate()

## Decisions Made
- Used 404 (not a placeholder image response) for photo proxy failures — least code change, matches HTTP semantics, frontend already handles it
- Added structlog to suggest.py for consistent observability across both FTS5 paths
- Preserved existing fallback behavior in _detect_and_translate(): return ("en", original_message) on failure

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three Sentry error sources eliminated (photo 502, FTS5 500, Gemini model deprecation)
- gemini-2.5-flash-lite JSON mode compatibility needs live validation after deployment
- Ready for Plan 42-02 (Search Lab pipeline alignment)

---
*Phase: 42-backend-error-hardening*
*Completed: 2026-02-26*
