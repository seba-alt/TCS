# Phase 6: Thumbs up/down feedback — Research

**Researched:** 2026-02-20
**Domain:** React UI feedback widget + FastAPI REST endpoint + SQLAlchemy ORM
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Feedback UI placement & visibility**
- Thumbs appear **below the expert cards block** — after the user has seen all three experts
- Only the **most recent result set** gets thumbs; earlier exchanges in a conversation do not show voting controls
- Thumbs are **always visible** (not hover-to-reveal), but color in / fill when the user hovers over them — keep them small and unobtrusive
- A **subtle label** sits above the thumbs (e.g. "Were these results helpful?") to orient the user

**Downvote suggestion sheet**
- Clicking thumbs-down opens a **centered modal dialog** overlay
- Modal contains **preset checkboxes + an optional free-text field** — Claude picks 3–4 sensible reasons (e.g. "Wrong experts shown", "Experts not relevant to my problem", "Experts seem unavailable", "Other")
- **Submitting the form is optional** — the thumbs-down vote is recorded the moment the thumb is clicked; the modal collects extra detail but closing without submitting is fine

**Feedback state & interaction**
- After voting, the **selected thumb stays highlighted** (filled/colored) — no extra confirmation text needed
- Users **can switch** their vote by clicking the other thumb (thumbs-up → thumbs-down or vice versa)
- Clicking the **already-selected thumb does nothing** — no deselect/unvote behaviour
- Vote state is **not persisted across page reloads** — fresh state each session; the DB record stands but the UI resets

**Data captured in DB**
- Each feedback record is **linked to conversation_id** so it can be traced back to the exact query
- The **expert IDs shown** in that result set are stored with the feedback record (enables future analysis)
- **Email is included if available** — pulled from the email gate submission if the user already provided one
- API endpoint approach: **Claude's discretion** — likely `POST /api/feedback`, consistent with the existing REST structure

### Claude's Discretion
- Exact checkbox reasons in the suggestion modal (pick 3–4 sensible ones)
- Thumb icon style (SVG icons or emoji-based — match existing Tinrate brand)
- Hover/active color for the thumb buttons
- Exact label wording above the thumbs
- API endpoint naming and request schema

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

Phase 6 adds a lightweight feedback widget below each expert result set. The implementation divides cleanly into three areas: (1) a backend DB table + REST endpoint, (2) a React feedback widget with thumb buttons and hover states, and (3) a modal dialog for downvote detail collection.

The most important architectural decision is that `conversation_id` must be surfaced to the frontend. Currently the SSE stream does NOT include `conversation_id` — the `chat.py` router logs it server-side only. The `result` SSE event must be extended to carry the conversation ID so the frontend can attach it to feedback submissions. This is the single cross-cutting change that touches existing code.

Everything else is additive: a new `Feedback` SQLAlchemy model, a new `POST /api/feedback` router, a new `FeedbackBar` React component, a new `useFeedback` hook, and a `DownvoteModal` dialog component. The modal requires no new dependencies — the project already uses Tailwind and React 19; a native `<dialog>` element or a simple portaled `<div>` with Tailwind backdrop styles is sufficient.

**Primary recommendation:** Add `conversation_id` to the SSE `result` event first (single-line backend change), then build the rest as net-new files with no modification to existing components except `ChatMessage.tsx` (to render `FeedbackBar` below the expert cards on the last expert message).

---

## Standard Stack

