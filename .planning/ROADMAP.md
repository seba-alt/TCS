# Roadmap: Tinrate AI Concierge Chatbot

## Milestones

- [x] **v1.0 MVP** - Phases 1-7 (shipped 2026-02-20)
- [x] **v1.1 Expert Intelligence & Search Quality** - Phases 8-10 (shipped 2026-02-21)
- [x] **v1.2 Intelligence Activation & Steering Panel** - Phases 11-13 (shipped 2026-02-21)
- [x] **v2.0 Extreme Semantic Explorer** - Phases 14-21 (shipped 2026-02-22)
- [x] **v2.2 Evolved Discovery Engine** - Phases 22-27 (shipped 2026-02-22)
- [ ] **v2.3 Sage Evolution & Marketplace Intelligence** - Phases 28-31 (in progress)

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

- [x] Phase 14: Hybrid Search Backend (3/3 plans) — completed 2026-02-21
- [x] Phase 15: Zustand State & Routing (1/1 plan) — completed 2026-02-21
- [x] Phase 16: Marketplace Page & Sidebar (3/3 plans) — completed 2026-02-21
- [x] Phase 17: Expert Grid & Cards (3/3 plans) — completed 2026-02-21
- [x] Phase 18: Floating AI Co-Pilot (4/4 plans) — completed 2026-02-21
- [x] Phase 19: Extended Features (6/6 plans) — completed 2026-02-21
- [x] Phase 20: Bug Fixes — Pagination & Rate Filter (1/1 plan) — completed 2026-02-22
- [x] Phase 21: Documentation & Cleanup (2/2 plans) — completed 2026-02-22

</details>

<details>
<summary>v2.2 Evolved Discovery Engine (Phases 22-27) — SHIPPED 2026-02-22</summary>

See `.planning/milestones/v2.2-ROADMAP.md`

- [x] Phase 22: Visual Infrastructure (2/2 plans) — completed 2026-02-22
- [x] Phase 23: Discovery Engine (3/3 plans) — completed 2026-02-22
- [x] Phase 24: Atomic Index Swap UI (2/2 plans) — completed 2026-02-22
- [x] Phase 25: Admin Intelligence Metrics (2/2 plans) — completed 2026-02-22
- [x] Phase 26: Embedding Heatmap (2/2 plans) — completed 2026-02-22
- [x] Phase 27: Newsletter Gate + Easter Egg (3/3 plans) — completed 2026-02-22

</details>

### v2.3 Sage Evolution & Marketplace Intelligence (In Progress)

**Milestone Goal:** Evolve Sage from a filter adjuster into an active search engine with full personality, instrument user behavior across the marketplace, and surface demand and exposure signals in a new admin intelligence page.

- [x] **Phase 28: Sage Search Engine** - Add `search_experts` Gemini function; Sage finds experts, narrates results, syncs main grid (completed 2026-02-22)
- [x] **Phase 29: Sage Personality + FAB Reactions** - Rewrite system prompt for warmer/wittier tone; animated FAB boxShadow pulse on activity (completed 2026-02-22)
- [x] **Phase 30: Behavior Tracking** - `UserEvent` DB model + `POST /api/events` backend + frontend `trackEvent()` instrumentation for card clicks, Sage queries, and filter changes (2 plans ready) (completed 2026-02-22)
- [x] **Phase 31: Admin Marketplace Intelligence** - New `/admin/marketplace` page showing unmet demand, expert exposure, daily Sage trend, and cold-start empty state (completed 2026-02-22)

## Phase Details

### Phase 28: Sage Search Engine
**Goal**: Sage can actively find experts by calling `/api/explore` in-process, narrate results in the panel, and sync the main expert grid
**Depends on**: Phase 27 (v2.2 shipped system)
**Requirements**: SAGE-01, SAGE-02, SAGE-03, SAGE-04
**Success Criteria** (what must be TRUE):
  1. User asks Sage "find me fintech experts" and sees matching experts appear in the main grid without touching any filter
  2. Sage responds with a natural-language summary ("I found 8 fintech experts who...") after every search — the grid never updates silently
  3. When a Sage search returns zero results, Sage acknowledges it explicitly and either suggests an alternative or asks a clarifying question
  4. Gemini correctly routes browsing-refinement queries to `apply_filters` and discovery queries to `search_experts` across 20 real test queries (verified in Railway logs before ship)
