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
- 🚧 **v4.1 UX Polish & Mobile Overhaul** — Phases 51-54 (in progress)

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

### 🚧 v4.1 UX Polish & Mobile Overhaul (In Progress)

**Milestone Goal:** Fix admin analytics, redesign mobile expert cards, polish Explorer interactions, upgrade bookmarks UX, and add Clarity analytics.

- [x] **Phase 51: Admin Fixes** — Correct broken overview stats, make stat cards clickable, add expert deletion (completed 2026-03-02)
- [ ] **Phase 52: Explorer & Search UX** — Randomize initial display, remove sort-by, autofocus search, Intercom no-results CTA, fix autocomplete, dynamic rate slider
- [ ] **Phase 53: Card & Mobile Redesign** — Redesign mobile and desktop cards, remove tap-expand, clean up mobile filter controls
- [ ] **Phase 54: Bookmarks & Analytics** — Color saved profiles, filter-independent saved view, anonymous search tracking, Microsoft Clarity

## Phase Details

### Phase 51: Admin Fixes
**Goal**: Admin overview page shows accurate live stats and admins can manage experts directly
**Depends on**: Nothing (first phase of v4.1)
**Requirements**: ADMN-01, ADMN-02, ADMN-03
**Success Criteria** (what must be TRUE):
  1. Admin overview page shows non-zero values for matches, searches, leads, lead rate, top searches, and gaps when data exists in the database
  2. Clicking any stat card on the admin overview navigates to the corresponding detail page
  3. Admin can delete an expert from the experts list and the expert is removed immediately
**Plans:** 2/2 plans complete
Plans:
- [ ] 51-01-PLAN.md — Fix overview stats + clickable stat card navigation
- [ ] 51-02-PLAN.md — Expert deletion (single + bulk) with FAISS rebuild

### Phase 52: Explorer & Search UX
**Goal**: Explorer loads with immediate usability — search focused, initial results varied, sort-by gone, autocomplete working, rate slider accurate
**Depends on**: Phase 51
**Requirements**: EXPL-01, EXPL-02, EXPL-03, EXPL-04, EXPL-05, EXPL-06
**Success Criteria** (what must be TRUE):
  1. On each page load the initial expert grid shows a different ordering, with higher-findability experts appearing more prominently
  2. There is no sort-by dropdown — the grid always shows best-match ordering
  3. The search bar receives focus automatically when the page loads, ready for immediate typing
  4. When the grid returns no results, a CTA appears that opens Intercom so the user can describe their need or request an expert
  5. Typing in the search bar shows a working autocomplete dropdown with matching suggestions
  6. The rate slider's maximum value reflects the highest rate among currently filtered experts, not a fixed global cap
**Plans:** 2 plans
Plans:
- [ ] 52-01-PLAN.md — Randomized initial display, sort-by removal, autofocus search, Intercom no-results CTA
- [ ] 52-02-PLAN.md — Autocomplete tag-first ranking, dynamic rate slider

### Phase 53: Card & Mobile Redesign
**Goal**: Expert cards are visually clear on both mobile and desktop, and mobile interaction is direct tap with simplified filter controls
**Depends on**: Phase 52
**Requirements**: CARD-01, CARD-02, CARD-03, MOBL-01, MOBL-02, MOBL-03, MOBL-04
**Success Criteria** (what must be TRUE):
  1. On mobile, expert cards display a prominent profile photo with the expert's name centered below it
  2. On desktop, expert cards display a larger profile photo with the expert's name and role info to its right
  3. Tapping an expert card on mobile navigates directly — there is no expand-then-tap behavior
  4. Mobile filter controls have no clear button and no search-within-tags or industry picker
  5. Tapping a tag on mobile resets the active search query and applies the tag as the sole filter
  6. The tag row on mobile scrolls smoothly without visual glitching
**Plans:** 2 plans
Plans:
- [ ] 53-01-PLAN.md — Card layout redesign (mobile photo-centric + desktop photo-left) and tap-expand removal
- [ ] 53-02-PLAN.md — Mobile filter simplification (remove clear, search inputs, sort) + tag-click clears query + scroll fix

### Phase 54: Bookmarks & Analytics
**Goal**: Saved profiles are visually obvious, the saved view is filter-independent, all searches are tracked, and Clarity analytics is live
**Depends on**: Phase 53
**Requirements**: BOOK-01, BOOK-02, ANLT-01, ANLT-02
**Success Criteria** (what must be TRUE):
  1. Saved/bookmarked expert cards appear with a distinct color treatment that makes them immediately recognizable in the grid
  2. Activating "Show saved" displays all saved experts regardless of any active filters or selected tags
  3. Search events are recorded in the database whether or not the user has submitted their email
  4. Microsoft Clarity session recordings and heatmaps are active for the Explorer (Clarity project ID: vph5o95n6c)
**Plans**: TBD

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
| 45. Security + Infrastructure | v4.0 | 2/2 | Complete | 2026-02-27 |
| 46. Frontend Performance | v4.0 | 1/1 | Complete | 2026-02-27 |
| 47. Explorer Polish | v4.0 | 3/3 | Complete | 2026-02-27 |
| 48. Admin Features + Industry Tags | v4.0 | 4/4 | Complete | 2026-02-27 |
| 49. Admin Cleanup | v4.0 | 1/1 | Complete | 2026-02-27 |
| 50. Verification Cleanup | v4.0 | 1/1 | Complete | 2026-02-27 |
| 50.1. Lead Click Tracking + Reset | v4.0 | 3/3 | Complete | 2026-02-27 |
| 50.2. Analytics Fix | v4.0 | 2/2 | Complete | 2026-03-02 |
| 50.3. Intercom Integration | v4.0 | 3/3 | Complete | 2026-03-02 |
| 51. Admin Fixes | 2/2 | Complete    | 2026-03-02 | - |
| 52. Explorer & Search UX | v4.1 | 0/TBD | Not started | - |
| 53. Card & Mobile Redesign | v4.1 | 0/TBD | Not started | - |
| 54. Bookmarks & Analytics | v4.1 | 0/TBD | Not started | - |
