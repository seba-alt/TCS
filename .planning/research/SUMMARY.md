# Project Research Summary

**Project:** TCS — Tinrate Expert Marketplace v2.2 Evolved Discovery Engine
**Domain:** AI-augmented expert marketplace (visual overhaul + operational intelligence)
**Researched:** 2026-02-22
**Confidence:** HIGH (architecture grounded in production codebase inspection; stack confirmed against npm/PyPI; pitfalls verified against official docs and GitHub issues)

## Executive Summary

TCS v2.2 is an additive milestone layering premium visual design, admin intelligence tooling, and operational robustness onto an already-shipping v2.0 marketplace. The v2.0 system — FastAPI + SQLite + FAISS + Gemini embeddings on Railway, React + Zustand + react-virtuoso on Vercel — is stable and unchanged. v2.2 adds six discrete capability groups: aurora/glassmorphism visual overhaul, claymorphic animated tag cloud, atomic FAISS index swap UI, admin intelligence metrics (OTR@K and Index Drift), t-SNE embedding scatter plot, and a newsletter subscription gate. Because the existing codebase is ground truth and the FAISS index type was confirmed by local inspection (IndexFlatIP, 536 vectors, 768 dimensions), all integration points are unambiguous. Frontend additions are three npm packages (zustand@^5, react-virtuoso@^4.18, framer-motion@^12); backend additions are two Python packages (scikit-learn==1.8.0, scipy==1.15.1). No infrastructure changes are required.

The recommended approach is to ship v2.2 in six sequential phases (22–27) that mirror the feature group dependencies. Visual infrastructure (aurora + glassmorphism, Phase 22) must precede all other visual phases because the glassmorphism glass effect is invisible on a white background — the aurora gradient must be rendering before any glass surface can be validated. The claymorphic tag cloud (Phase 23) builds on the OKLCH design tokens introduced in Phase 22. The atomic FAISS swap UI (Phase 24) is a pure admin capability with no frontend visual dependencies. Admin intelligence metrics (Phases 25–26) depend on schema changes from Phase 24 and require scikit-learn on Railway. The newsletter gate and Easter egg (Phase 27) are independent of all other groups.

The top risk is deployment failure caused by placing the t-SNE `fit_transform` computation above the `yield` in FastAPI's lifespan context manager — this blocks Railway's healthcheck, triggers an infinite restart loop, and prevents the app from ever serving traffic. The second risk is the `backdrop-filter` stacking context trap: adding glass surfaces inside an `overflow: hidden` ancestor silently produces no visual effect with no error thrown. Both risks are 100% avoidable if the phase specifications encode the correct patterns before implementation begins. All eight critical pitfalls identified have clear, low-cost mitigations.

## Key Findings

### Recommended Stack

The production stack remains unchanged. Three frontend packages are added; two backend packages are added. All other v2.2 features (IDSelectorBatch, FTS5, Gemini function calling, asyncio.to_thread, OKLCH CSS) use packages already installed or built into the standard library.

**New frontend packages:**
- `zustand@^5.0.10`: State management with `persist` middleware — covers search params, pilot state, and the new newsletter subscription slice. Use separate `create()` stores with unique `name` keys for orthogonal state (newsletter slice must use `'tinrate-newsletter-v1'`, not `'explorer-filters'`).
- `react-virtuoso@^4.18.1`: Virtualized expert grid. Use `Virtuoso` (list, variable height) not `VirtuosoGrid` (fixed-height only); chunk experts into rows and render each row as a CSS grid inside `itemContent`.
- `framer-motion@^12.34.3` (import from `motion/react`): Layout animations for tag cloud reordering and proximity-based scale. Already installed at v12.34 per PROJECT.md — verify before reinstalling.

**New backend packages:**
- `scikit-learn==1.8.0`: Provides `sklearn.manifold.TSNE` and `sklearn.decomposition.PCA` for the t-SNE embedding map endpoint. Ships manylinux binary wheels for Python 3.11 on Linux x86-64 — Railway builds without compilation. Adds ~10–20s to Railway build time but not to cold-start latency.
- `scipy==1.15.1`: Required transitive dependency of scikit-learn 1.8. Also ships manylinux wheels.

