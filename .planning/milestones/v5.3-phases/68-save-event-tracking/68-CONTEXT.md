# Phase 68: Save Event Tracking - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Record save/unsave bookmark actions as backend analytics events. Events are attributed to the visitor's email (always known — email gate ensures this). Events appear in the existing admin event feed.

</domain>

<decisions>
## Implementation Decisions

### Event payload
- Minimal payload: expert_id + action ("save" or "unsave") only
- No view context, no client timestamp, no extra metadata
- Server records timestamp when event is received
- Fire immediately on every toggle — no debouncing
- Fire-and-forget: tracking failure does not block the save/unsave action, analytics loss is acceptable

### Attribution
- All visitors have an email (email gate from Phase 67 runs first)
- No anonymous/unknown visitor case to handle
- Events attributed to the visitor's email directly

### Admin visibility
- Save/unsave events appear in the existing admin event feed, mixed chronologically with other events (searches, page views, etc.)
- Event log format: expert name, user email, timestamp, action (save/unsave)
- No separate section or filtering — just part of the existing feed
- No aggregated counts — individual event entries only

### Claude's Discretion
- trackEvent() implementation details (API endpoint, request format)
- How events integrate with the existing user_events table schema
- Error handling internals for fire-and-forget
- How save events render in the admin feed (icon, formatting)

</decisions>

<specifics>
## Specific Ideas

- No anonymous case exists — the email gate guarantees all visitors provide email before any interaction
- Keep the event payload as lean as possible — just what's needed for analytics

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 68-save-event-tracking*
*Context gathered: 2026-03-04*
