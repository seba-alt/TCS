# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** A user describes any problem and instantly gets three expertly matched professionals they can contact — no searching, no filtering, no guesswork.
**Current focus:** Phase 15 — Zustand State and Routing

## Current Position

Phase: 15 of 19 (Zustand State and Routing)
Plan: 1 of 1 in current phase
Status: Phase complete
Last activity: 2026-02-21 — Phase 15 Plan 01 complete: three-slice Zustand store with persist middleware and MarketplacePage routing

Progress: [██████████░░░░░░░░░░] ~50% (v1.0–v1.2 complete, v2.0 phase 14 in progress)

## Live URLs

| Service | URL |
|---------|-----|
| Railway (backend) | https://web-production-fdbf9.up.railway.app |
| Vercel (frontend) | https://tcs-three-sigma.vercel.app |

## Performance Metrics

**Velocity:**
- Total plans completed: 39 (phases 1-13 + 14-01)
- Average duration: ~15 min

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 14 | 01 | 2 min | 2 | 2 |
| 14 | 02 | 2 min | 2 | 2 |
| 14 | 03 | 3 min | 1 | 1 |
| 15 | 01 | 2 min | 2 | 6 |

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

Key v2.0 architecture constraints (from .planning/research/):
- FAISS IDSelectorBatch used as search-time filter only — never `remove_ids`; `username_to_faiss_pos` mapping required at startup
- FTS5 synced via explicit SQL in write paths (not ORM events); `rebuild` required after virtual table creation to populate existing rows
- Zustand `partialize` scopes localStorage to filter prefs only — results and pilot slices never persisted; `version: 1` from day one
- AnimatePresence exit animations excluded from react-virtuoso items; entry-only `animate` prop on cards
- Co-pilot is client-side dispatch — FastAPI is thin Gemini proxy; browser owns all filter state via `useExplorerStore.getState()`
- Gemini function call output must pass `validateFilterArgs` before any store dispatch
- Use `Virtuoso` (not `VirtuosoGrid`) — expert cards have variable height; use `padding` not `margin` on cards

### Pending Todos

- Set `ALLOWED_ORIGINS=https://tcs-three-sigma.vercel.app` in Railway environment variables (carried over from v1.1)
- Verify FTS5 availability on Railway SQLite at startup: `conn.execute(text("SELECT fts5('test')"))`

### Blockers/Concerns

- [Phase 18]: Gemini two-turn proxy pattern (FastAPI forwarding function call, frontend executing, second Gemini call for confirmation) has no official FastAPI+Gemini reference implementation. Validate during Phase 18 planning or early spike.

## Session Continuity

Last session: 2026-02-21
Stopped at: Completed 15-01-PLAN.md — Zustand three-slice store with persist middleware and MarketplacePage routing (STATE-01, STATE-02, STATE-03)
Resume file: None
