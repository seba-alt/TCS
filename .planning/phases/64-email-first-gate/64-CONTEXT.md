# Phase 64: Email-First Gate - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Every new visitor sees a mandatory email gate before browsing the Explorer. Returning subscribers bypass it instantly. Post-gate activity (searches, saves, clicks) is attributed to the lead's email in admin timelines. The old newsletter subscription gate is removed — this gate replaces it.

</domain>

<decisions>
## Implementation Decisions

### Gate appearance & copy
- Full-screen overlay with centered card on top of blurred Explorer backdrop
- Explorer is visible but blurred behind the gate — creates curiosity and motivation to submit
- Card includes Tinrate logo at top + tagline
- Copy tone: blend of value-first and professional/trustworthy — concise but can be a few lines. Do NOT mention number of experts
- Brief privacy note below the email input (e.g., "We respect your privacy. No spam.")

### Bypass & coexistence
- Remove the existing newsletter subscription gate entirely — the page-entry gate replaces it
- Bypass check uses the existing localStorage key (same key the old subscription flow used)
- Gate writes email to the same localStorage key/format as the old subscription — unified key for bypass, trackEvent() email reading, and gate submission
- Loops API call is delayed after gate submission — give time for the first search query to be captured and sent alongside or associated with the Loops contact creation. Claude decides exact timing approach
- Loops source tag: `page_entry` (not `gate`)

### Validation & submission UX
- Validate on submit only — no real-time validation as user types
- Inline error message if email is invalid
- Submit button text: "Get Access"
- On successful submission: gate card and overlay fade out smoothly, revealing the Explorer

### Timeline attribution (TRACK-03)
- Search queries appear inline as timeline entries alongside existing events (same visual treatment, new event type)
- Each search entry shows: query text + timestamp
- Lead events matched by **email only** — no session_id fallback. Only email-attributed events appear
- Event types shown in timeline: search queries, expert saves/bookmarks, expert card clicks (NOT page views)
- Each event type gets a distinct icon or label for visual differentiation in the timeline

### Claude's Discretion
- Exact gate copy wording (within the tone guidelines above)
- Fade-out animation duration and easing
- Loops call delay timing strategy
- Timeline icon choices per event type
- Exact privacy note wording

</decisions>

<specifics>
## Specific Ideas

- Blurred Explorer behind the gate creates a "peek behind the curtain" effect — motivates email submission
- "Get Access" button implies exclusivity while being action-oriented
- Delayed Loops call allows first search query to be bundled with lead creation for richer lead context

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 64-email-first-gate*
*Context gathered: 2026-03-04*
