# Project Research Summary

**Project:** TCS Expert Marketplace — v2.3 Sage Evolution & Marketplace Intelligence
**Domain:** AI-powered Expert Marketplace (additive milestone on live v2.2 system)
**Researched:** 2026-02-22
**Confidence:** HIGH (architecture and pitfalls from direct codebase inspection; stack additions from official sources; features MEDIUM due to emerging AI UX literature)

## Executive Summary

TCS v2.3 is an additive milestone on a live AI expert marketplace (530 experts, FastAPI + SQLite + FAISS backend on Railway, React + Vite + Tailwind v3 frontend on Vercel). The milestone has three parallel tracks: (1) upgrading the Sage AI co-pilot to perform active searches via a second Gemini function (`search_experts`) alongside the existing `apply_filters` function, (2) instrumenting user behavior via a lightweight custom event tracking layer, and (3) surfacing that data in a new Admin Marketplace Intelligence page. No new infrastructure is required — all capabilities extend the existing validated stack without adding any new packages to either the frontend or backend.

The recommended approach is to sequence the work as: Sage `search_experts` (highest user-facing value, fully independent) first, then the personality/clarifying question rewrite (one prompt file, instant rollback), then FAB animations and proactive nudge, then the database model and ingestion endpoint, then the frontend tracking layer, and finally the admin intelligence page. The critical architectural constraint is single ownership: `useExplore` is the exclusive writer to `resultsSlice`, and Sage search results for the panel travel through `pilotSlice.experts` independently. The backend's `pilot_service.py` calls `run_explore()` via direct Python import — no HTTP self-call.

The primary risks are about precision rather than scale. Gemini must choose between two semantically similar functions — descriptions must be mutually exclusive and tested against real queries before shipping. The proactive empty-state nudge has multiple false-positive conditions that must all be guarded from day one. Event tracking must be debounced and fire-and-forget to avoid polluting both the user experience and the gap analysis data. The SQLite `user_events` table is a new table (safe with `create_all`), but any future column additions to existing tables require explicit `ALTER TABLE` in the startup lifespan.

## Key Findings

### Recommended Stack

The v2.3 stack additions are zero. All three tracks — Gemini dual-function calling, SQLite event tracking, admin aggregation queries — use packages already in `requirements.txt` and `package.json`. The following is a summary of the validated existing stack as used by v2.3:

**Core technologies (all existing — zero new packages):**
- `google-genai==1.64.*`: dual `FunctionDeclaration` in one `types.Tool`; `response.function_calls` list dispatch; `fn_call.args` is a protobuf Struct — wrap in `dict()` before JSON serialization
- `motion/react` v12.34 (installed as `framer-motion@^12`): `useMotionValue` + `useTransform` + `useSpring` for proximity-based tag cloud; `AnimatePresence` for FAB/panel; FAB glow via wrapper `motion.div` on `boxShadow` only (never `scale` — conflicts with `whileHover`)
- `zustand@^5.0.10`: `persist` middleware with `partialize` for selective localStorage persistence; `createJSONStorage` required in v5; `useExplorerStore.getState()` snapshot pattern for async handlers
- `react-virtuoso@^4.18.1`: `Virtuoso` for variable-height expert card grid; tracking must not add DOM wrappers inside `itemContent` — VirtuosoGrid's height assumption breaks
- SQLite FTS5 (stdlib) + SQLAlchemy `text()`: no ORM support for FTS5; content-table mode requires INSERT/DELETE/UPDATE triggers; `rank` column = negative BM25 score
- `scikit-learn==1.8.0` + `scipy==1.15.1`: added in v2.2 for t-SNE; PCA 768→50 then TSNE 50→2; compute post-startup via `asyncio.to_thread`; cached in `app.state`

**What NOT to add (confirmed as unnecessary):**
- Any external analytics SDK (PostHog, Mixpanel, Segment) — SQLite `user_events` table is sufficient at this scale
- `navigator.sendBeacon` — cannot send `Content-Type: application/json`; use `fetch` with `keepalive: true`
- Alembic migrations — `Base.metadata.create_all()` handles new tables; `ALTER TABLE` in lifespan for existing table columns
- LangChain — overkill for a single-tool co-pilot
- `umap-learn` — explicitly deferred to v2.3+; heavy Railway build dependency

### Expected Features

Research identifies a clear priority hierarchy for v2.3 with dependency constraints that determine sequencing.

