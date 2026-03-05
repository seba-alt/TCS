---
phase: 07-analytics-dashboard-admin-view-of-searches-expert-matches-gap-tracking-csv-export
plan: 04
subsystem: deployment

tags: [railway, vercel, deployment, admin-dashboard, verification, admin-v2]

# Dependency graph
requires:
  - phase: 07-analytics-dashboard-admin-view-of-searches-expert-matches-gap-tracking-csv-export (plan 01)
    provides: "/api/admin/* endpoints — stats, searches, gaps, resolve, CSV export"
  - phase: 07-analytics-dashboard-admin-view-of-searches-expert-matches-gap-tracking-csv-export (plan 03)
    provides: "Full admin UI — OverviewPage, SearchesPage, GapsPage"
provides:
  - "Admin dashboard v2 live at /admin on tcs-three-sigma.vercel.app"
  - "Login flow replacing VITE_ADMIN_KEY — sessionStorage-based auth with POST /api/admin/auth"
  - "New admin pages: Score Explainer, Leads, Experts (with category management), Settings"
  - "Expert SQLite DB seeded from experts.csv (1558 experts) — fixes 'Failed to fetch' error"
  - "Dark slate theme across all admin pages including Searches and Gaps"
  - "Cross-navigation: Searches ↔ Leads ↔ Gaps with email filter state"
  - "SVG speedometer on Overview dashboard"
affects:
  - "Phase 08 test lab — full admin dashboard available for production inspection"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "sessionStorage for admin key — replaces build-time VITE_ADMIN_KEY baked into bundle"
    - "Expert SQLite table seeded from experts.csv at first startup — eliminates file I/O at request time"
    - "RequireAuth wrapper — Outlet-based auth guard for /admin routes"
    - "useNavigate with state param — cross-page navigation preserving filter context"

key-files:
  created:
    - "frontend/src/admin/LoginPage.tsx"
    - "frontend/src/admin/RequireAuth.tsx"
    - "frontend/src/admin/pages/ScoreExplainerPage.tsx"
    - "frontend/src/admin/pages/LeadsPage.tsx"
    - "frontend/src/admin/pages/ExpertsPage.tsx"
    - "frontend/src/admin/pages/SettingsPage.tsx"
  modified:
    - "app/models.py (Expert ORM model added)"
    - "app/main.py (_seed_experts_from_csv function, lifespan seeding)"
    - "app/routers/admin.py (auth endpoint, leads endpoint, DB-backed expert endpoints, extended stats)"
    - "frontend/src/admin/AdminApp.tsx (logout)"
    - "frontend/src/admin/components/AdminSidebar.tsx (dark redesign + 7 nav items)"
    - "frontend/src/admin/pages/OverviewPage.tsx (speedometer, top queries/feedback widgets)"
    - "frontend/src/admin/pages/SearchesPage.tsx (dark theme + leads navigation)"
    - "frontend/src/admin/pages/GapsPage.tsx (dark theme)"
    - "frontend/src/admin/components/SearchesTable.tsx (dark theme + email → leads nav)"
    - "frontend/src/admin/components/GapsTable.tsx (dark theme, sessionStorage key fix)"
    - "frontend/src/admin/hooks/useAdminData.ts (sessionStorage key, useAdminLeads, useAdminExperts)"
    - "frontend/src/admin/types.ts (LeadRow, ExpertRow, extended AdminStats)"
    - "frontend/src/main.tsx (login route, RequireAuth wrapper, new page routes)"

key-decisions:
  - "[07-04]: Expert table in SQLite seeded from experts.csv — eliminates metadata.json file-read at request time; solves 'Failed to fetch' production crash"
  - "[07-04]: sessionStorage for admin key — removes VITE_ADMIN_KEY from Vercel build; key flows through POST /api/admin/auth → sessionStorage → X-Admin-Key header"
  - "[07-04]: Admin v2 enhancements delivered in same phase as verification — original checklist passed, then dashboard significantly expanded"

patterns-established:
  - "Admin auth: POST /api/admin/auth → 200/401 → sessionStorage key → X-Admin-Key header on all admin requests"
  - "Expert management: SQLite Expert table is source of truth; experts.csv remains as ingestion feed for FAISS"

requirements-completed: [ANAL-01]

# Metrics
duration: multi-session
completed: 2026-02-20
---

# Phase 7 Plan 04: Deploy, Human Verification & Admin Dashboard v2

**Admin dashboard deployed to production, human-verified, then significantly enhanced with login flow, leads page, expert management, score explainer, settings, and dark theme refresh**

## Performance

- **Duration:** multi-session
- **Completed:** 2026-02-20
- **Tasks:** 2
- **Files modified:** 20+

