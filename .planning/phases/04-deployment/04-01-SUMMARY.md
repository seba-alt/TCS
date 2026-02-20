---
phase: 04-deployment
plan: "01"
subsystem: infra
tags: [railway, sentry, sqlite, faiss, gitignore, health-check]

# Dependency graph
requires:
  - phase: 03-frontend
    provides: Complete frontend build; backend was already functional with FAISS index and SQLite
provides:
  - railway.json with healthcheckPath /api/health and 300s timeout for FAISS startup
  - VAR_DIR-aware DATABASE_URL in app/config.py routing SQLite to Railway Volume
  - Sentry SDK init in app/main.py guarded by SENTRY_DSN env var
  - data/faiss.index, data/metadata.json, data/experts.csv unignored and committable
affects:
  - 04-02 (Railway service connect + env vars)
  - 04-03 (Vercel deployment)

# Tech tracking
tech-stack:
  added: [sentry-sdk]
  patterns:
    - VAR_DIR env var pattern for Railway Volume-backed SQLite (falls back to DATA_DIR locally)
    - Walrus-operator guard for optional SDK init (if dsn := os.getenv(...))
    - railway.json config-as-code for Railway health check and start command

key-files:
  created:
    - railway.json
  modified:
    - .gitignore
    - app/config.py
    - app/main.py
    - requirements.txt

key-decisions:
  - "Railway Volume mounted at /app/var (not /app/data) — mounting at /app/data would shadow committed FAISS index and metadata"
  - "sentry-sdk added without version pin — stable and backward-compatible; latest stable is fine"
  - "FAISS index, metadata.json, and experts.csv committed to git — Railway clones repo at deploy time, so data files must be tracked"
  - "Sentry walrus-operator guard (if dsn := os.getenv) skips init silently in local dev without SENTRY_DSN"

patterns-established:
  - "VAR_DIR pattern: Path(os.getenv('VAR_DIR', str(DATA_DIR))) for production/local path divergence"
  - "Optional SDK guard: if dsn := os.getenv('SDK_DSN'): sdk.init(...) — silently skipped when absent"

requirements-completed: [DEPL-01]

# Metrics
duration: 2min
completed: 2026-02-20
---

# Phase 4 Plan 01: Railway Deployment Prep Summary

**railway.json health check config, VAR_DIR-based SQLite routing to Railway Volume, and conditional Sentry SDK init — backend codebase ready for Railway clone and deploy**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-20T15:51:30Z
- **Completed:** 2026-02-20T15:53:03Z
- **Tasks:** 2
- **Files modified:** 4 (+ 1 created)

## Accomplishments

- Removed three gitignore rules blocking FAISS index, metadata.json, and experts.csv from being committed; Railway can now clone all data files at deploy time
- Added VAR_DIR env var pattern to app/config.py so SQLite writes to Railway Volume (/app/var) in production while falling back to data/ locally with no local config change needed
- Created railway.json with startCommand, healthcheckPath=/api/health, and 300s timeout giving FAISS lifespan time to complete before Railway routes traffic
- Added conditional Sentry init in app/main.py using walrus-operator guard — monitoring enabled in production, silently skipped locally

## Task Commits

Each task was committed atomically:

1. **Task 1: Unignore data files and update DATABASE_URL for Railway Volume** - `1d19c18` (chore)
2. **Task 2: Create railway.json and add Sentry to backend** - `02f95ae` (feat)

## Files Created/Modified

- `railway.json` — Railway config-as-code: startCommand, healthcheckPath /api/health, 300s timeout
- `.gitignore` — Removed data/faiss.index, data/metadata.json, data/*.csv; kept data/conversations.db gitignored
- `app/config.py` — Added import os; replaced static DATABASE_URL with VAR_DIR-aware version
- `app/main.py` — Added import sentry_sdk; conditional Sentry init block before app = FastAPI()
- `requirements.txt` — Added sentry-sdk (no version pin)

## Decisions Made

- **Railway Volume at /app/var not /app/data:** Mounting at /app/data would shadow the committed FAISS index and metadata.json files that Railway clones from the repo. /app/var is safe and isolated.
- **sentry-sdk without version pin:** Sentry SDK is stable and backward-compatible; latest stable is appropriate for v1.
- **Data files committed to git:** Railway clones the repo at deploy time — FAISS index and metadata must be tracked in git to be available at runtime. Only conversations.db stays gitignored (it belongs on the Volume).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

Railway dashboard configuration required before connecting repo:

- Set `VAR_DIR=/app/var` environment variable in Railway service settings
- Mount Railway Volume at `/app/var` mount point
- Set `SENTRY_DSN` environment variable to enable production error monitoring (optional but recommended)
- Set `ALLOWED_ORIGINS` to the Vercel deployment URL (e.g., `https://tinrate.vercel.app`)

These steps are handled in plan 04-02.

## Next Phase Readiness

- Backend codebase is fully prepared for Railway connection: data files tracked, health check configured, Volume path set up, Sentry ready
- Next: 04-02 connects Railway to GitHub repo, sets env vars, and attaches Volume — no further code changes expected
- 04-03 deploys frontend to Vercel and wires VITE_API_URL

---
*Phase: 04-deployment*
*Completed: 2026-02-20*
