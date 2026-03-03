# Phase 59: Tech Debt Cleanup - Research

**Researched:** 2026-03-03
**Domain:** Frontend code cleanup + documentation alignment
**Confidence:** HIGH

## Summary

Phase 59 is a pure cleanup phase with no new features. Four distinct tasks: (1) remove the dead "Searches ->" button and email state passing from LeadsPage, (2) update ADMUI-03 status in REQUIREMENTS.md traceability table, (3) verify ADMUI-01/02/04 traceability entries are correct, and (4) delete the orphaned AdminMarketplacePage.tsx file.

All changes are localized to well-understood files. The codebase has been thoroughly audited and the exact locations of all tech debt items are known.

**Primary recommendation:** Execute as a single plan with 4 tasks since there are no dependencies between items and all changes are trivial.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Remove the "Searches ->" button entirely from LeadsPage
- Delete the `navigate('/admin/data', { state: { email } })` call and all related email state passing
- Clean removal -- no commented code, no TODOs, no backward-compat shims
- Let the remaining row layout adjust naturally after button removal
- Close ADMUI-03 as N/A in the traceability table
- Include a brief reason: "N/A -- Sage data source retired"
- Do NOT rewrite the requirement text or mark it as satisfied
- Add ADMUI-01, ADMUI-02, ADMUI-03, ADMUI-04 to REQUIREMENTS.md traceability table
- ADMUI-01, 02, 04: Phase column = "58.1", Status = "Complete"
- ADMUI-03: Phase column = "58.1", Status = "N/A -- Sage data source retired"
- Delete AdminMarketplacePage.tsx immediately (git history preserves it)
- Quick scan the admin directory for other orphaned files (not imported, not routed)
- Delete any additional confirmed orphans found during the scan

### Claude's Discretion
- Exact scan scope for orphan detection (which directories to check)
- Whether to clean up any dead imports left by the button removal
- Commit granularity (single commit vs per-item)

### Deferred Ideas (OUT OF SCOPE)
- Overview page: show top experts (most clicked) -- new feature, own phase
- Overview page: show top searches -- new feature, own phase
- Overview page: show zero-result searches as unmet demand/gaps -- new feature, own phase
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ADMUI-01 | Tag-only search rows render as chips, not blank | Already Complete in traceability -- verify entry is correct |
| ADMUI-02 | Overview page cleaned up | Already Complete in traceability -- verify entry is correct |
| ADMUI-03 | Searches + Marketplace merged into single Data page | Close as N/A in traceability (Sage data source retired) |
| ADMUI-04 | Click count column on Leads table | Already Complete in traceability -- verify entry is correct |
</phase_requirements>

## Standard Stack

No new libraries or dependencies needed. This phase only modifies existing files and deletes orphans.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | existing | Component modifications in LeadsPage.tsx | Already in project |
| react-router-dom | existing | Remove navigate/useLocation dead code | Already in project |

## Architecture Patterns

### Pattern 1: Clean Dead Code Removal
**What:** Remove unused code paths without leaving artifacts
**When to use:** Button removal, unused import cleanup
**Example:**
- Remove the entire `<td>` containing the "Searches ->" button
- Remove the `useNavigate` and `useLocation` imports if no longer used
- Remove the `highlightEmail` state and ref if no other code depends on them
- Remove `location.state?.email` consumption

### Anti-Patterns to Avoid
- **Commenting out instead of deleting:** Git history preserves everything; commented code is noise
- **Leaving unused imports:** After removing the button, `useNavigate` and `useLocation` may become dead imports
- **Half-removal:** Removing the button but leaving the email state reading logic

## Codebase Analysis

### LeadsPage.tsx Changes Required
**File:** `frontend/src/admin/pages/LeadsPage.tsx`

1. **Remove the "Searches ->" button** (lines 315-325): The entire `<td>` block containing the button that calls `navigate('/admin/data', { state: { email: lead.email } })`.

2. **Remove dead email state consumption** (line 26): `const highlightEmail: string = location.state?.email ?? ''` -- DataPage never reads this state.

3. **Remove dependent code after email state removal:**
   - Line 28: `const [expandedEmail, setExpandedEmail] = useState<string | null>(highlightEmail || null)` -- simplify to `useState<string | null>(null)`
   - Lines 75-79: `useEffect` for scroll-to-highlight -- remove entirely
   - Line 29: `highlightRef` -- remove if only used for highlight scrolling
   - Lines 261-262, 268, 290-294: `isHighlighted` logic and "from search" badge -- remove