**Must have (table stakes):**
- Sage search results visible inside the panel after a `search_experts` call — users who ask "show me experts in X" expect inline results, not a silent grid change
- Grid syncs with Sage search — divergent results between panel and grid break user trust
- Natural language confirmation from Sage after every function call — raw function results without narrative feel broken
- Zero-result graceful handling — Sage must acknowledge empty results and offer a redirect, not show a silent empty state
- Event tracking fires without blocking UX — `void fetch(...)` with `keepalive: true`; never `await` in click paths
- Admin zero-result query visibility — the most basic search analytics output

**Should have (competitive differentiators):**
- Sage dual-function intent disambiguation (`apply_filters` for browsing refinement vs `search_experts` for direct retrieval) — no competitor marketplace AI co-pilot resolves this split
- Sage clarifying questions for ambiguous queries — one question maximum; reduces error rates by 27% and retries from 4.1 to 1.3 per session (Haptik 2025)
- Sage proactive empty-state nudge — FAB pulses when grid hits zero results; injects system message when panel is closed
- Expert exposure distribution in admin — which experts are effectively invisible in search results
- Admin Gaps tab combining unmet demand (zero-result queries) and supply gaps (low-exposure experts) in one view

**Defer to v2.4+:**
- Quick-reply chips for clarifying questions (plain text fallback acceptable for v2.3)
- FAB glow animation on message received (P3 delight)
- Real-time Gaps dashboard (WebSocket/polling) — retrospective analysis is sufficient
- UMAP visualization (heavy Railway build dependency)
- Third-party analytics SDK (justified at >10K daily events; current scale does not warrant it)

### Architecture Approach

The v2.3 architecture makes three surgical additions to the existing v2.2 system without modifying any of its core services. The critical design principle is single ownership: `resultsSlice` is written exclusively by `useExplore`; Sage search results for the panel travel through `pilotSlice.experts`; the `user_events` table is written only by the public `POST /api/events` endpoint. Grid sync for `search_experts` is achieved by `useSage` calling `validateAndApplyFilters(data.filters)`, which updates `filterSlice`, which triggers `useExplore`'s reactive re-fetch — the same mechanism that already powers `apply_filters`. The backend's `pilot_service.py` calls `run_explore()` directly (Python import, no HTTP self-call) and receives `db` and `app_state` via dependency injection from the `pilot.py` router.

**Major components (v2.3 delta):**
1. `pilot_service.py` (MODIFIED) — adds `SEARCH_EXPERTS_DECLARATION` to `types.Tool`; dispatches `run_explore()` in-process; returns `experts: list[dict]` in `PilotResponse`
2. `pilot.py` (MODIFIED) — injects `db: Session = Depends(get_db)` and `app_state = request.app.state` into `run_pilot()` call
3. `events.py` (NEW router) — `POST /api/events`, public, no auth, returns 202; validates `event_type` allowlist
4. `UserEvent` in `models.py` (NEW model) — single table, discriminated `event_type`, sparse nullable columns per type; auto-created by `Base.metadata.create_all()`
5. `tracking.ts` (NEW frontend lib) — `trackEvent()` fire-and-forget via `fetch` with `keepalive: true`; module function, not a hook
6. `SageExpertCard.tsx` (NEW component) — compact expert card for the 380px Sage panel; no bento constraints
7. `MarketplacePage.tsx` (NEW admin page) — demand signals + expert exposure; reads from `GET /api/admin/events/demand` and `/events/exposure`

**Files completely unchanged:** `explorer.py`, `retriever.py`, `embedder.py`, `search_intelligence.py`, `tagging.py`, `database.py`, `config.py`, `useExplore.ts`, `resultsSlice.ts`, `SagePanel.tsx`, `GapsPage.tsx`, all existing admin pages.

### Critical Pitfalls

1. **Gemini wrong function routing (`search_experts` vs `apply_filters` ambiguity)** — Write mutually exclusive descriptions: `apply_filters` = "narrow or refine current results"; `search_experts` = "discover experts, find me X, who can help with Y". Test against 20 real queries from `conversations` table before shipping; assert `fn_call.name` in Railway logs for each.

2. **Grid sync race condition** — Two concurrent writers to `resultsSlice` when Sage also dispatches filter state. Prevention: `setResults` is called exclusively by `useExplore`. Sage populates `pilotSlice.experts` for the panel independently; grid gets results via the reactive `useExplore` re-fetch triggered by `validateAndApplyFilters`. Never call `setResults` from `useSage`.

