# Phase 47: Public Explorer Polish - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Polish the public Explorer experience: white search input, keyword-oriented placeholder, grid/list view toggle, fix Sage double-render on desktop, mobile tap-to-expand behavior, and API error states with retry. No new features — improving existing Explorer.

</domain>

<decisions>
## Implementation Decisions

### Grid/list toggle
- Toggle placed in top-right of results area, separate from filter controls
- Default view is grid (cards) for first-time visitors
- View preference persists across page reloads (localStorage)
- Toggle uses icon + label buttons ("Grid" / "List")
- List view shows: expert name, job title, hourly rate, and domain tags per row

### Mobile tap behavior
- First tap on card expands it inline showing key stats (rate, experience, top tags)
- Instant expand — no animation, content appears immediately
- Second tap on the expanded card opens the full profile
- Tapping outside an expanded card collapses it back to normal
- Only one card expanded at a time

### Error states
- Friendly casual tone: "Oops, something went wrong. Let's try that again."
- Network-aware error messages: distinguish "Check your connection" for network errors vs generic server error message
- Retry button included in error state

### Search bar styling
- Solid white background — pure white, not translucent
- Thin light border, no shadow — flat and clean against the dark aurora header
- Placeholder text: "Name, company, keyword..."

### Claude's Discretion
- Error state illustration/icon choice
- Retry UX behavior (inline loading vs full reload)
- Search icon presence inside input
- Search bar border-radius (match existing UI conventions)
- Sage double-render fix approach
- Loading skeleton design for grid/list views

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 47-public-explorer-polish*
*Context gathered: 2026-02-27*