4. **Clean up imports:**
   - `useNavigate` -- check if still used elsewhere in component. The `downloadLeadsCsv` and `downloadNewsletterCsv` functions don't use navigate. Nothing else calls `navigate`. **Remove `useNavigate` import.**
   - `useLocation` -- only used for `location.state`. **Remove `useLocation` import.**

5. **Reduce colSpan:** The table header has an empty `<th className="px-5 py-3" />` (line 249) for the Searches button column. Remove it and reduce `colSpan={6}` to `colSpan={5}` in the empty state and expanded row.

### AdminMarketplacePage.tsx Deletion
**File:** `frontend/src/admin/pages/AdminMarketplacePage.tsx`
- 435 lines of dead code. Not imported anywhere (main.tsx line 26 has a comment about it being removed).
- Safe to delete entirely.

### REQUIREMENTS.md Traceability Update
**File:** `.planning/REQUIREMENTS.md`
- Current state: ADMUI-01, 02, 04 already correct (Phase 58.1 / Complete)
- ADMUI-03 currently shows: `Phase 59 | Pending`
- Update to: `Phase 58.1 | N/A -- Sage data source retired`

### Additional Orphan: GapsTable.tsx "View Searches" Link
**File:** `frontend/src/admin/components/GapsTable.tsx` (line 77)
- Contains `navigate('/admin/searches', { state: { query: gap.query } })` pointing to a non-existent route
- `/admin/searches` hits the catch-all redirect to `/admin`
- This is dead navigation -- the button does nothing useful
- **Recommendation:** Remove or repurpose (Claude's discretion per CONTEXT.md)

## Common Pitfalls

### Pitfall 1: Incomplete Import Cleanup
**What goes wrong:** Removing code but leaving unused imports causes lint warnings
**Why it happens:** Focused on the JSX removal, forgot the import lines
**How to avoid:** After each removal, trace back to imports and verify they're still needed
**Warning signs:** `useNavigate`, `useLocation` appearing in import without usage

### Pitfall 2: ColSpan Mismatch
**What goes wrong:** Removing a table column but not updating colSpan causes misalignment
**Why it happens:** colSpan values are scattered across empty state and expanded rows
**How to avoid:** Search for all `colSpan` references in the file
**Warning signs:** Table cells not spanning full width

## Don't Hand-Roll

No hand-rolling concerns -- this is pure deletion and documentation update work.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vite dev server (no unit test framework configured) |
| Config file | vite.config.ts |
| Quick run command | `cd frontend && npx vite build 2>&1 | tail -5` |
| Full suite command | `cd frontend && npx vite build` |
| Estimated runtime | ~15 seconds |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADMUI-01 | Traceability entry correct | manual-only | Verify .planning/REQUIREMENTS.md content | N/A (doc) |
| ADMUI-02 | Traceability entry correct | manual-only | Verify .planning/REQUIREMENTS.md content | N/A (doc) |
| ADMUI-03 | Closed as N/A in traceability | manual-only | Verify .planning/REQUIREMENTS.md content | N/A (doc) |
| ADMUI-04 | Traceability entry correct | manual-only | Verify .planning/REQUIREMENTS.md content | N/A (doc) |

### Nyquist Sampling Rate
- **Minimum sample interval:** After every committed task -> run: `cd frontend && npx vite build 2>&1 | tail -5`
- **Full suite trigger:** After all code changes committed
- **Phase-complete gate:** Build succeeds + manual file verification
- **Estimated feedback latency per task:** ~15 seconds

### Wave 0 Gaps
None -- no test infrastructure needed for deletion-only work. Build verification sufficient.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all affected files
- `.planning/v5.0-MILESTONE-AUDIT.md` -- source of all tech debt items
- `.planning/REQUIREMENTS.md` -- current traceability state
- `.planning/phases/59-tech-debt-cleanup/59-CONTEXT.md` -- user decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies
- Architecture: HIGH - pure deletion, patterns well understood
- Pitfalls: HIGH - limited scope, all changes localized

**Research date:** 2026-03-03
**Valid until:** indefinite (cleanup of known items)