3. **SQLite migration crash on Railway** — `Base.metadata.create_all()` creates new tables but silently skips existing ones. New columns on existing tables require explicit `ALTER TABLE ... ADD COLUMN` in `main.py` lifespan before `yield`. The `user_events` table is new (safe). Watch for this if tracking fields are later added to `conversations`.

4. **Event tracking noise making gap analysis misleading from day one** — Tracking every Zustand filter mutation generates 10–100 events per slider drag. Prevention: debounce 1000ms after last mutation; track rate slider only on drag-end (`onMouseUp`/`onTouchEnd`); add `if (q)` guard on `setQuery` to skip empty-string clears.

5. **Proactive nudge fires at wrong times** — Fires on mount (initial `experts: []` state), during rapid typing, and repeatedly across sessions. Prevention: `hasFetchedOnce` ref + `nudgeSent` boolean in `pilotSlice` + 1500ms debounce + `!loading && !isStreaming` guards. Nudge trigger must live in a `useEffect` with reactive `useExplorerStore(s => s.experts)` selector — never inside `handleSend` using `getState()` snapshots.

6. **FAB pulse/glow animation conflicts with `whileHover`/`whileTap` gesture props** — `SageFAB.tsx` already uses `whileHover={{ scale: 1.05 }}` and `whileTap={{ scale: 0.95 }}`. Adding a loop on `animate={{ boxShadow: [...] }}` on the same `motion.button` causes both to compete. Prevention: outer `motion.div` handles `boxShadow` animation only; inner `motion.button` retains `scale` gesture props. Never animate `scale` on the wrapper.

7. **Awaiting tracking in click handlers blocks the interaction path** — `await fetch('/api/events', ...)` before `onViewProfile` introduces a 50–200ms network round-trip before the profile gate opens. Prevention: `void fetch(...)` always. The `void` keyword makes fire-and-forget intent explicit in code review.

8. **Sage personality loops clarifying questions — grid never updates** — Gemini 2.5 Flash defaults to asking when descriptions include "make sure you understand." Hard-limit clarification depth in the system prompt: "You may ask at most ONE clarifying question per conversation. After the user responds to any question, always call a function."

## Implications for Roadmap

Based on combined research, the recommended build order is: Sage `search_experts` function (D) first, Sage personality (A) concurrently or second, FAB reactions + proactive nudge (C) third, then event tracking backend (Phase 4) then frontend (Phase 5), and finally the admin intelligence page (Phase 6). The key constraint is that Phase 6 requires data from Phase 5 to be meaningful — ship with a cold-start empty state that communicates the tracking start timestamp.

### Phase 1: Sage `search_experts` Dual Function

**Rationale:** Highest user-facing value; fully independent of tracking and admin work; unblocks Phase 3 (which needs search-triggered empty states as test cases for the nudge logic). Ship first.
**Delivers:** Second `FunctionDeclaration` in `types.Tool`; `pilot_service.py` calls `run_explore()` in-process; `PilotResponse` gains `experts: list[dict]`; `pilotSlice.PilotMessage` gains `experts?: Expert[]`; `useSage` handles `data.experts` and calls `validateAndApplyFilters(data.filters)` for grid sync; `SageExpertCard` compact component (name, title, rate — 3 fields max, no bento constraints); Turn 2 Gemini narrative summarizing result count and notable matches; graceful zero-result handling in Turn 2 context.
**Uses:** `google-genai==1.64.*` (existing); direct `run_explore()` Python import; `validateAndApplyFilters` for grid sync (already used by `apply_filters`)
**Avoids:** Pitfall 1 (function description ambiguity — mutually exclusive descriptions, 20-query test); Pitfall 2 (race condition — single-ownership rule enforced at code review); Architecture anti-pattern 6 (never call `setResults` from `useSage`)

### Phase 2: Sage Personality Rewrite + System Prompt

**Rationale:** Zero infrastructure dependencies; system prompt changes deploy instantly via `main`; establishes the personality baseline before the nudge logic (Phase 3) needs to reference Sage's behavior. Lowest risk, can ship concurrently with Phase 1 or immediately after.
**Delivers:** Warmer Sage voice with contractions and result summaries; hard-limited clarifying questions (max 1 per conversation, explicit `turn_number` signal in system prompt); correct context injection of `current_filters.query` preserving user's active query; fallback safety net in `useSage` (2 consecutive non-function turns → auto-suggest action).
**Avoids:** Pitfall 7 (Sage loops clarifying questions); Pitfall UX-3 (Sage ignores active query context when asking clarifying questions)

