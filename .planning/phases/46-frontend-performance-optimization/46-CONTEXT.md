# Phase 46: Frontend Performance Optimization - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Lazy-load admin routes via React.lazy and split large vendor libraries (Recharts, react-table) into separate chunks. Public Explorer users should not download admin JS. Suspense fallback required while admin chunks load.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
- All implementation decisions — this phase is purely technical with clear success criteria
- Loading fallback design (spinner, skeleton, or branded splash while admin chunks load)
- Vite manualChunks configuration strategy
- How aggressively to split beyond the required admin/vendor separation

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

*Phase: 46-frontend-performance-optimization*
*Context gathered: 2026-02-27*
