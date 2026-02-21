# Project Research Summary

**Project:** TCS — Tinrate Expert Marketplace v2.0 (Extreme Semantic Explorer)
**Domain:** Expert/professional marketplace with AI-assisted search and lead capture
**Researched:** 2026-02-21
**Confidence:** HIGH — all four research areas resolved against official documentation, live codebase, and verified sources

## Executive Summary

TCS v2.0 is a brownfield rearchitecture of an existing production expert marketplace: replacing a chat-centric interface with a full professional marketplace (faceted search sidebar, virtualized expert grid, floating AI co-pilot) while preserving all existing infrastructure (FastAPI, SQLAlchemy, SQLite, FAISS, Gemini, admin dashboard). The dominant theme from research is that the existing technology stack covers almost all v2.0 needs — only three npm packages are added (Zustand, react-virtuoso, Framer Motion) and zero backend packages change. Everything new builds on validated foundations.

The recommended approach is a strict sequential build order driven by data dependencies: the hybrid search backend (FTS5 migration + /api/explore endpoint) must ship first because every other component depends on its API contract. Zustand global state is the second dependency — the sidebar, grid, and AI co-pilot cannot share state without it. From there, the marketplace UI assembles in layers (page layout, then grid, then co-pilot). This is not a preference; it is the dependency graph. Attempting to build in parallel without a working API or store leads to mock-debt that must be unwound later.

The key risks are specific and well-documented. FAISS IDSelectorBatch must be used exclusively as a search-time filter (not `remove_ids`). The FTS5 UPDATE trigger must capture old values before overwriting them, or the search index silently corrupts. Zustand persist must be scoped with `partialize` and `version` from day one to prevent returning users getting broken state on every deploy. Framer Motion `AnimatePresence` exit animations are incompatible with the virtualizer and must only be used outside it. Gemini function call output must be validated field-by-field before touching the store. Every pitfall has a clear, low-cost prevention strategy documented in PITFALLS.md.

## Key Findings

### Recommended Stack

The existing production stack (FastAPI + SQLAlchemy + SQLite + FAISS + Gemini + React + Vite + Tailwind v3) handles all v2.0 requirements without infrastructure change. Backend additions (FTS5, IDSelectorBatch, Gemini function calling) use packages already in `requirements.txt`. Frontend adds exactly three packages. See `STACK.md` for full version details.

**Core technologies:**
- `zustand@^5.0.0` — global state management for filters, results, and co-pilot — chosen for module-level singleton pattern required by the co-pilot's async dispatch outside React render cycle
- `react-virtuoso@^4.18.0` — virtualized expert grid — use `Virtuoso` (list) not `VirtuosoGrid` (fixed-height grid) because expert cards have variable heights
- `framer-motion@^12.0.0` — animations for co-pilot panel slide-in and card entry — use `LazyMotion` + `domAnimation` to keep bundle size at ~15KB; no exit animations on virtualized items
- `faiss-cpu@1.13.*` (existing) — pre-filtered vector search via `IDSelectorBatch` + `SearchParameters` at search time, not destructive `remove_ids`
- `google-genai@1.64.*` (existing) — Gemini 2.5 Flash for AI co-pilot with `apply_filters` function calling; `google-generativeai` is deprecated
- SQLite FTS5 (built-in, no install) — BM25 full-text search for keyword matching in hybrid pipeline
- Tailwind v3 (existing, no upgrade) — OKLCH colors via arbitrary values `bg-[oklch(...)]`; do not upgrade to v4 during this milestone

**What NOT to add:** Tailwind v4 (breaking changes, no feature value for v2.0), `VirtuosoGrid` (fixed-height only), `google-generativeai` (deprecated), any vector database (FAISS at 1,558 experts needs no change).

### Expected Features

