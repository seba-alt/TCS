# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** A user describes any problem and instantly gets expertly matched professionals they can browse, filter, and contact — no searching, no guesswork.
**Current focus:** v2.3 — Sage Evolution & Marketplace Intelligence (Phase 31 complete — awaiting human-verify checkpoint on 31-02)

## Current Position

Phase: 31 of 31 (Marketplace Intelligence)
Plan: 2 of 2 in current phase (31-01 and 31-02 implementation complete)
Status: Phase 31 implementation done — awaiting human-verify checkpoint (Task 3) before phase sign-off
Last activity: 2026-02-22 — 31-02 AdminMarketplacePage frontend built and committed; pushed to main for Vercel deploy

Progress: [████████████████████] 53/53 plans (100% through Phase 31-02) | v2.3: 7/7 plans

## Live URLs

| Service | URL |
|---------|-----|
| Railway (backend) | https://web-production-fdbf9.up.railway.app |
| Vercel (frontend) | https://tcs-three-sigma.vercel.app |

## Performance Metrics

**Velocity:**
- Total plans completed: 52 (through Phase 31-01)
- Average duration: ~15 min

| Phase-Plan | Duration | Tasks | Files |
|------------|----------|-------|-------|
| 31-01 | 2 min | 2 | 1 |
| 31-02 | 2 min | 2 | 5 |

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
- [Phase 31]: All 5 marketplace intelligence endpoints added to existing router object — inherits _require_admin, no main.py changes needed
- [Phase 31]: json_extract boolean comparisons use = 1 not = true — SQLite stores JSON booleans as integers
- [Phase 31]: Custom downloadMarketplaceCsv helper instead of extending useAdminExport — keeps AdminMarketplacePage self-contained without modifying shared hook ExportSection type
- [Phase 31]: AdminSidebar slice updated (0,3)/(3+) to (0,4)/(4+) — Marketplace inserted at Analytics index 2, between Searches and Gaps

### Pending Todos

- Set `ALLOWED_ORIGINS=https://tcs-three-sigma.vercel.app` in Railway environment variables (carried over from v1.1)
- Verify FTS5 availability on Railway SQLite at startup

### Blockers/Concerns

- Phase 30: Confirm `conversations.response_experts` column existence before relying on it for Phase 31 exposure backfill.

## Session Continuity

Last session: 2026-02-22
Stopped at: Checkpoint 31-02 Task 3 (human-verify) — AdminMarketplacePage implemented; waiting for visual confirmation at /admin/marketplace
Resume signal: Type "approved" if all checks pass, or describe any issues found
Resume file: .planning/phases/31-admin-marketplace-intelligence/31-02-PLAN.md
