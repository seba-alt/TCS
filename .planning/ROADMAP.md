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
- ✅ **v4.0 Public Launch** — Phases 45-50 (shipped 2026-02-27)
- ✅ **v4.1 UX Polish & Mobile Overhaul** — Phases 51-54 (shipped 2026-03-03)
- 🚧 **v5.0 Platform Polish & Admin Overhaul** — Phases 55-58 (in progress)

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

</details>

<details>
<summary>✅ v4.0 Public Launch (Phases 45-50) — SHIPPED 2026-02-27</summary>

See `.planning/milestones/v4.0-ROADMAP.md`

- [x] Phase 45: Security and Infrastructure Hardening (2/2 plans) — completed 2026-02-27
- [x] Phase 46: Frontend Performance Optimization (1/1 plan) — completed 2026-02-27
- [x] Phase 47: Public Explorer Polish (3/3 plans) — completed 2026-02-27
- [x] Phase 48: Admin Features and Industry Tags (4/4 plans) — completed 2026-02-27
- [x] Phase 49: Admin Dashboard Cleanup (1/1 plan) — completed 2026-02-27
- [x] Phase 50: Verification & Requirements Cleanup (1/1 plan) — completed 2026-02-27
- [x] Phase 50.1: Lead Click Tracking, Data Reset for Launch & Search Bar Visibility (3 plans) (completed 2026-02-27)
  - [x] 50.1-01-PLAN.md — Lead click tracking backend + frontend capture — completed 2026-02-27
  - [ ] 50.1-02-PLAN.md — Admin UI: lead click views, expert name fix, search bar CSS
  - [ ] 50.1-03-PLAN.md — Pre-launch data reset script
- [x] Phase 50.2: Fix search tracking and click analytics not showing in admin overview (2 plans) (completed 2026-03-02)
  - [ ] 50.2-01-PLAN.md — CORS fix + search query tracking + analytics-summary endpoint
  - [ ] 50.2-02-PLAN.md — OverviewPage analytics display cards
- [x] Phase 50.3: Remove Sage (including from admin) and replace with Intercom (3 plans) (completed 2026-03-02)
  - [ ] 50.3-01-PLAN.md — Backend Sage removal (pilot router + admin intelligence endpoints)
  - [ ] 50.3-02-PLAN.md — Frontend Sage removal (pilot components, store, tracking, admin pages)
  - [ ] 50.3-03-PLAN.md — Intercom integration + vaul cleanup

</details>

<details>
<summary>✅ v4.1 UX Polish & Mobile Overhaul (Phases 51-54) — SHIPPED 2026-03-03</summary>

See `.planning/milestones/v4.1-ROADMAP.md`

- [x] Phase 51: Admin Fixes (2/2 plans) — completed 2026-03-02
- [x] Phase 52: Explorer & Search UX (2/2 plans) — completed 2026-03-03
- [x] Phase 53: Card & Mobile Redesign (2/2 plans) — completed 2026-03-03
- [x] Phase 54: Bookmarks & Analytics (2/2 plans) — completed 2026-03-03

</details>

### 🚧 v5.0 Platform Polish & Admin Overhaul (In Progress)

**Milestone Goal:** Fix lingering Explorer UX bugs, eliminate backend performance bottlenecks, and overhaul the admin panel into a modern, consistent interface.

- [x] **Phase 55: Explorer Bug Fixes** - Fix tier sorting, currency symbols, mobile card completeness, clear button, and Open Graph tags (completed 2026-03-03)
- [x] **Phase 56: Backend Performance & Admin Refactor** - Cache embeddings/feedback/settings, optimize tag filtering, split admin monolith into route modules (completed 2026-03-03)
- [x] **Phase 57: Admin Frontend Overhaul** - URL routing, pagination, consistent components, overview redesign, experts table, responsive layout, expert search (completed 2026-03-03)
- [x] **Phase 58: Audit Gap Closure** - CORS DELETE fix, currency symbol consistency, Phase 56 retroactive verification (completed 2026-03-03)

## Phase Details

### Phase 55: Explorer Bug Fixes
**Goal**: The Explorer surface is visually complete and correct — search results respect match quality tiers, currencies show as symbols, mobile cards show all key fields, filters are accessible, and shared links generate rich previews.
**Depends on**: Phase 54 (v4.1 complete)
**Requirements**: BUG-01, BUG-02, BUG-03, BUG-04, BUG-05, BUG-06, BUG-08
**Success Criteria** (what must be TRUE):
  1. A user running a search sees Top Match results before Good Match results before unscored results in the grid
  2. Every expert card displaying a rate shows a currency symbol (€, $, £) rather than a text code (EUR, USD, GBP)
  3. A mobile user viewing any expert card can see the company name, a match badge (when applicable), and the expert's name without it being cut off
  4. A mobile user can tap a visible, clearly accessible clear-all button to reset all active filters
  5. Sharing the site URL on Slack, iMessage, or social platforms renders a rich link card with the Tinrate title, description, and preview image
