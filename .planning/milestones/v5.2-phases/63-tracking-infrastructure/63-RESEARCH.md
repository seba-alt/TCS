# Phase 63: Tracking Infrastructure - Research

**Researched:** 2026-03-04
**Domain:** Backend schema migration + frontend event enrichment
**Confidence:** HIGH

## Summary

Phase 63 adds an `email` column to the `user_events` table and enriches the frontend `trackEvent()` function to include the user's email when available. The project already has a well-established pattern for both idempotent startup migrations (see `main.py` lifespan) and the Zustand-persisted newsletter store (`nltrStore.ts`) where email is stored after gate submission.

The scope is narrow and well-bounded: one backend column + migration, one Pydantic model update, one router update, and one frontend function update. No new libraries, no new patterns, no new infrastructure.

**Primary recommendation:** Follow the existing `ALTER TABLE ... ADD COLUMN` startup migration pattern exactly as used for conversations, experts, and newsletter_subscribers. Read email from the Zustand store (`tinrate-newsletter-v1` localStorage key) rather than a separate `subscriber_email` key.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Email stored in `localStorage` under key `subscriber_email`
- `trackEvent()` reads `localStorage.getItem('subscriber_email')` on every call
- If key is missing or empty, sends `email: null`
- Phase 63 sets up the **read path only** — Phase 64 (gate) writes the email to localStorage on submission
- New top-level optional `email` field in the POST body to `/api/events`, alongside existing fields (session_id, event_type, etc.)
- Maps directly to the new `email` column on `user_events`
- Backend applies basic validation: must contain `@` and a dot if provided
- If validation fails, store the event with `email: null` (never reject/lose a tracking event)
- Response stays as-is (200 OK, fire-and-forget) — no changes to response body
- No backfill of pre-gate events in the same session — pre-gate events stay `email: null`, post-gate events include email
- No retroactive backfill of historical (pre-v5.2) events — existing rows stay `email: null`
- If user clears localStorage, events degrade gracefully back to `email: null` until re-gated

### Claude's Discretion
- Migration implementation details (raw SQL vs Alembic, exact startup hook)
- Index type on the email column
- Exact trackEvent() refactoring approach

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

**IMPORTANT NOTE — localStorage key reconciliation:**
The CONTEXT.md says `subscriber_email` but STATE.md has a later decision: "Gate writes exclusively to useNltrStore (tinrate-newsletter-v1) — no new localStorage key." The Zustand store (`nltrStore.ts`) already persists `email` inside the `tinrate-newsletter-v1` JSON blob. For Phase 63, `trackEvent()` should read from this existing Zustand store key rather than a separate `subscriber_email` key. This avoids creating a new localStorage key and stays consistent with the roadmap-level decision. The read approach is: `JSON.parse(localStorage.getItem('tinrate-newsletter-v1') || '{}')?.state?.email`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TRACK-01 | Backend stores email on `user_events` table (nullable indexed column, idempotent startup migration) | Existing migration pattern in `main.py` lifespan — use `ALTER TABLE user_events ADD COLUMN email VARCHAR(320)` with try/except, plus add `email` field to `UserEvent` model and `EventRequest` Pydantic model |
| TRACK-02 | Frontend `trackEvent()` includes user's email in every event after gate submission | Read email from `tinrate-newsletter-v1` localStorage key (Zustand persist store), pass as `email` field in POST body to `/api/events` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLAlchemy | (already in use) | ORM model for `email` column on `UserEvent` | Project standard — all models use SQLAlchemy mapped_column |
| Pydantic | (already in use) | Request validation for optional `email` field | Project standard — all FastAPI request models use Pydantic BaseModel |
| SQLite | (already in use) | Database storage | Project standard — `ALTER TABLE` for migrations |

### Supporting
No new libraries needed. All changes use existing dependencies.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw SQL ALTER TABLE | Alembic migrations | Alembic is overkill — project has 6+ existing ALTER TABLE migrations in lifespan, all using the same try/except pattern |
| Direct localStorage read | Import Zustand store in tracking.ts | tracking.ts is a plain module (not a React hook) — cannot use `useNltrStore()`. Direct localStorage read of the persisted JSON is correct |

