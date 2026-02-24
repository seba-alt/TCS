# Roadmap: Tinrate AI Concierge Chatbot

## Milestones

- [x] **v1.0 MVP** - Phases 1-7 (shipped 2026-02-20)
- [x] **v1.1 Expert Intelligence & Search Quality** - Phases 8-10 (shipped 2026-02-21)
- [x] **v1.2 Intelligence Activation & Steering Panel** - Phases 11-13 (shipped 2026-02-21)
- [x] **v2.0 Extreme Semantic Explorer** - Phases 14-21 (shipped 2026-02-22)
- [x] **v2.2 Evolved Discovery Engine** - Phases 22-27 (shipped 2026-02-22)
- [x] **v2.3 Sage Evolution & Marketplace Intelligence** - Phases 28-35 (shipped 2026-02-24)
- [ ] **v3.0 Netflix Browse & Agentic Navigation** - Phases 36-39 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-7) - SHIPPED 2026-02-20</summary>

See `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>v1.1 Expert Intelligence & Search Quality (Phases 8-10) - SHIPPED 2026-02-21</summary>

See `.planning/milestones/v1.1-ROADMAP.md`

</details>

<details>
<summary>v1.2 Intelligence Activation & Steering Panel (Phases 11-13) - SHIPPED 2026-02-21</summary>

See `.planning/milestones/v1.2-ROADMAP.md`

</details>

<details>
<summary>v2.0 Extreme Semantic Explorer (Phases 14-21) — SHIPPED 2026-02-22</summary>

See `.planning/milestones/v2.0-ROADMAP.md`

</details>

<details>
<summary>v2.2 Evolved Discovery Engine (Phases 22-27) — SHIPPED 2026-02-22</summary>

See `.planning/milestones/v2.2-ROADMAP.md`

</details>

<details>
<summary>v2.3 Sage Evolution & Marketplace Intelligence (Phases 28-35) — SHIPPED 2026-02-24</summary>

See `.planning/milestones/v2.3-ROADMAP.md`

- [x] Phase 28: Sage Search Engine (2/2 plans) — completed 2026-02-22
- [x] Phase 29: Sage Personality + FAB Reactions (1/1 plan) — completed 2026-02-22
- [x] Phase 30: Behavior Tracking (2/2 plans) — completed 2026-02-22
- [x] Phase 31: Admin Marketplace Intelligence (2/2 plans) — completed 2026-02-22
- [x] Phase 32: Sage Direct Search Integration (3/3 plans) — completed 2026-02-22
- [x] Phase 33: Command Center Header (2/2 plans) — completed 2026-02-23
- [x] Phase 34: Admin Platform Restructure (2/2 plans) — completed 2026-02-23
- [x] Phase 34.1: Fix zero-result searches + Dutch Sage (2/2 plans) — completed 2026-02-23
- [x] Phase 35: Close v2.3 Documentation Gaps (1/1 plan) — completed 2026-02-24

</details>

### v3.0 Netflix Browse & Agentic Navigation (In Progress)

**Milestone Goal:** Reimagine expert discovery as a high-end streaming service — Netflix-style Browse page hooks users with curated categories, Sage conducts them to the Explorer for deep discovery.

- [x] **Phase 36: Foundation** - Route restructure, Zustand navigationSlice, Expert.photo_url column (2 plans) (completed 2026-02-24)
- [x] **Phase 37: Backend Endpoints** - GET /api/browse + GET /api/photos/{username} + bulk photo CSV ingest (completed 2026-02-24)
- [x] **Phase 38: Browse UI** - BrowsePage, CategoryRow, BrowseExpertCard with photo/monogram, "See All" and "Explore All" navigation (2 plans) (completed 2026-02-24)
- [ ] **Phase 39: Sage Cross-Page Navigation** - Sage FAB on Browse, cross-page handoff, conversation history preserved

## Phase Details

### Phase 36: Foundation
**Goal**: Routes, shared Zustand state, and Expert model are restructured so every v3.0 feature has its preconditions met before a line of Browse UI is written
**Depends on**: Phase 35 (v2.3 complete)
**Requirements**: NAV-01, SAGE-04
**Success Criteria** (what must be TRUE):
  1. Visiting `/` serves the BrowsePage stub (not Explorer) and visiting `/explore` serves the Explorer (formerly `/marketplace`)
  2. Visiting `/marketplace` in the browser redirects permanently to `/explore` with query params preserved
  3. Zustand store has a `navigationSlice` with `pendingSageResults` field that is not persisted to localStorage
  4. Expert SQLAlchemy model has a nullable `photo_url` column added via idempotent ALTER TABLE that does not crash on Railway restart
**Plans**: 2 plans
  - [ ] 36-01-PLAN.md — Route restructure + BrowsePage stub
  - [ ] 36-02-PLAN.md — Zustand navigationSlice + Expert.photo_url

### Phase 37: Backend Endpoints
**Goal**: Backend serves curated Browse data and proxies expert photos so the Browse UI can be built against real data from day one
**Depends on**: Phase 36
**Requirements**: PHOTO-01, PHOTO-02
**Success Criteria** (what must be TRUE):
  1. GET /api/browse returns `{ featured, rows[] }` with category row data drawn from SQL queries (no FAISS, no Gemini) and a cold-start guard when user_events is empty
  2. GET /api/photos/{username} proxies the photo URL stored on the Expert record, returns a 404 when no photo is stored, includes 24h Cache-Control headers, and goes through CORSMiddleware
  3. Admin can POST to /api/admin/experts/photos with a CSV to bulk-import photo URLs into the Expert table, with a dry-run count returned before any writes
  4. Photo endpoint returns an HTTPS URL in production (no mixed-content from Railway to Vercel)
**Plans**: 2 plans
Plans:
  - [ ] 37-01-PLAN.md — Browse API + photo proxy endpoints
  - [ ] 37-02-PLAN.md — Admin bulk photo import + serializer update

### Phase 38: Browse UI
**Goal**: Users experience a Netflix-style landing page with horizontal category rows, glassmorphic photo cards, monogram fallbacks, and direct navigation into the Explorer
**Depends on**: Phase 37
**Requirements**: BROWSE-01, BROWSE-02, BROWSE-03, BROWSE-04, NAV-02, PHOTO-03
**Success Criteria** (what must be TRUE):
  1. User lands on `/` and sees horizontal category rows (trending tags, recently joined, most clicked, highest findability) each showing expert cards that scroll left-to-right with snap behavior and no visible scrollbar
  2. User sees glassmorphic expert cards with a large photo (or monogram initials fallback when no photo exists) plus name, rate overlay, and tags revealed on hover
  3. User clicks "See All" on any category row and arrives at Explorer with that row's filter pre-applied and the expert grid populated accordingly
  4. User clicks "Explore All Experts" in the Browse page header and arrives at Explorer showing all 530 experts with no filters applied
  5. Rows show per-card skeleton placeholders while data is loading — no blank rows appear at any point during initial fetch
**Plans**: 2 plans
Plans:
  - [ ] 38-01-PLAN.md — Data hook + BrowseCard + BrowseRow + skeleton components
  - [ ] 38-02-PLAN.md — HeroBanner carousel + BrowsePage assembly + navigation wiring

### Phase 39: Sage Cross-Page Navigation
**Goal**: Sage operates as a persistent co-pilot across both Browse and Explorer — conversation history survives navigation and discovery searches land the user directly in Explorer with results already loaded
**Depends on**: Phase 38
**Requirements**: SAGE-01, SAGE-02, SAGE-03
**Success Criteria** (what must be TRUE):
  1. Sage FAB is visible on the Browse page without any manual mounting — it appears at the root layout level above the route outlet
  2. User asks Sage a discovery question on Browse, Sage navigates them to Explorer, and the search results are visible in the expert grid on arrival without a competing 530-expert fetch flash
  3. User asks Sage a question on Browse, navigates to Explorer, and can see and continue the same conversation thread in the Sage panel — no messages lost
  4. Navigating from Browse to Explorer does not reset the Sage pilot state — direct `/explore` URL visits still start with a clean Sage panel
**Plans**: 2 plans
Plans:
  - [ ] 39-01-PLAN.md — RootLayout + SagePopover + FAB lift (SAGE-01, SAGE-02)
  - [ ] 39-02-PLAN.md — Discovery auto-navigation + pending results (SAGE-03)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7. MVP Phases | v1.0 | Complete | Complete | 2026-02-20 |
| 8-10. Intelligence Phases | v1.1 | Complete | Complete | 2026-02-21 |
| 11-13. Steering Panel Phases | v1.2 | Complete | Complete | 2026-02-21 |
| 14-21. Marketplace Phases | v2.0 | 23/23 | Complete | 2026-02-22 |
| 22-27. Evolved Discovery Engine | v2.2 | 14/14 | Complete | 2026-02-22 |
| 28-35. Sage Evolution | v2.3 | 17/17 | Complete | 2026-02-24 |
| 36. Foundation | 2/2 | Complete    | 2026-02-24 | - |
| 37. Backend Endpoints | 2/2 | Complete    | 2026-02-24 | - |
| 38. Browse UI | 2/2 | Complete    | 2026-02-24 | - |
| 39. Sage Cross-Page Navigation | 1/2 | In Progress|  | - |
