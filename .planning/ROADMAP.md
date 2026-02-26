# Roadmap: Tinrate AI Concierge Chatbot

## Milestones

- ✅ **v1.0 MVP** — Phases 1-7 (shipped 2026-02-20)
- ✅ **v1.1 Expert Intelligence & Search Quality** — Phases 8-10 (shipped 2026-02-21)
- ✅ **v1.2 Intelligence Activation & Steering Panel** — Phases 11-13 (shipped 2026-02-21)
- ✅ **v2.0 Extreme Semantic Explorer** — Phases 14-21 (shipped 2026-02-22)
- ✅ **v2.2 Evolved Discovery Engine** — Phases 22-27 (shipped 2026-02-22)
- ✅ **v2.3 Sage Evolution & Marketplace Intelligence** — Phases 28-35 (shipped 2026-02-24)
- ✅ **v3.0 Netflix Browse & Agentic Navigation** — Phases 36-40.3.1 (shipped 2026-02-26)
- 🚧 **v3.1 Launch Prep** — Phases 41-44 (in progress)

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

- [x] Phase 36: Foundation (2/2 plans) — completed 2026-02-24
- [x] Phase 37: Backend Endpoints (2/2 plans) — completed 2026-02-24
- [x] Phase 38: Browse UI (2/2 plans) — completed 2026-02-24
- [x] Phase 39: Sage Cross-Page Navigation (2/2 plans) — completed 2026-02-24
- [x] Phase 40: Close v3.0 Audit Gaps (1/1 plan) — completed 2026-02-24
- [x] Phase 40.1: Optimization and Debugging (2/2 plans) — completed 2026-02-25
- [x] Phase 40.2: UAT Fixes and Enhancements (4/4 plans) — completed 2026-02-25
- [x] Phase 40.3: Revert to Explorer-Only (2/2 plans) — completed 2026-02-25
- [x] Phase 40.3.1: Search & Mobile Improvements (2/2 plans) — completed 2026-02-26

</details>

### 🚧 v3.1 Launch Prep (In Progress)

**Milestone Goal:** Harden the platform for public launch — remove sensitive data, fix production errors, align Search Lab with the live pipeline, and improve mobile UX and analytics.

- [x] **Phase 41: Expert Email Purge** — Remove expert PII before any public traffic reaches the platform (completed 2026-02-26)
- [x] **Phase 42: Backend Error Hardening** — Fix all backend Sentry errors and align Search Lab pipeline (completed 2026-02-26)
- [x] **Phase 43: Frontend Fixes + Analytics + Tag Cloud** — Fix redirect loop, add GA4, expand tag cloud (completed 2026-02-26)
- [ ] **Phase 44: Mobile Filter Redesign** — Replace Vaul bottom-sheet filters with inline dropdown controls

## Phase Details

### Phase 41: Expert Email Purge
**Goal**: Expert email data is completely removed from the system before public launch
**Depends on**: Nothing (first phase of v3.1)
**Requirements**: PRIV-01, PRIV-02, PRIV-03
**Success Criteria** (what must be TRUE):
  1. No Expert row in the SQLite database has a non-empty email value
  2. The data/experts.csv file contains no Email column
  3. Uploading a new CSV with an Email column does not write email values to any Expert row
  4. Conversation.email and Feedback.email columns are untouched and the admin Leads page functions normally
**Plans:** 1/1 plans complete
Plans:
- [ ] 41-01-PLAN.md — Purge expert email from DB, CSV, and import paths

### Phase 42: Backend Error Hardening
**Goal**: All backend Sentry error sources are eliminated and Search Lab results match the live search pipeline
**Depends on**: Phase 41
**Requirements**: ERR-01, ERR-03, ERR-04, SRCH-01, SRCH-02
**Success Criteria** (what must be TRUE):
  1. A broken expert photo URL returns a 404 response (not 502) and the frontend shows the monogram fallback
  2. Submitting an empty string in the search bar does not produce a 500 error from FTS5
  3. Dutch text submitted to Sage is correctly detected and translated using the updated Gemini model
  4. Search Lab query results use the same run_explore() pipeline as the search bar and Sage
  5. Search Lab A/B comparison still supports toggling HyDE and feedback as per-run overrides on top of the aligned pipeline
**Plans:** 2/2 plans complete
Plans:
- [x] 42-01-PLAN.md — Fix photo proxy 502s, harden FTS5 MATCH, replace deprecated Gemini model
- [x] 42-02-PLAN.md — Align Search Lab with run_explore() pipeline, add pipeline labels

### Phase 43: Frontend Fixes + Analytics + Tag Cloud
**Goal**: The React redirect loop is eliminated, GA4 tracks every page view from launch day, and the desktop tag cloud shows 18-20 tags
**Depends on**: Phase 42
**Requirements**: ERR-02, DISC-01, ANLT-01, ANLT-02
**Success Criteria** (what must be TRUE):
  1. Navigating to /explore, /marketplace, /browse, or /chat does not produce a Maximum call stack exceeded error in the browser console
  2. The GA4 property G-0T526W3E1Z receives a page_view event on initial load
  3. Navigating between routes via React Router fires a new page_view event in GA4 without a full page reload
  4. The desktop tag cloud displays 18-20 tags simultaneously (up from 12)
**Plans:** 1/1 plans complete
Plans:
- [x] 43-01-PLAN.md — Fix redirect loop, add GA4 analytics, expand tag cloud

### Phase 44: Mobile Filter Redesign
**Goal**: Mobile users can filter experts using inline dropdown controls without opening and dismissing a bottom sheet
**Depends on**: Phase 43
**Requirements**: MOB-01, MOB-02
**Success Criteria** (what must be TRUE):
  1. On mobile, filter controls (rate range, domain tags) are visible inline on the page without any drawer interaction
  2. Changing a filter on mobile updates the expert grid without hammering the API on every keystroke
  3. The search bar spans the full viewport width on mobile
  4. The active filter count badge reflects the current filter state after the Vaul bottom-sheet is removed
  5. The Sage mobile bottom sheet (using Vaul) continues to open and function correctly
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
| 41. Expert Email Purge | 1/1 | Complete    | 2026-02-26 | - |
| 42. Backend Error Hardening | v3.1 | 2/2 | Complete | 2026-02-26 |
| 43. Frontend Fixes + Analytics + Tag Cloud | v3.1 | 1/1 | Complete | 2026-02-26 |
| 44. Mobile Filter Redesign | v3.1 | 0/TBD | Not started | - |
