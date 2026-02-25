# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** A user describes any problem and instantly gets expertly matched professionals they can browse, filter, and contact — no searching, no guesswork.
**Current focus:** v3.0 Netflix Browse & Agentic Navigation — Phase 40.2 complete (UAT fixes and Browse Explorer enhancements)

## Current Position

Phase: 40.2 of 40.2 (UAT Fixes and Browse Explorer Enhancements)
Plan: 2 of 2 complete
Status: Phase 40.2 complete — Browse card alignment, hero taglines, email gate, Sage search, Explorer photos, Clear All pill, save/bookmark
Last activity: 2026-02-25 — Phase 40.2 complete (BrowseCard alignment, HeroBanner taglines, email gate on Browse, Sage clean filters, ExpertCard photos + bookmark, FilterChips pill styling)

Progress: [██████████] 100% (13 plans complete)

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
- Phase 40 Plan 01: useNavigationSlice hook deleted (zero callers) — createNavigationSlice and NavigationSlice type retained
- Phase 40 Plan 01: setNavigationSource('direct') unconditional after pilot gate — idempotent on primitives, prevents sticky-state across same-session Explorer visits
- Phase 40.1 Plan 01: initial={{ height: 220 }} instead of minHeight for motion.div containing block — minHeight does NOT work for absolute-inset children
- Phase 40.1 Plan 01: HeroBanner photo branch deleted entirely — portrait photos don't work as wide banners, gradient-only is correct design
- Phase 40.1 Plan 01: Overlay gradient darkened to from-black/85 via-black/55 for text readability over bright photos
- Phase 40.1 Plan 02: CachedBrowseData interface re-declared in navigationSlice to avoid circular dependency with useBrowse
- Phase 40.1 Plan 02: 5-min TTL browse cache in Zustand — balances freshness with session navigation speed
- Phase 40.1 Plan 02: SeeAllEndCard changed from dark glass (bg-white/5) to light glass (bg-white/60) for aurora theme
- Phase 40.2 Plan 01: BrowseCard overlay uses flex-col justify-end for consistent bottom alignment of name/rate/tags
- Phase 40.2 Plan 01: BrowseRow scroll container left padding increased to pl-8 md:pl-16 for first-card visibility past fade overlay
- Phase 40.2 Plan 01: HeroBanner taglines mapped from expert category field via CATEGORY_TAGLINES record (fallback to default tagline)
- Phase 40.2 Plan 01: Email gate on Browse reuses NewsletterGateModal + useNltrStore (identical to Explorer pattern)
- Phase 40.2 Plan 01: useSage sends clean empty filter state when on Browse (not Explorer) for reliable search_experts triggering
- Phase 40.2 Plan 02: Backend ExpertCard model includes photo_url (built as /api/photos/{username} proxy URL)
- Phase 40.2 Plan 02: ExpertCard renders 32px circle avatar (w-8 h-8) — hidden entirely when no photo (no placeholder)
- Phase 40.2 Plan 02: Bookmark icon (lucide Bookmark) at right edge of ExpertCard Zone A — fill-current text-brand-purple when saved
- Phase 40.2 Plan 02: tcs_saved_experts localStorage key stores array of saved usernames
- Phase 40.2 Plan 02: savedFilter added to Zustand filterSlice (ephemeral, not persisted) — ExpertGrid filters displayExperts via useMemo
- Phase 40.2 Plan 02: Clear All styled as pill (bg-red-50 text-red-600 rounded-full) matching existing chip pattern

### Pending Todos

- Set `ALLOWED_ORIGINS=https://tcs-three-sigma.vercel.app` in Railway environment variables (carried over from v1.1)
- Verify FTS5 availability on Railway SQLite at startup

### Roadmap Evolution

- Phase 40.1 inserted after Phase 40: optimization and debugging of v3 (URGENT)
- Phase 40.2 inserted after Phase 40: UAT fixes and Browse Explorer enhancements (URGENT)

### Blockers/Concerns

None — photo backend is ready for Browse UI consumption

## Session Continuity

Last session: 2026-02-25
Stopped at: Phase 40.2 complete — UAT fixes and Browse Explorer enhancements done
Resume signal: All v3.0 phases + UAT fixes complete. Ready for next milestone or deployment.
Resume file: .planning/phases/40.2-uat-fixes-and-browse-explorer-enhancements/40.2-02-SUMMARY.md