**Must have (v2.0 core — marketplace is incomplete without these):**
- Zustand global state (filter + results + pilot slices with `partialize` persist) — unblocks everything else
- `/api/explore` hybrid endpoint (SQLAlchemy pre-filter → FAISS IDSelectorBatch → FTS5 BM25 → fused weighted scoring)
- Faceted sidebar (rate range slider, domain tag multi-select, text search, active filter chips, clear all)
- Virtualized expert grid (react-virtuoso, variable-height cards, name/title/rate/tags/CTA)
- Floating AI co-pilot (FAB → slide-in panel, Gemini conversation, context-aware of current grid results)
- Gemini function calling `apply_filters` (AI updates Zustand filter state from conversation)
- Email gate extended to "View Full Profile" trigger (existing gate mechanism, new trigger point)
- Loading skeletons and empty state with co-pilot CTA (no dead ends)

**Should have (v2.0 extended — after core works):**
- "Download Match Report" lead magnet (personalized PDF, gated by email, server-side generation)
- URL filter sync (serialize Zustand slice to query params for shareable filters)
- Fuzzy search / "Did you mean?" (FTS5 prefix search + Levenshtein on tag vocabulary)
- Match reason snippet on expert cards (Gemini-generated plain-language explanation per result)
- Mobile bottom sheet sidebar (after desktop sidebar is complete)

**Defer to v2.1+:**
- Saved filter presets (localStorage named filter sets — need is not validated)
- Co-pilot suggested question chips (nice-to-have, patterns not yet understood)
- Expert card detail slide-in drawer (conversion improvement to test post-v2.0)

**Anti-features to avoid:** Star ratings without Tinrate data sync, real-time availability/calendar integration, aggressive email gate on search access, full bio text in cards, more than 2-3 sort options, 20+ filter dimensions, numeric cosine similarity scores shown to users.

### Architecture Approach

The architecture is a thin-router / fat-service pattern extended to two new backend endpoints (`explore.py` → `explorer.py` service, `pilot.py` as Gemini proxy) and a Zustand module-level singleton on the frontend. Admin routes and all existing services remain entirely unchanged. The homepage route changes from `App` (chat) to `MarketplacePage` (marketplace). React Router v7 lazy loading requires the marketplace component and its loader to be in separate files to prevent heavy dependencies from leaking into the initial bundle.

**Major components:**
1. `app/services/explorer.py` (NEW) — three-stage hybrid search pipeline: SQLAlchemy pre-filter → FAISS IDSelectorBatch → FTS5 BM25 → fused rank (0.7 FAISS / 0.3 BM25) → cursor pagination
2. `app/routers/pilot.py` (NEW) — thin Gemini API proxy with `apply_filters` function declaration; returns raw function call or text to frontend
3. `frontend/src/store/useExplorerStore.ts` (NEW) — Zustand module-level singleton with three slices (filters, results, pilot); `partialize` persists only user-preference fields
4. `frontend/src/components/marketplace/` (NEW) — `FilterSidebar`, `ExpertGrid`, `ExpertCard`, `CoPilot` — all read/write through `useExplorerStore`
5. `frontend/src/hooks/usePilot.ts` (NEW) — Gemini two-turn function calling loop; dispatches to store via `useExplorerStore.getState()` from async callbacks
6. `app/main.py` (MODIFIED, minimally) — FTS5 migration block, `username_to_faiss_pos` mapping at startup, two new router registrations

**Critical integration constraint:** FAISS uses positional indices (0 to 1557), not `Expert.id` values from SQLite. A `username_to_faiss_pos` mapping must be built at startup from `app.state.metadata` and stored in `app.state`. SQLAlchemy pre-filter results must be translated through this mapping before constructing `IDSelectorBatch`.

### Critical Pitfalls

1. **FAISS `remove_ids` vs search-time `IDSelectorBatch`** — Never call `index.remove_ids()` on the production index; it mutates the index and silently shifts all sequential IDs. Use `faiss.SearchParameters(sel=faiss.IDSelectorBatch(ids))` exclusively. Add a unit test asserting `index.ntotal == 1558` after every code path that touches the index.

2. **FTS5 UPDATE trigger capturing wrong (post-update) values** — The UPDATE trigger must explicitly delete old tokens using `old.` values and insert new tokens using `new.` values in a single AFTER UPDATE trigger. The naive pattern of three separate AFTER triggers corrupts the index ~10% of the time. Always run `INSERT INTO experts_fts(experts_fts) VALUES('rebuild')` after creating the table to backfill existing 1,558 rows (triggers do not backfill).

