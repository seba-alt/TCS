---
phase: 43-frontend-fixes-analytics-tag-cloud
plan: 01
subsystem: ui
tags: [react, react-router, google-analytics, ga4, vite, typescript]

# Dependency graph
requires: []
provides:
  - Fixed redirect loop on legacy routes (/explore, /marketplace) using imperative useNavigate+useEffect pattern
  - GA4 analytics tracking (property G-0T526W3E1Z) with SPA route change support via useLocation
  - Desktop tag cloud showing 18 tags (up from 12) for better expert discovery
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Imperative redirect pattern: use useNavigate+useEffect with empty deps for one-shot redirects instead of declarative <Navigate> to avoid re-render loops"
    - "SPA analytics pattern: Analytics component using useLocation hook fires page_view on every route change, mounted inside RouterProvider context"
    - "GA4 send_page_view:false in gtag config + manual page_view via React component avoids double-counting on initial load"

key-files:
  created:
    - frontend/src/analytics.tsx
  modified:
    - frontend/src/main.tsx
    - frontend/src/components/sidebar/TagCloud.tsx
    - frontend/index.html
    - frontend/src/layouts/RootLayout.tsx

key-decisions:
  - "useNavigate+useEffect (imperative) over declarative <Navigate> for RedirectWithParams to eliminate Maximum call stack exceeded re-render loop"
  - "send_page_view:false in GA4 config is required — React Analytics component handles ALL page_view events to prevent double-counting on initial load"
  - "Analytics mounted in RootLayout (not AdminApp) — admin routes intentionally excluded from GA4 tracking per research recommendation"
  - "page_path includes query params (pathname + search) so tag filter interactions (/?tags=saas) are tracked as distinct page views"
  - "Ad-blocker guard: typeof window.gtag !== function check prevents runtime errors when gtag fails to load"

patterns-established:
  - "Redirect pattern: use useNavigate+useEffect([]) for any redirect that must preserve search params — never use declarative <Navigate> in a component that also calls useSearchParams"
  - "Analytics pattern: useLocation in a dedicated Analytics component, rendered as first child in layout, with null return"

requirements-completed: [ERR-02, DISC-01, ANLT-01, ANLT-02]

# Metrics
duration: 2min
completed: 2026-02-26
---

# Phase 43 Plan 01: Frontend Fixes + Analytics + Tag Cloud Summary

**Eliminated redirect loop on legacy routes, added GA4 SPA tracking for property G-0T526W3E1Z, and expanded desktop tag cloud from 12 to 18 visible tags**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-26T12:05:04Z
- **Completed:** 2026-02-26T12:06:37Z
- **Tasks:** 2 of 2
- **Files modified:** 5 (4 modified, 1 created)

## Accomplishments
- Eliminated "Maximum call stack exceeded" browser error on /explore and /marketplace by replacing declarative `<Navigate>` with imperative `useNavigate()` inside `useEffect(fn, [])` in RedirectWithParams
- Wired GA4 property G-0T526W3E1Z to fire `page_view` events on both initial load and every SPA route change, with ad-blocker resilience and query param inclusion
- Desktop tag cloud now shows 18 pills instead of 12, improving discovery surface without layout changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix redirect loop and expand tag cloud** - `fdbb8f4` (fix)
2. **Task 2: Add GA4 page-view tracking with SPA route change support** - `13cca7d` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `frontend/src/main.tsx` - RedirectWithParams rewritten to use useNavigate+useEffect; useEffect and useNavigate added to imports
- `frontend/src/components/sidebar/TagCloud.tsx` - visibleCount raised from Math.max(12,...) to Math.max(18,...); comment updated
- `frontend/index.html` - Added GA4 script tags with gtag.js loader and send_page_view:false config
- `frontend/src/analytics.tsx` - New file: Analytics component using useLocation to fire page_view on every route change
- `frontend/src/layouts/RootLayout.tsx` - Imported Analytics and mounted as first child in layout fragment

## Decisions Made
- Used imperative redirect pattern (useNavigate+useEffect) over declarative Navigate to avoid the re-render loop — declarative Navigate re-triggers on every render while useSearchParams is also in scope
- GA4 configured with send_page_view:false so the React Analytics component is the single source of truth for all page_view events, preventing double-counting on initial load
- Analytics component placed in RootLayout (non-admin layout) so admin routes are intentionally excluded from tracking

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None — TypeScript compiled cleanly and `npm run build` succeeded on first attempt. The pre-existing chunk size warning (1,258 kB bundle) is unrelated to these changes.

## User Setup Required
None - no external service configuration required. The GA4 property G-0T526W3E1Z script is hardcoded in index.html and will start receiving events immediately after deployment.

## Next Phase Readiness
- Phase 43 plan 01 complete — all 4 requirements satisfied (ERR-02, DISC-01, ANLT-01, ANLT-02)
- Frontend is clean: zero TypeScript errors, successful production build
- Ready for Phase 44 (final pre-launch phase per ROADMAP)

## Self-Check: PASSED

All files verified present. All commits verified in git log.

- FOUND: frontend/src/main.tsx
- FOUND: frontend/src/analytics.tsx
- FOUND: frontend/src/layouts/RootLayout.tsx
- FOUND: frontend/src/components/sidebar/TagCloud.tsx
- FOUND: frontend/index.html
- FOUND: 43-01-SUMMARY.md
- FOUND commit: fdbb8f4 (Task 1)
- FOUND commit: 13cca7d (Task 2)

---
*Phase: 43-frontend-fixes-analytics-tag-cloud*
*Completed: 2026-02-26*