**What NOT to add:**
- `google-generativeai` (deprecated — use `google-genai` already in requirements.txt)
- Tailwind v4 (breaking config changes; migration cost outweighs benefit for this milestone)
- `umap-learn` (explicitly deferred to v2.3; heavy Railway build dependency)
- `useSpring` per tag item in proximity scale (40+ concurrent springs = animation frame budget pressure)
- `VirtuosoGrid` component (requires uniform fixed-height cards; expert cards are variable-height)

### Expected Features

**Must have (table stakes — visual features must all ship together in Phase 22 or the design is incoherent):**
- `backdrop-filter: blur` on FilterSidebar, SearchInput, and SagePanel — the defining affordance of glassmorphism; absent = flat cards
- Semi-transparent background on glass surfaces (rgba alpha 0.08–0.15 over aurora)
- 1px border on glass surfaces (rgba(255,255,255,0.18))
- Keyframe-animated aurora mesh gradient background (15–30s cycles; GPU-composited via `transform` on pseudo-elements)
- OKLCH color tokens in CSS custom properties (`--aurora-violet`, `--aurora-teal`, `--aurora-rose`)
- `@supports` fallback for browsers without `backdrop-filter` (opaque dark background)
- WCAG 4.5:1 contrast on all glass text surfaces (tested over the actual aurora gradient, not white)
- Bento ExpertCard redesign (four zones: name/role, rate/badge, tags, match-reason; h-[180px] fixed height preserved)

**Should have (competitive differentiators for v2.2):**
- Claymorphic animated tag cloud: Framer Motion `layout` prop for reorder animation; dual-inset + outer shadow for 3D clay depth; proximity-based scale via `useMotionValue` + `useTransform` (not `useState`)
- "Everything is possible" animated example phrases below tag cloud (AnimatePresence, 3s cycles, 4–6 phrases)
- Atomic FAISS index swap admin UI: button that calls existing `POST /api/admin/ingest/run`; status polling via existing `GET /api/admin/ingest/status`
- OTR@K metric in admin: fraction of top-10 results scoring ≥ 0.60 threshold; 7-day rolling average
- Index Drift metric: time since last rebuild + expert count delta
- t-SNE embedding scatter plot in admin: startup-computed, category-colored points, hover tooltips
- Newsletter subscription gate: replaces raw email gate with value-exchange framing; single email field; writes to both `newsletter_subscribers` and `email_leads` tables

**Defer to v2.3+:**
- UMAP visualization (heavy Railway build dependency; scikit-learn t-SNE is sufficient for 530 points)
- Cursor-reactive JS aurora (mousemove-driven gradient = 60 events/sec GPU cost for no functional value)
- `backdrop-filter: blur` on ExpertCards (530 cards × GPU compositor layer = performance failure)
- External newsletter service integration (Mailchimp, Klaviyo) — CSV export sufficient for current scale

**P3 (ship if time remains after P1/P2):**
- Barrel roll Easter egg (FUN-01): Framer Motion 360° rotate applied to the VirtuosoGrid container, not individual ExpertCards; trigger on exact phrase match only

### Architecture Approach

The v2.2 architecture is strictly additive. The production system is a single-process Uvicorn FastAPI app with `app.state` holding the FAISS index, metadata list, and username-to-position mapping. New state follows the same pattern: `app.state.tsne_cache` (list, computed post-startup in background) and `app.state.tsne_ready` (bool, guards the endpoint).

The existing atomic swap in `_run_ingest_job` (admin.py lines 93–146) already performs the three-line reference assignment for FAISS index, metadata, and position mapping. The v2.2 change adds one line: `app.state.tsne_cache = []` to invalidate the t-SNE cache on swap completion. The admin UI only needs a frontend button calling the already-existing `POST /api/admin/ingest/run` endpoint.

