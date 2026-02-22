# Phase 20: Bug Fixes — Pagination & Rate Filter - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix two functional bugs identified by the v2.0 audit: (1) infinite scroll breaks when a text query is active because `loadNextPage` sends the wrong API param (`q` instead of `query`), and (2) the rate filter chip shows "EUR 0–5000" on fresh page load when no rate filter is active. Also aligns `RateSlider` max to 5000 and fixes `MobileFilterSheet` rate defaults + `TOP_TAGS` import. New features are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Regression tests
- Tests are a **blocker** — phase is not complete without passing regression tests
- Claude decides: whether to add tests, where they live, and what level (unit vs integration)
- Tests must cover at minimum: the pagination param fix and the rate filter chip state on load

### Audit scope
- While fixing the `q`→`query` param in `loadNextPage`, audit all other API call sites for similar wrong param names and fix any found
- For `MobileFilterSheet`, audit all store/sheet state sync issues (not just rate defaults) and fix any found
- Check mobile vs desktop filter behavior parity; fix any gaps found
- Out-of-scope findings (not fixable within this phase's boundary) should be logged to ROADMAP.md backlog

### Constants consolidation
- Audit ALL rate-related constants across the codebase (min, max, defaults) and fix any that conflict with the store's source of truth — not just `DEFAULT_RATE_MAX`
- `DEFAULT_RATE_MAX` value changes: 2000 → 5000 everywhere
- `RateSlider` max aligns to 5000
- Audit all files for inline copies of `TOP_TAGS`; make all files import from `constants/tags.ts` (not just `MobileFilterSheet`)
- Source of truth for rate constants: Claude decides based on project patterns
- Build/typecheck must pass as a verification step after all constant and import changes

### Claude's Discretion
- Which test framework and file locations to use for regression tests
- Where the single source of truth for rate constants should live (constants file vs store)
- Test depth/level (unit vs integration) per fix

</decisions>

<specifics>
## Specific Ideas

- Fixes are surgical — don't refactor surrounding code unless an audit finding requires it
- Build check (`tsc` / `vite build`) is a required verification step, not optional

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 20-bug-fixes-pagination-rate-filter*
*Context gathered: 2026-02-22*
