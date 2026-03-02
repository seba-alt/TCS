# Phase 54: Bookmarks & Analytics - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Make saved/bookmarked profiles visually distinct with purple color treatment (like active tags), create a filter-independent saved view, track all searches including anonymous, and integrate Microsoft Clarity. No new bookmark features beyond visual + view improvements.

</domain>

<decisions>
## Implementation Decisions

### Bookmark Visual Treatment
- Style similar to active tags — filled/colored when saved, outlined when not
- Purple (brand color) for the saved/active state
- Claude decides whether icon shows on all cards (outline when unsaved, filled when saved) or only on saved cards

### Saved View UX
- "Show Saved" replaces the grid with only saved experts — filters/tags inactive
- Exit saved view via: close/back button AND any search/filter interaction automatically exits
- Empty state: friendly message — "No saved experts yet — bookmark experts to see them here"
- Claude decides whether filters are hidden or grayed-out-but-visible in saved view

### Anonymous Search Tracking
- Capture: search query, active tags, rate filter, and result count per search
- Anonymous searches (no email) tracked alongside email-linked searches — mixed in one data set
- Anonymous entries simply have no email attached — admin sees all searches together

### Microsoft Clarity
- Integrate Clarity script with project ID: vph5o95n6c
- The exact script provided by user:
  ```
  (function(c,l,a,r,i,t,y){
  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window, document, "clarity", "script", "vph5o95n6c");
  ```
- Active on all public pages (Explorer), exclude admin routes

### Claude's Discretion
- Bookmark icon visibility (all cards vs saved-only)
- Filter sidebar behavior in saved view (hidden vs grayed out)
- Clarity script injection method (index.html vs React component)
- Search tracking implementation details (existing event system vs new endpoint)

</decisions>

<specifics>
## Specific Ideas

- Bookmark visuals should feel like active tags — same kind of filled/colored toggle treatment
- Saved view should feel like a focused mode, not a separate page
- Anonymous searches appearing mixed with identified ones — no distinction in the UI, just missing email field

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 54-bookmarks-analytics*
*Context gathered: 2026-03-02*
