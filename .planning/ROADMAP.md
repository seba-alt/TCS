# Roadmap: Tinrate AI Concierge Chatbot

## Milestones

- [x] **v1.0 MVP** - Phases 1-7 (shipped 2026-02-20)
- [x] **v1.1 Expert Intelligence & Search Quality** - Phases 8-10 (shipped 2026-02-21)
- [x] **v1.2 Intelligence Activation & Steering Panel** - Phases 11-13 (shipped 2026-02-21)
- [ ] **v2.0 Extreme Semantic Explorer** - Phases 14-21 (gap closure in progress)

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

### v2.0 Extreme Semantic Explorer (gap closure in progress)

**Milestone Goal:** Rearchitect from AI chat into a professional Expert Marketplace with hybrid search (SQLAlchemy + FAISS IDSelectorBatch + FTS5 BM25 fusion), Zustand global state, virtualized expert grid, floating AI co-pilot with Gemini function calling, and value-driven lead capture.

## Phase Checklist (v2.0)

- [x] **Phase 14: Hybrid Search Backend** - Deploy `/api/explore` with three-stage hybrid pipeline and FTS5 index
- [x] **Phase 15: Zustand State & Routing** - Create `useExplorerStore` and swap homepage to `MarketplacePage` (completed 2026-02-21)
- [x] **Phase 16: Marketplace Page & Sidebar** - Page layout, faceted filter sidebar, mobile bottom-sheet (completed 2026-02-21)
- [x] **Phase 17: Expert Grid & Cards** - Virtualized grid, high-density cards, Framer Motion entry animations (completed 2026-02-21)
- [x] **Phase 18: Floating AI Co-Pilot** - FAB panel, Gemini function calling, mobile full-screen overlay (completed 2026-02-21)
- [x] **Phase 19: Extended Features** - Lead capture, match report, URL state, fuzzy suggestions, empty states (completed 2026-02-21)
- [x] **Phase 20: Bug Fixes — Pagination & Rate Filter** - Fix loadNextPage param, FilterChips/RateSlider/MobileFilterSheet rate defaults (gap closure) (completed 2026-02-22)
- [ ] **Phase 21: Documentation & Cleanup** - Post-hoc VERIFICATION.md for phases 16/19, MARKET-05 accept, LEAD-03 deferred, tech debt (gap closure)

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
- [x] 17-01-PLAN.md — Fix Expert type (snake_case), extend resultsSlice (appendResults, isFetchingMore), extend useExplore (loadNextPage), install react-virtuoso + motion
- [x] 17-02-PLAN.md — Create ExpertCard + EmptyState + ExpertGrid components, wire into MarketplacePage
- [x] 17-03-PLAN.md — Human verify checkpoint: cards, animations, infinite scroll, tag pill wiring, empty state

### Phase 18: Floating AI Co-Pilot
**Goal**: Users can describe what they need in natural language and the co-pilot translates that into filter updates, making the marketplace intelligently navigable via conversation
**Depends on**: Phase 17
**Requirements**: PILOT-01, PILOT-02, PILOT-03
**Success Criteria** (what must be TRUE):
  1. A floating action button is visible at all times in the bottom-right corner; clicking it opens a 380px slide-in panel without disrupting the grid
  2. Typing a natural-language request (e.g. "show marketing experts under €100/hr") causes the co-pilot to call `apply_filters`, update the Zustand store, and trigger a grid re-fetch — all without the user touching the sidebar
  3. The co-pilot responds with a confirmation message reflecting the filters it applied and the resulting expert count
  4. On mobile viewports, the co-pilot panel expands to full-screen
**Plans**: 4 plans

Plans:
- [x] 18-01-PLAN.md — FastAPI pilot service + POST /api/pilot endpoint (Gemini two-turn function calling)
- [x] 18-02-PLAN.md — filterSlice setTags + useSage hook + SageFAB + SagePanel + SageMessage + SageInput
- [x] 18-03-PLAN.md — Wire SageFAB/SagePanel into MarketplacePage + wire EmptyState CTA
- [x] 18-04-PLAN.md — Human verify: FAB, panel animation, filter dispatch, mobile, conversation persistence

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
**Plans**: 6 plans

