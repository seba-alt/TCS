# Phase 13: Search Lab A/B Comparison - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Search Lab can run a single query across up to 4 intelligence configurations simultaneously and display results as side-by-side columns. A diff view highlights rank changes, new appearances, and dropped experts across configs. Per-run flag overrides let the admin force-enable features for that single run without touching global settings in the DB.

</domain>

<decisions>
## Implementation Decisions

### Column layout & info density
- Each result row shows: expert name, relevance score, job title, and domain tags
- Default result count: top 20, with the count being configurable per run
- Rank number displayed on each row: present but subtle (small, muted — does not compete with expert name)
- When columns have different-length result lists: Claude's discretion (likely empty-slot placeholders to maintain row alignment)

### Diff highlighting design
- Rank changes indicated with **both** color-coded row background (warm = moved up, cool = moved down) **and** a delta badge next to the score (e.g. "+3" or "-5")
- Experts absent from a config: Claude's discretion (likely ghost/grayed placeholder row so columns stay aligned)
- Comparison anchor: Claude's discretion (most intuitive — likely baseline as anchor since it is the "no intelligence" reference)
- Diff view is a **toggle button, default off** — clean results by default, diff mode on demand

### Configuration selection UX
- 4 presets are available; admin checks which to include (default all checked, can deselect down to 2 or 3)
- Config selection lives in a **collapsible panel below the query bar**
- How compare mode is entered: Claude's discretion (e.g. selecting 2+ configs could auto-enable multi-column layout)
- Preset config names: Claude's discretion (clear, concise labels consistent with the rest of the admin UI)

### Per-run override UX
- Override placement: Claude's discretion (likely co-located with config selection in the collapsible panel)
- Override scope: Claude's discretion (interpret from success criteria — likely applies to all selected configs for the run)
- Override persistence: Claude's discretion (likely sticky within session, reset on page reload — balances convenience and clarity)
- Active overrides should show a **prominent banner or badge** (e.g. "Overrides active: HyDE forced ON") — must be obvious to the admin

### Claude's Discretion
- Row alignment strategy for mismatched column lengths
- Ghost/placeholder row design for absent experts
- Comparison anchor logic for diff calculation
- How compare mode is entered (single config vs. multi-column transition)
- Preset configuration label naming
- Override panel placement within collapsible section
- Override scope (global-to-run vs. per-config)
- Override reset timing

</decisions>

<specifics>
## Specific Ideas

No specific references or "I want it like X" moments — open to standard approaches informed by the decisions above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 13-search-lab-a-b-comparison*
*Context gathered: 2026-02-21*