**New/modified components (v2.2 delta):**

Backend:
1. `app/models.py` — add `NewsletterSubscriber` model; add `otr_at_k: Mapped[float | None]` to `Conversation`
2. `app/main.py` — post-yield `asyncio.create_task(_compute_tsne_background(app))` background task; `ALTER TABLE conversations ADD COLUMN otr_at_k REAL` in existing migration block; register newsletter router
3. `app/routers/newsletter.py` (NEW) — `POST /api/newsletter-subscribe`; idempotent writes to both `newsletter_subscribers` and `email_leads`
4. `app/routers/admin.py` — add `GET /embedding-map`; `GET /newsletter-subscribers`; `otr_7day` array in `intelligence-stats` response
5. `app/services/explorer.py` — add `otr_at_k: float | None = None` field to `ExploreResponse`; compute `top_k = scored[:10]; on_topic = sum(1 for s >= 0.60) / len(top_k)` after `scored.sort()`

Frontend:
1. `frontend/src/store/nltrSlice.ts` (NEW) — standalone `useNltrStore` with persist key `'nltr-state'`; initializes synchronously from localStorage to prevent gate flash
2. `frontend/src/components/sidebar/AnimatedTagCloud.tsx` (NEW, replaces TagMultiSelect) — `layout` prop for reordering; `useMotionValue`/`useTransform` for proximity scale
3. `frontend/src/components/marketplace/ExpertCard.tsx` — bento zones; CSS-only hover glow (no Framer Motion import in this file)
4. `frontend/src/components/modals/ProfileGateModal.tsx` — newsletter CTA copy; calls `/api/newsletter-subscribe`; `localStorage['tcs_email_unlocked']` bypass logic unchanged
5. `frontend/src/pages/MarketplacePage.tsx` — aurora mesh gradient wrapper div added

**Files completely unchanged:** chat.py, feedback.py, email_capture.py, health.py, pilot.py, suggest.py, embedder.py, retriever.py, search_intelligence.py, tagging.py, database.py, config.py, all existing Zustand slices (filterSlice, resultsSlice, pilotSlice), entire admin frontend directory.

### Critical Pitfalls

1. **t-SNE `fit_transform` above `yield` in FastAPI lifespan blocks Railway healthcheck** — Even wrapped in `asyncio.to_thread`, calling `fit_transform` above the `yield` prevents the server from starting. Place the computation as `asyncio.create_task(_compute_tsne_background(app))` *after* the `yield`. Use `n_iter=300` (not 1000) + PCA pre-reduction to 50 dims. Guard `/api/admin/embedding-map` with `if not app.state.tsne_ready: return JSONResponse({"status": "computing"}, 202)`.

2. **`overflow: hidden` ancestor silently kills `backdrop-filter` blur** — The existing layout has `overflow: hidden` flex containers that create stacking contexts. Glass surfaces inside them see only the ancestor's background (solid), not the aurora. Before writing any glass class, audit the full ancestor chain in DevTools. Use the `before:backdrop-blur-md before:-z-10` pseudo-element escape hatch if the ancestor cannot be modified. Always include `-webkit-backdrop-filter` (Tailwind v3 does not emit this prefix).

3. **Tag cloud proximity scale using `useState` + `onMouseMove` causes 60 re-renders/sec** — With 40+ tags, this produces continuous orange React DevTools profiler highlights and visible jank alongside VirtuosoGrid. Mandate `useMotionValue` + `useTransform` from the start. These bypass React's render cycle entirely. Do NOT add `useSpring` per tag item — use CSS `transition: transform 80ms ease-out` instead.

4. **FAISS in-place mutation during rebuild races concurrent search requests** — Never call `.reset()` or `.add()` on `app.state.faiss_index` directly. Always build a new `faiss.IndexFlatIP(768)` object inside the rebuild thread and assign it to `app.state.faiss_index` only after the thread completes. Add `asyncio.Lock` on the rebuild endpoint to prevent double-rebuild OOM.

