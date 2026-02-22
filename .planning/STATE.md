# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** A user describes any problem and instantly gets expertly matched professionals they can browse, filter, and contact — no searching, no guesswork.
**Current focus:** v2.3 — Sage Evolution & Marketplace Intelligence (Phase 29 ready to plan)

## Current Position

Phase: 29 of 31 (Sage Personality + FAB Reactions)
Plan: 0 of ? in current phase
Status: Ready to plan
Last activity: 2026-02-22 — Phase 28 Sage Search Engine complete

Progress: [████████████████████] 48/48 plans (100% through Phase 28) | v2.3: 2/7 plans

## Live URLs

| Service | URL |
|---------|-----|
| Railway (backend) | https://web-production-fdbf9.up.railway.app |
| Vercel (frontend) | https://tcs-three-sigma.vercel.app |

## Performance Metrics

**Velocity:**
- Total plans completed: 48 (through Phase 28)
- Average duration: ~15 min

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

**Phase 28 key findings:**
- `search_experts` + `apply_filters` descriptions were mutually exclusive out of the box — 20/20 routing accuracy, no description tuning needed
- `args = dict(fn_call.args)` unwrap pattern + `float()`/`list()` defensive casting confirmed essential
- `search_performed` check MUST precede `data.filters` truthy check — zero-result searches return `filters: null`
- Two-call pattern `validateAndApplyFilters({reset:true})` then `validateAndApplyFilters(filtersObj)` for clean grid slate

**v2.3 critical constraints (remaining phases):**
- Phase 29: System prompt rewrite in `pilot_service.py` — one-file change, instant rollback. Outer `motion.div` for `boxShadow` animation ONLY; inner `motion.button` retains `whileHover`/`whileTap` scale — never animate `scale` on the wrapper.
- Phase 30: `UserEvent` is a NEW table — `create_all` handles it safely, no `ALTER TABLE` needed. `trackEvent()` is a module function (not a hook) using `fetch` with `keepalive: true` — NEVER `await` in click path. Filter tracking debounced 1000ms; rate slider on drag-end only. Verify table creation in Railway logs within 60s of first deploy.
- Phase 31: New `MarketplacePage.tsx` at `/admin/marketplace` — does NOT modify `GapsPage.tsx`. Two new admin endpoints: `GET /api/admin/events/demand` + `/events/exposure`. Build empty state BEFORE data-loading logic (cold-start pitfall). Both endpoints return `data_since` field.

### Pending Todos

- Set `ALLOWED_ORIGINS=https://tcs-three-sigma.vercel.app` in Railway environment variables (carried over from v1.1)
- Verify FTS5 availability on Railway SQLite at startup
- Before Phase 30: confirm `onViewProfile` handler location in `ExpertCard.tsx` for tracking injection point

### Blockers/Concerns

- Phase 30: Confirm `conversations.response_experts` column existence before relying on it for Phase 31 exposure backfill.

## Session Continuity

Last session: 2026-02-22
Stopped at: Phase 28 complete, ready to plan Phase 29
Resume signal: N/A
Resume file: None
