---
phase: 30
phase_name: Behavior Tracking
status: complete
researched: 2026-02-22
---

# Phase 30 Research: Behavior Tracking

## Backend — ORM Model Pattern

`app/models.py` shows the exact pattern for new models:
- Uses `Mapped[type]` + `mapped_column(...)` syntax (SQLAlchemy 2.x declarative)
- `datetime.datetime.utcnow` (function reference, no parentheses) as `default=`
- `Base.metadata.create_all(bind=engine)` is called at lifespan startup in `app/main.py` — NEW tables are created automatically; no migration needed
- No FK constraints on any existing model — follow same style for `UserEvent`

Composite index pattern not in current codebase — will add via `__table_args__` with `Index()`.

## Backend — Router Pattern

`app/routers/feedback.py` is the canonical template for the events router:
- `router = APIRouter()` (plain, no prefix, no dep)
- `@router.post("/api/feedback", status_code=200)` — status_code inline
- `db: Session = Depends(get_db)` injection
- Pydantic model with `Literal["up", "down"]` for allowlist validation → 422 on invalid
- structlog for `log.info(...)` after DB commit
- Simple `db.add(record)` → `db.commit()` pattern

For events: use `status_code=202`, Pydantic `Literal["card_click", "sage_query", "filter_change"]` on `event_type` field, no auth required.

## Backend — Router Registration

`app/main.py` pattern:
```python
from app.routers import events   # new import
app.include_router(events.router)
```
Must be added alongside existing router includes.

## Frontend — ExpertCard (marketplace variant)

`frontend/src/components/marketplace/ExpertCard.tsx` — this is the card used in the live grid.
- `onViewProfile` prop: `(url: string) => void`
- Tracking injection point: inside the `onClick` handler at line 76-79:
  ```tsx
  onClick={(e) => {
    e.stopPropagation()
    onViewProfile(expert.profile_url)  // ← inject trackEvent BEFORE this call
  }}
  ```
- `expert.username` is the stable ID (unique, indexed in DB)
- Context prop: `ExpertCard` doesn't know its context (grid vs sage_panel) — must be passed as a new prop `context: 'grid' | 'sage_panel'`

## Frontend — ExpertCard prop chain

`MarketplacePage.tsx` → `ExpertGrid` → `ExpertCard`:
- `handleViewProfile(url: string)` is defined in `MarketplacePage.tsx` (line 63-70)
- This is where `card_click` tracking could also be placed, but it only receives `url` not `expert` — so `context: 'grid'` must be added to ExpertCard prop instead, and tracking fires inside ExpertCard itself
- Alternatively: update `onViewProfile` signature to `(expert: Expert, context: string) => void` — but this requires changing ExpertGrid and MarketplacePage too
- Cleanest approach: add `context` prop to `ExpertCard`, call `trackEvent` inside `onClick` before `onViewProfile` — no signature changes needed upstream

## Frontend — useSage.ts injection point

`frontend/src/hooks/useSage.ts` — `sage_query` event emitted AFTER pilot response:
- Emit after `data` is received and before `addMessage()` (success path, lines 134-140)
- Fields available at that point:
  - `text.trim()` → query_text
  - `data.search_performed` → function_called (`search_experts` or `apply_filters`)
  - `data.total` → result_count (may be undefined for apply_filters path)
  - No expert_ids in current response — need to add `experts?: Expert[]` to the data type or pass `expert_ids` from backend
- Note: `data.search_performed` is the exact discriminator; use ternary: `data.search_performed ? 'search_experts' : 'apply_filters'`

## Frontend — filterSlice actions (tracking hooks)

`frontend/src/store/filterSlice.ts`:
- `setQuery(q)` → string query filter — debounce 1000ms
- `setRateRange(min, max)` → rate filter — fire on mouse/touch up only (not per drag tick)
- `setTags(tags)` / `toggleTag(tag)` → tag filter — fire on set
- Filter tracking: wrap filter actions in `filterSlice` OR instrument at the call sites in UI components
- Best approach: instrument at call sites in the filter UI components (SearchInput, RateSlider, TagFilter) so we can capture result count at settled time from the store — NOT by wrapping filterSlice actions (which don't have result count context)

## Frontend — Session Identity

CONTEXT.md decision: `session_id` in `localStorage`, UUID v4 generated on first visit.
- Use `crypto.randomUUID()` (available in all modern browsers, no deps needed)
- Key: `tcs_session_id`
- Email from `nltrStore.subscribed` email or `localStorage.tcs_gate_email` or `localStorage.tcs_email_unlocked` — but these store only boolean/email; email value from newsletter gate is stored separately

Looking at MarketplacePage.tsx: email is not directly accessible in JS state — `subscribed` is boolean in nltrStore. The profile gate email is stored in `localStorage` by the gate modal. For tracking, `session_id` is sufficient; email patching is a Phase 30 CONTEXT decision but adds complexity. The CONTEXT.md explicitly calls this "Claude's Discretion" whether to implement the patch endpoint.

Decision: implement session_id only (no email patch endpoint) — keeps the plan to 2 tasks as specified in ROADMAP.md. Email attribution can be added post-ship if needed.

## Frontend — Filter Tracking: Where to Call

Filter tracking fires at 3 filter settled points:
1. Query: `SearchInput.tsx` onChange → debounce 1000ms
2. Rate: Rate slider `onMouseUp`/`onTouchEnd` only
3. Tags: `toggleTag` click in TagFilter component

Need to read `SearchInput.tsx` and rate slider component to find exact injection points.

## Key Constraints (from STATE.md + ROADMAP.md)

- `UserEvent` NEW table — `create_all` handles it; no ALTER TABLE
- Event types allowlist: `card_click`, `sage_query`, `filter_change` — Pydantic Literal rejects others with 422
- `trackEvent()` module function (not hook), `fetch` + `keepalive: true`, always `void fetch(...)` — NEVER `await`
- Filter tracking: debounced 1000ms; rate slider on drag-end only
- `useSage` emits `sage_query` with explicit `function_called` from `data.search_performed`
- Composite index on `(event_type, created_at)` in UserEvent model
- Verify `user_events` table creation in Railway logs within 60s of first deploy
- `POST /api/events` returns 202, no auth, rejects unknown event_type with 422

## Files to Modify (Plan 30-01 — Backend)

- `app/models.py` — add `UserEvent` model
- `app/routers/events.py` — NEW file, events router
- `app/main.py` — register events router

## Files to Modify (Plan 30-02 — Frontend)

- `frontend/src/tracking.ts` — NEW file, `trackEvent()` module function
- `frontend/src/components/marketplace/ExpertCard.tsx` — add `context` prop, call `trackEvent` on click
- `frontend/src/hooks/useSage.ts` — emit `sage_query` after pilot response
- Filter UI components (SearchInput, RateSlider/FilterSidebar) — emit `filter_change` on settled state
