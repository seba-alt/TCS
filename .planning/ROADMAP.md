# Roadmap: Tinrate AI Concierge Chatbot

## Milestones

- [x] **v1.0 MVP** - Phases 1-7 (shipped 2026-02-20)
- [x] **v1.1 Expert Intelligence & Search Quality** - Phases 8-10 (shipped 2026-02-21)
- [x] **v1.2 Intelligence Activation & Steering Panel** - Phases 11-13 (shipped 2026-02-21)
- [x] **v2.0 Extreme Semantic Explorer** - Phases 14-21 (shipped 2026-02-22)
- [ ] **v2.2 Evolved Discovery Engine** - Phases 22-27 (in progress)

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

### v2.2 Evolved Discovery Engine (In Progress)

**Milestone Goal:** Evolve the marketplace from a functional grid into an immersive, high-fidelity discovery engine — aurora aesthetics, glassmorphism depth, animated tag cloud, atomic index management, admin embedding heatmap, and newsletter-gated lead capture.

- [x] **Phase 22: Visual Infrastructure** - Aurora mesh gradient + OKLCH tokens + glassmorphism on all surfaces (completed 2026-02-22)
- [ ] **Phase 23: Discovery Engine** - Bento ExpertCard redesign + animated claymorphic tag cloud
- [x] **Phase 24: Atomic Index Swap UI** - Admin rebuild trigger + status polling frontend (completed 2026-02-22)
- [x] **Phase 25: Admin Intelligence Metrics** - OTR@K computation + Index Drift display (completed 2026-02-22)
- [x] **Phase 26: Embedding Heatmap** - t-SNE projection endpoint + admin scatter plot (completed 2026-02-22)
- [ ] **Phase 27: Newsletter Gate + Easter Egg** - Newsletter subscription modal + barrel roll

## Phase Details

### Phase 22: Visual Infrastructure
**Goal**: The marketplace renders with a premium aurora aesthetic — OKLCH design tokens in CSS, an animated aurora mesh gradient background, and glassmorphism surfaces on the sidebar, search input, and Sage panel — all legible and gracefully degrading on unsupported browsers.
**Depends on**: Phase 21 (v2.0 complete codebase)
**Requirements**: VIS-01, VIS-02, VIS-03, VIS-04, VIS-05
**Success Criteria** (what must be TRUE):
  1. The marketplace background displays a slow-moving, multi-color aurora gradient animation at all viewport sizes
  2. FilterSidebar, SearchInput, and SagePanel each render with a frosted-glass appearance (translucent background + blur) over the aurora
  3. All text on glass surfaces passes 4.5:1 contrast measured over the actual aurora gradient (not white)
  4. On a browser without backdrop-filter support, glass surfaces fall back to an opaque dark background (no invisible/broken surfaces)
  5. OKLCH color tokens are defined as CSS custom properties and consumed by all glass and aurora elements
**Plans**: 2 plans

**Planning notes (from research):**
- Audit full ancestor chain before writing any glass class — `overflow: hidden` ancestors silently kill `backdrop-filter`; use `before:` pseudo-element hack if ancestor cannot be modified
- Include `-webkit-backdrop-filter` alongside `backdrop-filter` (Tailwind v3 does not emit this prefix)
- OKLCH tokens go in CSS custom properties only — NOT Tailwind JS config
- Do NOT apply backdrop-filter to overflow:hidden containers; start with ancestor audit in DevTools
- Contrast audit must use deployed aurora gradient, not white background

Plans:
- [ ] 22-01-PLAN.md — OKLCH tokens, aurora animation keyframes, glass-surface CSS class, and AuroraBackground React component
- [ ] 22-02-PLAN.md — Apply aurora to MarketplacePage and glass surfaces to FilterSidebar, SearchInput, SagePanel; human visual verification

### Phase 23: Discovery Engine
**Goal**: Expert discovery feels dynamic and tactile — the ExpertCard displays information in distinct visual zones (bento layout), the tag selector is replaced with an animated claymorphic tag cloud with proximity-based scaling, and an "Everything is possible" element invites exploration.
**Depends on**: Phase 22 (OKLCH tokens and aurora background must exist for visual validation)
**Requirements**: CARD-01, CARD-02, CARD-03, DISC-01, DISC-02, DISC-03, DISC-04
**Success Criteria** (what must be TRUE):
  1. ExpertCard shows four distinct visual zones (name/role, rate+badge, tags, match reason) within the fixed h-[180px] height, compatible with VirtuosoGrid
  2. Hovering an ExpertCard shows an aurora-palette glow that visually fits the new background (not the old purple-only glow)
  3. The tag selector area displays all tags as rounded pill items with Framer Motion layout reordering when tags are toggled
  4. Moving the cursor near (not just over) a tag pill causes it to scale up proportionally to cursor proximity, with no visible React re-render jank
  5. An "Everything is possible" phrase element below the tag cloud cycles through example quirky tags and is keyboard-navigable for tag selection
**Plans**: 3 plans

