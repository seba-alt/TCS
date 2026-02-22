# Phase 33: Command Center Header - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Transform `Header.tsx` from a minimal logo + tagline into a "Command Center" — glassmorphic frosted-glass panel, aurora radial gradient backdrop, animated search bar with rotating playful placeholders, Sage-in-flight pulse indicator, and a tilt + particle easter egg. The header search bar replaces the sidebar SearchInput. Expert count stays in FilterChips (unchanged from Phase 32). `AuroraBackground.tsx` is untouched — the header gets its own scoped radial gradient layer.

</domain>

<decisions>
## Implementation Decisions

### Search bar role
- Header search bar **replaces** the sidebar `SearchInput.tsx` — removes that component entirely from the sidebar
- Sidebar layout starts directly with rate slider + tags (no search row)
- Header search is `max-w-2xl centered` — floating feel, breathing room on wide screens
- Controlled input: reads `store.query`, writes `store.setQuery` on change
- Expert count remains in FilterChips only (not duplicated in header)

### Visual intensity
- `backdrop-blur-md bg-white/70 border-b border-white/20` — noticeable glass, balanced
- Aurora radial gradient: **moderate 8-10% opacity** — visible warmth, purple-to-deep-blue bloom at top-right corner
- Logo glow: `drop-shadow-[0_0_15px_rgba(139,92,246,0.30)]` — soft purple halo
- Aurora background motion: **Claude's discretion** — pick what's tasteful alongside search bar and Sage pulse animations

### Placeholder animation
- Style: **fade crossfade** — one fades out, next fades in (Framer Motion AnimatePresence)
- Timing: **4-5 second** interval between rotations
- Pause logic: pause rotation when input has any text (not on focus alone)
- Quantity: **6-8 phrases**, Claude writes them — playful, brand-aligned, varied

### Easter egg
- Trigger: typing **"tinrate"** exactly in the header search bar
- Effects: 3-degree header tilt **+ small floating star/emoji particles burst from logo corner for ~1s**
- Post-trigger: input is cleared ("consumed")
- Frequency: fires **every time** "tinrate" is typed — always rewarding

### Claude's Discretion
- Aurora background animation (static vs very slow drift) — pick what's tasteful
- Exact star/emoji particle emoji choice and count
- Framer Motion spring/easing values for tilt and scale animations
- Error state for search input

</decisions>

<specifics>
## Specific Ideas

- "The header should no longer look like a standard website nav. It should feel like a Command Center for an intelligent marketplace — clean, deep, and reactive."
- Sage-in-flight pulse: a holographic `animate-pulse` glow appears **left of the search icon** while `sageMode` is transitioning (Sage query in flight)
- Search bar: `focus-within:ring-2 focus-within:ring-brand-purple/20 focus-within:border-brand-purple/40` + Framer Motion `scale: 1.02` on focus
- The glass header should show the expert grid scrolling underneath — depth and layering is the point
- Logo should pop from the glass, not blend into it

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 33-command-center-header*
*Context gathered: 2026-02-22*
