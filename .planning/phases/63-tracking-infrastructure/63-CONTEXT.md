# Phase 63: Tracking Infrastructure - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend adds a nullable indexed `email` column to `user_events` (idempotent startup migration) and the frontend enriches every `trackEvent()` call with the user's email when available. This phase builds the plumbing — the gate UI that writes the email is Phase 64.

</domain>

<decisions>
## Implementation Decisions

### Email propagation
- Email stored in `localStorage` under key `subscriber_email`
- `trackEvent()` reads `localStorage.getItem('subscriber_email')` on every call
- If key is missing or empty, sends `email: null`
- Phase 63 sets up the **read path only** — Phase 64 (gate) writes the email to localStorage on submission

### API contract
- New top-level optional `email` field in the POST body to `/api/events`, alongside existing fields (session_id, event_type, etc.)
- Maps directly to the new `email` column on `user_events`
- Backend applies basic validation: must contain `@` and a dot if provided
- If validation fails, store the event with `email: null` (never reject/lose a tracking event)
- Response stays as-is (200 OK, fire-and-forget) — no changes to response body

### Transition behavior
- No backfill of pre-gate events in the same session — pre-gate events stay `email: null`, post-gate events include email
- No retroactive backfill of historical (pre-v5.2) events — existing rows stay `email: null`
- If user clears localStorage, events degrade gracefully back to `email: null` until re-gated

### Claude's Discretion
- Migration implementation details (raw SQL vs Alembic, exact startup hook)
- Index type on the email column
- Exact trackEvent() refactoring approach

</decisions>

<specifics>
## Specific Ideas

- The email collected via the gate lives in two places: Loops (lead management) and `user_events.email` (activity attribution) — this column connects admin lead timelines to on-site behavior
- `subscriber_email` key name chosen to match the existing Loops subscription concept

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 63-tracking-infrastructure*
*Context gathered: 2026-03-04*
