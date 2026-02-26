# Phase 42: Backend Error Hardening - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix all backend Sentry error sources (photo proxy 502s, FTS5 empty-string 500s, deprecated Gemini model) and align Search Lab's query pipeline with the live run_explore() pipeline used by the search bar and Sage. No new features — hardening and alignment only.

</domain>

<decisions>
## Implementation Decisions

### Empty search handling
- Block submission when input is empty (disable search button / ignore enter on whitespace-only input)
- Special characters (e.g. `***`) are allowed through — zero results is acceptable, only truly empty strings are blocked
- Backend must also guard FTS5 MATCH against empty/invalid strings as a safety net (belt and suspenders)

### Search Lab pipeline alignment
- Keep the current Search Lab UI identical — fix the pipeline under the hood only
- Default to run_explore() as the base pipeline
- A/B comparison should allow different bases — one side can use the legacy pipeline for validating alignment
- Show a pipeline label/badge on each result set so it's clear which pipeline produced the results (e.g. "run_explore" vs "legacy")

### Error feedback philosophy
- Photo fallback: completely silent — monogram appears without any error indicator
- Translation failure: show original untranslated text rather than an error message
- General approach: graceful degradation, never surface raw errors to users

### Claude's Discretion
- Scope of empty-input guards across entry points (search bar, Sage, Search Lab, API endpoints) — based on where Sentry errors are actually firing
- Whether to add placeholder text hints on disabled search state — based on current UX
- Photo proxy response strategy (404 with empty body vs returning placeholder image) — based on least code change and robustness
- Which errors warrant a subtle user-facing fallback message vs completely silent logging
- Whether to keep the legacy pipeline option permanently or remove after verification — based on maintenance burden

</decisions>

<specifics>
## Specific Ideas

- Pipeline labels in Search Lab should make it easy to verify alignment is working during testing
- The legacy pipeline comparison option is explicitly wanted for validating the alignment itself

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 42-backend-error-hardening*
*Context gathered: 2026-02-26*
