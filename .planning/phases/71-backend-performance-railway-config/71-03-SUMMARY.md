---
phase: 71-backend-performance-railway-config
plan: 03
subsystem: infra
tags: [railway, uvicorn, deployment, healthcheck, europe-west4]

# Dependency graph
requires:
  - phase: 71-backend-performance-railway-config plan 01
    provides: /api/health endpoint referenced as healthcheckPath
provides:
  - Railway deployment config targeting europe-west4 with production-tuned Uvicorn flags
  - Procfile in sync with railway.json startCommand
affects: [deployment, railway-config, phase-73-seo, phase-74-frontend-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "railway.json is the single source of truth for deployment config; Procfile mirrors it as fallback"
    - "--timeout-keep-alive 75 set above Railway's 60s LB timeout to prevent premature TCP drops"

key-files:
  created: []
  modified:
    - railway.json
    - Procfile

key-decisions:
  - "healthcheckTimeout reduced from 300s to 120s — faster failure detection without sacrificing cold-start margin"
  - "ON_FAILURE restart policy — auto-recovery on crash without restarting on clean exits"
  - "europe-west4 (Netherlands) selected as closest Railway region to primary European user base"
  - "--no-access-log keeps structlog as the canonical request log, avoiding duplicate per-request entries in production"

patterns-established:
  - "railway.json startCommand and Procfile kept in sync — both verified in CI-style assertion script"

requirements-completed: [RAIL-01, RAIL-02, RAIL-03]

# Metrics
duration: 5min
completed: 2026-03-05
---

# Phase 71 Plan 03: Railway Deployment Config Summary

**Railway deployment tuned for European production: europe-west4 region, 75s keep-alive, 120s healthcheck timeout, ON_FAILURE restart policy**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-05T12:25:15Z
- **Completed:** 2026-03-05T12:30:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Set Railway deployment region to europe-west4 (Netherlands) for lowest EU latency
- Added `--timeout-keep-alive 75` to prevent TCP connection drops under Railway's 60s load balancer timeout
- Added `--log-level warning` and `--no-access-log` to reduce production log noise (structlog handles request logging)
- Reduced healthcheckTimeout from 300s to 120s for faster Railway failure detection
- Set restartPolicyType to ON_FAILURE for automatic container recovery on crash
- Synced Procfile with railway.json startCommand flags

## Task Commits

Each task was committed atomically:

1. **Task 1: Railway deployment config + Procfile update** - `a44eb41` (chore)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `railway.json` - Complete deploy block rewrite: region, tuned startCommand, reduced healthcheckTimeout, ON_FAILURE restart
- `Procfile` - Uvicorn flags synced with railway.json startCommand

## Decisions Made
- healthcheckTimeout reduced from 300 to 120 seconds — 120s gives enough margin for Railway cold starts without the previous over-generous 300s window that delayed failure detection
- ON_FAILURE restart policy chosen over ALWAYS to avoid Railway restart loops on intentional clean exits
- europe-west4 (Netherlands) is the Railway region geographically closest to the primary European user base
- --no-access-log intentional: structlog already captures request telemetry; Uvicorn access log would be duplicate noise

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `python` command not found on macOS (zsh); used `python3` for verification script. Not a deviation — local tooling difference only.

## User Setup Required

None - no external service configuration required. Railway picks up railway.json automatically on next deploy (triggered by git push to main).

## Next Phase Readiness
- Phase 71 complete: all 3 plans done (71-01 health endpoints, 71-02 structlog + caching, 71-03 Railway config)
- Ready to proceed to Phase 72 (Frontend Performance & Bundle Optimization) or Phase 73 (SEO & Meta)
- Deployment config change takes effect on next push to main

---
*Phase: 71-backend-performance-railway-config*
*Completed: 2026-03-05*