### Phase 3: Sage FAB Animated Reactions + Proactive Empty-State Nudge

**Rationale:** Depends on Phase 1 (`search_experts` must exist to produce search-triggered empty states for testing the nudge). `motion/react` already installed. Independent of tracking infrastructure.
**Delivers:** FAB pulse animation on zero-results state — outer `motion.div` wrapper on `boxShadow` only; `nudgeSent` boolean added to `pilotSlice` (excluded from `partialize`); `hasFetchedOnce` ref + 1500ms debounce guards; proactive system message injected into `pilotSlice.messages` when `experts.length === 0 && total === 0` and panel is closed; nudge trigger in `useEffect` with reactive selectors.
**Avoids:** Pitfall 3 (nudge false positives on page load, rapid typing, repeated sessions); Pitfall 4 (Framer Motion gesture/animate property conflict — separate wrapper pattern); Pitfall 10 (reactive selector vs `getState()` misuse for nudge trigger)

### Phase 4: User Behavior Event Tracking (Backend)

**Rationale:** Foundation for Phase 6 (admin page needs data); `UserEvent` is a new table so `create_all` handles it safely; the public `POST /api/events` endpoint must exist before Phase 5 frontend tracking fires.
**Delivers:** `UserEvent` SQLAlchemy model with discriminated `event_type` (`card_click`, `sage_query`, `filter_change`) and sparse nullable columns per type; `events.py` router (`POST /api/events`, 202 response, no auth); `event_type` allowlist validation via Pydantic (rejects arbitrary strings with 422); 2000-char cap on `query_text`; composite index on `(event_type, created_at)`; per-IP rate limiting recommendation (20 req/s).
**Avoids:** Pitfall 6 (new table — `create_all` is safe; no `ALTER TABLE` needed); Security: event_type allowlist prevents attacker-injected event categories

### Phase 5: Frontend Event Tracking Integration

**Rationale:** Requires Phase 4 endpoint. `trackEvent()` is a module function (not a hook) so it can be called from Zustand actions, handlers, and `useCallback` without hook rules constraints.
**Delivers:** `tracking.ts` with fire-and-forget `fetch + keepalive: true`; `filterSlice.ts` modified to call `trackEvent()` in settled-state (debounced 1000ms after last mutation); rate slider tracking on drag-end only (`onMouseUp`/`onTouchEnd`), not on every position; `ExpertCard.tsx` onClick emits `card_click` (grid context); `SageExpertCard.tsx` onClick emits `card_click` (sage_panel context); `useSage.ts` emits `sage_query` after pilot response with `query_text`, `function_called`, `result_count`.
**Avoids:** Pitfall 5 (awaiting tracking blocks click path — `void fetch(...)`, never `await`); Pitfall 8 (tracking noise from slider events — settled-state debounce); Architecture anti-pattern 3 (never in `useEffect` — in onClick and Zustand actions only); VirtuosoGrid tracking wrapper pitfall (no new DOM wrappers inside `itemContent`)

### Phase 6: Admin Marketplace Intelligence Page

**Rationale:** Requires Phase 4 + 5 live and accumulating data. Builds on existing `adminFetch` and Recharts infrastructure used in the Intelligence tab. New page (`MarketplacePage.tsx`) at `/admin/marketplace` — does not modify existing `GapsPage.tsx`.
**Delivers:** Two new admin endpoints (`GET /api/admin/events/demand`, `GET /api/admin/events/exposure`) under existing `_require_admin` auth; `DemandTable` (zero-result Sage queries sorted by frequency + most-searched filter terms); `ExposureTable` (expert click counts, grid vs Sage panel breakdown, vs findability score); daily Sage usage trend; `AdminSidebar.tsx` updated with Marketplace nav entry; explicit empty state with "Tracking started [timestamp] — insights will appear after ~50 page views" when `user_events` is empty; `data_since` field in every Gaps API response.
**Avoids:** Pitfall 9 (cold-start empty tab confusion — empty state built before data-loading logic); Security: all `/api/admin/events/*` wrapped in `_require_admin` dependency (already covers all `/api/admin/*` routes)

### Phase Ordering Rationale