**Plans:** 2/2 plans complete
Plans:
- [ ] 55-01-PLAN.md — Backend tier sorting + Open Graph meta tags
- [ ] 55-02-PLAN.md — Currency symbols, mobile card fixes, mobile clear-all button

### Phase 56: Backend Performance & Admin Refactor
**Goal**: The backend handles repeated requests without redundant external API calls, tag filtering runs against a proper index, and the admin router code is organized into logical modules that are maintainable.
**Depends on**: Phase 55
**Requirements**: PERF-01, PERF-02, PERF-03, PERF-04, ADM-01
**Success Criteria** (what must be TRUE):
  1. Repeated identical search queries hit a cache and do not trigger a new Google embedding API call (verified by absence of duplicate API calls in logs)
  2. Tag filtering in the explore endpoint does not use LIKE on a JSON string — it queries a proper index or normalized table
  3. Feedback and settings data are fetched once per request cycle, not on every individual explore call
  4. The admin router file no longer contains the full 2,225-line monolith — routes are split into logical sub-modules that can be read and edited independently
**Plans:** 3/3 plans complete
Plans:
- [x] 56-01-PLAN.md — Embedding cache (60s TTL) + settings cache (30s TTL)
- [x] 56-02-PLAN.md — ExpertTag join table for tag filtering + feedback prefetch
- [x] 56-03-PLAN.md — Admin router split into sub-modules

### Phase 57: Admin Frontend Overhaul
**Goal**: The admin panel is a modern, consistent, and usable interface — pages navigate via real URLs, tables paginate clearly, visual patterns are uniform across pages, the overview communicates actionable information, and the layout works on tablet screens.
**Depends on**: Phase 56
**Requirements**: ADM-02, ADM-03, ADM-04, ADM-05, ADM-06, ADM-07, BUG-07
**Success Criteria** (what must be TRUE):
  1. An admin user can navigate directly to any Tools or Data sub-page via its own URL and use the browser back button to return
  2. An admin user on the Experts page can type a name into a search field and see the table filtered to matching experts
  3. An admin user can jump to a specific page number in any paginated table without clicking through every page
  4. All admin pages use the same card, table header, and form input visual patterns — no pages look like they were built by a different team
  5. The admin Overview page surfaces the metrics an operator actually needs to act on (lead growth, search volume, zero-result rate) with clear navigation to detail views
  6. The admin panel is fully usable at tablet width (768px+) without broken layouts or hidden controls
**Plans:** 4/4 plans complete
Plans:
- [ ] 57-01-PLAN.md — URL child routes for Tools and Data sub-pages
- [ ] 57-02-PLAN.md — Shared components (AdminCard, AdminInput, AdminPagination, AdminPageHeader) + pagination upgrade
- [ ] 57-03-PLAN.md — Experts page name search + visual refresh
- [ ] 57-04-PLAN.md — Overview dashboard redesign with period toggle + responsive layout

### Phase 58: Audit Gap Closure
**Goal**: All v5.0 audit gaps are closed — CORS permits DELETE for admin actions, currency symbols use the shared utility on all surfaces, and Phase 56 has a retroactive verification document.
**Depends on**: Phase 57
**Requirements**: BUG-02, ADM-06, PERF-01, PERF-02, PERF-03, PERF-04, ADM-01
**Gap Closure**: Closes gaps from v5.0 milestone audit
**Success Criteria** (what must be TRUE):
  1. An admin user can delete a single expert from the Experts page without a CORS error
  2. The rate filter slider and filter chips display the correct currency symbol from the currencySymbol() utility
  3. Phase 56 has a VERIFICATION.md confirming all 5 requirements (PERF-01–04, ADM-01) are satisfied
**Plans:** 2/2 plans complete
Plans:
- [ ] 58-01-PLAN.md — CORS DELETE fix + currencySymbol adoption in FilterChips and RateSlider
- [ ] 58-02-PLAN.md — Retroactive Phase 56 VERIFICATION.md

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 55. Explorer Bug Fixes | 2/2 | Complete    | 2026-03-03 |
| 56. Backend Performance & Admin Refactor | 3/3 | Complete | 2026-03-03 |
| 57. Admin Frontend Overhaul | 4/4 | Complete    | 2026-03-03 |
| 58. Audit Gap Closure | 2/2 | Complete    | 2026-03-03 |
| 58.1 Admin Dashboard Improvements | 3/3 | Complete | 2026-03-03 |

### Phase 58.1: Admin Dashboard Improvements (INSERTED)

**Goal:** The admin dashboard surfaces actionable data at a glance — tag-only searches render as chips, irrelevant sections are removed, Searches and Marketplace are merged into one Data page with a unified date picker, and lead click activity is immediately visible without expanding rows.
**Depends on:** Phase 58
**Requirements:** ADMUI-01, ADMUI-02, ADMUI-03, ADMUI-04
**Plans:** 3/3 plans complete

Plans:
- [x] 58.1-01-PLAN.md — Backend endpoint extensions (click_count, active_tags) + Overview page cleanup
- [x] 58.1-02-PLAN.md — Merge Searches/Marketplace into unified Data page with shared date picker
- [x] 58.1-03-PLAN.md — Leads page click count column + dedicated Click Activity table
