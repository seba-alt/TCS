---
plan: 28-01
phase: 28-sage-search-engine
status: complete
completed: 2026-02-22
---

# Summary: Backend search_experts Tool for Sage Pilot Service

## What Was Built

Added `search_experts` as a second Gemini FunctionDeclaration to the pilot service, enabling Sage to discover experts from scratch (not just refine existing results). Updated `pilot.py` to inject `db` and `app_state` into `run_pilot()`, and rewrote `pilot_service.py` to route function calls by name with full zero-result fallback logic.

## Tasks Completed

| # | Task | Status |
|---|------|--------|
| 1 | Inject db + app_state into pilot.py router | ✓ |
| 2 | Add search_experts declaration + handler to pilot_service.py | ✓ |

## Key Decisions

- `_handle_search_experts()` calls `run_explore()` directly (in-process Python import, no HTTP self-call)
- Zero-result with fallback: `filters=None` (grid stays, Sage narrates alternative)
- Double-zero fallback: `filters={"reset": True}` (grid resets to all experts)
- `fn_call.name` logged in every pilot request for Railway verification
- `args = dict(fn_call.args)` unwraps protobuf Struct before use (defensive)
- `float()` and `list()` casting on protobuf nested types (rate_min, tags)

## Artifacts

### key-files.created
- `app/routers/pilot.py` — Updated with Request + Depends(get_db), PilotResponse extended with search_performed/total/experts
- `app/services/pilot_service.py` — SEARCH_EXPERTS_DECLARATION, _handle_search_experts(), _handle_apply_filters() refactored, run_pilot() extended

## Verification Results

- `python3 -c "from app.routers.pilot import router"` → OK
- `python3 -c "from app.services.pilot_service import run_pilot, SEARCH_EXPERTS_DECLARATION"` → OK
- `grep "fn_call.name" app/services/pilot_service.py` → fn_name logged in all paths
- `grep "from app.services.explorer import run_explore" app/services/pilot_service.py` → confirmed direct import
- `grep "search_performed" app/services/pilot_service.py` → confirmed in all return dicts

## Self-Check: PASSED
