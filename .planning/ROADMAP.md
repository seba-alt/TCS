# Roadmap: Tinrate AI Concierge Chatbot

## Milestones

- ✅ **v1.0 MVP** — Phases 1-7 (shipped 2026-02-20)
- ✅ **v1.1 Expert Intelligence & Search Quality** — Phases 8-10 (shipped 2026-02-21)
- ✅ **v1.2 Intelligence Activation & Steering Panel** — Phases 11-13 (shipped 2026-02-21)
- ✅ **v2.0 Extreme Semantic Explorer** — Phases 14-21 (shipped 2026-02-22)
- ✅ **v2.2 Evolved Discovery Engine** — Phases 22-27 (shipped 2026-02-22)
- ✅ **v2.3 Sage Evolution & Marketplace Intelligence** — Phases 28-35 (shipped 2026-02-24)
- ✅ **v3.0 Netflix Browse & Agentic Navigation** — Phases 36-40.3.1 (shipped 2026-02-26)
- ✅ **v3.1 Launch Prep** — Phases 41-44 (shipped 2026-02-26)
- 🚧 **v4.0 Public Launch** — Phases 45-49 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-7) — SHIPPED 2026-02-20</summary>

See `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1 Expert Intelligence & Search Quality (Phases 8-10) — SHIPPED 2026-02-21</summary>

See `.planning/milestones/v1.1-ROADMAP.md`

</details>

<details>
<summary>✅ v1.2 Intelligence Activation & Steering Panel (Phases 11-13) — SHIPPED 2026-02-21</summary>

See `.planning/milestones/v1.2-ROADMAP.md`

</details>

<details>
<summary>✅ v2.0 Extreme Semantic Explorer (Phases 14-21) — SHIPPED 2026-02-22</summary>

See `.planning/milestones/v2.0-ROADMAP.md`

</details>

<details>
<summary>✅ v2.2 Evolved Discovery Engine (Phases 22-27) — SHIPPED 2026-02-22</summary>

See `.planning/milestones/v2.2-ROADMAP.md`

</details>

<details>
<summary>✅ v2.3 Sage Evolution & Marketplace Intelligence (Phases 28-35) — SHIPPED 2026-02-24</summary>

See `.planning/milestones/v2.3-ROADMAP.md`

</details>

<details>
<summary>✅ v3.0 Netflix Browse & Agentic Navigation (Phases 36-40.3.1) — SHIPPED 2026-02-26</summary>

See `.planning/milestones/v3.0-ROADMAP.md`

</details>

<details>
<summary>✅ v3.1 Launch Prep (Phases 41-44) — SHIPPED 2026-02-26</summary>

See `.planning/milestones/v3.1-ROADMAP.md`

- [x] Phase 41: Expert Email Purge (1/1 plan) — completed 2026-02-26
- [x] Phase 42: Backend Error Hardening (2/2 plans) — completed 2026-02-26
- [x] Phase 43: Frontend Fixes + Analytics + Tag Cloud (1/1 plan) — completed 2026-02-26
- [x] Phase 44: Mobile Filter Redesign (1/1 plan) — completed 2026-02-26

</details>

### 🚧 v4.0 Public Launch (In Progress)

**Milestone Goal:** Fix frontend bugs, streamline admin panel, harden for full public launch.

- [x] **Phase 45: Security and Infrastructure Hardening** - Upgrade admin auth to bcrypt+JWT, add rate limiting, enable SQLite WAL mode, fix t-SNE heatmap (completed 2026-02-27)
- [x] **Phase 46: Frontend Performance Optimization** - Lazy-load admin routes and split large vendor chunks for a smaller public bundle (completed 2026-02-27)
- [ ] **Phase 47: Public Explorer Polish** - Grid/list toggle, white search input, error states, Sage double-render fix, mobile tap behavior
- [ ] **Phase 48: Admin Features and Industry Tags** - Lead export CSV, one-snap overview stats, improved expert import, and industry tag taxonomy
- [ ] **Phase 49: Admin Dashboard Cleanup** - Remove unused admin tools and simplify sidebar for current configuration

## Phase Details

### Phase 45: Security and Infrastructure Hardening
**Goal**: The admin panel is secured with proper credentials and the backend is hardened for concurrent public traffic
**Depends on**: Phase 44 (v3.1 complete)
**Requirements**: SEC-01, SEC-02, SEC-03, ADM-03
**Success Criteria** (what must be TRUE):
  1. Admin can log in with username and bcrypt-hashed password; old single-key login no longer works after migration confirmed
  2. Five failed login attempts from the same IP within one minute are rejected with a rate-limit error, not processed
  3. The embedding heatmap (t-SNE) renders on the Intelligence page without a permanent loading spinner
  4. SQLite runs in WAL mode so concurrent user event writes do not produce "database is locked" errors under public traffic
**Plans**: 2 plans

Plans:
- [ ] 45-01-PLAN.md — Backend auth upgrade: bcrypt+JWT credentials, slowapi rate limiting, frontend login form migration
- [ ] 45-02-PLAN.md — SQLite WAL mode with busy_timeout and t-SNE background task lifespan fix

### Phase 46: Frontend Performance Optimization
**Goal**: Public users download a smaller bundle because admin code is excluded from the initial load
**Depends on**: Phase 45
**Requirements**: PERF-01, PERF-02
**Success Criteria** (what must be TRUE):
  1. Admin routes load via dynamic import — the public Explorer page does not include admin JS in its initial bundle
  2. Recharts and react-table ship as separate chunks that load only when the admin panel is visited
  3. A Suspense fallback renders while admin chunks load, with no blank screen or unhandled error boundary
**Plans**: 1 plan

Plans:
- [ ] 46-01-PLAN.md — React.lazy admin route splitting and Vite manualChunks configuration

### Phase 47: Public Explorer Polish
**Goal**: The public Explorer delivers a polished, resilient browsing experience with correct Sage behavior and mobile interactions
**Depends on**: Phase 46
**Requirements**: EXP-01, EXP-02, EXP-03, EXP-04, EXP-05, EXP-06
**Success Criteria** (what must be TRUE):
  1. Search bar input has a white background that reads clearly against the dark aurora header
  2. Search bar placeholder reads "Name, company, keyword..." (keyword-oriented, not conversational)
  3. User can toggle between card grid view and compact list view; the chosen view persists across page reloads
  4. On desktop, the Sage panel renders exactly once — no overlapping desktop and mobile instances
  5. On mobile, tapping an expert card expands it inline; on desktop, the same click opens the profile directly
  6. When the API fails, the explorer grid shows a friendly error message with a Retry button instead of a blank grid
**Plans**: 3 plans

Plans:
- [ ] 47-01-PLAN.md — Search bar white background, flat border, static keyword placeholder
- [ ] 47-02-PLAN.md — Grid/list view toggle with ExpertList component and Zustand persistence
- [ ] 47-03-PLAN.md — Sage double-render fix, desktop card click bypass, API error state with retry

### Phase 48: Admin Features and Industry Tags
**Goal**: Admin can export actionable lead data, the overview dashboard shows key stats at a glance, expert import is improved, and industry-level tags are browsable in the tag cloud
**Depends on**: Phase 45
**Requirements**: ADM-01, ADM-02, ADM-05, DISC-01, DISC-02, DISC-03
**Success Criteria** (what must be TRUE):
  1. Admin can download a CSV of all leads that includes each lead's search queries and expert card clicks
  2. The admin overview page shows Total Leads and Expert Pool stat cards alongside the existing Sage volume stats
  3. Admin can bulk import experts via a CSV upload flow without touching the Railway terminal
  4. Industry-level tags (e.g., Finance, Healthcare, Tech) appear as a separate section in the tag cloud alongside domain tags
  5. User can filter experts by industry tag; industry filters apply independently of domain tag filters
**Plans**: TBD

Plans:
- [ ] 48-01: Lead export CSV endpoint and admin UI button
- [ ] 48-02: Admin overview stat cards (Total Leads, Expert Pool)
- [ ] 48-03: Improved bulk expert CSV import flow
- [ ] 48-04: Industry tag taxonomy — data model, tagging pipeline, Zustand store, tag cloud UI, filter integration

### Phase 49: Admin Dashboard Cleanup
**Goal**: The admin sidebar contains only the tools in active use and the overview page consolidates the most important signals
**Depends on**: Phase 48
**Requirements**: ADM-04
**Success Criteria** (what must be TRUE):
  1. Unused admin pages and sidebar links are removed; navigating to a removed route redirects to the overview
  2. All corresponding backend endpoints and background tasks for removed pages are also removed (no orphaned computation)
  3. The admin overview page surfaces the most important marketplace signals without requiring navigation to sub-pages
**Plans**: TBD

Plans:
- [ ] 49-01: Admin sidebar simplification and atomic page removal (frontend + backend + background tasks)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7. MVP Phases | v1.0 | Complete | Complete | 2026-02-20 |
| 8-10. Intelligence Phases | v1.1 | Complete | Complete | 2026-02-21 |
| 11-13. Steering Panel Phases | v1.2 | Complete | Complete | 2026-02-21 |
| 14-21. Marketplace Phases | v2.0 | 23/23 | Complete | 2026-02-22 |
| 22-27. Evolved Discovery Engine | v2.2 | 14/14 | Complete | 2026-02-22 |
| 28-35. Sage Evolution | v2.3 | 17/17 | Complete | 2026-02-24 |
| 36-40.3.1. Browse & Navigation | v3.0 | 19/19 | Complete | 2026-02-26 |
| 41-44. Launch Prep | v3.1 | 5/5 | Complete | 2026-02-26 |
| 45. Security + Infrastructure | 2/2 | Complete    | 2026-02-27 | - |
| 46. Frontend Performance | 1/1 | Complete    | 2026-02-27 | - |
| 47. Explorer Polish | v4.0 | 0/3 | Not started | - |
| 48. Admin Features + Industry Tags | v4.0 | 0/4 | Not started | - |
| 49. Admin Cleanup | v4.0 | 0/1 | Not started | - |
