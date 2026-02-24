# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** A user describes any problem and instantly gets expertly matched professionals they can browse, filter, and contact — no searching, no guesswork.
**Current focus:** v3.0 Netflix Browse & Agentic Navigation — Phase 39: Sage Cross-Page Navigation

## Current Position

Phase: 39 of 39 (Sage Cross-Page Navigation)
Plan: 2 of 2 complete
Status: Phase 39 complete — v3.0 milestone complete
Last activity: 2026-02-24 — Phase 39 Plan 02 complete (discovery auto-navigation, pending results consumption)

Progress: [██████████] 100% (8 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed (v3.0): 8
- Prior milestone (v2.3): 17 plans across 9 phases

**By Phase (v3.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 36. Foundation | 2/2 | 3min | ~1.5min |
| 37. Backend Endpoints | 2/2 | 5min | ~2.5min |
| 38. Browse UI | 2/2 | 4min | ~2min |
| 39. Sage Cross-Page Navigation | 2/2 | 6min | ~3min |

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- v3.0 scoping: Billboard Hero (BROWSE-05), aurora page transitions (NAV-03/NAV-04), and Sage navigate_to function (SAGE-05) deferred to v2 requirements
- v3.0 architecture: navigationSlice is ephemeral (not persisted) — sageMode must be set BEFORE navigate() to prevent competing 530-expert fetch on Explorer mount
- Phase 36: resetPilot() gated by navigationSource — direct=reset, browse/sage=preserve (highest-risk change resolved)
- Phase 36: pendingSageResults stores full Expert objects (not IDs) — matches existing resultsSlice pattern
- Phase 36: MarketplaceRedirect uses useSearchParams for query param preservation in SPA redirect
- Phase 37: Photo proxy uses StreamingResponse (not redirect) — preserves HTTPS enforcement and cache control
- Phase 37: Browse card photo_url points to /api/photos/{username} proxy (not raw stored URL)
- Phase 37: Case-insensitive name matching for bulk photo CSV import
- Phase 38 Plan 01: Dark gradient overlay (not .glass-surface) for BrowseCard — backdrop-filter breaks inside overflow:hidden
- Phase 38 Plan 01: Deterministic monogram gradient via charCodeAt(0) % 6 palette for consistent per-expert color
- Phase 38 Plan 01: Mobile second-tap on expanded card opens profile_url in new tab
- Phase 38 Plan 02: HeroBanner rotation uses setInterval cleared on paused=true — simple and sufficient for 5s cadence
- Phase 38 Plan 02: recently-added slug mapped to 'Recently Joined' display label inline in BrowsePage (UI concern, not hook/backend)
- Phase 38 Plan 02: setNavigationSource('browse') called BEFORE navigate() — maintains Phase 36 pattern for browse navigation
- Phase 39 Plan 01: SagePopover 340x420px (smaller than SagePanel) for lightweight Browse chat bubble
- Phase 39 Plan 01: RootLayout wraps / and /explore — single source for Sage FAB/panel/popover rendering
- Phase 39 Plan 01: Filter glow on SageFAB suppressed when not on /explore
- Phase 39 Plan 02: 2s setTimeout before auto-navigation — user reads "Found X experts..." first
- Phase 39 Plan 02: sageMode + pendingSageResults set BEFORE navigate() — critical race condition prevention
- Phase 39 Plan 02: Non-discovery questions on Browse just show message (no filter application)

### Pending Todos

- Set `ALLOWED_ORIGINS=https://tcs-three-sigma.vercel.app` in Railway environment variables (carried over from v1.1)
- Verify FTS5 availability on Railway SQLite at startup

### Blockers/Concerns

None — photo backend is ready for Browse UI consumption

## Session Continuity

Last session: 2026-02-24
Stopped at: Phase 39 complete — v3.0 Netflix Browse & Agentic Navigation milestone complete
Resume signal: Push to main to deploy, then verify in production
