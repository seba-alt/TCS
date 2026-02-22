# Phase 21: Documentation & Cleanup - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Bring all planning artefacts (VERIFICATION.md files, REQUIREMENTS.md, code comments) into sync with the actual shipped implementation so the v2.0 milestone audit can pass. This phase writes retroactive docs and makes surgical fixes — it does not change any product behaviour.

</domain>

<decisions>
## Implementation Decisions

### VERIFICATION.md format & depth
- Agent picks the most sensible format/structure based on existing phase VERIFICATION.md files (no fixed template required)
- Depth should match existing phases (e.g. Phase 17 or 18 level of detail)
- Status should be `passed` — these are retroactive docs for already-shipped, production code
- Source: primary from existing plan SUMMARY.md files, confirmed against actual code files for key facts (both — SUMMARYs + code spot-check)
- Applies to: Phase 16 (Marketplace Page & Sidebar) and Phase 19 (Extended Features)

### Requirement language updates (MARKET-05 & Phase 17 VERIFICATION.md)
- Agent judges how much to rewrite MARKET-05 based on how wrong the current text is — minimal surgical fix if close, fuller rewrite if the current wording is substantially wrong
- Phase 17 VERIFICATION.md animation description: agent picks level of detail (label-only vs behaviour description) based on surrounding context
- tags.slice count (0,3 → 0,2): agent investigates the actual code to confirm the real value before updating the doc
- Phase 17 VERIFICATION.md full accuracy: agent flags anything obviously wrong it spots while editing, but primary task is the two known issues

### LEAD-03 deferral
- Treat as minor — just mark it deferred with a brief v2.1 backlog note
- Tone and placement: agent follows whatever pattern other deferred requirements use in REQUIREMENTS.md
- Agent checks if a v2.1 milestone exists in the roadmap and references it formally if so; otherwise uses 'v2.1 backlog' as a placeholder label

### Dead code scan breadth
- Scan all Phase 14–20 frontend/backend files for dead comments and stale code
- If dead code is found during reads, fix it inline (don't just note it)
- Code changes committed separately from documentation changes
- The known `_state?.triggerSearch()` comment in the Phase 15 store is confirmed dead — delete it without further investigation

### Commit conventions
- Documentation changes (VERIFICATION.md, REQUIREMENTS.md) → one commit
- Code changes (dead comment removal) → separate commit

### Claude's Discretion
- Exact format and section headings for Phase 16 and 19 VERIFICATION.md files
- Whether to expand or just label-correct the MARKET-05 requirement
- Depth of Phase 17 VERIFICATION.md animation description
- Placement of LEAD-03 deferral (in-place flag vs separate section)
- What else is obviously dead in the codebase during the scan

</decisions>

<specifics>
## Specific Ideas

- The audit specifically called out five items (VERIFICATION.md for phases 16 & 19, MARKET-05 animation wording, LEAD-03 deferral, dead triggerSearch comment, and tags.slice count). These are the minimum bar; anything else fixed is a bonus.
- Dead code scan should be thorough across phases 14–20 since the user explicitly wants a broad cleanup pass with inline fixes.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 21-documentation-cleanup*
*Context gathered: 2026-02-22*
