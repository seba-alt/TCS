# Phase 59: Tech Debt Cleanup - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Resolve all v5.0 tech debt identified by the milestone re-audit: remove dead code paths, formally close partial requirements, add missing traceability entries, and delete orphaned files. No new features — strictly cleanup and documentation alignment.

</domain>

<decisions>
## Implementation Decisions

### LeadsPage button removal
- Remove the "Searches →" button entirely from LeadsPage
- Delete the `navigate('/admin/data', { state: { email } })` call and all related email state passing
- Clean removal — no commented code, no TODOs, no backward-compat shims
- Let the remaining row layout adjust naturally after button removal

### ADMUI-03 resolution
- Close ADMUI-03 as N/A in the traceability table
- Include a brief reason: "N/A — Sage data source retired"
- Do NOT rewrite the requirement text or mark it as satisfied

### ADMUI traceability
- Add ADMUI-01, ADMUI-02, ADMUI-03, ADMUI-04 to REQUIREMENTS.md traceability table
- ADMUI-01, 02, 04: Phase column = "58.1", Status = "Complete"
- ADMUI-03: Phase column = "58.1", Status = "N/A — Sage data source retired"

### Orphaned file cleanup
- Delete AdminMarketplacePage.tsx immediately (git history preserves it)
- Quick scan the admin directory for other orphaned files (not imported, not routed)
- Delete any additional confirmed orphans found during the scan

### Claude's Discretion
- Exact scan scope for orphan detection (which directories to check)
- Whether to clean up any dead imports left by the button removal
- Commit granularity (single commit vs per-item)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — straightforward cleanup guided by the audit findings.

</specifics>

<deferred>
## Deferred Ideas

- Overview page: show top experts (most clicked) — new feature, own phase
- Overview page: show top searches — new feature, own phase
- Overview page: show zero-result searches as unmet demand/gaps — new feature, own phase

</deferred>

---

*Phase: 59-tech-debt-cleanup*
*Context gathered: 2026-03-03*
