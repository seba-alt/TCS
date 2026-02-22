# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** A user describes any problem and instantly gets expertly matched professionals they can browse, filter, and contact — no searching, no guesswork.
**Current focus:** v2.3 — Sage Evolution & Marketplace Intelligence (Phase 30 complete, Phase 31 next)

## Current Position

Phase: 31 of 31 (Marketplace Intelligence)
Plan: 1 of ? in current phase
Status: Phase 30 complete — ready to execute Phase 31
Last activity: 2026-02-22 — 30-02 frontend tracking (trackEvent module + all event instrumentation) complete

Progress: [████████████████████] 51/51 plans (100% through Phase 30) | v2.3: 5/7 plans

## Live URLs

| Service | URL |
|---------|-----|
| Railway (backend) | https://web-production-fdbf9.up.railway.app |
| Vercel (frontend) | https://tcs-three-sigma.vercel.app |

## Performance Metrics

**Velocity:**
- Total plans completed: 51 (through Phase 30-02)
- Average duration: ~15 min

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

**Phase 29 key findings:**
- `motion.div` glow wrapper confirmed working alongside inner `motion.button` scale gestures — no conflict
- prevFilterKey initialized to `null` (not `filterKey`) to cleanly skip first-render glow
- prevStreamingRef pattern works cleanly for detecting isStreaming false transitions

**Phase 30-01 key decisions:**
- UserEvent uses Pydantic Literal for event_type validation (card_click, sage_query, filter_change) — 422 on unknown values without extra code
- payload stored as JSON string in Text column — flexible shape per event_type for Phase 31 aggregation
- POST /api/events returns 202 Accepted, no auth — fire-and-forget pattern, no sensitive data

**Phase 30-02 key decisions:**
- trackEvent() is a module function (not hook) — callable from async handlers and non-component code without React rules
- expert_ids omitted from sage_query payload — not in PilotResponse yet; Phase 31 uses result_count/zero_results
- TagMultiSelect tracks ADD-only events — remove events are noise for demand signal analysis
- RateSlider uses onValueCommit (drag-end) not onValueChange (per-tick) — avoids flooding events table

**v2.3 critical constraints (remaining phases):**
- Phase 31: New `MarketplacePage.tsx` at `/admin/marketplace` — does NOT modify `GapsPage.tsx`. Two new admin endpoints: `GET /api/admin/events/demand` + `/events/exposure`. Build empty state BEFORE data-loading logic (cold-start pitfall). Both endpoints return `data_since` field.

### Pending Todos

- Set `ALLOWED_ORIGINS=https://tcs-three-sigma.vercel.app` in Railway environment variables (carried over from v1.1)
- Verify FTS5 availability on Railway SQLite at startup

### Blockers/Concerns

- Phase 30: Confirm `conversations.response_experts` column existence before relying on it for Phase 31 exposure backfill.

## Session Continuity

Last session: 2026-02-22
Stopped at: Phase 30 complete (30-02: trackEvent module + full event instrumentation), ready for Phase 31
Resume signal: N/A
Resume file: None
