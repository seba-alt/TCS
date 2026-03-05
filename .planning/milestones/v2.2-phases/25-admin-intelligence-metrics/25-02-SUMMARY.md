---
plan: 25-02
phase: 25-admin-intelligence-metrics
status: complete
completed: 2026-02-22
---

# Summary: Intelligence Dashboard Frontend — OTR@K + Index Drift Panels

## What Was Built

Added end-to-end frontend instrumentation for the Phase 25 admin intelligence metrics:

1. **IntelligenceMetrics TypeScript Interface** — Exported from `frontend/src/admin/types.ts`. Matches the exact shape of `GET /api/admin/intelligence`: `otr.rolling_avg_7d`, `otr.query_count_7d`, and `index_drift.*` fields.

2. **useIntelligenceMetrics Hook** — Exported from `frontend/src/admin/hooks/useAdminData.ts`. Fetches from `/intelligence` via `adminFetch`, follows the same loading/error/refetch pattern as all other admin hooks.

3. **OTR@K Metric Card** — Top-left card in a 2-column grid above the existing settings panel. Displays the 7-day rolling OTR@K as a percentage with color coding: green (>=75%), amber (>=60%), red (<60%), em dash when null. Shows query count sub-label or "no data yet".

4. **Index Drift Metric Card** — Top-right card showing time-since-last-FAISS-rebuild via `timeAgo()` helper (just now / N min ago / N hr ago / N days ago / '—'). Shows expert count at rebuild, current count, and delta with green +N or red -N coloring. Falls back to "no rebuild recorded" when `_ingest` dict has never been set.

5. **Helper Functions** — Module-level pure functions `otrColor()` and `timeAgo()` defined before the component, clean and testable.

6. **Existing Settings Panel Intact** — Feature flags (HyDE, Feedback Re-ranking toggles) and threshold numeric inputs (Similarity Threshold, HyDE Trigger Sensitivity, Feedback Boost Cap) remain fully functional below the new metric cards.

## Key Files

- `frontend/src/admin/types.ts` — IntelligenceMetrics interface
- `frontend/src/admin/hooks/useAdminData.ts` — useIntelligenceMetrics hook
- `frontend/src/admin/pages/IntelligenceDashboardPage.tsx` — metric cards + helper functions

## Commits

- `feat(25-02/task-1): add IntelligenceMetrics type and useIntelligenceMetrics hook`
- `feat(25-02/task-2): add OTR@K and Index Drift metric cards to Intelligence page`

## Human Verification

Verified on deployed URL: https://tcs-three-sigma.vercel.app/admin
Status: approved

## Deviations

None. Implemented exactly as specified in the plan.

## Self-Check

- [x] IntelligenceMetrics TypeScript interface exported from types.ts
- [x] useIntelligenceMetrics hook exported from useAdminData.ts, fetches from /api/admin/intelligence
- [x] IntelligenceDashboardPage shows OTR@K as percentage with green/amber/red color coding
- [x] IntelligenceDashboardPage shows Index Drift: time-ago for rebuild and expert count delta
- [x] Null/missing states display '—' (em dash), no crashes or 0% misleads
- [x] Existing settings panel controls unchanged and functional
- [x] TypeScript + Vite build passes
- [x] Human verified on deployed URL