5. **Zustand newsletter persist key collision silently overwrites `explorer-filters` state** — The new newsletter store must use `name: 'tinrate-newsletter-v1'`. Two stores sharing the same key perform a shallow merge on hydration, wiping user filter preferences. No error is thrown.

6. **`motion.div` with `initial`/`animate` on ExpertCard causes scroll-triggered re-animations** — VirtuosoGrid unmounts cards outside the overscan boundary; Framer Motion treats each remount as a new entry animation. ExpertCard must use CSS-only hover transitions. No Framer Motion import belongs in `ExpertCard.tsx`.

7. **Nested glass surfaces compound blur and wash out to white** — SagePanel using `backdrop-filter` over an already-blurred FilterSidebar blurs the composited result, not the aurora. Apply glass surfaces at the same stacking level. Test contrast over the actual aurora gradient at deployed opacity, not over white.

8. **Newsletter gate flashes locked state for returning subscribers** — Zustand `persist` hydration is asynchronous; the first render uses the store's default state (`subscribed: false`), then hydrates. Read subscription status synchronously in the store's initial state: `() => localStorage.getItem('tinrate-newsletter-v1')`. Keep the existing `localStorage['tcs_email_unlocked']` check as the gate bypass — it is synchronous and must not be replaced.

## Implications for Roadmap

Research confirms the six-phase structure identified in FEATURES.md (Phases 22–27). The ordering is determined by hard dependencies.

### Phase 22: Visual Infrastructure (VIS-01 through VIS-05)

**Rationale:** Aurora gradient and OKLCH tokens are prerequisites for every other visual feature. Glassmorphism is invisible on white — no glass surface can be validated until the aurora is rendering behind it. All visual features share the same OKLCH color token system, so tokens must exist first.

**Delivers:** Animated aurora mesh gradient background; glassmorphism on FilterSidebar, SearchInput, SagePanel; OKLCH design tokens in CSS custom properties; `@supports (backdrop-filter: blur(1px))` browser fallback; WCAG 4.5:1 contrast validation on all glass text.

**Addresses:** All VIS table-stakes features: backdrop-filter, semi-transparent backgrounds, 1px border, keyframe animation, contrast compliance.

**Avoids:** Pitfalls 2 (overflow ancestor kills blur) and 7 (nested glass double-blur). Phase spec must require a DevTools ancestor chain audit as Step 1 before writing any glass class. Contrast audit must use the actual aurora gradient, not white.

**Research flag:** STANDARD PATTERNS — CSS glassmorphism and aurora animation are thoroughly documented with cross-verified recipes. Pitfall checklists from PITFALLS.md are the critical addition to the spec.

### Phase 23: Discovery Engine (CARD-01..03, DISC-01..04)

**Rationale:** Depends on Phase 22 OKLCH tokens for tag palette and card hover glow colors. Bento card redesign and claymorphic tag cloud are only visually coherent against the aurora background.

**Delivers:** Bento ExpertCard with four visual zones (h-[180px] preserved); CSS-only aurora hover glow; AnimatedTagCloud replacing TagMultiSelect; Framer Motion `layout` prop for tag reorder animation; proximity-based scale via `useMotionValue`/`useTransform`; "Everything is possible" example phrases with `AnimatePresence`.

**Uses:** `motion/react` already installed at v12.34 — `layout`, `useMotionValue`, `useTransform`. CSS claymorphism: `border-radius: 999px` + dual-inset shadow + outer drop shadow.

**Avoids:** Pitfall 3 (useState re-render storm — mandate MotionValues from the start); Pitfall 6 (Framer Motion on VirtuosoGrid cards — CSS-only hover; no Framer Motion import in ExpertCard.tsx).

**Research flag:** MEDIUM CONFIDENCE for proximity scale. The canonical pattern is confirmed via BuildUI Magnified Dock, but no v12-specific tag cloud example with exact `motion/react` imports exists. The phase spec must include the exact `useMotionValue`/`useTransform` code from STACK.md Q3 to prevent `useState` temptation during implementation.

