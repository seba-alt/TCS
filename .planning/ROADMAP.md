# Roadmap: Tinrate AI Concierge Chatbot

## Milestones

- [x] **v1.0 MVP** - Phases 1-7 (shipped 2026-02-20)
- [x] **v1.1 Expert Intelligence & Search Quality** - Phases 8-10 (shipped 2026-02-21)
- [x] **v1.2 Intelligence Activation & Steering Panel** - Phases 11-13 (shipped 2026-02-21)
- [ ] **v2.0 Extreme Semantic Explorer** - Phases 14-19 (in progress)

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

---

### v2.0 Extreme Semantic Explorer (In Progress)

**Milestone Goal:** Rearchitect from AI chat into a professional Expert Marketplace with hybrid search (SQLAlchemy + FAISS IDSelectorBatch + FTS5 BM25 fusion), Zustand global state, virtualized expert grid, floating AI co-pilot with Gemini function calling, and value-driven lead capture.

## Phase Checklist (v2.0)

- [x] **Phase 14: Hybrid Search Backend** - Deploy `/api/explore` with three-stage hybrid pipeline and FTS5 index
- [x] **Phase 15: Zustand State & Routing** - Create `useExplorerStore` and swap homepage to `MarketplacePage` (completed 2026-02-21)
- [x] **Phase 16: Marketplace Page & Sidebar** - Page layout, faceted filter sidebar, mobile bottom-sheet (completed 2026-02-21)
- [x] **Phase 17: Expert Grid & Cards** - Virtualized grid, high-density cards, Framer Motion entry animations (completed 2026-02-21)
- [ ] **Phase 18: Floating AI Co-Pilot** - FAB panel, Gemini function calling, mobile full-screen overlay
- [ ] **Phase 19: Extended Features** - Lead capture, match report, URL state, fuzzy suggestions, empty states

## Phase Details

### Phase 14: Hybrid Search Backend
**Goal**: The backend exposes a hybrid search API that fuses semantic and keyword signals so the marketplace has a working, validated data contract to build against
**Depends on**: Phase 13 (v1.2 complete — existing production system)
**Requirements**: EXPL-01, EXPL-02, EXPL-03, EXPL-04, EXPL-05
**Success Criteria** (what must be TRUE):
  1. `GET /api/explore` returns a JSON `ExploreResponse` with `experts[]`, `total`, `cursor`, and `took_ms` fields for any combination of query, rate range, and tag filters
  2. When filters are active and no text query is given, results are sorted by findability score descending — FAISS and BM25 are skipped entirely
  3. When a text query is given, results reflect fused FAISS (0.7) + BM25 (0.3) weighted ranking, with findability and feedback boosts applied on top
  4. The FTS5 `experts_fts` virtual table exists in the Railway SQLite database and is populated with all experts at startup (count grows over time)
  5. The `username_to_faiss_pos` mapping is built at startup and IDSelectorBatch correctly restricts FAISS search to only the SQLAlchemy pre-filtered expert set
**Plans**: 2 plans

Plans:
- [x] 14-01-PLAN.md — Create explorer.py pipeline service + explore.py router (ExploreResponse data contract, three-stage hybrid search)
- [x] 14-02-PLAN.md — Wire into main.py (FTS5 startup, mapping, category classification, router registration) + admin.py FTS5 sync

### Phase 15: Zustand State & Routing
**Goal**: The frontend has a single shared state store and the homepage route delivers the marketplace, so every subsequent UI phase builds on a real data contract and shared state layer
**Depends on**: Phase 14
**Requirements**: STATE-01, STATE-02, STATE-03
**Success Criteria** (what must be TRUE):
  1. Navigating to `/` renders `MarketplacePage` — the old chat interface is no longer the homepage
  2. `useExplorerStore` is importable from any component and exposes filter, results, and pilot slices without a Provider wrapper
  3. Filter preferences (query, rateMin, rateMax, tags) survive a full browser reload via localStorage, while results and pilot messages do not persist
  4. Changing a filter value in any component is immediately reflected in all other components consuming that slice, with no stale state
**Plans**: 1 plan

Plans:
- [x] 15-01-PLAN.md — Install Zustand, create three-slice store with persist middleware, create MarketplacePage shell, update routing

### Phase 16: Marketplace Page & Sidebar
**Goal**: Users see a professional marketplace layout with a functional faceted sidebar that filters the expert pool — the visible frame the grid and co-pilot will attach to
**Depends on**: Phase 15
**Requirements**: MARKET-01, MARKET-06
**Success Criteria** (what must be TRUE):
  1. The marketplace page renders a sidebar with a rate range slider, domain tag multi-select, text search input, and active filter chips showing the current filter state
  2. Adjusting any sidebar control triggers a debounced fetch to `/api/explore` and updates the results area
  3. Clearing all filters resets the sidebar controls and refetches the unfiltered expert pool
  4. On mobile viewports, the sidebar is hidden by default and accessible via a bottom-sheet drawer