## Architecture Patterns

### Pattern 1: Idempotent Startup Migration
**What:** Add column via `ALTER TABLE` in `main.py` lifespan, wrapped in try/except to handle "column already exists"
**When to use:** Adding columns to existing tables in SQLite (no Alembic in this project)
**Example (from existing codebase):**
```python
# From main.py lifespan — Phase 62.2 pattern
with engine.connect() as _conn:
    for _col_ddl in [
        "ALTER TABLE newsletter_subscribers ADD COLUMN session_id VARCHAR(64)",
    ]:
        try:
            _conn.execute(_text(_col_ddl))
            _conn.commit()
        except Exception:
            pass  # column already exists
```

### Pattern 2: Optional Pydantic Field (No extra='forbid')
**What:** Add optional field to existing Pydantic BaseModel — existing clients without the field continue to work
**When to use:** Extending API contracts without breaking existing callers
**Key finding:** `EventRequest` does NOT use `extra='forbid'`, so adding `email: str | None = None` is backward-compatible. The STATE.md blocker "Confirm EventRequest in events.py does NOT have extra='forbid'" is resolved — it does not.

### Pattern 3: Fire-and-Forget Tracking with localStorage Read
**What:** `trackEvent()` reads email from localStorage on every call (not from React state)
**When to use:** Module-level functions that can't access React hooks
**Key insight:** The Zustand persist middleware stores state as `{"state":{"subscribed":true,"email":"user@example.com"},"version":0}` under `tinrate-newsletter-v1`. Read via `JSON.parse(localStorage.getItem('tinrate-newsletter-v1') || '{}')?.state?.email || null`.

### Anti-Patterns to Avoid
- **Importing Zustand store in tracking.ts:** `trackEvent()` is a plain function, not a React component. Calling `useNltrStore.getState()` would work (Zustand supports this), but creates a tight coupling. Direct localStorage read is simpler and consistent with how `getSessionId()` already reads localStorage.
- **Rejecting events with invalid emails:** The requirement explicitly says "never reject/lose a tracking event." Always store with `email: null` if validation fails.
- **Creating a new localStorage key:** STATE.md says "no new localStorage key." Use the existing `tinrate-newsletter-v1` Zustand persist key.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email validation | Full RFC 5322 regex | Simple `@` + `.` check | Context decision: "must contain @ and a dot if provided" — don't over-engineer |
| Schema migration | Alembic setup | Existing try/except ALTER TABLE pattern | 6+ precedents in main.py — don't introduce a new migration tool |

## Common Pitfalls

### Pitfall 1: SQLite ALTER TABLE Index
**What goes wrong:** SQLite `ALTER TABLE ADD COLUMN` does not support adding an index inline
**Why it happens:** SQLite has limited ALTER TABLE support
**How to avoid:** Add column first, then `CREATE INDEX IF NOT EXISTS` as a separate statement
**Warning signs:** Migration error mentioning "near INDEX: syntax error"

### Pitfall 2: Pydantic Validation Rejecting Events
**What goes wrong:** If email validation is done via Pydantic `@field_validator` that raises, the entire event is rejected (422)
**Why it happens:** Pydantic validators raise ValidationError by default
**How to avoid:** Do email validation in the route handler, not in the Pydantic model. Or use a Pydantic validator that silently coerces to None on failure. The safest approach: accept `email: str | None = None` in the model, validate in the handler, set to None if invalid.

### Pitfall 3: Response Status Code Mismatch
**What goes wrong:** CONTEXT.md says "200 OK" but current endpoint returns 202 Accepted
**Why it happens:** CONTEXT.md was written before checking the codebase
**How to avoid:** Keep existing 202 status code — no changes to response behavior

## Code Examples

### Backend: UserEvent Model Update
```python
# app/models.py — add email column to UserEvent
class UserEvent(Base):
    __tablename__ = "user_events"
    __table_args__ = (
        Index("ix_user_events_type_created", "event_type", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    session_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    payload: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    email: Mapped[str | None] = mapped_column(String(320), nullable=True, index=True)  # Phase 63
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )
```