### Phase 24: Atomic Index Swap Admin UI (IDX-01..04)

**Rationale:** Backend swap logic already exists in `_run_ingest_job` (admin.py:93–146). This phase adds only the admin frontend button and status polling UI. Must precede Phases 25–26 because t-SNE cache invalidation hooks into swap completion, and Index Drift state is sourced from the `_ingest` dict extended in this phase.

**Delivers:** Admin rebuild button calling existing `POST /api/admin/ingest/run`; status display (idle/running/complete/failed + timestamp) via existing `GET /api/admin/ingest/status`; `last_rebuild_at` and `expert_count_at_rebuild` fields added to `_ingest` dict; `app.state.tsne_cache = []` invalidation line added to swap completion.

**Avoids:** Pitfall 4 (in-place FAISS mutation) and double-rebuild OOM (asyncio.Lock already needed). Acceptance criteria must include: trigger rebuild, send concurrent explore requests, confirm zero search failures during rebuild.

**Research flag:** STANDARD PATTERNS. The backend swap is already implemented; the admin UI pattern follows existing admin panel conventions. No architecture uncertainty.

### Phase 25: Admin Intelligence Metrics (INTEL-01..04)

**Rationale:** Depends on the `otr_at_k` schema change (ALTER TABLE conversations) established in Phase 24's deployment. OTR@K is computed in the explore pipeline (independent of FAISS rebuild) and logged per search query. Index Drift reads from the `_ingest` dict extended in Phase 24.

**Delivers:** OTR@K computed per search query, stored in `conversations` table; 7-day rolling average in admin Intelligence tab (green ≥0.75, amber 0.60–0.74, red <0.60); Index Drift status display (time since rebuild + expert count delta); `newsletter_subscribers` SQLite table created.

**Uses:** Existing SQLAlchemy + SQLite stack. No new packages. `ALTER TABLE conversations ADD COLUMN otr_at_k REAL` in the existing inline migration block.

**Avoids:** OTR@K exposed to end users (admin-only metric; do not add to public ExploreResponse in user-facing API).

**Research flag:** STANDARD PATTERNS. `SIMILARITY_THRESHOLD=0.60` aligns with existing `GAP_THRESHOLD=0.60` in admin.py — no calibration research needed. The SQL rolling average is a trivial GROUP BY query.

### Phase 26: Embedding Heatmap (INTEL-05..06)

**Rationale:** Depends on scikit-learn (new package requiring a Railway redeploy to cache) and on the production FAISS index being accessible via `reconstruct_n`. This is the highest-risk phase for deployment failure due to the t-SNE blocking pitfall.

**Delivers:** t-SNE projection computed post-startup (PCA 768→50 dims, then TSNE 50→2 dims, n_iter=300, method='barnes_hut', random_state=42); cached in `app.state.tsne_cache`; `GET /api/admin/embedding-map` endpoint (returns 202 while computing); admin scatter plot colored by category with hover tooltips; t-SNE recompute triggered on atomic swap completion.

**Uses:** `scikit-learn==1.8.0`, `scipy==1.15.1` (new backend packages). `asyncio.create_task` post-yield for background computation. `IndexFlatIP.reconstruct_n(0, ntotal, vectors)` — confirmed working on the production index type. PCA pre-reduction is mandatory (reduces 768→50 dims before TSNE; cuts compute time 4–8×).

**Avoids:** Pitfall 1 (t-SNE blocking Railway healthcheck) — this is the highest-severity pitfall in the entire milestone. The phase spec must specify the post-yield `asyncio.create_task` pattern as a non-negotiable constraint and include the exact lifespan code.

**Research flag:** HIGH PRIORITY for spec quality. The pattern is clear, but the blocking mistake is easy to make. The phase spec must reproduce the exact lifespan code from PITFALLS.md Pitfall 4 before any implementation begins. Accept criteria must include: Railway deploy completes and `/health` responds in under 10 seconds.