**Planning notes (from research):**
- ExpertCard MUST NOT import Framer Motion — CSS-only hover (Phase 17 decision); no `initial`/`animate` props on card mount
- Tag cloud: limit displayed tags to top 30
- Proximity scale: `useMotionValue` + `useTransform` + `useSpring` — NOT `useState` + `onMouseMove` (causes 60 re-renders/sec with 40+ tags)
- Bento card must preserve `h-[180px]` for VirtuosoGrid uniform-height assumption
- DISC-04: keyboard navigation and aria-label must be preserved (selection behavior unchanged from TagMultiSelect)

Plans:
- [ ] 23-01-PLAN.md — Bento four-zone ExpertCard layout + OKLCH aurora glow update in index.css
- [ ] 23-02-PLAN.md — TagCloud.tsx with proximity-scale motion values + EverythingIsPossible.tsx with cycling crossfade
- [ ] 23-03-PLAN.md — Wire TagCloud + EverythingIsPossible into FilterSidebar; human visual verification

### Phase 24: Atomic Index Swap UI
**Goal**: Admins can trigger a FAISS index rebuild from the admin panel and watch its status in real time, while live search requests are served without interruption throughout the rebuild.
**Depends on**: Phase 21 (admin panel codebase); backend swap logic already exists in admin.py
**Requirements**: IDX-01, IDX-02, IDX-03, IDX-04
**Success Criteria** (what must be TRUE):
  1. The admin panel shows a "Rebuild Index" button that triggers the existing ingest job and immediately shows a "running" status indicator
  2. While the rebuild runs, users can perform expert searches without receiving errors or degraded results
  3. On completion, the admin panel shows a "complete" status with a timestamp of when the rebuild finished
  4. If the rebuild fails, the admin panel shows a "failed" status and the previous index continues serving requests
**Plans**: 2 plans

**Planning notes (from research):**
- Frontend-only phase: backend swap already exists in `_run_ingest_job` (admin.py lines 93–146)
- Extend `_ingest` dict with `last_rebuild_at` and `expert_count_at_rebuild` fields for Index Drift (needed by Phase 25)
- Add `app.state.tsne_cache = []` invalidation line to swap completion (required by Phase 26)
- Add `asyncio.Lock` on rebuild endpoint to prevent double-rebuild OOM
- Frontend polls existing `GET /api/admin/ingest/status` — no new backend endpoints needed

Plans:
- [ ] 24-01-PLAN.md — Backend surgical additions (asyncio.Lock, _ingest dict extension, tsne_cache init) + TypeScript contract extension
- [ ] 24-02-PLAN.md — IndexPage.tsx admin UI + route registration + sidebar nav item; human visual verification

### Phase 25: Admin Intelligence Metrics
**Goal**: The admin Intelligence dashboard surfaces OTR@K (On-Topic Rate) as a 7-day rolling average per search query and shows Index Drift status — time since last rebuild and expert count change — giving operators actionable signal on retrieval health.
**Depends on**: Phase 24 (last_rebuild_at and expert_count_at_rebuild fields in _ingest dict; tsne_cache invalidation hook)
**Requirements**: INTEL-01, INTEL-02, INTEL-03, INTEL-04
**Success Criteria** (what must be TRUE):
  1. Every search query that returns results records an OTR@K value in the conversations table (fraction of top-10 results scoring at or above 0.60)
  2. The admin Intelligence tab displays a 7-day rolling average OTR@K with color coding (green ≥ 0.75, amber 0.60–0.74, red < 0.60)
  3. The admin Intelligence tab shows how long ago the FAISS index was last rebuilt (e.g., "3 days ago")
  4. The admin Intelligence tab shows the expert count delta since the last rebuild (e.g., "+12 experts added since rebuild")
**Plans**: 2 plans

**Planning notes (from research):**
- OTR@K computed in chat pipeline (chat.py) after retrieve_with_intelligence() returns candidates — NOT in marketplace explore path
- Add `otr_at_k REAL` column to conversations via inline `ALTER TABLE` in main.py (same pattern as existing migrations)
- `SIMILARITY_THRESHOLD=0.60` aligns with existing `GAP_THRESHOLD=0.60` — no recalibration needed
- OTR@K is admin-only — do NOT expose in public ExploreResponse
- Index Drift reads from `_ingest` dict extended in Phase 24

Plans:
- [ ] 25-01-PLAN.md — DB migration + ORM field + OTR@K computation in chat.py + GET /api/admin/intelligence endpoint
- [ ] 25-02-PLAN.md — IntelligenceMetrics TypeScript type + useIntelligenceMetrics hook + OTR@K and Index Drift metric panels in IntelligenceDashboardPage; human visual verification

### Phase 26: Embedding Heatmap
**Goal**: The admin Intelligence tab displays an interactive scatter plot of all expert embeddings projected into 2D space via t-SNE, colored by category, with expert name visible on hover — enabling operators to see clustering and coverage of the expert pool.
**Depends on**: Phase 24 (tsne_cache invalidation on atomic swap); scikit-learn and scipy added to requirements.txt
**Requirements**: INTEL-05, INTEL-06
**Success Criteria** (what must be TRUE):
  1. After deployment, the Railway app passes its healthcheck within 10 seconds (t-SNE computation does not block startup)
  2. The admin Intelligence tab displays a scatter plot within 30 seconds of app startup, with points colored by expert category
  3. Hovering a scatter plot point shows the expert's name in a tooltip
  4. After an admin triggers an index rebuild (Phase 24), the scatter plot recomputes and updates to reflect the new index