3. **Zustand persist rehydrating stale/incompatible state across deploys** — Use `partialize` to persist only `emailGated` (and optionally filter preferences); never persist `results`, `isLoading`, or `messages`. Set `version: 1` from day one and implement `migrate` to reset incompatible old state. Bump `version` on every deploy that changes the persisted shape.

4. **Gemini function call output applied to Zustand without validation** — Gemini's structured output guarantees syntactic JSON validity, not semantic correctness. Write a strict `validateFilterArgs` function that whitelists only `minRate`, `maxRate`, `tags`, `query` and enforces valid ranges before any store dispatch. Treat Gemini output as untrusted input.

5. **Framer Motion `AnimatePresence` exit animations inside Virtuoso** — Virtuoso unmounts DOM nodes immediately on scroll; `AnimatePresence` never gets to run exit animations. Use `animate` (entry only) on card `motion` elements; never define `exit` on virtualized items. Reserve `AnimatePresence` for the co-pilot panel, filter sidebar, and modals.

## Implications for Roadmap

Based on the dependency graph established in ARCHITECTURE.md and the feature priority matrix in FEATURES.md, research strongly supports a 5-phase build order with an optional 6th phase for extended features.

### Phase 1: Hybrid Search Backend
**Rationale:** Every other component (UI, state, co-pilot) is blocked until the API contract is established and the FTS5 index exists on Railway. This phase has no frontend dependency and can ship independently. FTS5 migration is idempotent (IF NOT EXISTS) and safe to deploy early.
**Delivers:** Working `/api/explore` endpoint returning `ExploreResponse` with cursor pagination; FTS5 virtual table on Railway SQLite; `username_to_faiss_pos` mapping in `app.state`; `ExploreResponse` Pydantic schema (the contract all frontend phases depend on)
**Addresses features:** `/api/explore` hybrid endpoint (P1 core), expert count display, pure filter mode (no query), hybrid search mode
**Avoids:** FAISS `remove_ids` mutation (add code comment and unit test now), FTS5 UPDATE trigger bug (correct three-trigger pattern from day one), FTS5 missing rebuild (include in migration script with verification SQL)
**Research flag:** STANDARD PATTERNS — all three pipeline stages are documented with exact code in ARCHITECTURE.md and STACK.md. No additional research needed.

### Phase 2: Zustand State and Routing
**Rationale:** Zustand is the load-bearing middleware for the entire frontend. The sidebar, grid, and co-pilot cannot share state without it. React Router route change (homepage to marketplace) must happen here so Phase 3 builds against the real route. This phase can begin in parallel with Phase 1 using a mock API response; it must finalize after Phase 1 API contract is confirmed.
**Delivers:** `useExplorerStore.ts` with filter, results, and pilot slices; `partialize` + `version: 1` + `migrate` configured from day one; React Router route change (`/` to `MarketplacePage`); `ExpertCard` and `ExploreResponse` TypeScript types; `useExplore` hook (debounced fetch)
**Uses:** `zustand@^5.0.0` with `persist` middleware; React Router v7 `lazy()` with loader/component in separate files
**Avoids:** Double source of truth (write state ownership table before any code; grep for `useState` holding filter/result/gate data); persist rehydration (partialize + version from day one); React Router lazy loading bundle leak (separate `marketplace.loader.ts` from `MarketplacePage.tsx`); OKLCH browser decision (document now, add PostCSS plugin only if needed)
**Research flag:** STANDARD PATTERNS — Zustand v5 and React Router v7 are well-documented. No additional research needed.