**Plans**: 3 plans

Plans:
- [x] 16-01-PLAN.md — Install deps + useExplore hook + leaf filter components (SearchInput, RateSlider, TagMultiSelect)
- [x] 16-02-PLAN.md — FilterSidebar + FilterChips + SkeletonGrid + MobileFilterSheet + MarketplacePage wiring
- [x] 16-03-PLAN.md — Human verify checkpoint: sidebar interactions, mobile bottom-sheet, filter/fetch flow

### Phase 17: Expert Grid & Cards
**Goal**: Users can browse all experts in a performant, animated grid with rich cards — the core browsing experience of the marketplace (expert count grows over time)
**Depends on**: Phase 16
**Requirements**: MARKET-02, MARKET-03, MARKET-04, MARKET-05
**Success Criteria** (what must be TRUE):
  1. The expert grid renders 20 cards per page using react-virtuoso and loads additional pages automatically as the user scrolls to the bottom
  2. Each expert card displays name, job title, company, hourly rate, domain tag pills, findability badge, and a match reason snippet
  3. Clicking a domain tag pill on a card adds that tag to the sidebar filters and immediately triggers a re-fetch with the new tag active
  4. Cards animate into view on mount; sidebar and modal transitions use AnimatePresence; no exit animations are applied to virtualized card items
**Plans**: 3 plans

Plans:
- [ ] 17-01-PLAN.md — Fix Expert type (snake_case), extend resultsSlice (appendResults, isFetchingMore), extend useExplore (loadNextPage), install react-virtuoso + motion
- [ ] 17-02-PLAN.md — Create ExpertCard + EmptyState + ExpertGrid components, wire into MarketplacePage
- [ ] 17-03-PLAN.md — Human verify checkpoint: cards, animations, infinite scroll, tag pill wiring, empty state

### Phase 18: Floating AI Co-Pilot
**Goal**: Users can describe what they need in natural language and the co-pilot translates that into filter updates, making the marketplace intelligently navigable via conversation
**Depends on**: Phase 17
**Requirements**: PILOT-01, PILOT-02, PILOT-03
**Success Criteria** (what must be TRUE):
  1. A floating action button is visible at all times in the bottom-right corner; clicking it opens a 380px slide-in panel without disrupting the grid
  2. Typing a natural-language request (e.g. "show marketing experts under €100/hr") causes the co-pilot to call `apply_filters`, update the Zustand store, and trigger a grid re-fetch — all without the user touching the sidebar
  3. The co-pilot responds with a confirmation message reflecting the filters it applied and the resulting expert count
  4. On mobile viewports, the co-pilot panel expands to full-screen
**Plans**: TBD

### Phase 19: Extended Features
**Goal**: Users can share filtered views, get fuzzy search help, download a personalized match report, and never hit a dead end — making the marketplace robust and conversion-ready
**Depends on**: Phase 18
**Requirements**: LEAD-01, LEAD-02, LEAD-03, LEAD-04, ROBUST-01, ROBUST-02, ROBUST-03
**Success Criteria** (what must be TRUE):
  1. A user can browse the full expert grid and apply all filters without being asked for an email
  2. Clicking "View Full Profile" triggers an email capture modal; clicking "Download Match Report" triggers a two-field modal (email + project type); returning visitors with a previously captured email bypass both modals automatically
  3. After capturing email and project type, the AI generates and displays a styled in-app HTML match report personalized to the top results
  4. The URL reflects active filters as query params so a filtered view can be bookmarked or shared; loading that URL restores the exact filter state
  5. When search returns no results, the page shows alternative query suggestions and nearby tag options rather than a blank state
**Plans**: TBD

## Progress

**Execution Order:** 14 → 15 → 16 → 17 → 18 → 19

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7. MVP Phases | v1.0 | Complete | Complete | 2026-02-20 |
| 8-10. Intelligence Phases | v1.1 | Complete | Complete | 2026-02-21 |
| 11-13. Steering Panel Phases | v1.2 | Complete | Complete | 2026-02-21 |
| 14. Hybrid Search Backend | 3/3 | Complete    | 2026-02-21 | 2026-02-21 |
| 15. Zustand State & Routing | 1/1 | Complete    | 2026-02-21 | - |
| 16. Marketplace Page & Sidebar | v2.0 | 3/3 | Complete | 2026-02-21 |
| 17. Expert Grid & Cards | v2.0 | Complete    | 2026-02-21 | - |
| 18. Floating AI Co-Pilot | v2.0 | 0/? | Not started | - |
| 19. Extended Features | v2.0 | 0/? | Not started | - |
