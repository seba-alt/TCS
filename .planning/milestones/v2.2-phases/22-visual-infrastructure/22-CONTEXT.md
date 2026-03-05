# Phase 22: Visual Infrastructure - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a premium aurora aesthetic as visual infrastructure: animated aurora mesh gradient background, OKLCH CSS custom properties for aurora and glass colors, and glassmorphism surfaces on FilterSidebar, SearchInput, and SagePanel. Text contrast must pass 4.5:1 measured over the actual aurora. Graceful degradation required for unsupported browsers.

Phase 23 (ExpertCard redesign, tag cloud) builds on these tokens and background — this phase delivers the foundation only.

</domain>

<decisions>
## Implementation Decisions

### Aurora palette & mood
- Color family: cool aurora — blues, cyans, teals, violets anchored to brand purple `#5128F2`
- Visibility: subtle atmosphere — barely-there, content dominates; aurora never competes with UI
- Base background: Claude decides (keeping brand purple in mind) — suggested deep purple-tinted near-black (~`#05050a`) so the aurora sits naturally on brand
- Blob structure: Claude decides — radial gradient blobs that drift are preferred over a smooth wash (more aurora-authentic, animates well)

### Glass surface style
- Blur: light frosted — `backdrop-filter: blur(4px)` (`blur-sm` equivalent)
- Tint: brand-purple/8 — dark surface with a subtle `#5128F2` tint at ~8% opacity
- Border: Claude decides — subtle `white/10` 1px border recommended (classic glassmorphism separator, less aggressive than purple border at this blur level)
- Surface hierarchy: Claude decides — apply slight hierarchy where visually appropriate (SagePanel as the primary AI surface may warrant marginally more weight)

### Animation character
- Cycle duration: slow — 15–25s per full drift cycle
- Behavior: pause animation when tab is hidden (`visibilitychange`); respect `prefers-reduced-motion` (freeze gradient, keep static fallback)
- Cursor interaction: Claude decides — given the "subtle atmosphere" intent, purely ambient animation is preferred (no cursor following); keeps it lightweight and non-distracting
- Loop: seamless — no visible reset or jump at cycle boundary

### Fallback aesthetic (unsupported browsers)
- backdrop-filter unsupported: opaque surface in the same brand-purple-tinted dark tone as the glass tint — looks intentional, not broken
- Animation/gradient unsupported: static version of the aurora gradient (same colors, frozen) — not a solid color
- Design standard: fallback must look like a first-class design choice, not a degraded state
- OKLCH token scope: Claude decides — scope tokens to aurora + glass elements this phase; name them semantically (e.g., `--aurora-teal`, `--glass-surface`) so they can expand in future phases without replacing existing Tailwind brand values in `tailwind.config.ts`

### Claude's Discretion
- Exact OKLCH values for each aurora color stop
- Specific blur value (may land between `blur-sm` and `blur-md` depending on rendered result)
- Border width and exact opacity on glass surfaces
- Whether SagePanel gets a distinct glass treatment vs sidebar/search
- Whether to implement aurora as CSS `@keyframes` on `background-position` or via SVG filter approach
- Exact anchor point for the base background color (dark purple-tinted black)
- Cursor interaction implementation (purely ambient recommended)

</decisions>

<specifics>
## Specific Ideas

- Brand purple `#5128F2` is the existing brand anchor — aurora palette should feel like this purple has expanded into teal and deep blue, not departed from it
- The existing expert card hover uses a purple glow (`rgba(81, 40, 242, 0.25)`) — aurora and glass should feel consistent with this existing brand language
- "Subtle atmosphere" means: if you took a screenshot and cropped out the aurora, you'd miss it — it's ambiance, not a feature

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 22-visual-infrastructure*
*Context gathered: 2026-02-22*