**Plans**: 2 plans

**Architecture notes (encode in plan):**
- `search_experts` calls `run_explore()` via direct Python import in `pilot_service.py` — NOT an HTTP self-call to `/api/explore`
- `pilot.py` router injects `db: Session = Depends(get_db)` and `app_state = request.app.state` into `run_pilot()`
- Grid sync: `useSage` calls `validateAndApplyFilters(data.filters)` which updates `filterSlice` and triggers `useExplore` reactive re-fetch — NEVER calls `setResults` directly
- `pilotSlice.PilotMessage` gains `experts?: Expert[]` for panel display; `resultsSlice` is NEVER written by `useSage`
- Function descriptions must be mutually exclusive: `apply_filters` = "narrow or refine current results"; `search_experts` = "discover experts, find me X, who can help with Y"
- `fn_call.args` is a protobuf Struct — wrap in `dict()` before use
- Test 20 real queries from `conversations` table; assert `fn_call.name` in logs before shipping

Plans:
- [ ] 28-01-PLAN.md — Backend: `search_experts` FunctionDeclaration + `run_explore()` in-process call + db/app_state injection in `pilot_service.py` + `pilot.py`
- [ ] 28-02-PLAN.md — Frontend: `useSage` dual-function dispatch, grid sync via `validateAndApplyFilters`, zero-result handling, 20-query routing test

### Phase 29: Sage Personality + FAB Reactions
**Goal**: Sage speaks with a warmer, wittier voice and the FAB pulses/glows on user activity
**Depends on**: Phase 27 (independent of Phase 28 — can ship in either order)
**Requirements**: SAGE-05, FAB-01
**Success Criteria** (what must be TRUE):
  1. Sage responses use contractions, warm language, and concise result summaries — no clinical filter-confirm tone
  2. Sage asks at most one clarifying question per conversation; after the user replies to any question, Sage always calls a function (never asks a second question)
  3. The Sage FAB displays a visible boxShadow pulse/glow animation in response to user activity
  4. FAB hover (scale up) and tap (scale down) gestures continue to work without conflict alongside the glow animation
**Plans**: 1 plan

**Architecture notes (encode in plan):**
- System prompt rewrite lives entirely in `pilot_service.py` — one-file change, instant rollback via `git push`
- Hard-limit in system prompt: "You may ask at most ONE clarifying question per conversation. After the user responds to any question, always call a function."
- FAB animation: outer `motion.div` animates `boxShadow` ONLY; inner `motion.button` retains `whileHover={{ scale: 1.05 }}` and `whileTap={{ scale: 0.95 }}` — NEVER animate `scale` on the wrapper div

Plans:
- [ ] 29-01-PLAN.md — System prompt rewrite (Sage personality) + SageFAB motion.div glow wrapper (purple on Sage reply, blue on filter change)

### Phase 30: Behavior Tracking
**Goal**: Expert card clicks, Sage query interactions, and filter changes are durably recorded in the database without blocking any user interaction
**Depends on**: Phase 28 (Sage must exist to emit `sage_query` events; card tracking is independent but grouped here)
**Requirements**: TRACK-01, TRACK-02, TRACK-03
**Success Criteria** (what must be TRUE):
  1. Clicking an expert card in the grid or Sage panel records a `card_click` event in the DB with expert ID, timestamp, and context (grid vs sage_panel) — the profile gate opens without any perceptible delay
  2. Each Sage interaction records a `sage_query` event with query text, which function was called, and result count — emitted after the pilot response, never before
  3. Settling a filter (rate slider released, tag selected) records a `filter_change` event — exactly one event per settled change, not per slider tick
  4. The `POST /api/events` endpoint returns 202, requires no authentication, and rejects unknown `event_type` values with 422
**Plans**: TBD