**Plans**: 2 plans

**Planning notes (from research):**
- CRITICAL: t-SNE `fit_transform` MUST run post-yield via `asyncio.create_task(_compute_tsne_background(app))` — placing it above the `yield` in FastAPI lifespan blocks Railway healthcheck and causes infinite restart loop
- Use `PCA(n_components=50)` then `TSNE(perplexity=30, max_iter=1000, init='pca', random_state=42, metric='cosine')` — PCA pre-reduction is mandatory (cuts compute 4–8×)
- Guard endpoint: if `not app.state.tsne_ready`, return `JSONResponse({"status": "computing"}, 202)`
- Cache in `app.state.embedding_map`; invalidate by setting `app.state.tsne_cache = []` on swap (done in Phase 24)
- Frontend: Recharts `ScatterChart` — points colored by category, hover tooltips with expert name
- Add `scikit-learn==1.8.0` and `scipy==1.15.1` to requirements.txt; use `max_iter` (not `n_iter` — removed in sklearn 1.7)

Plans: 2/2 complete
- [x] 26-01-PLAN.md — Backend: scikit-learn + scipy deps, _compute_tsne_background coroutine (post-yield), GET /api/admin/embedding-map endpoint with 202 guard
- [x] 26-02-PLAN.md — Frontend: recharts install, EmbeddingPoint types, useEmbeddingMap polling hook, ScatterChart with jewel-tone category colors in IntelligenceDashboardPage; human visual verification

### Phase 27: Newsletter Gate + Easter Egg
**Goal**: The email gate is redesigned as a newsletter subscription CTA with value-exchange framing, subscription state persists via Zustand, admins can see subscriber counts and lists, and users who type playful queries trigger a delightful barrel roll animation.
**Depends on**: Phase 21 (ProfileGateModal and existing email gate); fully independent of Phases 22–26 (can be built in parallel)
**Requirements**: NLTR-01, NLTR-02, NLTR-03, NLTR-04, FUN-01
**Success Criteria** (what must be TRUE):
  1. First-time visitors see a newsletter CTA modal ("Get expert insights to your inbox. Unlock profiles.") when clicking "View Full Profile"
  2. Submitting an email subscribes the user (record in newsletter_subscribers table) and unlocks profiles; the modal does not re-appear on subsequent page visits
  3. Returning visitors who were already unlocked in v2.0 (localStorage key `tcs_email_unlocked`) bypass the newsletter gate automatically
  4. The admin Leads page shows a newsletter subscriber count and the full subscriber list
  5. Typing "barrel roll" or "do a flip" in Sage or the search input causes ExpertCards to spin 360 degrees via Framer Motion
**Plans**: 3 plans

**Planning notes (from research):**
- Standalone `useNltrStore` with persist key `'tinrate-newsletter-v1'` — do NOT use `'explorer-filters'` or modify `useExplorerStore` or its `partialize`
- Synchronous localStorage read in store's initial state to prevent hydration flash (not `useEffect`)
- `localStorage['tcs_email_unlocked']` bypass logic is UNCHANGED — existing unlocked users auto-bypass
- Newsletter table created by `Base.metadata.create_all()` — no `ALTER TABLE` needed
- Barrel roll: detect trigger phrases in Sage query AND search query; apply Framer Motion `rotate` on VirtuosoGrid container element — NOT on individual ExpertCards (would cause scroll-triggered re-animations on VirtuosoGrid unmount/remount)

Plans:
- [ ] 27-01-PLAN.md — Backend foundation (NewsletterSubscriber model, subscribe endpoint, admin endpoints) + useNltrStore Zustand store
- [ ] 27-02-PLAN.md — Newsletter gate modal redesign + MarketplacePage integration with useNltrStore; human visual verification
- [ ] 27-03-PLAN.md — Barrel roll easter egg (ExpertGrid animation + Sage/SearchInput trigger detection) + Admin Leads subscriber section; human visual verification

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7. MVP Phases | v1.0 | Complete | Complete | 2026-02-20 |
| 8-10. Intelligence Phases | v1.1 | Complete | Complete | 2026-02-21 |
| 11-13. Steering Panel Phases | v1.2 | Complete | Complete | 2026-02-21 |
| 14-21. Marketplace Phases | v2.0 | 23/23 | Complete | 2026-02-22 |
| 22. Visual Infrastructure | 2/2 | Complete   | 2026-02-22 | - |
| 23. Discovery Engine | v2.2 | 0/3 | Not started | - |
| 24. Atomic Index Swap UI | 2/2 | Complete   | 2026-02-22 | - |
| 25. Admin Intelligence Metrics | 2/2 | Complete   | 2026-02-22 | - |
| 26. Embedding Heatmap | 2/2 | Complete    | 2026-02-22 | - |
| 27. Newsletter Gate + Easter Egg | 2/3 | In Progress|  | - |
