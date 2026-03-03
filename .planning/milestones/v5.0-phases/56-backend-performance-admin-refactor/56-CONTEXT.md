# Phase 56: Backend Performance & Admin Refactor - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Eliminate redundant backend work (embedding cache, tag filtering optimization, feedback/settings caching) and split the 2,225-line admin router monolith into maintainable modules. Pure backend/infrastructure phase — no frontend changes.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
User deferred all implementation decisions to Claude. The following areas should be resolved during research/planning based on what's best for the codebase:

**Admin route module split:**
- How to organize the 2,225-line admin.py into sub-modules
- Grouping strategy (by page, by concern, or hybrid)
- Maintaining backward-compatible endpoint paths

**Embedding cache:**
- Cache TTL duration
- Invalidation strategy (TTL-only vs event-driven on FAISS rebuild/expert changes)
- In-memory vs file-backed cache

**Tag filtering optimization:**
- Approach: separate join table vs SQLite JSON functions vs other
- Migration strategy if schema changes are needed
- Impact on existing tag-related endpoints

**Feedback and settings caching:**
- Cache scope (per-request, time-based TTL, or hybrid)
- Invalidation when settings are updated via admin

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User trusts Claude to make the right technical calls for the current scale and codebase.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 56-backend-performance-admin-refactor*
*Context gathered: 2026-03-03*