### Phase 3: Marketplace Page and Filter Sidebar
**Rationale:** Depends on Phase 1 (API works) and Phase 2 (store works). The page layout and sidebar controls are the visible frame that the grid and co-pilot attach to. Card design must be finalized here before virtualization is implemented — react-virtuoso requires stable card height to avoid measurement thrash.
**Delivers:** `MarketplacePage.tsx` layout (sidebar + grid area + floating pilot FAB); `FilterSidebar.tsx` (rate range dual-handle slider, tag checkboxes with counts, text search, active filter chips, clear all); debounced filter-to-API wiring; loading skeletons; empty state with co-pilot CTA; expert count ("Showing X of 1,558")
**Implements:** Left sidebar as primary navigation (non-negotiable industry pattern); sidebar controls as controlled components driven by Zustand; filter chips as single source of visual truth for active state
**Avoids:** Mobile sidebar vs co-pilot panel conflict (design mutual-exclusion state machine before building either); card height decision (target fixed height with line-clamp to simplify Phase 4 virtualization)
**Research flag:** STANDARD PATTERNS — faceted sidebar and card design are well-documented marketplace patterns with strong industry consensus.

### Phase 4: Expert Grid with Virtualization
**Rationale:** Depends on Phase 3 (page skeleton exists and card design is finalized). react-virtuoso requires finalized card content to avoid layout thrash. This phase virtualizes the grid for 1,558 experts and wires infinite scroll via cursor pagination.
**Delivers:** `ExpertGrid.tsx` with react-virtuoso `Virtuoso` component (row-chunked CSS grid approach, not `VirtuosoGrid`); `ExpertCard.tsx` with fixed-height design (name, title, rate, 2-3 tag pills, CTA); `endReached` callback triggering cursor pagination via `appendResults`; Framer Motion entry-only card animation (no exit)
**Uses:** `react-virtuoso@^4.18.0` (`Virtuoso` list with CSS grid row renderer); `framer-motion@^12.0.0` with `LazyMotion + domAnimation`
**Avoids:** VirtuosoGrid jitter (use `Virtuoso` with row-chunked approach; use `padding` not `margin` on cards; fixed card height); AnimatePresence exit animations (entry `animate` only; no `exit` prop on card motion elements); Framer Motion bundle size (LazyMotion + domAnimation feature set targets ~15KB)
**Research flag:** STANDARD PATTERNS — react-virtuoso docs and known VirtuosoGrid limitations are documented in PITFALLS.md. No additional research needed.

### Phase 5: Floating AI Co-Pilot
**Rationale:** Depends on Phase 2 (Zustand store) and Phase 4 (grid exists to provide context). The co-pilot backend (`pilot.py`) can be built in parallel with Phase 4 — they share no code. The co-pilot is the primary differentiator and the last piece to snap into place.
**Delivers:** `app/routers/pilot.py` (Gemini thin proxy with `apply_filters` tool declaration); `usePilot.ts` (two-turn function calling loop with `validateFilterArgs` before any store dispatch); `CoPilot.tsx` (bottom-right FAB, slide-in panel with context strip, conversation area, sticky input); `AnimatePresence` on panel open/close; mobile full-screen overlay
**Uses:** `google-genai@1.64.*` (existing); Gemini 2.5 Flash with `apply_filters` FunctionDeclaration; `useExplorerStore.getState()` from async callbacks
**Avoids:** Gemini output not validated (write `validateFilterArgs` before wiring; unit test with crafted invalid values); server-side state push anti-pattern (backend is a thin proxy only — no filter state on backend); `adminKey` never in Zustand persist (stays in `sessionStorage`)
**Research flag:** MEDIUM COMPLEXITY — the Gemini two-turn proxy pattern (FastAPI forwarding function call to frontend, frontend returning tool result, second Gemini call for final text) has no official FastAPI reference implementation. The pattern is inferred from documented Gemini function calling behavior. Consider a short spike to validate the exact `PilotRequest` / `PilotResponse` shape against SDK behavior before full build.

