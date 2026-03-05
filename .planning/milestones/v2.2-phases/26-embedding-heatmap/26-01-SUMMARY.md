---
phase: 26-embedding-heatmap
plan: 01
subsystem: api
tags: [scikit-learn, scipy, tsne, faiss, embedding, heatmap, asyncio]

# Dependency graph
requires:
  - phase: 25-admin-intelligence-metrics
    provides: admin router with _require_admin dep, app.state.faiss_index, app.state.metadata
provides:
  - scikit-learn==1.8.0 and scipy==1.15.1 in requirements.txt
  - _compute_tsne_background async coroutine in main.py (post-yield asyncio.create_task)
  - app.state.tsne_ready and app.state.embedding_map initialized in lifespan
  - GET /api/admin/embedding-map endpoint with 202 guard on tsne_ready flag
affects: [26-02-frontend-scatter-plot, any phase using app.state for embeddings]

# Tech tracking
tech-stack:
  added: [scikit-learn==1.8.0, scipy==1.15.1]
  patterns:
    - asyncio.create_task post-lifespan-yield for non-blocking background computation
    - asyncio.to_thread wrapping CPU-bound sklearn PCA+TSNE in async context
    - 202 guard pattern: getattr(request.app.state, 'tsne_ready', False) before serving data
    - Set embedding_map before tsne_ready=True to prevent empty-result race condition
    - tsne_ready=True even on exception to prevent perpetual 202 responses

key-files:
  created: []
  modified:
    - requirements.txt
    - app/main.py
    - app/routers/admin.py

key-decisions:
  - "asyncio.create_task(_compute_tsne_background) MUST fire post-yield — NEVER before yield (Railway healthcheck blocks on pre-yield blocking code causing infinite restart loop)"
  - "PCA(50) pre-reduction before TSNE to cut 768-dim compute 4-8x"
  - "TSNE params: perplexity=30, max_iter=1000, init='pca', random_state=42, metric='cosine'"
  - "Set app.state.embedding_map before app.state.tsne_ready=True to avoid empty-result race"
  - "Mark tsne_ready=True on exception so 202 guard clears and client gets readable error state"

patterns-established:
  - "Post-yield background task pattern: asyncio.create_task(coroutine) immediately after yield in lifespan"
  - "202 computing guard: getattr(request.app.state, 'flag', False) -> JSONResponse 202 if not ready"

requirements-completed: [INTEL-05]

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 26 Plan 01: Embedding Heatmap Backend Summary

**Non-blocking t-SNE background task (PCA-50 + TSNE cosine) with 202/200 guard endpoint exposing 530 expert embeddings as a 2D scatter-plot-ready JSON structure**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-22T14:35:37Z
- **Completed:** 2026-02-22T14:37:29Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added scikit-learn==1.8.0 and scipy==1.15.1 to requirements.txt
- Added `_compute_tsne_background` async coroutine to main.py using asyncio.to_thread for non-blocking sklearn PCA+TSNE computation
- Added `asyncio.create_task(_compute_tsne_background(app))` immediately after yield in lifespan — NEVER above yield — preserving Railway healthcheck compatibility
- Initialized `app.state.tsne_ready = False` and `app.state.embedding_map = []` before yield in lifespan
- Added `GET /api/admin/embedding-map` endpoint to admin.py with 202 guard while computing, 200 with points array when ready
- Added `JSONResponse` to fastapi.responses import in admin.py

## Task Commits

Each task was committed atomically:

1. **Task 1: Add scikit-learn/scipy deps + initialize tsne_ready/embedding_map state flags** - `4575e2e` (feat)
2. **Task 2: Add _compute_tsne_background coroutine + GET /embedding-map endpoint** - `5604a90` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `/Users/sebastianhamers/Documents/TCS/requirements.txt` - Added scikit-learn==1.8.0 and scipy==1.15.1 after numpy==2.2.*
- `/Users/sebastianhamers/Documents/TCS/app/main.py` - Added asyncio+numpy imports, _compute_tsne_background coroutine before lifespan, tsne_ready/embedding_map state init before yield, create_task post-yield
- `/Users/sebastianhamers/Documents/TCS/app/routers/admin.py` - Added JSONResponse import, added GET /embedding-map endpoint with 202 guard

## Decisions Made

- asyncio.create_task fires post-yield, never before — the plan explicitly mandates this because pre-yield blocking code causes Railway healthcheck failure and infinite restart loops
- app.state.embedding_map is set before app.state.tsne_ready=True to prevent a race condition where a fast client gets empty points on the first successful poll
- tsne_ready=True is set even on exception so the 202 guard clears and the client gets a predictable state (empty points array) rather than waiting forever

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Dependencies will be installed by Railway on next deployment. Computation runs automatically on startup post-yield.

## Next Phase Readiness

- Backend infrastructure complete for the embedding heatmap scatter plot
- GET /api/admin/embedding-map returns 202 while t-SNE runs (~30s) then 200 with points array
- Each point has x, y, name, category, username fields as specified
- Frontend scatter plot (Phase 26-02) can poll this endpoint and render when status == "ready"

---
*Phase: 26-embedding-heatmap*
*Completed: 2026-02-22*
