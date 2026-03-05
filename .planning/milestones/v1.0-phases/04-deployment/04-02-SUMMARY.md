---
phase: 04-deployment
plan: "02"
subsystem: infra
tags: [github-actions, ci, sentry, react, vite, ruff, typescript]

# Dependency graph
requires:
  - phase: 03-frontend
    provides: React frontend with Vite build system and TypeScript

provides:
  - GitHub Actions CI pipeline (ruff + tsc on push to main)
  - Sentry React SDK instrumentation (instrument.ts, production-only)
  - VITE_SENTRY_DSN typed in ImportMetaEnv
  - Sentry Vite plugin for source map upload (disabled without SENTRY_AUTH_TOKEN)

affects: [04-deployment, railway-deploy, vercel-deploy]

# Tech tracking
tech-stack:
  added: [@sentry/react, @sentry/vite-plugin, github-actions, ruff (CI)]
  patterns:
    - "Sentry initialized via instrument.ts as first import in main.tsx before React renders"
    - "enabled: import.meta.env.PROD disables Sentry in local dev without env var fiddling"
    - "sentryVitePlugin with disable guard avoids build failure when SENTRY_AUTH_TOKEN absent"
    - "CI uses ruff check . and npx tsc --noEmit as lint+type gates before Railway deploy"

key-files:
  created:
    - .github/workflows/ci.yml
    - frontend/src/instrument.ts
  modified:
    - frontend/src/main.tsx
    - frontend/src/vite-env.d.ts
    - frontend/vite.config.ts
    - frontend/package.json
    - app/main.py
    - app/services/retriever.py
    - scripts/ingest.py

key-decisions:
  - "CI workflow gates Railway deploys via ruff check and tsc -- both must pass before merge to main"
  - "Sentry enabled only in PROD builds (import.meta.env.PROD) -- local dev never sends errors to Sentry"
  - "sentryVitePlugin disabled when SENTRY_AUTH_TOKEN absent -- local builds never fail due to missing Sentry credentials"
  - "noqa: E402 applied to scripts/ingest.py sys.path-dependent import -- script legitimately needs sys.path insertion before app.config import"

patterns-established:
  - "instrument.ts pattern: Sentry init file imported as first module before any React/app code"
  - "CI-first pattern: lint and type check must pass locally before creating .github/workflows"

requirements-completed: [DEPL-01]

# Metrics
duration: 2min
completed: 2026-02-20
---

# Phase 4 Plan 02: CI Pipeline and Sentry Frontend Instrumentation Summary

**GitHub Actions CI (ruff + tsc) and Sentry React SDK with instrument.ts loaded before React on production builds only**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-20T13:35:32Z
- **Completed:** 2026-02-20T13:37:32Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Created `.github/workflows/ci.yml` with ruff lint and TypeScript type-check jobs gating every push to main
- Created `frontend/src/instrument.ts` with Sentry.init() using VITE_SENTRY_DSN, enabled only in production builds
- Added `import './instrument'` as the first line of `main.tsx` so Sentry initializes before React renders
- Added VITE_SENTRY_DSN to ImportMetaEnv interface for TypeScript-safe env access
- Added sentryVitePlugin to vite.config.ts with disable guard for local builds without SENTRY_AUTH_TOKEN
- Fixed 4 ruff lint errors (unused imports, E402) so CI passes immediately on first push

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GitHub Actions CI workflow** - `46baed1` (feat)
2. **Task 2: Install and configure Sentry React SDK** - `10c5333` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `.github/workflows/ci.yml` - CI pipeline: ruff lint + TypeScript type check on push/PR to main
- `frontend/src/instrument.ts` - Sentry.init() with VITE_SENTRY_DSN, browserTracing, enabled only in PROD
- `frontend/src/main.tsx` - Added `import './instrument'` as first import before React
- `frontend/src/vite-env.d.ts` - Added VITE_SENTRY_DSN to ImportMetaEnv interface
- `frontend/vite.config.ts` - Added sentryVitePlugin with org/project/authToken and disable guard
- `frontend/package.json` - Added @sentry/react and @sentry/vite-plugin dependencies
- `app/main.py` - Removed unused `from pathlib import Path` import (ruff F401)
- `app/services/retriever.py` - Removed unused `import json` and `from app.config import OUTPUT_DIM` (ruff F401)
- `scripts/ingest.py` - Added `# noqa: E402` to sys.path-dependent import block (ruff E402)

## Decisions Made

- Sentry enabled only in production via `import.meta.env.PROD` — local dev never sends error events to Sentry without any `.env` changes needed
- sentryVitePlugin uses `disable: !process.env.SENTRY_AUTH_TOKEN` guard — local Vite builds succeed without Sentry credentials; source map upload only happens in CI with the token set
- CI workflow installs ruff via pip rather than from requirements.txt — keeps it isolated as a dev tool with no production footprint

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 4 ruff lint errors blocking CI on first push**
- **Found during:** Task 1 (Create GitHub Actions CI workflow)
- **Issue:** Running `ruff check .` locally revealed F401 unused imports in `app/main.py` and `app/services/retriever.py`, and E402 module-level import order in `scripts/ingest.py` — CI would have failed immediately on first push
- **Fix:** Removed `from pathlib import Path` from app/main.py; removed `import json` and `from app.config import OUTPUT_DIM` from retriever.py; added `# noqa: E402` to the sys.path-dependent import block in scripts/ingest.py (a legitimate ordering requirement for scripts)
- **Files modified:** app/main.py, app/services/retriever.py, scripts/ingest.py
- **Verification:** `ruff check .` exits 0 with "All checks passed!"
- **Committed in:** 46baed1 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - lint bug fixes)
**Impact on plan:** Required for CI to pass on first push. No scope creep — all fixes are unused import cleanup in existing files.

## Issues Encountered

None — all dependencies installed cleanly, build succeeded on first attempt.

## User Setup Required

When creating the Sentry project, add these to the Railway dashboard (backend) and Vercel dashboard (frontend build):

- `VITE_SENTRY_DSN` — Sentry DSN URL from your Sentry project settings (Vercel env var, exposed to frontend build)
- `SENTRY_AUTH_TOKEN` — Sentry auth token for source map upload (Vercel build env var, not exposed to browser)
- `SENTRY_ORG` — Your Sentry organization slug (Vercel build env var)
- `SENTRY_PROJECT` — Your Sentry project slug (Vercel build env var)

Without these, the app works normally in production — Sentry is simply disabled when VITE_SENTRY_DSN is missing.

## Next Phase Readiness

- CI pipeline ready: every push to main will run ruff + tsc before Railway deploys
- Frontend Sentry instrumentation ready: add VITE_SENTRY_DSN to Vercel to activate
- Both plans 04-01 and 04-02 complete — ready for 04-03 (Railway service connect + Volume + env vars)

---
*Phase: 04-deployment*
*Completed: 2026-02-20*
