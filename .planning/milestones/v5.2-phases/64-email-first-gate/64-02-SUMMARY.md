---
phase: 64-email-first-gate
plan: 02
status: complete
started: 2026-03-04
completed: 2026-03-04
---

# Plan 64-02 Summary: Admin Lead Timeline with Email-Attributed Explorer Events

## What was built

Extended the admin lead timeline to include Explorer search queries and card clicks from the user_events table, matched by email. Added distinct icons per event type for visual differentiation in the timeline UI.

## Key Changes

### Modified
- `app/routers/admin/leads.py` — Added step 3.5 to `get_lead_timeline()`: queries `user_events` WHERE `email = :email` for `search_query` and `card_click` event types. Uses distinct types `explorer_search` and `explorer_click`. Deduplicates against session_id-linked events.
- `frontend/src/admin/types.ts` — Added `TimelineExplorerSearchEvent` and `TimelineExplorerClickEvent` interfaces. Updated `TimelineEvent` union type.
- `frontend/src/admin/pages/LeadsPage.tsx` — Added rendering for `explorer_search` (green dot + Compass icon) and `explorer_click` (amber dot + Eye icon). Updated dot color conditional to support 4 event types.

## Requirements Addressed
- TRACK-03: Admin lead timeline includes Explorer search queries attributed to lead's email

## Decisions Made
- Event types: `explorer_search` (green/compass) and `explorer_click` (amber/eye) — visually distinct from existing `search` (blue/magnifying glass) and `click` (purple/cursor)
- Deduplication: Track session_event_ids from step 3, skip matching IDs in step 3.5
- Match by email ONLY — no session_id fallback (per CONTEXT.md)

## Self-Check
- [x] Python syntax valid (`ast.parse` passes)
- [x] TypeScript compiles (`tsc --noEmit` passes)
- [x] All 17 existing tests pass (`vitest run`)
- [x] 4 distinct event type colors/icons in timeline
- [x] Email-only matching (no session_id fallback)