## Accomplishments
- Admin dashboard deployed to production at https://tcs-three-sigma.vercel.app/admin and human-verified working
- Login flow implemented: POST /api/admin/auth endpoint + LoginPage + RequireAuth wrapper + sessionStorage key — replaces baked-in VITE_ADMIN_KEY
- New admin pages: Score Explainer (static explanation + per-search drill-down), Leads (grouped by email), Experts (category management + add form), Settings
- Expert SQLite DB: Expert ORM model + _seed_experts_from_csv() seeds 1558 experts from CSV on first startup — definitively fixed "Failed to fetch" production error
- Dark slate theme applied uniformly across all admin pages including Searches and Gaps
- Cross-navigation: email links in SearchesTable → Leads; "Searches →" in LeadsPage → SearchesPage with pre-filled filter; "View Searches →" in GapsTable
- SVG arc speedometer on Overview dashboard as live system status indicator
- Extended /api/admin/stats with top_queries and top_feedback arrays for new Overview widgets
- GET /api/admin/leads endpoint: groups conversations by email, returns total_searches, last_search_at, gap_count, recent_queries

## Files Created/Modified

**Backend:**
- `app/models.py` — Expert ORM model (username, email, names, job_title, company, bio, hourly_rate, currency, profile_url, category)
- `app/main.py` — _seed_experts_from_csv() with bulk insert from experts.csv; called in lifespan
- `app/routers/admin.py` — auth_router (POST /auth), extended stats, GET /leads, GET/POST expert endpoints (DB-backed)

**Frontend:**
- `frontend/src/admin/LoginPage.tsx` — full-page dark login form
- `frontend/src/admin/RequireAuth.tsx` — sessionStorage guard, Outlet-based
- `frontend/src/admin/pages/ScoreExplainerPage.tsx` — static panels + per-search drill-down
- `frontend/src/admin/pages/LeadsPage.tsx` — email-grouped table, expandable, cross-nav
- `frontend/src/admin/pages/ExpertsPage.tsx` — expert table with category dropdown, auto-classify, add form
- `frontend/src/admin/pages/SettingsPage.tsx` — system info, logout
- `frontend/src/admin/AdminApp.tsx` — logout handler
- `frontend/src/admin/components/AdminSidebar.tsx` — dark redesign, 7 nav items with inline SVGs
- `frontend/src/admin/pages/OverviewPage.tsx` — speedometer, top queries/feedback widgets
- `frontend/src/admin/pages/SearchesPage.tsx` — dark theme, leads nav
- `frontend/src/admin/pages/GapsPage.tsx` — dark theme
- `frontend/src/admin/components/SearchesTable.tsx` — dark theme, email → leads nav
- `frontend/src/admin/components/GapsTable.tsx` — dark theme, sessionStorage key
- `frontend/src/admin/hooks/useAdminData.ts` — sessionStorage key, useAdminLeads, useAdminExperts, adminPost helper
- `frontend/src/admin/types.ts` — LeadRow, ExpertRow, LeadsResponse, ExpertsResponse, extended AdminStats
- `frontend/src/main.tsx` — /admin/login route, RequireAuth, new page routes

## Decisions Made
- Expert data served from SQLite (not metadata.json) — eliminates file-read crash on Railway; 1558 CSV rows vs 530 FAISS vectors (larger expert pool)
- sessionStorage key replaces build-time env var — admin key never baked into frontend bundle
- Admin v2 delivered incrementally in same phase — original Phase 7 verification completed first, then enhancements built on top

## Deviations from Plan

### Extended scope (authorized)
- **Admin v2 enhancements** added beyond original deploy+verify scope — user explicitly requested login flow, new pages, dark theme, expert management. Original 11-item verification checklist completed first, then dashboard expanded.

## Issues Encountered
- "Failed to fetch" on Experts tab: Root cause was server crash when accessing metadata.json on Railway. Fixed by migrating to Expert SQLite table seeded from experts.csv at startup.
- CORS missing Vercel URL in ALLOWED_ORIGINS: Railway env var `ALLOWED_ORIGINS=https://tcs-three-sigma.vercel.app` must be set (documented in STATE.md).

## User Setup Required
- Set `ALLOWED_ORIGINS=https://tcs-three-sigma.vercel.app` in Railway environment variables (enables frontend → backend CORS)

## Next Phase Readiness
- Full admin v2 dashboard live: login, overview with speedometer, searches, gaps, score explainer, leads, experts, settings
- Phase 8 (test lab) can proceed

---
*Phase: 07-analytics-dashboard-admin-view-of-searches-expert-matches-gap-tracking-csv-export*
*Completed: 2026-02-20*

## Self-Check: PASSED

Admin dashboard confirmed live at /admin. Login flow, all new pages, Expert DB seeding, and dark theme all deployed to production. User confirmed "admin works" in human verification.
