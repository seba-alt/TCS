# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** A user describes any problem and instantly gets expertly matched professionals they can browse, filter, and contact — no searching, no guesswork.
**Current focus:** Phase 33 — Command Center Header (complete) — Phase 34 Admin Platform Restructure is next

## Current Position

Phase: 33 of 33+ (Command Center Header) — COMPLETE
Plan: 2 of 2 in current phase (33-01 + 33-02 complete, human-verified)
Status: All Phase 33 requirements live and verified — Command Center Header deployed to Vercel
Last activity: 2026-02-23 — 33-02 complete, human verification passed

Progress: [████████████████████] 58/58 plans | v2.4 complete

## Live URLs

| Service | URL |
|---------|-----|
| Railway (backend) | https://web-production-fdbf9.up.railway.app |
| Vercel (frontend) | https://tcs-three-sigma.vercel.app |

## Performance Metrics

**Velocity:**
- Total plans completed: 54
- Average duration: ~15 min

| Phase-Plan | Duration | Tasks | Files |
|------------|----------|-------|-------|
| 31-01 | 2 min | 2 | 1 |
| 31-02 | 2 min | 3 | 5 |
| 32-01 | 3 min | 1 | 1 |
| 32-02 | 3 min | 2 | 5 |
| Phase 32 P03 | 25 | 4 tasks (2 planned + 2 bug fixes) | 6 files |
| 33-01 | 15 min | 2 | 2 |
| 33-02 | 10 min | 3 (incl. human-verify) | 2 |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

**Phase 29 key findings:**
- `motion.div` glow wrapper confirmed working alongside inner `motion.button` scale gestures — no conflict
- prevFilterKey initialized to `null` (not `filterKey`) to cleanly skip first-render glow
- prevStreamingRef pattern works cleanly for detecting isStreaming false transitions

**Phase 30-01 key decisions:**
- UserEvent uses Pydantic Literal for event_type validation (card_click, sage_query, filter_change) — 422 on unknown values without extra code
- payload stored as JSON string in Text column — flexible shape per event_type for Phase 31 aggregation
- POST /api/events returns 202 Accepted, no auth — fire-and-fire pattern, no sensitive data

**Phase 30-02 key decisions:**
- trackEvent() is a module function (not hook) — callable from async handlers and non-component code without React rules
- expert_ids omitted from sage_query payload — not in PilotResponse yet; Phase 31 uses result_count/zero_results
- TagMultiSelect tracks ADD-only events — remove events are noise for demand signal analysis
- RateSlider uses onValueCommit (drag-end) not onValueChange (per-tick) — avoids flooding events table

**Phase 31 key decisions:**
- All 5 marketplace intelligence endpoints added to existing router object — inherits _require_admin, no main.py changes needed
- json_extract boolean comparisons use = 1 not = true — SQLite stores JSON booleans as integers
- Custom downloadMarketplaceCsv helper instead of extending useAdminExport — keeps AdminMarketplacePage self-contained without modifying shared hook ExportSection type
- AdminSidebar slice updated (0,3)/(3+) to (0,4)/(4+) — Marketplace inserted at Analytics index 2, between Searches and Gaps
- TrendSection uses useMarketplaceTrend() with no days param (fixed 14d) — only demand/exposure tables respond to page-level dropdown

**Phase 32-01 key decisions:**
- Only primary result.experts serialized — fallback variable experts excluded from response (fallback used for narration only, not grid population)
- Zero-result paths produce experts: [] automatically — result.experts is already [] from run_explore(), no special casing needed
- No PilotResponse schema changes needed — existing `experts: list[dict] | None = None` field already accepts serialized list

**Phase 32-02 key decisions:**
- sageMode is NOT added to partialize allowlist — ephemeral display state must reset to false on page refresh
- setSortBy intentionally does NOT call setSageMode(false) — sorting Sage results is valid without exiting sage mode
- useExplore guard is the FIRST statement in useEffect (before abort/setLoading) to prevent loading flash
- store.setLoading(false) called before store.setResults in useSage to avoid skeleton flash from mid-flight prior fetch

**Phase 32-03 key decisions:**
- motion.img always in DOM with animate={{ opacity }} for smooth sage icon fade — avoids abrupt conditional render
- Sage confirmation handlers call setQuery/setRateRange directly — setSageMode(false) fires internally via filterSlice, no double-calling
- total = len(scored) for text queries — pre-filter pool (len(filtered_experts)) is the full DB when no rate/tag filters active; only scored experts are meaningful results
- Pure filter mode total = len(filtered_experts) — all filtered experts ARE the results there, no FAISS/BM25 scoring
- Abort controllerRef.current when sageMode becomes true — previous guard prevented new fetch but mid-flight .then() still called setResults(), overwriting sage results

**Phase 33-01 key decisions:**
- Easter egg (tinrate) fires on every match — no one-shot guard, always rewarding per CONTEXT.md
- particlePositions stored in useRef so positions are stable and not regenerated on re-renders
- springCount subscription cleanup via returned unsub function in useEffect to avoid stale listeners
- Placeholder rotation useEffect includes `localValue` in dep array so it re-evaluates pause condition when input changes

**Phase 33-02 key decisions:**
- No props passed to `<Header />` — zero-prop interface, reads from Zustand store directly
- SearchInput.tsx deleted outright — no dead-code stub kept, FilterSidebar confirmed search-free before deletion

### Pending Todos

- Set `ALLOWED_ORIGINS=https://tcs-three-sigma.vercel.app` in Railway environment variables (carried over from v1.1)
- Verify FTS5 availability on Railway SQLite at startup

### Blockers/Concerns

None active.

## Session Continuity

Last session: 2026-02-23
Stopped at: Completed Phase 33 — Command Center Header live and human-verified on https://tcs-three-sigma.vercel.app
Resume signal: Phase 33 complete. Phase 34 (Admin Platform Restructure) is next.
