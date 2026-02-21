# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** A user describes any problem and instantly gets three expertly matched professionals they can contact — no searching, no filtering, no guesswork.
**Current focus:** Phase 14 — Hybrid Search Backend

## Current Position

Phase: 14 of 19 (Hybrid Search Backend)
Plan: 0 of ? in current phase
Status: Ready to plan
Last activity: 2026-02-21 — v2.0 roadmap created; phases 14-19 defined; ready to plan Phase 14

Progress: [██████████░░░░░░░░░░] ~50% (v1.0–v1.2 complete, v2.0 not started)

## Live URLs

| Service | URL |
|---------|-----|
| Railway (backend) | https://web-production-fdbf9.up.railway.app |
| Vercel (frontend) | https://tcs-three-sigma.vercel.app |

## Performance Metrics

**Velocity:**
- Total plans completed: 38 (phases 1-13)
- Average duration: ~15 min

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

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
Stopped at: v2.0 roadmap created — Phase 14 ready to plan
Resume file: None
