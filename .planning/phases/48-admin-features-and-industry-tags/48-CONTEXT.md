# Phase 48: Admin Features and Industry Tags - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Lead export CSV, admin overview stat cards, improved bulk expert CSV import, and industry tag taxonomy with tag cloud integration and filtering. No new public-facing features beyond industry tags in the tag cloud and filter.

</domain>

<decisions>
## Implementation Decisions

### Lead export content
- Export includes ALL search queries and ALL profile clicks per lead (not truncated)
- Each query/click paired with its timestamp — useful for recency and intent analysis
- CSV columns: lead info + timestamped queries + timestamped profile clicks

### Industry tag taxonomy
- Use a standard industry taxonomy (simplified NAICS or GICS) adapted for this use case
- Auto-assign industry tags from job titles, companies, and bio text as a starting point
- Admin can override or correct auto-assigned tags through the admin panel
- Experts can have 1-3 industry tags (supports multi-industry consultants like fintech = Finance + Tech)
- Industry tags appear in their own separate labeled section in the tag cloud, visually distinct from domain tags
- Industry filters apply independently of domain tag filters

### CSV import flow
- Drag-and-drop zone upload UI with option to click and browse
- Preview rows shown before confirming import
- Column mapping UI after upload — admin matches CSV columns to expected fields
- Auto-regenerate embeddings and rebuild FAISS index after successful import

### Overview stat cards
- New stat cards placed in a top row above existing Sage volume stats
- Cards: Total Leads, Expert Pool, Top Searches (top 3-5 queries), Conversion Rate (% visitors → leads)
- Each card shows count + 7-day trend indicator (up/down arrow with delta vs previous 7-day period)

### Claude's Discretion
- CSV format for multi-value fields (semicolon-separated vs one-row-per-event)
- Date range filter on lead export (include or skip)
- Partial failure handling on CSV import (import valid + skip bad, or all-or-nothing)
- Exact industry list derived from standard taxonomy
- Auto-tagging algorithm (keyword matching vs LLM inference)
- Stat card visual design and refresh behavior

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

*Phase: 48-admin-features-and-industry-tags*
*Context gathered: 2026-02-27*
