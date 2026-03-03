---
phase: 55-explorer-bug-fixes
plan: 01
subsystem: api
tags: [python, fastapi, search, sorting, open-graph, seo, meta-tags]

requires: []
provides:
  - Tier-grouped sort in hybrid search pipeline (_tier_key helper + updated sort key)
  - Open Graph meta tags (og:type, og:title, og:description, og:image, og:url) in index.html
  - Twitter Card meta tags in index.html
  - Purple logo served as static OG image at /og-image.png
affects: [explorer, social-sharing, seo]

tech-stack:
  added: []
  patterns:
    - "Tier-first sort: sort by (tier_key, -final_score) to group Top Match before Good Match before rest"

key-files:
  created:
    - frontend/public/og-image.png
  modified:
    - app/services/explorer.py
    - frontend/index.html

key-decisions:
  - "Tier thresholds mirror frontend findabilityLabel() thresholds (>=88 Top, >=75 Good) for consistency"
  - "OG image uses absolute production URL (tcs-three-sigma.vercel.app) since crawlers require absolute URLs"
  - "Twitter card type set to summary (not summary_large_image) since logo is a square icon not a wide banner"

patterns-established:
  - "Tier-grouped sort pattern: _tier_key(score) returns 0/1/2 and is used as leading tuple element in sort"

requirements-completed: [BUG-01, BUG-08]

duration: 2min
completed: 2026-03-03
---

# Phase 55 Plan 01: Explorer Bug Fixes Summary

**Tier-grouped search sorting (Top Match > Good Match > rest) and Open Graph rich link preview with Tinrate branding**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-03T10:45:57Z
- **Completed:** 2026-03-03T10:47:27Z
- **Tasks:** 2
- **Files modified:** 3 (explorer.py, index.html, og-image.png created)

## Accomplishments
- Backend hybrid search now returns Top Match experts (findability_score >= 88) before Good Match (>= 75) before unscored experts when a search query is active
- Pure filter mode (no query) sorting logic is unchanged
- Sharing any Tinrate URL on social media / messaging apps now renders a branded preview card with title, description, and purple logo

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement tier-grouped sorting in backend explorer** - `2658eba` (feat)
2. **Task 2: Add Open Graph meta tags and preview image** - `58c3580` (feat)

## Files Created/Modified
- `app/services/explorer.py` - Added `_tier_key()` helper and updated `scored.sort()` to sort by (tier, -final_score)
- `frontend/index.html` - Added og:type, og:title, og:description, og:image, og:url and Twitter Card meta tags
- `frontend/public/og-image.png` - Purple Tinrate logo icon for OG preview (copied from frontend/Logo Icon Purple.png)

## Decisions Made
- Tier thresholds (88, 75) mirror the frontend `findabilityLabel()` function thresholds for consistency between backend sorting and frontend badge display
- OG image absolute URL points to production Vercel deployment since social media crawlers require absolute URLs
- Twitter card type is `summary` (square image) rather than `summary_large_image` since the logo is a square icon

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Tier-grouped search sorting is live and ready to verify via Explorer UI after deployment
- OG preview can be tested with https://www.opengraph.xyz/ after pushing to main and waiting for Vercel deploy
- Phase 55 Plan 02 can proceed independently

---
*Phase: 55-explorer-bug-fixes*
*Completed: 2026-03-03*

## Self-Check: PASSED

- app/services/explorer.py: FOUND
- frontend/index.html: FOUND
- frontend/public/og-image.png: FOUND
- 55-01-SUMMARY.md: FOUND
- Commit 2658eba: FOUND
- Commit 58c3580: FOUND