- Phase 1 before Phase 3: `search_experts` must exist to produce search-triggered empty states as test cases for the proactive nudge.
- Phases 1 and 2 are independent and can ship in parallel or in either order. Personality first is lowest risk; `search_experts` first delivers more value faster.
- Phases 4 and 5 are independent of Phases 1–3 and can be built in parallel with Phase 3.
- Phase 5 must follow Phase 4 — the frontend tracking endpoint must exist before tracking code ships.
- Phase 6 must follow Phase 5 — the admin page needs events accumulated in the DB to display meaningful data. Ship Phase 6 a few days after Phase 5 is live, or with the cold-start empty state handling the gap.
- The single-ownership rule (`resultsSlice` written only by `useExplore`) must be documented as a code review requirement before Phase 1 implementation begins.

### Research Flags

Phases likely needing explicit verification before or during implementation:

- **Phase 1 (Sage dual function):** Gemini's function routing behavior with two semantically adjacent functions cannot be fully validated without running inference. Run the 20-query test against real queries from the `conversations` table before shipping. Budget for one iteration of description tuning. Assert `fn_call.name` in Railway logs for each test query.
- **Phase 5 (Frontend tracking debounce):** Verify that the settled-state debounce (1000ms) does not stack with an existing `RateSlider.tsx` debounce. Check DevTools Network tab: rate slider drag should produce exactly 1 tracking event per settled position, not per pixel of movement.
- **Phase 4 (SQLite on Railway):** Verify `user_events` table creation on first deploy by scanning Railway logs for `OperationalError` in the first 60 seconds post-deploy.

Phases with standard patterns where additional research is not needed:

- **Phase 2 (System prompt):** One-file change; instant rollback via `git push`. No infrastructure risk.
- **Phase 3 (FAB animation):** Framer Motion separation pattern (wrapper `motion.div` for `boxShadow`, inner `motion.button` for `scale`) is the documented canonical approach. Motion values pipeline for nudge trigger is the established pattern from v2.2.
- **Phase 6 (Admin page):** Recharts and `adminFetch` patterns already established in the Intelligence tab. SQL aggregations are standard `GROUP BY` queries with existing SQLAlchemy patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new packages for v2.3. All existing package APIs confirmed from official docs and GitHub. OKLCH browser support at 93% confirmed from caniuse. `motion/react` proximity pattern confirmed from official Motion docs and BuildUI recipe. |
| Features | MEDIUM | AI co-pilot dual-function UX and clarifying question patterns are cross-verified across 2025 sources but all at MEDIUM confidence (no single authoritative standard). The 27% error reduction claim from Haptik has not been independently verified. Table stakes features (inline results, grid sync, zero-result handling) are HIGH confidence from established UX patterns. |
| Architecture | HIGH | Based on direct codebase inspection of the running v2.2 system. All component boundaries, data flow, and hook patterns are ground truth from actual source files. The `run_explore()` import path, `run_in_executor` threading pattern, and `validateAndApplyFilters` dispatch mechanism are all verified from the live code. |
| Pitfalls | HIGH | All 10 critical pitfalls derived from direct inspection of `useSage.ts`, `useExplore.ts`, `pilot_service.py`, `SageFAB.tsx`, `models.py`, `admin.py`. The race condition, migration crash, and Framer Motion animation conflict are observable from existing code patterns — not inferred. |

**Overall confidence:** HIGH for architectural and implementation guidance. MEDIUM for Sage dual-function UX decisions where Gemini's actual routing behavior with two functions must be empirically validated before shipping.

### Gaps to Address

- **Gemini function routing empirical validation:** The function description text for `apply_filters` and `search_experts` is a design decision that cannot be fully validated without running inference. Before Phase 1 ships to production, run the 20-query verification test and assert `fn_call.name` in logs. Budget for one iteration of description tuning.

- **Railway SQLite write latency for tracking endpoint:** The fire-and-forget tracking endpoint posts to Railway's SQLite volume. ARCHITECTURE.md recommends `async def` with `run_in_executor` for the write (same pattern as `explore.py`). Verify at startup that P99 write latency is under 100ms. If not, consider collecting events in memory and flushing every 10 seconds rather than per-event writes.

- **VirtuosoGrid fixed-height constraint and `ExpertCard` tracking integration:** PITFALLS.md confirms that wrapping `ExpertCard` in a new DOM element inside `VirtuosoGrid`'s `itemContent` breaks the fixed-height assumption. The `card_click` tracking call must be added to the existing `onViewProfile` prop handler in `ExpertCard.tsx` — not via any new wrapper element. Confirm the current `itemContent` structure before Phase 5.

- **`conversations.response_experts` backfill for cold-start exposure chart:** PITFALLS.md suggests using existing `conversations` table data to populate initial exposure charts before new tracking accumulates. Whether `conversations.response_experts` is populated in v2.2 and in what format is not confirmed — verify this column exists and contains expert ID arrays before relying on it for Phase 6 backfill.