### Phase 27: Newsletter Gate + Easter Egg (NLTR-01..04, FUN-01)

**Rationale:** Fully independent of all visual and intelligence phases. The newsletter gate modifies an existing modal (ProfileGateModal); the Easter egg adds a Zustand flag and CSS keyframe on the VirtuosoGrid container. Both can be built and tested on the current main without the aurora background.

**Delivers:** Newsletter CTA modal replacing email gate copy; `newsletter_subscribers` SQLite table; `useNltrStore` standalone persist store (`'tinrate-newsletter-v1'` key with synchronous initial state read); admin subscriber list; barrel roll Easter egg applied to the VirtuosoGrid container element (not ExpertCards).

**Avoids:** Pitfall 5 (Zustand key collision — explicitly name the key `'tinrate-newsletter-v1'` in the spec); Pitfall 8 (hydration flash — synchronous localStorage read in initial state); email gate migration gap for v2.0 returning users (check `localStorage['tcs_email_unlocked']` to auto-bypass the newsletter gate for existing unlocked users).

**Research flag:** STANDARD PATTERNS for newsletter gate UX. The barrel roll must use the VirtuosoGrid container element to avoid Pitfall 6 (scroll-triggered re-animations on ExpertCards).

### Phase Ordering Rationale

- Phase 22 before Phase 23: OKLCH tokens must exist before any component uses them; glassmorphism requires aurora to validate.
- Phase 23 after Phase 22: Tag cloud uses aurora palette; card glow tokens reference Phase 22 CSS variables.
- Phase 24 before Phases 25–26: `_ingest` dict extensions and tsne_cache invalidation are wired into the swap completion that Phase 24 surfaces in the UI.
- Phase 26 after Phase 24: `reconstruct_n` reads `app.state.faiss_index` which must be valid after swap; tsne_cache invalidation hook lives in the swap completion added in Phase 24.
- Phase 27 is fully independent: can be built in parallel with any other phase or interleaved if development bandwidth allows.

### Research Flags

Phases likely needing extra care in spec writing:

- **Phase 23 (DISC-02):** Proximity scale is MEDIUM confidence. The phase spec must include the exact `useMotionValue`/`useTransform` code to prevent the `useState` anti-pattern during implementation.
- **Phase 26 (INTEL-05):** t-SNE parameter selection and startup integration are HIGH confidence, but the post-yield background task pattern is the most failure-prone in the milestone. Phase spec must include the exact lifespan pattern code as a mandatory constraint.

Phases with standard, well-documented patterns where additional research is not needed:
- **Phase 22:** CSS glassmorphism, aurora keyframes, OKLCH tokens — thoroughly documented with cross-verified implementations.
- **Phase 24:** Backend swap already exists; admin UI pattern follows existing admin panel conventions.
- **Phase 25:** OTR@K SQL query and ALTER TABLE migration follow established codebase patterns exactly.
- **Phase 27:** Newsletter gate UX and Zustand persist patterns are standard; barrel roll is trivial.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | npm versions confirmed from package registries; scikit-learn 1.8.0 manylinux wheel availability confirmed for Python 3.11 on Linux x86-64; framer-motion proximity API confirmed from official Motion docs. FTS5/SQLAlchemy pattern MEDIUM (community sources; no live Railway test). |
| Features | MEDIUM | Glassmorphism and claymorphism CSS recipes HIGH (cross-verified). OTR@K formal definition MEDIUM (equivalent to Precision@K; LinkedIn OTR@K usage LOW confidence). Newsletter gate UX MEDIUM (conversion data from MailerLite 2025). "Everything is possible" element MEDIUM (Framer Motion AnimatePresence pattern is standard). |
| Architecture | HIGH | All integration points grounded in actual production codebase file inspection. FAISS IndexFlatIP confirmed by local index load (`faiss.read_index('data/faiss.index')` → IndexFlatIP, ntotal=536, d=768). Zustand persist async hydration behavior confirmed from official docs and GitHub issues. scikit-learn startup timing is MEDIUM (2–8s estimate; Railway instance allocation varies). |
| Pitfalls | HIGH | Eight pitfalls with concrete code patterns. Critical pitfalls (overflow ancestor, t-SNE blocking, FAISS in-place mutation, Zustand key collision) verified against official docs, GitHub issues, and production codebase inspection. |

