# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** A user describes any problem and instantly gets expertly matched professionals they can browse, filter, and contact — no searching, no guesswork.
**Current focus:** v2.3 — Sage Evolution & Marketplace Intelligence (Phase 28 ready to plan)

## Current Position

Phase: 28 of 31 (Sage Search Engine)
Plan: 0 of 2 in current phase
Status: Ready to plan
Last activity: 2026-02-22 — v2.3 roadmap created (Phases 28-31)

Progress: [████████████████████] 44/44 plans (100% through v2.2) | v2.3: 0/7 plans

## Live URLs

| Service | URL |
|---------|-----|
| Railway (backend) | https://web-production-fdbf9.up.railway.app |
| Vercel (frontend) | https://tcs-three-sigma.vercel.app |

## Performance Metrics

**Velocity:**
- Total plans completed: 44 (through v2.2)
- Average duration: ~15 min

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

**v2.3 critical constraints (encode in every phase plan):**
- Phase 28: `search_experts` calls `run_explore()` via direct Python import — NOT HTTP self-call. `pilot.py` injects `db` + `app_state`. Sage dispatches to `filterSlice` via `validateAndApplyFilters()` for grid sync — NEVER calls `setResults` directly. Function descriptions MUST be mutually exclusive. Test 20 real queries from `conversations` table; assert `fn_call.name` in Railway logs before ship.
- Phase 29: System prompt rewrite in `pilot_service.py` — one-file change, instant rollback. Outer `motion.div` for `boxShadow` animation ONLY; inner `motion.button` retains `whileHover`/`whileTap` scale — never animate `scale` on the wrapper.
- Phase 30: `UserEvent` is a NEW table — `create_all` handles it safely, no `ALTER TABLE` needed. `trackEvent()` is a module function (not a hook) using `fetch` with `keepalive: true` — NEVER `await` in click path. Filter tracking debounced 1000ms; rate slider on drag-end only. Verify table creation in Railway logs within 60s of first deploy.
- Phase 31: New `MarketplacePage.tsx` at `/admin/marketplace` — does NOT modify `GapsPage.tsx`. Two new admin endpoints: `GET /api/admin/events/demand` + `/events/exposure`. Build empty state BEFORE data-loading logic (cold-start pitfall). Both endpoints return `data_since` field.

### Pending Todos

- Set `ALLOWED_ORIGINS=https://tcs-three-sigma.vercel.app` in Railway environment variables (carried over from v1.1)
- Verify FTS5 availability on Railway SQLite at startup
- Before Phase 28: confirm `run_explore()` import path in `pilot_service.py`
- Before Phase 30: confirm `onViewProfile` handler location in `ExpertCard.tsx` for tracking injection point

### Blockers/Concerns

- Phase 28 medium confidence: Gemini function routing between `search_experts` and `apply_filters` requires empirical validation. Budget one iteration of description tuning after the 20-query test.
- Phase 30: Confirm `conversations.response_experts` column existence before relying on it for Phase 31 exposure backfill.

## Session Continuity

Last session: 2026-02-22
Stopped at: v2.3 roadmap created — Phases 28-31 defined, ready to plan Phase 28
Resume signal: N/A
Resume file: None