- **`useSage.ts` function_called detection logic:** The tracking emission in `useSage` after a pilot response uses `data.filters ? (data.experts ? 'search_experts' : 'apply_filters') : null` to infer which function was called. If the backend always returns `filters` even for `search_experts`, this inference is wrong. Consider returning an explicit `function_called: str | None` field in `PilotResponse` to avoid ambiguity.

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection (`useSage.ts`, `useExplore.ts`, `pilot_service.py`, `SageFAB.tsx`, `models.py`, `admin.py`, `filterSlice.ts`, `resultsSlice.ts`, `pilotSlice.ts`, `ExpertCard.tsx`, `SagePanel.tsx`, `useAdminData.ts`, `admin/types.ts`) — all architecture and pitfall findings
- [google-genai PyPI + googleapis/python-genai GitHub](https://github.com/googleapis/python-genai) — `FunctionDeclaration`, `response.function_calls`, `fn_call.args` (protobuf Struct) API
- [Gemini function calling official docs](https://ai.google.dev/gemini-api/docs/function-calling) — two-turn pattern, multiple declarations in one Tool, AUTO mode
- [SQLite FTS5 official docs](https://sqlite.org/fts5.html) — content table mode, triggers, BM25 rank column
- [Motion useTransform docs](https://motion.dev/docs/react-use-transform) — proximity scaling pipeline API
- [Motion useSpring docs](https://motion.dev/docs/react-use-spring) — spring physics for proximity scale
- [Motion motion values docs](https://motion.dev/docs/react-motion-value) — `useMotionValue` bypasses React re-renders
- [Algolia Analytics — zero-result query tracking](https://support.algolia.com/hc/en-us/articles/13079831222033) — gap analysis dashboard patterns
- [Algolia Ecommerce Playbook — null results](https://www.algolia.com/ecommerce-merchandising-playbook/null-results-optimization) — unmet demand identification
- [Google Analytics for Developers — SPA event tracking](https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications) — event schema design (GA4 pattern)
- [scikit-learn TSNE docs 1.8](https://scikit-learn.org/stable/modules/generated/sklearn.manifold.TSNE.html) — parameter reference, PCA pre-reduction recommendation
- [caniuse OKLCH](https://caniuse.com/mdn-css_types_color_oklch) — 93% browser support
- [caniuse backdrop-filter](https://caniuse.com/css-backdrop-filter) — 92% browser support
- [Web Fetch API keepalive — MDN](https://developer.mozilla.org/en-US/docs/Web/API/fetch) — `keepalive: true` behavior on page unload

### Secondary (MEDIUM confidence)

- [BuildUI Magnified Dock recipe](https://buildui.com/recipes/magnified-dock) — proximity-based scaling pattern (`useMotionValue + useTransform + useSpring`); uses `framer-motion` imports (same API as `motion/react`)
- [Haptik AI — clarifying questions research](https://www.haptik.ai/tech/probing-clarification-skill-ai-assistant) — 27% error reduction, 4.1→1.3 retry reduction from single clarifying question
- [ShapeOfAI.com — AI nudge patterns](https://www.shapeof.ai/patterns/nudges) — proactive empty-state nudge UX
- [SQLAlchemy FTS5 discussion #9466](https://github.com/sqlalchemy/sqlalchemy/discussions/9466) — `text()` is the only path for FTS5 DDL in SQLAlchemy
- [Railway nixpacks docs](https://docs.railway.com/reference/nixpacks) — Python build process, glibc version, manylinux compatibility
- [fetch keepalive vs sendBeacon](https://www.stefanjudis.com/today-i-learned/fetch-supports-a-keepalive-option-to-make-it-outlive-page-navigations/) — `keepalive: true` survives page navigation; `sendBeacon` cannot send JSON

### Tertiary (LOW confidence)

- [5 UX Patterns for Better Generative AI Search — Medium/Bootcamp](https://medium.com/design-bootcamp/5-ux-patterns-for-better-generative-ai-search-6fecb37142a1) — dual-function intent distinction; single source
- [Microsoft Learn — UX guidance for AI co-pilots](https://learn.microsoft.com/en-us/microsoft-cloud/dev/copilot/isv/ux-guidance) — compact result card pattern inside chat panel; indirect application to Sage

---
*Research completed: 2026-02-22*
*Ready for roadmap: yes*
