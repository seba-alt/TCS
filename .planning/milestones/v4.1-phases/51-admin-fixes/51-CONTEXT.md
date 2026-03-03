# Phase 51: Admin Fixes - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the admin overview page to show accurate live statistics, make stat cards clickable to navigate to their corresponding detail pages, and add expert deletion (single + bulk) with confirmation and auto FAISS rebuild. No new admin pages or dashboard redesigns.

</domain>

<decisions>
## Implementation Decisions

### Stat Definitions
- **Leads:** Email submissions as primary metric, profile clicks as secondary — both tracked and shown
- **Gaps:** Zero-result searches (queries that returned no matching experts)
- **Searches:** All search queries, including anonymous (no email)
- The core issue is that all stats currently show zero — this is a bug to investigate and fix

### Stat Card Navigation
- Total Leads → `/admin/leads` (existing Leads page)
- Expert Pool → `/admin/experts` (existing Experts page)
- Total Searches → `/admin/marketplace` (Marketplace Intelligence page)
- Top Searches → `/admin/marketplace` (Marketplace Intelligence page)
- Gaps → `/admin/marketplace` (Marketplace Intelligence page)
- Lead Rate → `/admin/marketplace` (Marketplace Intelligence page)
- Matches → `/admin/marketplace` (Marketplace Intelligence page)

### Expert Deletion
- Both single delete (per-row button) and bulk delete (checkbox multi-select + delete selected)
- Hard delete — permanently removed from database
- Confirmation dialog before deletion ("Delete Expert X? This cannot be undone." / "Delete N experts? This cannot be undone.")
- Auto FAISS index rebuild triggered after deletion completes

### Claude's Discretion
- "Matches" definition — pick the most useful metric (expert cards shown vs clicks vs search-result count)
- "Lead rate" formula — pick the most meaningful conversion metric
- How to surface the primary vs secondary lead metric in the UI
- Loading states during FAISS rebuild after deletion

</decisions>

<specifics>
## Specific Ideas

- The overview stats are all stuck at zero currently — this is the primary bug to investigate (query, data, or display issue)
- Stat cards should feel clickable (cursor, hover state) and navigate on click
- Expert deletion should be accessible from the existing admin experts list

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 51-admin-fixes*
*Context gathered: 2026-03-02*
