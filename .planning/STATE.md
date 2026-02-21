# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21 after v2.0 milestone start)

**Core value:** A user describes any problem and instantly gets three expertly matched professionals they can contact — no searching, no filtering, no guesswork.
**Current focus:** v2.0 Extreme Semantic Explorer — defining requirements

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-02-21 — Milestone v2.0 started (24 requirements across 6 categories defined)

## Live URLs

| Service | URL |
|---------|-----|
| Railway (backend) | https://web-production-fdbf9.up.railway.app |
| Vercel (frontend) | https://tcs-three-sigma.vercel.app |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

Key v2.0 research findings (from .planning/research/):
- Use `Virtuoso` (not `VirtuosoGrid`) — expert cards have variable height
- `AnimatePresence` exit animations incompatible with react-virtuoso — use entry-only on cards
- FTS5 `AFTER UPDATE` triggers must capture old values before update or index silently corrupts — use old/new value pattern
- Zustand persist must use `partialize` from day one — results array will overflow localStorage
- FAISS `IDSelectorBatch` safe for search-time pre-filtering; `remove_ids()` is destructive — never call it
- Gemini function calls must be validated client-side (`validateFilterArgs`) before touching Zustand store
- FAISS positional IDs (0–N-1) ≠ Expert.id values — `username_to_faiss_pos` mapping required at startup
- OKLCH in Tailwind v3: use arbitrary value syntax `bg-[oklch(...)]` — no plugin needed, no v4 upgrade
- FTS5 needs `rebuild` command after creating virtual table on existing populated experts table
- Co-pilot uses client-side function call execution: FastAPI is thin Gemini proxy; browser dispatches to `useExplorerStore.getState()`

### Pending Todos

- Set `ALLOWED_ORIGINS=https://tcs-three-sigma.vercel.app` in Railway environment variables (carried over from v1.1)
- Verify FTS5 availability on Railway SQLite at startup: `conn.execute(text("SELECT fts5('test')"))`

### Blockers/Concerns

None currently.

## Session Continuity

Last session: 2026-02-21
Stopped at: v2.0 milestone initialized — 24 requirements defined, roadmap creation in progress
Resume file: None
