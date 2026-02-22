# Phase 19: Extended Features - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Three capabilities that make the marketplace conversion-ready and robust: (1) email capture gate on "View Full Profile", (2) a no-results state with tag suggestions and Sage CTA, and (3) shareable filter URLs with fuzzy search suggestions. The AI match report (LEAD-03) is explicitly removed from this phase.

</domain>

<decisions>
## Implementation Decisions

### Email capture modal (View Full Profile gate)
- Framing: Access-focused — "Unlock full profile" (gate framing, not value framing)
- Hard gate: No profile views without email. If user dismisses the modal and tries to click any profile again, the modal re-appears. There is no bypass without submitting an email.
- Dismiss behavior: Modal closes cleanly — no soft reminder or badge. Modal returns on next profile click.
- Returning visitors: Email stored in localStorage — subsequent visits on the same device skip the modal entirely (LEAD-04)
- No modal for the Download Match Report — that feature is removed (see Deferred)

### No-results state
- Tag suggestions: Show nearby tags first (related to active filter set), fall back to most popular tags overall if no nearby options exist
- Clicking a suggested tag: Replaces the current tag filter and immediately re-fetches (not additive)
- "Clear all filters" CTA: Present but secondary/subtle — not the headline action, just an escape hatch below the suggestions
- Sage CTA: Prominent — "Not finding what you need? Try describing it to Sage." This completes the Phase 17 placeholder handoff and ties the co-pilot into the zero-results flow

### Shareable filter URLs
- What encodes: Claude's discretion — encode whatever makes the shared URL most useful and reproducible (all active filters expected)
- Copy link: Explicit button in the sidebar or filter bar — one click to copy the current URL
- On landing with pre-set URL: Filters apply silently — no toast or banner, sidebar just shows the active filters, grid loads already filtered

### Fuzzy / prefix search suggestions (ROBUST-02)
- Behavior: Live dropdown below the search bar as user types (no debounce gate — suggestions appear immediately after each keystroke, starting at 2+ characters)
- Clicking a suggestion applies it as the search query

### Claude's Discretion
- Exact email modal copy and design
- Number of tag suggestions to show in the no-results state
- URL param naming convention (e.g. `?tags=ux-design&rate_max=100`)
- Search suggestion dropdown styling and max items shown

</decisions>

<specifics>
## Specific Ideas

- The Sage CTA in the no-results state is the completion of the Phase 17 placeholder — Phase 19 wires it to actually open the co-pilot panel
- No-results tag suggestions should feel like helpful redirects, not a wall — the tone should match TCS's warm/playful voice

</specifics>

<deferred>
## Deferred Ideas

- **AI match report (LEAD-03)** — Fully removed from Phase 19. The "Download Match Report" feature (email + project type gate → AI-generated HTML report) is explicitly out of scope. Capture for a future phase if needed.

</deferred>

---

*Phase: 19-extended-features*
*Context gathered: 2026-02-21*
