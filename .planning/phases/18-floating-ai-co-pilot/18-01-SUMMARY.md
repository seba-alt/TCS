---
plan: "18-01"
phase: "18-floating-ai-co-pilot"
status: complete
wave: 1
completed: "2026-02-21"
---

## Summary

Created the FastAPI backend pilot service enabling Sage co-pilot via two-turn Gemini function calling.

## What Was Built

### Task 1: pilot_service.py — Two-turn Gemini function calling
- `app/services/pilot_service.py` created with `APPLY_FILTERS_DECLARATION` (query, rate_min, rate_max, tags, reset parameters)
- `run_pilot()` function: Turn 1 extracts `apply_filters` structured args, Turn 2 sends function result back and gets Sage's confirmation text
- Lazy-init `_get_client()` pattern (same as llm.py and embedder.py)
- Error handling: network failures return graceful fallback messages, not 500s

### Task 2: pilot.py router + main.py registration
- `app/routers/pilot.py` created with `POST /api/pilot` endpoint
- `PilotRequest` model: `message` (str, 1-2000 chars), `history` (list of HistoryItem), `current_filters` (dict)
- `HistoryItem` uses `Literal["user", "model"]` — Gemini roles, not 'assistant'
- `PilotResponse` model: `filters` (dict | None) + `message` (str)
- `run_in_executor` async wrapper (identical pattern to explore.py — non-blocking)
- `app/main.py` updated: `pilot` added to imports and `app.include_router(pilot.router)` added

## Key Files

- **Created**: `app/services/pilot_service.py`
- **Created**: `app/routers/pilot.py`
- **Modified**: `app/main.py` (import + include_router)

## Verification

- `python3 -c "from app.routers.pilot import router; from app.services.pilot_service import run_pilot; print('imports OK')"` → `imports OK`
- `grep -n "api/pilot" app/routers/pilot.py` → route declaration present
- `grep -n "pilot" app/main.py` → both import and include_router lines present
- All three key identifiers present in pilot_service.py: `run_pilot`, `APPLY_FILTERS_DECLARATION`, `function_calls`

## Self-Check: PASSED

All tasks complete. Backend pilot endpoint created and registered. Imports verified without error.