### Phase 6: Extended Features (v2.0 Polish)
**Rationale:** These features add significant value but do not change the core architecture once Phases 1-5 are working. They can be sequenced independently of each other.
**Delivers:** URL filter sync (Zustand → query params for shareable links); "Download Match Report" lead magnet (server-side PDF generation, WeasyPrint on Railway, gated by email); fuzzy search / "Did you mean?" (FTS5 prefix + tag vocabulary Levenshtein); match reason snippet on cards (lightweight Gemini call at retrieval time)
**Research flag:** NEEDS RESEARCH for Download Match Report — WeasyPrint PDF generation on Railway (memory constraints, font availability on Railway's base image) is underexplored. Run a spike: generate a 5-expert report and measure memory and latency before committing. Alternative: send the report as a formatted HTML email (simpler, lower risk, easier to build). All other Phase 6 features follow standard patterns.

### Phase Ordering Rationale

- Phase 1 must come before all other phases: the API contract is the single dependency of all frontend phases. Without it, frontend builds against mocks that must be unwound.
- Phase 2 can partially run in parallel with Phase 1: the Zustand store can be scaffolded against a mock API response, then finalized after Phase 1 ships. This is the only safe parallelization point.
- Phase 3 before Phase 4: card design must be finalized before virtualization is implemented. Virtuoso requires stable card content to avoid measurement instability.
- Phase 5 co-pilot backend in parallel with Phase 4: `pilot.py` has no dependency on the frontend grid. The co-pilot frontend (CoPilot.tsx, usePilot.ts) requires Phase 4 (grid must exist to provide context for the AI).
- Phase 6 after all core phases: these features are additive to a working marketplace, not prerequisites.

### Research Flags

Phases needing deeper research during planning:
- **Phase 5 (co-pilot two-turn loop):** MEDIUM — validate the exact FastAPI proxy implementation for the Gemini two-turn function calling flow before full build. The pattern is derived from documentation but has no official FastAPI+Gemini reference. A one-day spike is recommended.
- **Phase 6 (Download Match Report):** LOW-MEDIUM — WeasyPrint on Railway requires environment validation (memory limits, font loading). Run a spike before committing to WeasyPrint. HTML email is the safe fallback.

Standard patterns (skip research-phase):
- **Phase 1:** SQLite FTS5, FAISS IDSelectorBatch, FastAPI router pattern — fully documented with exact code in ARCHITECTURE.md
- **Phase 2:** Zustand v5 with persist middleware, React Router v7 lazy loading — official docs are comprehensive
- **Phase 3:** Faceted sidebar, dual-handle rate slider, tag checkboxes, active filter chips — established marketplace UX patterns with strong consensus
- **Phase 4:** react-virtuoso `Virtuoso` component, Framer Motion `LazyMotion` — well-documented, pitfalls already identified and mitigated in PITFALLS.md

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages version-confirmed from npm/PyPI. No new backend packages. Frontend additions (Zustand, react-virtuoso, Framer Motion) from official docs. Existing packages (faiss-cpu, google-genai, Tailwind v3) are unchanged and validated in production. |
| Features | MEDIUM-HIGH | Table stakes (sidebar, cards, virtualization) are industry consensus with strong multi-source agreement. AI co-pilot anchoring patterns are 6-12 months old and less settled. Download Match Report conversion data is from secondary sources. |
| Architecture | HIGH | Resolved against live codebase (direct file inspection of all production source files) plus official FAISS, SQLite, Gemini, Zustand, and FastAPI docs. Build order derived from actual dependency graph, not preference. |
| Pitfalls | HIGH | FAISS, FTS5, and Zustand pitfalls are documented in official sources and verified GitHub issues. react-virtuoso jitter and AnimatePresence incompatibility are confirmed open issues with documented workarounds. Gemini validation pitfall is MEDIUM (community-informed). |

**Overall confidence:** HIGH

### Gaps to Address

- **Gemini two-turn proxy exact implementation:** The architecture document gives the full pattern (inferred from Gemini function calling docs + Zustand docs), but the FastAPI `pilot.py` proxy has no official reference. Validate during Phase 5 planning or early spike. If the two-turn approach is too complex, a simplified one-shot approach (Gemini returns function call, frontend executes, no second Gemini turn for confirmation text) is a viable fallback.
- **WeasyPrint on Railway:** PDF generation in a Railway container is not validated. Memory and font availability are unknowns. Gate this behind a spike before committing to the approach in Phase 6.
- **FTS5 on Railway's SQLite:** The migration assumes Railway's Python image ships CPython's `sqlite3` with FTS5 compiled in (standard for CPython wheels). Almost certainly true, but add a startup check (`SELECT fts5('test')`) — if it raises, fall back to SQLAlchemy LIKE-only search until confirmed.
- **Tag LIKE query performance at scale:** The SQLAlchemy tag filter uses `LIKE '%"tag"%'` — O(n) full-table scan. At 1,558 experts this is fast (<3ms). If the expert count grows beyond 10k, this needs SQLite JSON virtual columns or Postgres GIN index. Not a v2.0 issue, but flag for future milestones.

## Sources

### Primary (HIGH confidence)
- [FAISS wiki — Setting search parameters](https://github.com/facebookresearch/faiss/wiki/Setting-search-parameters-for-one-query) — IDSelectorBatch search-time API
- [FAISS IDSelectorBatch C++ API](https://faiss.ai/cpp_api/struct/structfaiss_1_1IDSelectorBatch.html) — numpy int64 array input confirmation
- [SQLite FTS5 official docs](https://sqlite.org/fts5.html) — external content tables, rebuild command, trigger patterns
- [Gemini function calling docs](https://ai.google.dev/gemini-api/docs/function-calling) — two-turn loop, FunctionDeclaration schema
- [Zustand persist middleware docs](https://zustand.docs.pmnd.rs/middlewares/persist) — partialize, version, migrate
- [react-virtuoso official docs](https://virtuoso.dev) — Virtuoso vs VirtuosoGrid, endReached, troubleshooting (margin vs padding)
- [FastAPI bigger applications](https://fastapi.tiangolo.com/tutorial/bigger-applications/) — router-per-file pattern
- [React Router v7 SPA mode](https://reactrouter.com/how-to/spa) — lazy loading, loader/component separation
- [Tailwind v4 blog](https://tailwindcss.com/blog/tailwindcss-v4) — OKLCH built-in (v4 only, not v3)
- Direct codebase inspection: `app/main.py`, `app/models.py`, `app/routers/`, `app/services/`, `frontend/src/` — ground truth for all integration points

### Secondary (MEDIUM confidence)
- [SQLite forum — FTS5 trigger bug](https://sqlite.org/forum/info/da59bf102d7a7951740bd01c4942b1119512a86bfa1b11d4f762056c8eb7fc4e) — UPDATE trigger corruption documented by SQLite contributors
- [FAISS issue #3112](https://github.com/facebookresearch/faiss/issues/3112) — IDSelectorBatch hash collision (not relevant for sequential IDs)
- [react-virtuoso issue #479](https://github.com/petyosi/react-virtuoso/issues/479) and [#1086](https://github.com/petyosi/react-virtuoso/issues/1086) — VirtuosoGrid jitter with variable heights (open since 2021, unresolved)
- [Framer Motion issue #1682](https://github.com/framer/motion/issues/1682) — AnimatePresence exit animation incompatibility with virtualizers
- [Zustand hydration race condition fix — v5.0.10](https://github.com/pmndrs/zustand/discussions/2556) — reason to use 5.0.10+
- [React Training blog — React Router v7 lazy loading pitfalls](https://reacttraining.com/blog/spa-lazy-loading-pitfalls) — loader/component separation required for true code splitting
- [Brixon Group — B2B lead magnet conversion data](https://brixongroup.com/en/b2b-lead-magnets-compared-gated-pdf-vs-interactive-tool-which-strategy-will-deliver-better-results-in/) — personalized report 6.2% vs static 3.8%
- [Microsoft Learn AI UX guidance](https://learn.microsoft.com/en-us/microsoft-cloud/dev/copilot/isv/ux-guidance) — floating AI co-pilot patterns

### Tertiary (LOW confidence)
- [Microsoft Bing floating Copilot — Windows Forum](https://windowsforum.com/threads/microsoft-bings-new-ai-features-floating-copilot-box-source-transparency-chat-driven-results.371429/) — FAB anchor position convention (bottom-right) used by industry-standard assistants
- Prompt injection risk for Gemini function calling — community-informed, not officially documented as a specific attack vector for this architecture

---
*Research completed: 2026-02-21*
*Ready for roadmap: yes*
