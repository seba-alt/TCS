# Phase 17: Expert Grid & Cards - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Virtualized grid of all 1,558 experts rendered with react-virtuoso (20 cards/page, infinite scroll), rich expert cards with Framer Motion entry animations, and interactive domain tag pills that update sidebar filters on click. Creating experts, profile modals, and AI co-pilot features are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Card visual design
- Primary visual hierarchy: name (large) + job title — person-first, company is secondary
- Findability badge: text label only — words like "Top Match", "Good Match", not a numeric score
- Card style: elevated with drop shadow and rounded corners — white card, clear separation from background
- Match reason snippet: Claude's discretion — appear when an active search query is present, hidden during unfiltered browsing

### Grid layout & density
- Desktop: 3 columns
- Card height: fixed height — content truncates to keep grid uniform
- Mobile: 2 compact columns (not full-width single column)
- Gap between cards: standard 16-20px

### Entry animations
- Animation type: slide up + fade (cards rise slightly from below as they appear)
- Stagger: sequential — each card animates with a ~40-80ms delay after the previous
- Duration per card: medium, 250-350ms
- On filter re-fetch: instant replace (old cards snap out), new cards stagger in fresh

### Loading & empty states
- Initial grid load: skeleton cards with shimmer — maintains layout shape while data fetches
- Infinite scroll trigger: skeleton row appears at bottom while next page loads
- End of list: no indicator — scroll simply stops, no "you've reached the end" message
- Zero results: illustration + message + suggestion to try the AI co-pilot (Phase 18 will wire this up; Phase 17 can show a placeholder CTA pointing to where the co-pilot will be)

### Claude's Discretion
- Exact shadow values, border-radius, typography scale — match existing TCS design system
- Skeleton card design — use standard shimmer pattern
- Match reason snippet layout and truncation behavior
- Exact stagger timing within the 40-80ms guidance
- Tablet breakpoint column count (2 or 3)

</decisions>

<specifics>
## Specific Ideas

- Empty state when no results: small illustration + short message + hint toward the AI assistant ("Try describing what you need to the AI co-pilot") — the CTA can be a placeholder in Phase 17, fully wired in Phase 18
- Tag pill click behavior (locked by success criteria): clicking a pill on a card adds that tag to sidebar filters and immediately re-fetches

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 17-expert-grid-cards*
*Context gathered: 2026-02-21*