Plans:
- [x] 19-01-PLAN.md — Backend GET /api/suggest endpoint (FTS5 prefix search for search suggestions)
- [x] 19-02-PLAN.md — Shareable filter URLs (useUrlSync hook + Copy link button in FilterSidebar)
- [x] 19-03-PLAN.md — Email gate modal (View Full Profile on ExpertCard, ProfileGateModal, useEmailGate reuse)
- [x] 19-04-PLAN.md — Enhanced EmptyState (tag suggestion pills + Sage CTA + clear all)
- [x] 19-05-PLAN.md — Search suggestions dropdown in SearchInput (calls /api/suggest, AbortController)
- [x] 19-06-PLAN.md — Human verify: email gate, URL sync, search suggestions, no-results state

### Phase 20: Bug Fixes — Pagination & Rate Filter
**Goal:** Fix the two functional bugs identified by the v2.0 audit so infinite scroll with an active text query works correctly and the rate filter chip reflects actual filter state on page load
**Depends on**: Phase 19
**Requirements**: MARKET-01, MARKET-02
**Gap Closure:** Closes gaps from v2.0 audit
**Success Criteria** (what must be TRUE):
  1. Typing a query and scrolling past page 1 returns semantically-ranked results — not filter-only results
  2. On fresh page load with no active rate filter, the "EUR 0–5000" chip does not appear
  3. `RateSlider` can represent rates up to €5000/hr (max=5000)
  4. `MobileFilterSheet` rate defaults match the store defaults; `TOP_TAGS` is imported from `constants/tags.ts` (no inline copy)
**Plans**: 1 plan

Plans:
- [ ] 20-01-PLAN.md — Fix `useExplore.ts` loadNextPage param (`q`→`query`); fix `FilterChips.DEFAULT_RATE_MAX` (2000→5000); align `RateSlider` max; fix `MobileFilterSheet` rate defaults + import TOP_TAGS

### Phase 21: Documentation & Cleanup
**Goal:** Bring all planning artefacts up to date with actual code so the milestone audit can pass — write missing VERIFICATION.md files, accept the CSS hover animation for MARKET-05, formally defer LEAD-03, and remove stale code comments
**Depends on**: Phase 20
**Requirements**: MARKET-05, LEAD-03
**Gap Closure:** Closes remaining audit gaps from v2.0 audit
**Success Criteria** (what must be TRUE):
  1. `VERIFICATION.md` exists in phases 16 and 19 directories and accurately describes implemented features
  2. MARKET-05 requirement and Phase 17 `VERIFICATION.md` accurately describe the CSS hover animation (not motion/react mount animation)
  3. LEAD-03 is marked deferred in `REQUIREMENTS.md` with a v2.1 backlog note
  4. Dead `_state?.triggerSearch()` comment removed from Phase 15 store
  5. Phase 17 `VERIFICATION.md` `tags.slice` count corrected (0,2 not 0,3)
**Plans**: 2 plans

Plans:
- [ ] 21-01-PLAN.md — Write Phase 16 + Phase 19 VERIFICATION.md; fix Phase 17 VERIFICATION.md; update MARKET-05 + confirm LEAD-03 deferral
- [ ] 21-02-PLAN.md — Remove dead code: triggerSearch comment in store/index.ts; dead index prop in ExpertCard/ExpertGrid

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
| 18. Floating AI Co-Pilot | 4/4 | Complete    | 2026-02-21 | - |
| 19. Extended Features | v2.0 | 6/6 | Complete | 2026-02-21 |
| 20. Bug Fixes — Pagination & Rate Filter | 1/1 | Complete    | 2026-02-22 | — |
| 21. Documentation & Cleanup | 1/2 | In Progress|  | — |