**Overall confidence:** HIGH

### Gaps to Address

- **t-SNE startup time on Railway:** The 2–8s estimate for 536 × 768 vectors has MEDIUM confidence. If Railway allocates a smaller CPU allocation than expected, the background task may take 15–20s. The post-yield pattern ensures this never blocks healthchecks, but the admin scatter plot loading state must communicate that computation is in progress.

- **Framer Motion import path:** PROJECT.md states the project uses `motion/react` imports. Confirm the installed package is `framer-motion` (which re-exports `motion/react`) and not the separate `motion` npm package (web animations API only). Run `cat frontend/package.json | grep -i motion` before Phase 23.

- **Safari `-webkit-backdrop-filter`:** Tailwind v3 `backdrop-blur-*` utilities do not emit the `-webkit-` prefix. Test on actual Safari (not Chrome DevTools responsive mode which uses Blink). Add the prefix via `@layer utilities` in Phase 22 if needed.

- **Returning v2.0 email gate users:** Confirm the exact localStorage key used in v2.0 (`'tcs_email_unlocked'` or `'emailGateUnlocked'`) before writing the Phase 27 migration logic. The auto-bypass for returning users depends on the correct key name. Read `frontend/src/hooks/useEmailGate.ts` before Phase 27 spec.

- **OTR@K threshold calibration:** The `SIMILARITY_THRESHOLD=0.60` aligns with existing `GAP_THRESHOLD=0.60`. After Phase 25 ships and accumulates real query data, validate the distribution of `otr_at_k` values — if the 7-day average is always >0.90 or always <0.40, the threshold needs recalibration. No action needed before shipping.

## Sources

### Primary (HIGH confidence)

