---
plan: 17-02
phase: 17-expert-grid-cards
status: complete
completed: 2026-02-21
duration: ~12 min
tasks_completed: 2/2
---

# Plan 17-02: ExpertCard, EmptyState, ExpertGrid + MarketplacePage wiring

## What Was Built

Three new marketplace components (ExpertCard, EmptyState, ExpertGrid) and an updated MarketplacePage that renders the live expert browsing experience replacing the Phase 16 placeholder div.

## Key Files

### Created
- `frontend/src/components/marketplace/ExpertCard.tsx` — Expert card with motion/react entry animation (slide-up+fade, index-based stagger, no exit prop), all 7 data fields, findability badge, clickable tag pills
- `frontend/src/components/marketplace/EmptyState.tsx` — Zero-results state with search icon, message, co-pilot CTA placeholder
- `frontend/src/components/marketplace/ExpertGrid.tsx` — VirtuosoGrid wrapper: 2-col mobile/3-col desktop CSS grid via listClassName, overscan=200, skeleton footer while isFetchingMore

### Modified
- `frontend/src/pages/MarketplacePage.tsx` — Replaced Phase 16 placeholder with ExpertGrid; destructures loadNextPage and isFetchingMore from useExplore; flex-1/min-h-0 container for VirtuosoGrid height

## Self-Check

- [x] ExpertCard uses motion/react (not framer-motion)
- [x] No exit prop on ExpertCard motion.div
- [x] toggleTag wired via individual Zustand selector
- [x] snake_case field access (first_name, job_title, hourly_rate, currency)
- [x] VirtuosoGrid with listClassName CSS grid classes
- [x] itemClassName="min-h-0" to prevent grid row blowout
- [x] overscan={200} for endReached reliability on small datasets
- [x] computeItemKey uses expert.username (stable key)
- [x] SkeletonFooter renders while isFetchingMore
- [x] MarketplacePage renders ExpertGrid with all 4 required props
- [x] npm run build passes with zero TypeScript errors

## Decisions

No deviations from plan. Used `flex-1 min-h-0` container around ExpertGrid in MarketplacePage (instead of `style={{ height: '100%' }}`) to correctly give VirtuosoGrid a measurable height within the flex column layout.
