---
phase: 04-deployment
plan: "03"
subsystem: infra
tags: [railway, vercel, sentry, faiss, sqlite, cors, github-actions, ci]

# Dependency graph
requires:
  - phase: 04-deployment/04-01
    provides: railway.json health check, Sentry backend SDK, data files unignored, VAR_DIR config
  - phase: 04-deployment/04-02
    provides: GitHub Actions CI pipeline (ruff + tsc), Sentry React SDK instrumentation
provides:
  - FAISS index, metadata.json, experts.csv committed to git (Railway can clone at deploy)
  - Frontend public assets (favicon.png, icon.png, logo.png) committed for Vercel build
  - why_them field added to Expert dataclass and response_experts DB payload
  - UI polish: thinking skeleton loader, rotating quotes, brand-purple user messages
  - Railway and Vercel platform setup (human-action checkpoint — awaiting user)
affects: [live-production, railway-service, vercel-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "FAISS index committed to git (not generated at deploy time) — Railway Railpack cannot inject env vars at build time"
    - "DEPLOYMENT ORDER: Railway first (get public URL) -> Vercel second (get domain) -> set ALLOWED_ORIGINS on Railway -> redeploy"
    - "VAR_DIR=/app/var on Railway + Volume at /app/var keeps SQLite across redeployments"

key-files:
  created:
    - data/faiss.index
    - data/metadata.json
    - data/experts.csv
    - frontend/public/favicon.png
    - frontend/public/icon.png
    - frontend/public/logo.png
  modified:
    - app/routers/chat.py
    - app/services/llm.py
    - frontend/index.html
    - frontend/src/App.tsx
    - frontend/src/components/ChatMessage.tsx
    - frontend/src/components/EmptyState.tsx
    - frontend/src/components/ExpertCard.tsx
    - frontend/src/components/Header.tsx
    - frontend/src/types.ts

key-decisions:
  - "Data files committed to git (faiss.index, metadata.json, experts.csv) — Railway Railpack cannot run ingest.py at build time (no GOOGLE_API_KEY in build env)"
  - "why_them field added to Expert dataclass — LLM now returns per-expert explanation, stored in response_experts DB column"
  - "LLM prompt hardened with strict name-only rule and bio included in candidate lines for better match quality"
  - "Frontend public assets committed (favicon.png, icon.png, logo.png) — Vercel build needs these files present in frontend/"

patterns-established:
  - "Deployment order enforced: Railway first (URL) -> Vercel (domain) -> ALLOWED_ORIGINS update -> Railway redeploy"

requirements-completed: [DEPL-01]

# Metrics
duration: partial — awaiting GitHub push and platform setup
completed: 2026-02-20
---

# Phase 4 Plan 03: Railway + Vercel Production Deployment Summary

**FAISS data files and UI polish committed; Railway and Vercel platform setup awaiting GitHub repo creation and push from user**

## Performance

- **Duration:** Partial — Task 1 committed locally, awaiting GitHub push for CI and Task 2 platform setup
- **Started:** 2026-02-20T00:00:00Z
- **Completed:** In progress (checkpoint returned)
- **Tasks:** 1/2 complete (Task 2 is checkpoint:human-verify)
- **Files modified:** 15

## Accomplishments

- Committed FAISS index, metadata.json, and experts.csv (2.6 MB total) so Railway clone has data at deploy time — no build-time ingest.py needed
- Added frontend public assets (favicon.png, icon.png, logo.png) for Vercel build and correct browser favicon
- Added `why_them` field to Expert dataclass in llm.py, propagated to chat.py DB logging and SSE events
- Hardened LLM prompt with strict name-only rule and bio excerpts in candidate lines
- UI polish: thinking skeleton loader with rotating quotes, brand-purple user message bubbles, EmptyState redesign, ExpertCard conditional link handling
- ruff check passes — all checks passed locally
- tsc --noEmit passes — zero TypeScript errors locally

## Task Commits

1. **Task 1: Commit and push all deployment prep to main** - `ad38715` (feat)
   - Note: Local commit complete; push to GitHub required (no remote configured yet)

## Files Created/Modified

- `data/faiss.index` - FAISS vector index for 1,600+ expert profiles (committed for Railway clone)
- `data/metadata.json` - Expert metadata parallel to FAISS index
- `data/experts.csv` - Source expert data CSV
- `frontend/public/favicon.png` - Browser favicon
- `frontend/public/icon.png` - App icon
- `frontend/public/logo.png` - Brand logo for frontend
- `app/services/llm.py` - Added why_them field to Expert dataclass; improved _build_prompt with bio and strict name rule
- `app/routers/chat.py` - Refactored experts_payload to include why_them; DRY shared between DB log and SSE event
- `frontend/index.html` - Updated favicon href from /vite.svg to /favicon.png
- `frontend/src/App.tsx` - Added thinking quotes rotation via useEffect + useState
- `frontend/src/components/ChatMessage.tsx` - Skeleton loading state, conditional cursor, thinkingQuote prop
- `frontend/src/components/EmptyState.tsx` - Redesigned with bolder headline and read-only example cards
- `frontend/src/components/ExpertCard.tsx` - Conditional link wrapper (null-safe profile_url)
- `frontend/src/components/Header.tsx` - (updated as part of UI polish)
- `frontend/src/types.ts` - Added why_them?: string to Expert interface

## Decisions Made

- Data files committed to git (not gitignored) — required because Railway Railpack cannot inject GOOGLE_API_KEY during build phase, making ingest.py at build time impossible
- why_them field added to Expert dataclass — enriches DB lead capture and enables future "why this expert" UI display
- LLM prompt hardened with strict name-only rule to prevent expert hallucination

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added why_them field to Expert dataclass and response payload**
- **Found during:** Task 1 (staging files)
- **Issue:** Modified files included why_them field added since Phase 3 verification — needed to be committed coherently with the rest of the UI polish
- **Fix:** Included app/routers/chat.py and app/services/llm.py in the commit with why_them integration and DRY experts_payload refactor
- **Files modified:** app/services/llm.py, app/routers/chat.py
- **Verification:** ruff check passes; logic confirmed — shared experts_payload used for both DB log and SSE event
- **Committed in:** ad38715

**2. [Rule 2 - Missing Critical] Added frontend public assets and favicon update**
- **Found during:** Task 1 (staging files)
- **Issue:** Plan's staging list referenced files already committed in Plans 01-02; untracked frontend/public/ assets were not listed but required for Vercel build
- **Fix:** Added frontend/public/favicon.png, icon.png, logo.png and updated index.html favicon reference
- **Files modified:** frontend/public/favicon.png, frontend/public/icon.png, frontend/public/logo.png, frontend/index.html
- **Verification:** tsc passes; index.html favicon href points to /favicon.png
- **Committed in:** ad38715

---

**Total deviations:** 2 auto-fixed (both Rule 2 — missing from plan's staging list but required for correct deployment)
**Impact on plan:** Both auto-fixes essential for correctness. Data files needed for Railway; public assets needed for Vercel.

## Issues Encountered

**No git remote configured** — The repository has no GitHub remote set up. Task 1 requires `git push origin main` to trigger CI. The user must:
1. Create a GitHub repository
2. `git remote add origin https://github.com/{username}/{repo}.git`
3. `git push -u origin main`
4. Verify GitHub Actions CI passes (ruff + tsc)

Local pre-validation shows both checks pass:
- `ruff check .` — All checks passed
- `npx tsc --noEmit` — No errors

## User Setup Required

**External services require manual configuration.** See the checkpoint details below.

### Platform Setup Order

1. **GitHub** — Create repo, add remote, push. CI must pass before Railway deploys.
2. **Sentry** — Create Python and React projects, get DSNs.
3. **Railway** — Connect GitHub repo, set env vars, add Volume at /app/var.
4. **Vercel** — Import repo (Root Directory: frontend), set env vars.
5. **Railway ALLOWED_ORIGINS** — Set to Vercel URL after Vercel deploy completes.

### Environment Variables Checklist

**Railway:**
- `GOOGLE_API_KEY` — Google AI Studio API key
- `VAR_DIR` — `/app/var` (literal, not secret)
- `SENTRY_DSN` — Python FastAPI project DSN from Sentry
- `ALLOWED_ORIGINS` — Exact Vercel URL after Vercel deploy (no trailing slash)

**Vercel:**
- `VITE_API_URL` — Railway public URL (no trailing slash), Production scope only
- `VITE_SENTRY_DSN` — React project DSN from Sentry, Production scope only

## Next Phase Readiness

- All code committed locally — ready to push once GitHub repo is created
- CI (ruff + tsc) pre-validated locally — expected to pass on GitHub Actions
- Platform setup checklist fully specified in Task 2 checkpoint
- Once user confirms deployment with Vercel URL + Railway URL, plan is complete

---
*Phase: 04-deployment*
*Completed: 2026-02-20 (partial — awaiting push and platform setup)*
