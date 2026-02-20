---
phase: 01-foundation
plan: 03
subsystem: api
tags: [fastapi, faiss, cors, uvicorn, lifespan, railway]

# Dependency graph
requires:
  - phase: 01-02
    provides: app/services/embedder.py, scripts/ingest.py, app/config.py — embedder and ingestion pipeline this server depends on

provides:
  - FastAPI app with asynccontextmanager lifespan loading FAISS index and metadata at startup
  - GET /api/health endpoint returning {"status": "ok", "index_size": N}
  - CORS middleware configured from ALLOWED_ORIGINS env var
  - Procfile for Railway deployment
  - .env.example documenting required environment variables

affects: [02-retrieval, 03-api, 04-frontend]

# Tech tracking
tech-stack:
  added: [fastapi lifespan pattern, uvicorn, python-dotenv, structlog]
  patterns: [asynccontextmanager lifespan for startup/shutdown, app.state for shared resources, env-var-driven CORS origins, absolute Path-based file references via app.config]

key-files:
  created:
    - app/main.py
    - app/routers/__init__.py
    - app/routers/health.py
    - Procfile
    - .env.example
  modified:
    - .gitignore

key-decisions:
  - "asynccontextmanager lifespan (not deprecated @app.on_event) used for FAISS loading — FastAPI 0.90+ pattern"
  - "CORS never uses ['*'] — ALLOWED_ORIGINS env var with explicit origin list; Railway injects Vercel URL at deploy time"
  - "FAISS index path sourced from app.config.FAISS_INDEX_PATH (absolute Path) — avoids CWD-relative failures"
  - ".gitignore fixed: added !.env.example negation to allow safe committed example file despite .env.* wildcard rule"
  - "Server startup blocked (expected): data/faiss.index not yet built — requires experts.csv + GOOGLE_API_KEY"

patterns-established:
  - "Lifespan pattern: asynccontextmanager loads singletons into app.state at startup"
  - "Router pattern: each feature area has its own router in app/routers/ registered via app.include_router()"
  - "Config pattern: all absolute paths centralized in app/config.py — no inline path strings"

requirements-completed: [REC-01]

# Metrics
duration: 5min
completed: 2026-02-20
---

# Phase 1 Plan 03: FastAPI Server Summary

**FastAPI app with asynccontextmanager FAISS lifespan, CORS middleware, and GET /api/health returning index_size — pending human verification (CSV and GOOGLE_API_KEY not yet provided)**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-20T09:56:32Z
- **Completed:** 2026-02-20T10:02:00Z (paused at checkpoint:human-verify Task 3)
- **Tasks:** 2 of 3 automated tasks complete (Task 3 is human-verify checkpoint)
- **Files modified:** 6

## Accomplishments
- FastAPI application wired with lifespan pattern — loads FAISS index and metadata JSON at startup into app.state
- Health endpoint `/api/health` returns `{"status": "ok", "index_size": N}` — index_size confirms FAISS loaded
- CORS middleware added before route registration, driven by ALLOWED_ORIGINS env var (safe for production)
- Procfile created for Railway deployment — correct module path `app.main:app`
- `.env.example` committed with placeholder values documenting GOOGLE_API_KEY and ALLOWED_ORIGINS

## Task Commits

Each task was committed atomically:

1. **Task 1: Create FastAPI app with lifespan and CORS** - `b1db2ba` (feat)
2. **Task 2: Start FastAPI server and verify health endpoint** - no files modified (verification-only task; server startup blocked pending CSV + API key — expected per plan)

## Files Created/Modified
- `app/main.py` - FastAPI app with asynccontextmanager lifespan, CORS middleware, route registration
- `app/routers/__init__.py` - Empty package init for routers module
- `app/routers/health.py` - GET /api/health endpoint reading app.state.faiss_index.ntotal
- `Procfile` - Railway deployment entry: `web: uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- `.env.example` - Committed safe placeholder documenting GOOGLE_API_KEY and ALLOWED_ORIGINS
- `.gitignore` - Added `!.env.example` negation rule (auto-fix: .env.* wildcard was blocking .env.example from being tracked)

## Decisions Made
- asynccontextmanager lifespan chosen over deprecated `@app.on_event("startup")` — FastAPI 0.90+ pattern
- CORS origins sourced from `ALLOWED_ORIGINS` env var — Railway injects Vercel URL at deploy; never use `["*"]` in production
- FAISS path resolved via `app.config.FAISS_INDEX_PATH` (absolute Path object) — prevents CWD-relative path bugs
- `.gitignore` negation `!.env.example` added — example file must be tracked; `.env.*` wildcard was wrongly excluding it

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed .gitignore incorrectly excluding .env.example**
- **Found during:** Task 1 (Create FastAPI app with lifespan and CORS)
- **Issue:** `.gitignore` had `.env.*` wildcard which matched `.env.example`, preventing the example file from being tracked. The plan explicitly requires `.env.example` to be safe to commit.
- **Fix:** Added `!.env.example` negation rule in `.gitignore` after the `.env.*` entry
- **Files modified:** `.gitignore`
- **Verification:** `git status --short` showed `.env.example` as untracked (not ignored) after the fix
- **Committed in:** `b1db2ba` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Necessary correctness fix — .env.example must be committable per plan requirements. No scope creep.

## Issues Encountered
- `data/faiss.index` does not exist: experts.csv has not been provided and GOOGLE_API_KEY has not been set. Server cannot start until `scripts/ingest.py` is run. This is documented expected behavior per the plan — "If `data/faiss.index` does not exist, document this clearly in the summary."
- `structlog` and `python-dotenv` were not installed in local environment (pip install was needed separately); both are in requirements.txt and install correctly.

## User Setup Required
To complete Task 3 human verification:
1. Provide `data/experts.csv` (1,600 expert profiles CSV)
2. Create `.env` with `GOOGLE_API_KEY=<your key>`
3. Run `python3 scripts/ingest.py` to build `data/faiss.index` and `data/metadata.json`
4. Start server: `uvicorn app.main:app --host 127.0.0.1 --port 8000`
5. Run verification checks listed in Task 3

## Next Phase Readiness
- All FastAPI server code is complete and correct — app imports cleanly, routes registered, CORS configured
- Phase 2 (retrieval) can begin once human verification (Task 3) is approved
- Blockers: CSV + GOOGLE_API_KEY still needed to build FAISS index and run live server verification

---
*Phase: 01-foundation*
*Completed: 2026-02-20 (partial — awaiting Task 3 human verification)*
