# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** A user describes any problem and instantly gets expertly matched professionals they can browse, filter, and contact — no searching, no guesswork.
**Current focus:** v2.3 — Sage Evolution & Marketplace Intelligence (Phase 30 ready to plan)

## Current Position

Phase: 30 of 31 (Behavior Tracking)
Plan: 0 of 2 in current phase
Status: Ready to plan
Last activity: 2026-02-22 — Phase 29 Sage Personality + FAB Reactions complete

Progress: [████████████████████] 49/49 plans (100% through Phase 29) | v2.3: 3/7 plans

## Live URLs

| Service | URL |
|---------|-----|
| Railway (backend) | https://web-production-fdbf9.up.railway.app |
| Vercel (frontend) | https://tcs-three-sigma.vercel.app |

## Performance Metrics

**Velocity:**
- Total plans completed: 49 (through Phase 29)
- Average duration: ~15 min

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

**Phase 29 key findings:**
- `motion.div` glow wrapper confirmed working alongside inner `motion.button` scale gestures — no conflict
- prevFilterKey initialized to `null` (not `filterKey`) to cleanly skip first-render glow
- prevStreamingRef pattern works cleanly for detecting isStreaming false transitions

**v2.3 critical constraints (remaining phases):**
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
Stopped at: Phase 29 complete, ready to plan Phase 30
Resume signal: N/A
Resume file: None