**Architecture notes (encode in plan):**
- `UserEvent` SQLAlchemy model is a NEW table — `Base.metadata.create_all()` handles creation safely; no `ALTER TABLE` needed
- Event types allowlist: `card_click`, `sage_query`, `filter_change` — Pydantic validation rejects arbitrary strings with 422
- Frontend: `tracking.ts` exports `trackEvent()` as a module function (not a hook); uses `fetch` with `keepalive: true`; ALWAYS `void fetch(...)` — NEVER `await` in click path
- Filter tracking: debounced 1000ms after settled state; rate slider tracks on `onMouseUp`/`onTouchEnd` only — not per pixel of movement
- `useSage` emits `sage_query` with explicit `function_called` field from `PilotResponse` (not inferred from `data.filters` presence)
- Composite index on `(event_type, created_at)` in `UserEvent` model
- Verify `user_events` table creation in Railway logs within 60 seconds of first deploy

Plans:
- [x] 30-01-PLAN.md — Backend: `UserEvent` model + `events.py` router (`POST /api/events`, 202, no auth, Pydantic allowlist)
- [x] 30-02-PLAN.md — Frontend: `tracking.ts` module + instrumentation in `ExpertCard.tsx`, `useSage.ts`, `SearchInput.tsx`, `RateSlider.tsx`, `TagMultiSelect.tsx`

### Phase 31: Admin Marketplace Intelligence
**Goal**: Admins can see which searches go unmet, which experts are invisible, and how Sage usage trends over time
**Depends on**: Phase 30 (events must be accumulating in the DB)
**Requirements**: INTEL-01, INTEL-02, INTEL-03, INTEL-04
**Success Criteria** (what must be TRUE):
  1. Admin navigates to `/admin/marketplace` and sees a table of zero-result Sage queries sorted by frequency, plus underserved filter combinations
  2. Admin sees an expert exposure table showing appears and click counts per expert, broken down by grid vs Sage panel context
  3. Admin sees a Recharts BarChart of daily Sage query volume
  4. When the `user_events` table is empty (cold start), the page shows an explicit message with the tracking start timestamp and guidance that insights appear after approximately 50 page views — no blank or broken state
**Plans**: 2 plans

**Architecture notes (encode in plan):**
- New admin page `MarketplacePage.tsx` at `/admin/marketplace` — does NOT modify existing `GapsPage.tsx` or any other admin page
- Two new backend endpoints under `_require_admin` dep: `GET /api/admin/events/demand` and `GET /api/admin/events/exposure`
- Both endpoints return `data_since` field (timestamp of earliest event or null) for cold-start display
- Build empty state UI BEFORE data-loading logic (cold-start Pitfall 9 — prevents confusing blank tab during cold start)
- `AdminSidebar.tsx` gains Marketplace nav entry
- SQL aggregations use standard `GROUP BY` + `ORDER BY COUNT DESC` with existing SQLAlchemy `text()` pattern

Plans:
- [ ] 31-01-PLAN.md — Backend: demand, exposure, trend aggregation endpoints + CSV exports in admin.py
- [ ] 31-02-PLAN.md — Frontend: AdminMarketplacePage with DemandTable, ExposureTable, BarChart, cold-start state + sidebar nav

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7. MVP Phases | v1.0 | Complete | Complete | 2026-02-20 |
| 8-10. Intelligence Phases | v1.1 | Complete | Complete | 2026-02-21 |
| 11-13. Steering Panel Phases | v1.2 | Complete | Complete | 2026-02-21 |
| 14-21. Marketplace Phases | v2.0 | 23/23 | Complete | 2026-02-22 |
| 22-27. Evolved Discovery Engine | v2.2 | 14/14 | Complete | 2026-02-22 |
| 28. Sage Search Engine | v2.3 | Complete    | 2026-02-22 | - |
| 29. Sage Personality + FAB Reactions | v2.3 | Complete    | 2026-02-22 | - |
| 30. Behavior Tracking | 2/2 | Complete    | 2026-02-22 | - |
| 31. Admin Marketplace Intelligence | 2/2 | Complete   | 2026-02-22 | - |
