---
plan: 25-01
phase: 25-admin-intelligence-metrics
status: complete
completed: 2026-02-22
---

# Summary: OTR@K Backend + /api/admin/intelligence Endpoint

## What Was Built

Added end-to-end OTR@K (On-Topic Rate at K) instrumentation to the backend:

1. **DB Migration** — `ALTER TABLE conversations ADD COLUMN otr_at_k REAL` added to the idempotent lifespan startup migration block in `app/main.py`. Safe to run on every startup.

2. **ORM Field** — `otr_at_k: Mapped[float | None] = mapped_column(Float, nullable=True)` added to the `Conversation` model in `app/models.py`, placed near other analytics fields.

3. **Chat Pipeline Instrumentation** — After retrieval in `app/routers/chat.py`, computes the fraction of top-10 candidates scoring >= 0.60. Writes `None` when zero candidates (prevents ZeroDivisionError). Value written to the Conversation row before `db.commit()`. Not included in any SSE response payload.

4. **Admin Endpoint** — `GET /api/admin/intelligence` added to the admin `router` (protected by `_require_admin`). Returns:
   - `otr.rolling_avg_7d`: 7-day rolling average OTR@K (float or null)
   - `otr.query_count_7d`: count of conversations with non-null otr_at_k in last 7 days
   - `index_drift.last_rebuild_at`: Unix timestamp of last FAISS rebuild (from `_ingest` dict)
   - `index_drift.expert_count_at_rebuild`: expert count at rebuild time
   - `index_drift.current_expert_count`: current metadata length
   - `index_drift.expert_delta`: difference (null if no rebuild recorded)

## Key Files

- `app/main.py` — otr_at_k DDL in migration block
- `app/models.py` — otr_at_k ORM field on Conversation
- `app/routers/chat.py` — OTR@K computation + persistence
- `app/routers/admin.py` — GET /api/admin/intelligence endpoint

## Commits

- `feat(25-01/task-1): add otr_at_k column migration and ORM field`
- `feat(25-01/task-2): compute and persist otr_at_k in chat pipeline`
- `feat(25-01/task-3): add GET /api/admin/intelligence endpoint`

## Deviations

None. Implemented exactly as specified in the plan.

## Self-Check

- [x] otr_at_k column migration in main.py lifespan startup block (idempotent try/except)
- [x] Conversation ORM model has otr_at_k: Mapped[float | None] field
- [x] chat.py computes otr_at_k (None on zero results, float 0.0-1.0 otherwise) and writes to conversation row
- [x] GET /api/admin/intelligence endpoint exists on admin router with _require_admin dependency
- [x] Endpoint returns correct JSON shape with otr and index_drift keys
- [x] No otr_at_k value exposed in any public API response
- [x] All modified Python files pass syntax check
