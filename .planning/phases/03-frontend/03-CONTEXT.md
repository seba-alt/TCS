# Phase 3: Frontend - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a React chat UI that accepts user problem descriptions, connects to the streaming SSE API, displays an AI narrative response, and shows 3 clickable Expert Cards — fully responsive on desktop and mobile. Creating posts, expert profiles, and any backend changes are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Chat interface layout
- Fixed bottom input bar (always visible, content scrolls above — like iMessage/Intercom)
- Multi-turn conversation — full history scrolls, user can see and build on previous messages
- Persistent top header with Tinrate logo + tagline
- Empty state: welcome message from the AI + 2-3 example prompt suggestions the user can tap

### Expert Card design
- Vertically stacked list on all screen sizes (one card per row)
- Each card shows: avatar/profile photo, name, job title, company, hourly rate, and "why them" explanation
- "Why them" explanation is immediately visible — always shown, no toggle/expand needed
- Clicking a card opens the expert's Tinrate profile in a new tab

### Streaming & loading states
- While waiting for API: spinner + status message (e.g., "Finding experts...")
- Narrative response streams in token by token — live typing effect
- Expert Cards appear all at once after the narrative finishes streaming
- On error or timeout: inline error message + retry button to resend the same query

### Visual style & branding
- Match Tinrate brand
- Brand colors: black #000000, white #FFFFFF, purple #5128F2
- Light mode only
- Logo: user will place PNG at `frontend/public/logo.png` — referenced as `/logo.png` in the header component

### Claude's Discretion
- Exact typography and spacing
- Tailwind class choices and component structure
- Avatar fallback if no photo URL is available
- Specific spinner animation style
- Exact status message wording during loading

</decisions>

<specifics>
## Specific Ideas

- Logo PNG placed at `frontend/public/logo.png` — served directly at `/logo.png`, no import needed
- Input bar behavior should feel native mobile (touch-friendly, accessible without horizontal scrolling on 375px viewport)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-frontend*
*Context gathered: 2026-02-20*
