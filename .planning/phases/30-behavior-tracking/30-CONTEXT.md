# Phase 30: Behavior Tracking - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Silently record card clicks, Sage queries, and filter changes in the database without blocking any user interaction. This phase is invisible infrastructure — events accumulate so Phase 31 (Admin Marketplace Intelligence) can surface demand signals. No user-facing UI in this phase.

</domain>

<decisions>
## Implementation Decisions

### Session/visitor identity
- Events must be linkable to an email — all users eventually provide their email via the profile gate
- Before email is known: generate a random session ID stored in `localStorage` (persists across page refreshes — returning visitor events are linked)
- After email is collected (profile gate): patch all prior session events to attach the email in a single backend call — the full pre-gate journey becomes attributed
- Only future events carry the email directly; the session ID field bridges pre- and post-gate attribution
- Events are keyed by: session_id (always), email (nullable, filled in after gate)

### Filter event payload
- Capture: which filter changed + the new value (e.g., `{ filter: 'rate', value: [100, 200] }`)
- Also capture: result count at the time the filter settled — powers "unmet demand" analysis in Phase 31
- No before/after delta needed — new value only
- Only fire on filter SET, not on filter clear/reset — reduces noise

### Card click context depth
- Always capture: expert ID, timestamp, context (grid vs sage_panel)
- Also capture: active filters at time of click (full filter state snapshot) and position/rank in the grid
- For sage_panel clicks: Claude decides whether panel rank is worth the instrumentation
- Record every click, including repeated clicks on the same expert in a session — no deduplication

### Sage query payload
- Capture: query text, function_called (`apply_filters` or `search_experts`), result_count, expert_ids returned (array)
- Add explicit `zero_results` boolean field on the event row — Phase 31 can filter directly without computing from result_count
- function_called field handles routing distinction (apply_filters vs search_experts) — no additional filter args field needed
- Event emitted after pilot response, never before (per success criteria)

### Claude's Discretion
- Session ID generation approach (UUID v4 or similar)
- Backend patch endpoint design for linking session → email on profile gate
- Whether sage_panel card clicks capture panel rank
- Exact schema field names (session_id, visitor_id, etc.)

</decisions>

<specifics>
## Specific Ideas

- Phase 31 will query this data heavily — the schema should optimize for: zero-result Sage queries by frequency, expert exposure by context, daily Sage volume, and filter demand signals
- The `zero_results` boolean is explicitly requested to keep Phase 31 queries simple
- Identity design: think of it as "anonymous until proven otherwise" — session ID always, email when earned

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 30-behavior-tracking*
*Context gathered: 2026-02-22*
