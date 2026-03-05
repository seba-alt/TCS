# Phase 26: Embedding Heatmap - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Display an interactive 2D scatter plot of all 530 expert embeddings (t-SNE projected) in the admin Intelligence tab — colored by category, expert name on hover. Backend computes t-SNE as a background task post-startup (non-blocking). Recomputes after Phase 24 atomic index swap. No new admin actions or data manipulation in scope.

</domain>

<decisions>
## Implementation Decisions

### Chart color palette
- **Aurora-adjacent jewel tones** — vibrant purples, teals, greens, pinks that complement the v2.2 aurora gradient
- Palette should feel part of the v2.2 visual system, not generic charting defaults

### Post-rebuild behavior
- After Phase 24 triggers an index rebuild and t-SNE cache is invalidated, the scatter plot **does not auto-detect the change**
- Fresh data loads on the admin's next visit to the Intelligence tab (reload required)
- No need to handle live invalidation while the admin is on the tab

### Claude's Discretion
All other visualization, UX, and layout decisions are deferred to Claude:

- **Chart container style** — Glass card (Phase 22 aesthetic) vs. darker utilitarian panel; what works best as a data visualization surface
- **Title and description** — Whether to label the chart, and how much explanation text to include
- **Legend placement** — Below chart, right side, or top; Claude decides based on category count
- **Computing state appearance** — What the admin sees while t-SNE computes (up to 30s): spinner, skeleton, progress message, etc.
- **Polling strategy** — Whether the frontend auto-polls the 202 endpoint or requires manual refresh
- **Failure handling** — What shows if t-SNE computation fails; graceful without over-engineering
- **Click behavior** — Whether clicking a point does anything (profile link, highlight, etc.) or is hover-only
- **Zoom/pan** — Whether 530 points warrant zoom/pan capability or a fixed overview is sufficient
- **Legend interactivity** — Whether category legend items toggle visibility
- **Tooltip content** — Name only, name + category, or name + category + job title
- **Chart height** — Fixed px vs. responsive; should accommodate 530 points with visible cluster separation
- **Position in Intelligence tab** — Where the chart sits relative to Phase 25 metrics (below, side-by-side, sub-section)
- **Collapsibility** — Always visible or collapsible toggle
- **Last-updated timestamp** — Whether to show when the map was last computed

</decisions>

<specifics>
## Specific Ideas

- Jewel-tone palette requirement: colors should feel designed, not default — reference the aurora gradient (purple/teal/green/pink family)
- Planning notes confirm: Recharts `ScatterChart` is the chosen library; `PCA(50)` → `TSNE(perplexity=30, max_iter=1000, cosine)` are locked implementation details
- The backend endpoint returns `{"status": "computing"}` with HTTP 202 until ready; frontend needs a state for this

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 26-embedding-heatmap*
*Context gathered: 2026-02-22*