### Backend: EventRequest Model Update
```python
# app/routers/events.py — add optional email field
class EventRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=64)
    event_type: EVENT_TYPES
    payload: dict[str, Any] = Field(default_factory=dict)
    email: str | None = None  # Phase 63: optional, validated in handler
```

### Backend: Startup Migration
```python
# In main.py lifespan — after existing migrations
with engine.connect() as _conn:
    for _col_ddl in [
        "ALTER TABLE user_events ADD COLUMN email VARCHAR(320)",
    ]:
        try:
            _conn.execute(_text(_col_ddl))
            _conn.commit()
        except Exception:
            pass  # column already exists
    # Index must be separate statement for SQLite
    try:
        _conn.execute(_text("CREATE INDEX IF NOT EXISTS ix_user_events_email ON user_events (email)"))
        _conn.commit()
    except Exception:
        pass
```

### Backend: Email Validation in Handler
```python
def _validate_email(email: str | None) -> str | None:
    """Basic validation: must contain @ and a dot. Returns None if invalid."""
    if not email:
        return None
    if "@" not in email or "." not in email:
        return None
    return email.strip().lower()
```

### Frontend: trackEvent with Email Enrichment
```typescript
// frontend/src/tracking.ts
function getSubscriberEmail(): string | null {
  try {
    const raw = localStorage.getItem('tinrate-newsletter-v1')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.state?.email || null
  } catch {
    return null
  }
}

export function trackEvent(event_type: EventType, payload: TrackPayload = {}): void {
  const session_id = getSessionId()
  const email = getSubscriberEmail()
  void fetch(`${API_BASE}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ session_id, event_type, payload, email }),
  })
}
```

## State of the Art

No state-of-the-art changes relevant. All technologies are stable and well-established in this project.

## Open Questions

1. **CONTEXT.md vs STATE.md localStorage key conflict**
   - What we know: CONTEXT.md says `subscriber_email`, STATE.md says "no new localStorage key" and gate writes to `useNltrStore` (`tinrate-newsletter-v1`)
   - Recommendation: Use the Zustand persist key (`tinrate-newsletter-v1`) — it already contains the email. The STATE.md roadmap decision supersedes the CONTEXT.md discussion decision. The planner should follow the Zustand store approach.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 (frontend only) |
| Config file | Inferred from package.json scripts |
| Quick run command | `cd frontend && npx vitest run` |
| Full suite command | `cd frontend && npx vitest run` |
| Estimated runtime | ~5 seconds |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRACK-01 | Backend stores email on user_events (nullable, indexed, idempotent migration) | manual-only | Deploy to Railway and verify via admin DB | N/A — no backend test framework |
| TRACK-02 | Frontend trackEvent() includes email after gate submission | unit | `cd frontend && npx vitest run src/tracking.test.ts` | No — Wave 0 gap |

### Nyquist Sampling Rate
- **Minimum sample interval:** After every committed task -> TypeScript compilation check: `cd frontend && npx tsc --noEmit`
- **Full suite trigger:** Before final task commit: `cd frontend && npx vitest run`
- **Phase-complete gate:** Full frontend suite green + manual deployment verification
- **Estimated feedback latency per task:** ~5 seconds

### Wave 0 Gaps (must be created before implementation)
- [ ] `frontend/src/tracking.test.ts` — covers TRACK-02 (trackEvent includes email from localStorage)
- No backend test framework — TRACK-01 verified manually via deployment

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `app/models.py` (UserEvent model), `app/routers/events.py` (EventRequest + handler), `app/main.py` (migration patterns), `frontend/src/tracking.ts` (trackEvent), `frontend/src/store/nltrStore.ts` (Zustand email store)
- `.planning/STATE.md` (project decisions)
- `.planning/phases/63-tracking-infrastructure/63-CONTEXT.md` (user decisions)

### Secondary (MEDIUM confidence)
None needed — all findings from direct codebase inspection.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all existing project dependencies, no new libraries
- Architecture: HIGH - follows 6+ existing migration precedents in main.py
- Pitfalls: HIGH - identified from direct codebase analysis

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable — no fast-moving dependencies)
