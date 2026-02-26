# Phase 36: Foundation - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Restructure routes (`/` → BrowsePage stub, `/explore` → Explorer, `/marketplace` → permanent redirect to `/explore`), add shared Zustand `navigationSlice` for cross-page state handoff, and extend the Expert SQLAlchemy model with a nullable `photo_url` column. This is infrastructure — no Browse UI beyond a stub.

</domain>

<decisions>
## Implementation Decisions

### Navigation state shape
- `navigationSlice` includes a `navigationSource` field: `'browse' | 'sage' | 'direct'` — tracks where the user came from so downstream pages can adapt UI (e.g., "Back to Browse" vs "Sage results for...")
- `pendingSageResults` is cleared after Explorer consumes them on mount — prevents stale results on subsequent visits
- `pendingSearchQuery` field stores the Sage search text alongside results, so Explorer can display contextual headers like "Showing results for: machine learning experts"
- `navigationSlice` is NOT persisted to localStorage (per success criteria)

### Claude's Discretion
- Whether `pendingSageResults` stores full expert objects or just IDs (pick what works best with existing data patterns)
- BrowsePage stub content and layout
- Explorer relocation approach (pure path swap vs any minor tweaks)
- Redirect implementation details for `/marketplace` → `/explore`
- `photo_url` column migration strategy (idempotent ALTER TABLE approach)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for the route restructuring, redirect, and model extension. The key constraint is that the Zustand slice must enable the Sage → Explorer handoff pattern clearly.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 36-foundation*
*Context gathered: 2026-02-24*
