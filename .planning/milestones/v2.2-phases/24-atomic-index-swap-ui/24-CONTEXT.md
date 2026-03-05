# Phase 24: Atomic Index Swap UI - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin panel UI for triggering a FAISS index rebuild and monitoring its status in real time. The backend swap logic already exists in `admin.py` — this phase is purely the frontend surface. Live search requests must remain uninterrupted during the rebuild.

</domain>

<decisions>
## Implementation Decisions

### Rebuild trigger & confirmation
- Clicking "Rebuild Index" shows a confirmation dialog before triggering — no immediate fire
- The "Rebuild Index" button is disabled (grayed out) while a rebuild is already running
- Visual difference between "never run" vs "previously completed": Claude's discretion
- If the rebuild endpoint returns an error (e.g. 409 conflict): Claude handles gracefully

### Status display style
- Running state: Claude's discretion (spinner, pulsing badge, etc.)
- Completed state: Green badge with timestamp — e.g. "✔ Complete — finished at 14:32"
- Failed state: Claude's discretion (red badge, error hint)
- Status persistence: Claude's discretion — poll `GET /api/admin/ingest/status` on mount so status survives page refresh

### Rebuild button placement
- Location within the panel: Claude's discretion based on existing admin layout
- Visible to all admins — no role restriction beyond existing admin auth
- Section heading with a brief description below it — e.g. "Index Management — Rebuild the FAISS search index from current expert data"
- Lives on a dedicated Settings or Tools page (one level deeper than the main overview)

### Polling & page-leave behavior
- Poll interval while running: every 10 seconds
- Polling stop on terminal state: Claude's discretion
- Page-return behavior (admin returns after navigating away mid-rebuild): Claude's discretion
- Cross-page notification when rebuild finishes: Claude's discretion (least intrusive approach)

### Claude's Discretion
- Running state indicator design
- Failed state display
- Never-run vs completed visual distinction
- 409/error state handling (re-fetch and reflect vs toast)
- Polling lifecycle (stop on terminal state or keep always-on)
- Page-leave and page-return status behavior
- Cross-page notification approach

</decisions>

<specifics>
## Specific Ideas

No specific references or "I want it like X" moments — open to standard approaches that fit the existing admin panel style.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 24-atomic-index-swap-ui*
*Context gathered: 2026-02-22*
