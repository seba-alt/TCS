---
phase: 27-newsletter-gate-easter-egg
plan: "01"
subsystem: backend-newsletter + frontend-store
tags: [newsletter, zustand, fastapi, sqlalchemy, sqlite, admin]
dependency_graph:
  requires: []
  provides: [newsletter-subscribe-endpoint, admin-newsletter-endpoints, useNltrStore]
  affects: [app/models.py, app/routers/newsletter.py, app/routers/admin.py, app/main.py, frontend/src/store/nltrStore.ts]
tech_stack:
  added: []
  patterns: [on_conflict_do_nothing, zustand-persist-partialize, streaming-csv-response]
key_files:
  created:
    - app/routers/newsletter.py
    - frontend/src/store/nltrStore.ts
  modified:
    - app/models.py
    - app/routers/admin.py
    - app/main.py
decisions:
  - "Persist key locked to 'tinrate-newsletter-v1' — matches planning notes constraint"
  - "spinTrigger excluded from partialize — ephemeral UI state must reset on page load"
  - "newsletter router placed with public routers (email_capture, explore, chat) not admin router"
metrics:
  duration: "~2 min"
  completed: "2026-02-22"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 5
---

# Phase 27 Plan 01: Newsletter Foundation (Backend + Store) Summary

**One-liner:** SQLAlchemy `NewsletterSubscriber` model, idempotent subscribe endpoint, admin CSV export, and Zustand persist store with `tinrate-newsletter-v1` key.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | NewsletterSubscriber model + subscribe endpoint + main.py wiring | 523a854 | app/models.py, app/routers/newsletter.py, app/main.py |
| 2 | Admin newsletter endpoints (subscriber list + CSV export) | 0eb605c | app/routers/admin.py |
| 3 | useNltrStore standalone Zustand persist store | f4032e3 | frontend/src/store/nltrStore.ts |

## What Was Built

### Backend

**`app/models.py`** — Added `NewsletterSubscriber` ORM model:
- Table: `newsletter_subscribers`
- Fields: `id`, `email` (unique, indexed), `source` (default "gate"), `created_at`
- Auto-created by `Base.metadata.create_all()` at startup — no migration script needed

**`app/routers/newsletter.py`** — New public router:
- `POST /api/newsletter/subscribe` — accepts `{email, source}`, stores subscriber, returns `{"status": "ok"}`
- Uses SQLite `on_conflict_do_nothing` for idempotency (duplicate emails silently ignored)
- Follows `email_capture.py` pattern exactly

**`app/routers/admin.py`** — Two new admin endpoints (both guarded by `_require_admin` dependency):
- `GET /api/admin/newsletter-subscribers` — returns `{count, subscribers[{email, created_at, source}]}`
- `GET /api/admin/export/newsletter.csv` — returns CSV download with metadata header rows

**`app/main.py`** — Newsletter router included alongside other public routers:
```python
from app.routers import admin, chat, email_capture, feedback, health, explore, newsletter, pilot, suggest
app.include_router(newsletter.router)
```

### Frontend

**`frontend/src/store/nltrStore.ts`** — Standalone Zustand persist store:
- Persist key: `'tinrate-newsletter-v1'` (locked — must not change)
- `partialize` includes only `subscribed` and `email` — `spinTrigger` excluded (ephemeral)
- Actions: `setSubscribed(email)`, `triggerSpin()`, `resetSpin()`
- Does NOT touch `useExplorerStore`, `store/index.ts`, or any existing store slices

## Verification Results

```
python3 -c "from app.routers.newsletter import router; from app.routers.admin import router as ar; print('imports ok')"
# → imports ok

python3 -c "from app.models import NewsletterSubscriber; print(NewsletterSubscriber.__tablename__)"
# → newsletter_subscribers

python3 -c "from app.routers.admin import router; routes = [r.path for r in router.routes]; print([r for r in routes if 'newsletter' in r])"
# → ['/api/admin/newsletter-subscribers', '/api/admin/export/newsletter.csv']

npx tsc --noEmit --project tsconfig.json 2>&1 | grep nltrStore
# → (no output — no TypeScript errors)
```

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `app/routers/newsletter.py` exists
- [x] `frontend/src/store/nltrStore.ts` exists
- [x] Commits 523a854, 0eb605c, f4032e3 all exist in git log
- [x] `newsletter_subscribers` table name confirmed
- [x] `tinrate-newsletter-v1` persist key present
- [x] `partialize` excludes `spinTrigger`

## Self-Check: PASSED
