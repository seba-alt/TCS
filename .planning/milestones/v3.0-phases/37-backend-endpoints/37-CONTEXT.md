# Phase 37: Backend Endpoints - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend API endpoints that serve curated Browse data (`GET /api/browse`), proxy expert photos (`GET /api/photos/{username}`), and allow admin bulk-import of photo URLs (`POST /api/admin/experts/photos`). No frontend UI — these endpoints are consumed by Browse UI in later phases.

</domain>

<decisions>
## Implementation Decisions

### Browse API response shape
- `featured` is an array of 3-5 expert objects (rotation set for the hero section — frontend picks which to display)
- Expert card fields: Claude's discretion based on what Browse UI phases will need
- Supports `?per_row=N` query param for experts per row, defaults to 10
- Cold-start guard: when user_events is empty, return default curated category rows (same structure, not personalized)

### Category definition
- Categories derived automatically from the existing `category` field on expert metadata — each unique category becomes a Browse row
- Minimum threshold: only categories with 3+ experts get a row (avoids sparse rows)
- Rows ordered by expert count descending (most populated categories first)
- Include 1-2 special cross-category rows alongside category rows (e.g., "Recently Added") for variety

### Admin bulk photo import
- CSV format: `first_name, last_name, photo_url` (matched by name, not username)
- Duplicate name handling: skip ambiguous matches, report them as "unresolved" in the response
- Existing photos: overwrite with new URL (admin is intentionally updating)
- Dry-run response: counts (matched, unresolved, will_overwrite) plus line-by-line detail of each match/skip/overwrite so admin can review before confirming

### Claude's Discretion
- Photo proxy implementation details (proxy bytes vs redirect, timeouts, error responses)
- Exact expert card fields in the Browse response
- Which special cross-category rows to include (e.g., "Recently Added", "Top Rated")
- HTTPS enforcement strategy for photo URLs in production

</decisions>

<specifics>
## Specific Ideas

- Browse rows should feel like Netflix category rows — each row is a horizontal scrollable set of expert cards
- The dry-run step is important for admin confidence — show exactly what will happen before writes occur
- Featured experts (3-5) serve the billboard/hero section of the Browse page

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 37-backend-endpoints*
*Context gathered: 2026-02-24*