- [Zustand npm 5.0.10](https://www.npmjs.com/package/zustand) — version, persist middleware API
- [Zustand persist docs](https://zustand.docs.pmnd.rs/middlewares/persist) — partialize, createJSONStorage, unique name requirement
- [Zustand onRehydrateStorage bug #1527](https://github.com/pmndrs/zustand/issues/1527) — do not call set() inside onRehydrateStorage callback
- [react-virtuoso npm 4.18.1](https://www.npmjs.com/package/react-virtuoso) — version, VirtuosoGrid vs Virtuoso distinction
- [react-virtuoso issue #298](https://github.com/petyosi/react-virtuoso/issues/298) — unmount/remount behavior on scroll
- [framer-motion npm 12.34.3](https://www.npmjs.com/package/framer-motion) — version, React 18 minimum
- [Motion docs — motion values](https://motion.dev/docs/react-motion-value) — useMotionValue bypasses React re-renders
- [Motion docs — useTransform](https://motion.dev/docs/react-use-transform) — composable motion values
- [Motion docs — layout animations](https://www.framer.com/motion/layout-animations/) — FLIP animation, layout prop
- [FAISS IDSelectorBatch C++ API](https://faiss.ai/cpp_api/struct/structfaiss_1_1IDSelectorBatch.html) — Python binding availability
- [FAISS wiki — search parameters](https://github.com/facebookresearch/faiss/wiki/Setting-search-parameters-for-one-query) — SearchParameters for flat index
- [FAISS thread safety — Issue #367](https://github.com/facebookresearch/faiss/issues/367) — concurrent read/write not thread-safe
- [SQLite FTS5 docs](https://sqlite.org/fts5.html) — FTS5 availability, content= mode, trigger patterns
- [google-genai PyPI](https://pypi.org/project/google-genai/) — function calling API, FunctionDeclaration
- [google-generativeai deprecated](https://github.com/google-gemini/deprecated-generative-ai-python) — deprecation confirmed
- [Tailwind v4 blog](https://tailwindcss.com/blog/tailwindcss-v4) — OKLCH built-in in v4; confirms v3 requires manual CSS vars
- [scikit-learn PyPI 1.8.0](https://pypi.org/project/scikit-learn/) — version, manylinux wheel for Python 3.11
- [sklearn TSNE docs](https://scikit-learn.org/stable/modules/generated/sklearn.manifold.TSNE.html) — parameter reference, PCA pre-reduction recommendation, max_iter vs n_iter rename
- [sklearn n_iter deprecation issue #25518](https://github.com/scikit-learn/scikit-learn/issues/25518) — n_iter removed in 1.7, use max_iter
- [caniuse OKLCH](https://caniuse.com/mdn-css_types_color_oklch) — 93% browser support as of early 2026
- [caniuse backdrop-filter](https://caniuse.com/css-backdrop-filter) — 92% browser support
- [MDN backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter) — stacking context behavior documented
- [Josh W. Comeau — Next-level frosted glass](https://www.joshwcomeau.com/css/backdrop-filter/) — overflow: hidden stacking context trap
- [FastAPI Discussion #6526](https://github.com/fastapi/fastapi/discussions/6526) — lifespan above yield blocking startup
- Direct codebase inspection: `app/main.py`, `app/routers/admin.py`, `app/routers/explore.py`, `app/services/explorer.py`, `app/models.py`, `app/config.py`, `scripts/ingest.py`, `frontend/src/store/index.ts`, `frontend/src/store/filterSlice.ts`, `frontend/src/components/marketplace/ExpertCard.tsx` — all integration points ground truth

### Secondary (MEDIUM confidence)

- [Glassmorphism Implementation Guide 2025](https://playground.halfaccessible.com/blog/glassmorphism-design-trend-implementation-guide) — glass recipe values
- [LogRocket — Implementing Claymorphism](https://blog.logrocket.com/implementing-claymorphism-css/) — clay shadow values
- [hype4.academy — Claymorphism CSS](https://hype4.academy/articles/coding/how-to-create-claymorphism-using-css) — dual-inset shadow technique
- [BuildUI Magnified Dock recipe](https://buildui.com/recipes/magnified-dock) — proximity scale canonical pattern (framer-motion imports; API identical to motion/react)
- [Pinecone — Evaluation Measures in IR](https://www.pinecone.io/learn/offline-evaluation/) — OTR@K / Precision@K equivalence
- [Omnisend — Newsletter Signup Examples 2026](https://www.omnisend.com/blog/newsletter-signup-examples/) — newsletter gate UX patterns
- [MailerLite — Newsletter Form Best Practices](https://www.mailerlite.com/blog/optimize-email-signup-form) — single-field friction data (each additional field reduces conversion 4–11%)
- [SQLAlchemy FTS5 Discussion #9466](https://github.com/sqlalchemy/sqlalchemy/discussions/9466) — text() is the only path for FTS5 DDL
- [Railway nixpacks docs](https://docs.railway.com/reference/nixpacks) — Python build process, glibc version
- [Zustand persist behavior — Discussion #426](https://github.com/pmndrs/zustand/discussions/426) — async hydration; synchronous read workaround
- [scikit-learn t-SNE perplexity example](https://scikit-learn.org/stable/auto_examples/manifold/plot_t_sne_perplexity.html) — parameter tuning for N=530
- [Dalton Walsh — Aurora CSS Background](https://daltonwalsh.com/blog/aurora-css-background-effect/) — aurora animation technique

### Tertiary (LOW confidence)

- Training data: LinkedIn OTR@K usage in production search evaluation — OTR@K term sourcing; mathematically equivalent to Precision@K regardless of term origin

---
*Research completed: 2026-02-22*
*Ready for roadmap: yes*
