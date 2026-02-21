# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** A user describes any problem and instantly gets three expertly matched professionals they can contact — no searching, no filtering, no guesswork.
**Current focus:** Phase 19 — Extended Features

## Current Position

Phase: 19 of 19 (Extended Features)
Plan: Not started
Status: Ready to plan
Last activity: 2026-02-21 — Phase 18 complete: Floating AI Co-Pilot — SageFAB, SagePanel, Gemini two-turn function calling, filter dispatch, mobile full-screen, EmptyState CTA wired

Progress: [████████████████████] 46/46 plans (100% of planned phases; Phase 19 TBD plans)

## Live URLs

| Service | URL |
|---------|-----|
| Railway (backend) | https://web-production-fdbf9.up.railway.app |
| Vercel (frontend) | https://tcs-three-sigma.vercel.app |

## Performance Metrics

**Velocity:**
- Total plans completed: 42 (phases 1-13 + 14-17)
- Average duration: ~15 min

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 14 | 01 | 2 min | 2 | 2 |
| 14 | 02 | 2 min | 2 | 2 |
| 14 | 03 | 3 min | 1 | 1 |
| 15 | 01 | 2 min | 2 | 6 |
| 16 | 01 | 8 min | 2 | 6 |
| 16 | 02 | 6 min | 2 | 5 |
| 16 | 03 | 5 min | 1 | 1 |
| 17 | 01 | ~10 min | 2 | 5 |
| 17 | 02 | ~12 min | 2 | 4 |
| 17 | 03 | ~3 min | 2 | 1 |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

**Phase 14 Plan 01 decisions (2026-02-21):**
- FAISS weight 0.7, BM25 weight 0.3 — hardcoded constants (tuning rare; env var overhead not justified)
- match_reason: tag-intersection label (deterministic, zero latency) — Gemini upgrade deferred to Phase 18
- Cursor: integer offset (simplest for react-virtuoso; stable corpus, no concurrent inserts)
- total: pre-filter count — matches "N experts matching your filters" user expectation
- Findability boost: multiplicative ±20% from 50–100 range (neutral at 75)

**Phase 14 Plan 02 decisions (2026-02-21):**
- FTS5 INSERT trigger for add_expert sync (SQLite-level); avoids duplicate rowid with explicit INSERT
- Explicit FTS5 rebuild in _run_ingest_job (bulk updates require full rebuild, trigger only fires on INSERT)
- username_to_faiss_pos built from metadata.json "Username" key (capital U, confirmed by RESEARCH.md)
- Category auto-classification scoped to uncategorized experts only (idempotent; preserves manual overrides)

**Phase 14 Plan 03 decisions (2026-02-21):**
- Inline feedback boost implementation (not _apply_feedback_boost import): avoids tuple type mismatch with scored list
- Cold-start threshold: 10 total votes (mirrors search_intelligence formula)
- boost_factor = 0.40 (FEEDBACK_BOOST_CAP * 2): consistent with search_intelligence._apply_feedback_boost()

**Phase 15 Plan 01 decisions (2026-02-21):**
- Zustand v5 pattern: type goes on create<T>() not on persist — combined with (...a) spread for slice composition
- StateCreator typed with [['zustand/persist', unknown]] in slice files to avoid circular reference with ExplorerStore type in index.ts
- useShallow from 'zustand/react/shallow' (v5 path, not 'zustand/shallow') for all slice hooks
- '/chat' route preserves old App interface but is not linked from new marketplace UI

**Phase 16 decisions (2026-02-21):**
- Individual Zustand selectors for useExplore (not useShallow) — prevents tags array identity causing infinite re-render loop
- AbortError caught silently; setLoading(false) NOT called on abort — next fetch manages loading state
- onValueCommit (not onValueChange) for RateSlider — single API call on drag-release, not per pixel
- Top-30 tags hardcoded — no /api/tags endpoint; stable list from metadata.json
- No overflow on MarketplacePage root div — critical for sticky sidebar (position:sticky fails with overflow ancestor)
- Vaul Drawer.Content requires h-full max-h-[97%] for snap-point sizing to render correctly
- MobileFilterSheet uses number inputs for rate on mobile — numeric keyboard is better UX than slider in bottom-sheet
- snapToSequentialPoint on Drawer.Root — prevents snap points being skipped on high-velocity drag

**Phase 17 decisions (2026-02-21):**
- VirtuosoGrid (not Virtuoso) — cards use fixed h-[180px] making uniform-height grid correct; listClassName CSS grid for 2/3-col responsive
- motion from 'motion/react' (new package name for Framer Motion v12+) — entry-only animation, no exit prop on VirtuosoGrid items
- Expert interface snake_case — API returns snake_case; camelCase aliases removed entirely from resultsSlice
- Individual Zustand selectors for isFetchingMore/appendResults in useExplore — consistent with Phase 16 pattern
- flex-1 min-h-0 container for VirtuosoGrid — gives known height for virtualization within flex column layout
- appendResults uses spread: [...state.experts, ...newExperts] — appends on scroll, setResults replaces on filter change

**Phase 18 decisions (2026-02-21):**
- filterSlice.setTags (not toggleTag) for Sage — Sage replaces tags array entirely; toggleTag is for human one-at-a-time interaction
- useExplorerStore.getState() snapshot in useSage async handler — prevents stale closure in async context
- Gemini role mapping: 'assistant' → 'model' — toGeminiRole() in useSage; pilotSlice uses 'assistant', Gemini API requires 'model'
- Two-turn Gemini pattern — Turn 1 extracts apply_filters args, Turn 2 sends function result back for contextually accurate confirmation
- FAB hides when panel is open — AnimatePresence with {!isOpen && <SageFAB>} — cleaner than coexisting; avoids z-index conflicts

Key v2.0 architecture constraints (from .planning/research/):
- FAISS IDSelectorBatch used as search-time filter only — never `remove_ids`; `username_to_faiss_pos` mapping required at startup
- FTS5 synced via explicit SQL in write paths (not ORM events); `rebuild` required after virtual table creation to populate existing rows
- Zustand `partialize` scopes localStorage to filter prefs only — results and pilot slices never persisted; `version: 1` from day one
- AnimatePresence exit animations excluded from react-virtuoso items; entry-only `animate` prop on cards
- Co-pilot is client-side dispatch — FastAPI is thin Gemini proxy; browser owns all filter state via `useExplorerStore.getState()`
- Gemini function call output must pass `validateFilterArgs` before any store dispatch
- VirtuosoGrid used (not Virtuoso) — expert cards are fixed height h-[180px]; listClassName CSS grid for responsive columns

### Pending Todos

- Set `ALLOWED_ORIGINS=https://tcs-three-sigma.vercel.app` in Railway environment variables (carried over from v1.1)
- Verify FTS5 availability on Railway SQLite at startup: `conn.execute(text("SELECT fts5('test')"))`

### Blockers/Concerns

- Set `ALLOWED_ORIGINS=https://tcs-three-sigma.vercel.app` in Railway environment variables (carried over from v1.1)
- Verify FTS5 availability on Railway SQLite at startup: `conn.execute(text("SELECT fts5('test')"))`

## Session Continuity

Last session: 2026-02-21
Stopped at: Phase 18 complete, ready to plan Phase 19 (Extended Features)
Resume file: None