### Core (already installed — no new dependencies required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.0 | UI components, state, hooks | Already in use; `useState` + `useCallback` pattern established |
| Tailwind CSS | 3.4.x | Styling thumb buttons, modal overlay | Already in use; brand token `brand-purple` (#5128F2) defined |
| FastAPI | 0.129.x | New `POST /api/feedback` router | Already the API framework |
| SQLAlchemy | 2.0.x | `Feedback` ORM model | Already the ORM; `Mapped`/`mapped_column` pattern established |
| Pydantic | 2.12.x | Request validation for feedback body | Already used on all endpoints |

### No New Dependencies

This phase requires **zero new npm or pip packages**. The existing stack covers all needs:
- Modal: native React state + Tailwind (`fixed inset-0 bg-black/50`) — no `@headlessui/react` or `radix-ui` needed
- Thumb icons: inline SVG (same pattern as ExpertCard's external-link icon) — no icon library
- DB: existing SQLAlchemy + SQLite setup; `Base.metadata.create_all` auto-creates new table at startup

**Installation:**
```bash
# No new packages required
```

---

## Architecture Patterns

### Critical Gap: conversation_id Not in SSE Stream

The `conversation_id` is assigned at DB commit time in `chat.py` (`conversation.id`), but the `result` SSE event currently only contains `type`, `narrative`, and `experts`. The frontend has no way to know the conversation ID.

**Fix required in `app/routers/chat.py`:**
```python
# Current result event (line 120–126):
yield _sse({
    "event": "result",
    "type": llm_response.type,
    "narrative": llm_response.narrative,
    "experts": experts_payload,
})

# Must become:
yield _sse({
    "event": "result",
    "type": llm_response.type,
    "narrative": llm_response.narrative,
    "experts": experts_payload,
    "conversation_id": conversation.id,   # <-- add this line
})
```

The `Message` type in `types.ts` must also be extended to carry `conversation_id`:
```typescript
export interface Message {
  id: string
  role: MessageRole
  content: string
  experts?: Expert[]
  conversationId?: number     // from SSE result event, only on assistant recommendation messages
  isStreaming?: boolean
}
```

And `useChat.ts` must read `conversation_id` from the `result` event and store it on the message:
```typescript
} else if (event.event === 'result') {
  const narrative = event.narrative as string
  const experts = (event.experts ?? []) as Expert[]
  const conversationId = event.conversation_id as number | undefined

  updateLastAssistantMessage((msg) => ({
    ...msg,
    content: narrative,
    experts: experts.length > 0 ? experts : undefined,
    conversationId,
    isStreaming: true,
  }))
```

### Recommended File Structure

```
app/
├── models.py              # Add Feedback model
├── routers/
│   ├── chat.py            # Add conversation_id to result SSE event
│   ├── feedback.py        # NEW — POST /api/feedback
│   └── ...
frontend/src/
├── types.ts               # Add conversationId to Message, add FeedbackVote type
├── components/
│   ├── FeedbackBar.tsx    # NEW — thumb buttons + label
│   ├── DownvoteModal.tsx  # NEW — centered modal with checkboxes + free text
│   └── ChatMessage.tsx    # Modified — render FeedbackBar below expert cards
├── hooks/
│   └── useFeedback.ts     # NEW — vote state management + API call
```

### Pattern 1: FeedbackBar Component

Rendered below the expert cards block, only on the last expert message (`isLastExpertMessage` flag already exists and is threaded through from `App.tsx` → `ChatMessage.tsx`).

```typescript
// frontend/src/components/FeedbackBar.tsx
interface Props {
  conversationId: number
  expertIds: string[]           // profile_url values used as stable IDs
  email: string | null
}
```

The `FeedbackBar` renders:
1. A small label: `"Were these results helpful?"`
2. A thumbs-up button
3. A thumbs-down button

Vote state lives in `useFeedback` hook, not in the component.

### Pattern 2: useFeedback Hook

```typescript
// frontend/src/hooks/useFeedback.ts
export type FeedbackVote = 'up' | 'down' | null

interface UseFeedbackOptions {
  conversationId: number
  expertIds: string[]
  email: string | null
}

interface UseFeedbackReturn {
  vote: FeedbackVote
  submitVote: (v: 'up' | 'down') => void
  openModal: boolean
  closeModal: () => void
  submitDownvoteDetail: (reasons: string[], comment: string) => Promise<void>
}
```

**Vote logic:**
- `submitVote('up')`: if not already 'up', POST to `/api/feedback` with `vote: 'up'`, set `vote = 'up'`
- `submitVote('down')`: if not already 'down', POST to `/api/feedback` with `vote: 'down'`, set `vote = 'down'`, set `openModal = true`
- If already selected: no-op (clicking same thumb does nothing)
- Switching votes: POST new vote (backend records latest), update local state

**API call is fire-and-forget** — consistent with the email capture pattern. Backend failure does not revert the UI vote state.

### Pattern 3: Backend Feedback Model

```python
# app/models.py — add to existing file
class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    conversation_id: Mapped[int] = mapped_column(index=True, nullable=False)
    vote: Mapped[str] = mapped_column(String(4), nullable=False)          # "up" | "down"
    email: Mapped[str | None] = mapped_column(String(320), nullable=True) # from email gate if available
    expert_ids: Mapped[str] = mapped_column(Text, nullable=False, default="[]")  # JSON-serialized profile_url list
    reasons: Mapped[str] = mapped_column(Text, nullable=True)             # JSON-serialized checkbox labels
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)      # free-text field
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )
```

**Design rationale:**
- No foreign key constraint on `conversation_id` — consistent with existing schema style (no FK relationships defined)
- `expert_ids` as JSON Text — same pattern as `response_experts` in `Conversation`
- `reasons` as JSON Text — flexible, no migration needed if checkbox options change
- No unique constraint — switching votes creates a new record (latest record wins for analysis)
- Auto-created by `Base.metadata.create_all` at startup — no migration script needed

### Pattern 4: Backend Feedback Router

```python
# app/routers/feedback.py
class FeedbackRequest(BaseModel):
    conversation_id: int
    vote: Literal["up", "down"]
    email: EmailStr | None = None
    expert_ids: list[str] = Field(default_factory=list)
    reasons: list[str] = Field(default_factory=list)       # only sent with down+detail
    comment: str | None = Field(None, max_length=1000)

@router.post("/api/feedback", status_code=200)
def submit_feedback(body: FeedbackRequest, db: Session = Depends(get_db)):
    record = Feedback(
        conversation_id=body.conversation_id,
        vote=body.vote,
        email=str(body.email) if body.email else None,
        expert_ids=json.dumps(body.expert_ids),
        reasons=json.dumps(body.reasons),
        comment=body.comment,
    )
    db.add(record)
    db.commit()
    return {"status": "ok"}
```

**Why not upsert?** Switching votes creates a new record. This keeps the history (up → down → up pattern is analytically interesting). The "latest record" approach is simpler than tracking updates for v1.

### Pattern 5: DownvoteModal

No modal library required. A fixed overlay with Tailwind:

```typescript
// frontend/src/components/DownvoteModal.tsx
// Centered dialog using: fixed inset-0 z-50 flex items-center justify-center bg-black/40
// Modal panel: bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl
```

**Checkbox reasons (Claude's discretion — recommended set):**
1. "Wrong experts shown"
2. "Experts not relevant to my problem"
3. "Experts seem unavailable or too expensive"
4. "Other"

When "Other" is checked, the free-text field becomes visible. This is a common UX pattern — no library needed, just controlled `useState`.

**Close behavior:**
- X button in top-right corner
- Clicking the backdrop closes the modal
- Both call `closeModal()` — the downvote is already recorded, modal only collects optional detail
- Submitting sends an additional POST with `reasons` and `comment` filled in

### Pattern 6: ChatMessage.tsx Integration

`ChatMessage.tsx` already receives `isLastExpertMessage` (the gate prop). The same condition used for `EmailGate` placement is the right condition for `FeedbackBar` placement.

However, `FeedbackBar` needs `conversationId` and `email`. These flow from:
- `message.conversationId` — new field on `Message` (from SSE result event)
- `email` — already in `App.tsx` via `useEmailGate()`, needs to be threaded down to `ChatMessage`

```typescript
// ChatMessage.tsx Props — add:
email: string | null
// message.conversationId already available from message prop

// Render below expert cards, after optional EmailGate, only when isLastExpertMessage:
{isLastExpertMessage && message.conversationId && (
  <FeedbackBar
    conversationId={message.conversationId}
    expertIds={message.experts?.map(e => e.profile_url ?? e.name) ?? []}
    email={email}
  />
)}
```

**Important:** FeedbackBar should render even when the email gate is still showing (vote doesn't require email). It renders below the email gate when locked, below expert cards when unlocked.

### Anti-Patterns to Avoid

- **Storing vote state in the Message object:** Vote state is ephemeral (not persisted across reload). Keep it in `useFeedback` hook local state, not in the `messages` array in `useChat`.
- **Blocking on feedback API:** Follow the email-capture pattern — fire-and-forget. UI updates immediately on click, backend failure is silent.
- **Using a modal library:** No need for Headless UI or Radix — a simple fixed overlay with Tailwind is consistent with the project's zero-extra-dependencies approach.
- **Adding a foreign key to `conversation_id`:** The existing schema has no FK relationships. Don't introduce one now (migration complexity for SQLite).
- **Opening modal before recording the vote:** The downvote must POST to `/api/feedback` immediately on thumb click, then open the modal. This matches the user decision: "the thumbs-down vote is recorded the moment the thumb is clicked."

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal overlay | Custom portal/teleport logic | Tailwind `fixed inset-0 z-50` div rendered conditionally | No DOM portal needed for a single modal; the z-index stack is simple |
| Thumb icons | Custom SVG design | Copy from Heroicons or similar (same approach as ExpertCard's external-link icon) | Consistent visual style, minimal code |
| Vote deduplication | Complex state machine | Simple `if (vote === newVote) return` guard | The requirement is "clicking same thumb does nothing" — one line |
| DB upsert on vote switch | SQLite upsert + conflict logic | Insert new record each time | Latest record wins for analytics; history is preserved; simpler code |
| Accessibility traps | Focus management library | `autoFocus` on modal close button + `onKeyDown Escape` handler | Modal is simple enough to handle manually |

**Key insight:** This entire phase can be built with zero new dependencies. The existing React + Tailwind + FastAPI + SQLAlchemy stack handles everything.

---

## Common Pitfalls

### Pitfall 1: conversation_id Not Available on Frontend

**What goes wrong:** Feedback POST has no `conversation_id`, making feedback records impossible to trace to a specific query.

**Why it happens:** The SSE `result` event currently omits `conversation_id` — the backend assigns it at `db.commit()` time but never surfaces it to the client.

**How to avoid:** Extend the `result` SSE event in `chat.py` to include `conversation_id: conversation.id`. This is a one-line addition. Then extend the `Message` type and `useChat.ts` parsing to store it.

**Warning signs:** If you're planning `FeedbackBar` without first verifying how `conversationId` reaches the component, this pitfall is active.

### Pitfall 2: CORS Config Missing for New Endpoint

**What goes wrong:** `POST /api/feedback` fails preflight because the new router isn't covered by CORS config.

**Why it doesn't apply here:** CORS in `main.py` applies at the middleware level to all routes (`allow_methods=["GET", "POST"]`). Registering a new router automatically inherits CORS. No changes to `main.py` CORS config are needed — just `app.include_router(feedback.router)`.

**Warning signs:** Forgetting to add `app.include_router(feedback.router)` in `main.py` means the route doesn't exist at all (404, not CORS).

### Pitfall 3: Modal Z-Index Conflict

**What goes wrong:** The modal overlay appears behind chat elements or the fixed header.

**Why it happens:** The header uses `fixed` positioning (confirmed in `ChatMessage.tsx` context: `pt-20` top padding for the header). If modal uses `z-50`, the header may need a known z-index to not conflict.

**How to avoid:** Use `z-50` on the modal backdrop (Tailwind default for `fixed` overlays). Check `Header.tsx` for its z-index — if it's lower than `z-50`, modal appears above. If Header uses `z-50` too, use `z-[60]` on the modal.

### Pitfall 4: FeedbackBar Appears on Non-Recommendation Messages

**What goes wrong:** FeedbackBar renders on clarification messages (where there are no experts).

**Why it happens:** `isLastExpertMessage` is computed as the last message with `experts && experts.length > 0`. If logic is changed or misread, clarification messages could get the feedback bar.

**How to avoid:** Always gate FeedbackBar on `message.experts && message.experts.length > 0 && isLastExpertMessage`. The `conversationId` presence also provides a natural guard (clarification responses have `conversation_id` too, so don't rely on that alone).

### Pitfall 5: verbatimModuleSyntax TypeScript Requirement

**What goes wrong:** TypeScript error "This import is never used as a value and must use 'import type'".

**Why it happens:** `tsconfig.app.json` sets `"verbatimModuleSyntax": true`. All type-only imports must use `import type { ... }`.

**How to avoid:** In all new `.tsx` files (`FeedbackBar.tsx`, `DownvoteModal.tsx`), use `import type { Expert, Message }` for type-only imports. Check existing components — they all follow this pattern.

### Pitfall 6: Email Threading

**What goes wrong:** `email` from `useEmailGate()` is in `App.tsx` but not threaded to `ChatMessage` → `FeedbackBar`.

**Why it happens:** The `email` prop is currently used by `App.tsx` only to pass to `useChat` (as the placeholder email for API calls). `ChatMessage.tsx` doesn't receive it.

**How to avoid:** Add `email: string | null` to `ChatMessage`'s Props interface and thread it from `App.tsx`. The `isUnlocked` and `onSubmitEmail` props already thread down — `email` follows the same path.

---

## Code Examples

Verified patterns from existing codebase:

### SSE result event extension (chat.py)
```python
# Source: app/routers/chat.py lines 108-125 (existing pattern)
db.add(conversation)
db.commit()
log.info("chat.logged", conversation_id=conversation.id)
yield _sse({
    "event": "result",
    "type": llm_response.type,
    "narrative": llm_response.narrative,
    "experts": experts_payload,
    "conversation_id": conversation.id,   # ADD THIS
})
```

### Thumb SVG (inline, matching existing ExpertCard icon style)
```typescript
// Thumbs-up — fill on selected/hover, stroke outline when unselected
// Use same pattern as ExpertCard's SVG: viewBox="0 0 20 20", w-5 h-5
// Heroicons thumb-up path (MIT license, standard in this ecosystem)
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"
  fill={vote === 'up' ? 'currentColor' : 'none'}
  stroke="currentColor" strokeWidth={1.5}
  className="w-5 h-5">
  <path d="M1 8.25a1.25 1.25 0 1 1 2.5 0v7.5a1.25 1.25 0 0 1-2.5 0v-7.5ZM11 3V1.7c0-.268.14-.526.395-.607A2 2 0 0 1 14 3c0 .995-.182 1.948-.514 2.826L12.5 8h2.396a2 2 0 0 1 1.966 2.337l-1.053 6A2 2 0 0 1 13.843 18H9.828a2 2 0 0 1-1.414-.586l-1.914-1.914A1 1 0 0 1 6.5 15V8.86a1 1 0 0 1 .293-.707L10 4.5 11 3Z"/>
</svg>
```

### Tailwind modal overlay pattern (project-idiomatic)
```typescript
// Consistent with project's rounded-2xl, bg-white, shadow-* patterns
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
  onClick={onClose} // backdrop click closes
>
  <div
    className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl"
    onClick={e => e.stopPropagation()} // prevent backdrop close on content click
  >
    {/* modal content */}
  </div>
</div>
```

### Existing fire-and-forget POST pattern (from useEmailGate.ts)
```typescript
// Source: frontend/src/hooks/useEmailGate.ts lines 36-46
// This is the established pattern for fire-and-forget API calls
try {
  await fetch(`${API_URL}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ /* feedback payload */ }),
  })
} catch {
  // Intentional: backend failure is silent. UI state already updated.
}
```

### SQLAlchemy model pattern (matching existing models.py style)
```python
# Source: app/models.py — follows Mapped/mapped_column pattern from SQLAlchemy 2.0
class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    conversation_id: Mapped[int] = mapped_column(index=True, nullable=False)
    vote: Mapped[str] = mapped_column(String(4), nullable=False)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    expert_ids: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    reasons: Mapped[str] = mapped_column(Text, nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@app.on_event("startup")` | `asynccontextmanager lifespan` | FastAPI 0.90+ | Already applied in this project — no change needed |
| `sqlalchemy.insert` | `sqlalchemy.dialects.sqlite.insert` for conflict handling | SQLAlchemy 2.0 | Already applied for EmailLead; feedback doesn't need upsert so plain insert is fine |
| Default export types | Named exports only | Project decision | Already established — `import type { Expert }` not `import { Expert }` |

**No deprecated APIs in scope for this phase.** All patterns this phase uses are already established and verified in the codebase.

---

## Open Questions

1. **Header z-index**
   - What we know: Header has `fixed` positioning (App.tsx has `pt-20` padding for it); `Header.tsx` not checked for explicit z-index class
   - What's unclear: Whether Header's z-index conflicts with a `z-50` modal overlay
   - Recommendation: Read `Header.tsx` during implementation and set modal to `z-[60]` if needed

2. **expert_ids: profile_url vs some other identifier**
   - What we know: Experts have `profile_url` (nullable), `name`, `title`, `company` — no dedicated `id` field in the `Expert` interface
   - What's unclear: `profile_url` is nullable so using it as a unique ID is imperfect; `name` alone could have collisions
   - Recommendation: Use `profile_url ?? name` as the identifier for storage. For analytics purposes this is good enough for v1.

3. **Should FeedbackBar render before or after the EmailGate?**
   - What we know: EmailGate renders below locked expert cards when `!isUnlocked && isLastExpertMessage`. FeedbackBar should render below the expert cards on the last expert message always.
   - What's unclear: Visual order when both are present (gate still showing, feedback buttons also visible)
   - Recommendation: Render FeedbackBar below EmailGate — the ordering is: expert cards → email gate (if locked) → feedback bar. Voting doesn't require being unlocked.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `app/routers/chat.py`, `app/models.py`, `app/database.py`, `app/main.py`, `app/config.py` — confirmed all patterns
- Direct codebase inspection: `frontend/src/types.ts`, `frontend/src/hooks/useChat.ts`, `frontend/src/hooks/useEmailGate.ts` — confirmed data flow
- Direct codebase inspection: `frontend/src/components/ChatMessage.tsx`, `ExpertCard.tsx`, `EmailGate.tsx` — confirmed rendering patterns
- Direct codebase inspection: `frontend/tailwind.config.ts` — confirmed brand token `brand-purple: #5128F2`
- Direct codebase inspection: `frontend/tsconfig.app.json` — confirmed `verbatimModuleSyntax: true`
- Direct codebase inspection: `frontend/package.json`, `requirements.txt` — confirmed all installed versions

### Secondary (MEDIUM confidence)
- None required — all findings grounded in direct codebase inspection

### Tertiary (LOW confidence)
- Heroicons thumb SVG paths — standard MIT-licensed icon set widely used in Tailwind projects; exact path coordinates should be verified at implementation time from https://heroicons.com

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — confirmed by direct inspection of `package.json` and `requirements.txt`; no new packages needed
- Architecture: HIGH — patterns directly observed in existing routers, hooks, and components
- conversation_id gap: HIGH — verified by reading every SSE event emitted in `chat.py`; `conversation_id` is confirmed absent from the stream
- Pitfalls: HIGH — `verbatimModuleSyntax`, email threading, CORS scope all verified from source files
- Modal z-index: MEDIUM — Header.tsx not read; confirmed risk but exact value unknown

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (stable stack — 30-day window appropriate)
