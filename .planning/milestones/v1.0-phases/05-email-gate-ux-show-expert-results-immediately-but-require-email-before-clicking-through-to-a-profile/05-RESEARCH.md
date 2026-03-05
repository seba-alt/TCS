# Phase 5: Email Gate UX - Research

**Researched:** 2026-02-20
**Domain:** React state management, localStorage persistence, FastAPI lead capture endpoint, Tailwind CSS locked-state visuals
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Gate presentation:**
- Expert Cards appear greyed out (desaturated/muted, not blurred) immediately when results are shown
- Cards are non-clickable in this greyed-out state — they tease the results but prevent navigation
- Email capture form appears below the greyed-out cards (not above, not in a modal)
- On valid email submission: cards instantly become clickable and the email form disappears (no animation — instant state change)
- No modal, no slide-in panel — it's an inline flow within the chat message

**Email persistence:**
- Email is stored in localStorage after submission — returning visitors (same browser) see fully unlocked cards with no gate shown at all
- If localStorage has an email, cards appear immediately active on page load — zero friction for returning users
- No "unlocked for [email]" indicator shown — just silently unlocked
- Both client-side (localStorage) and backend storage: email is POSTed to the server for lead capture, AND saved to localStorage for UX

**Gate copy & value prop:**
- Primary framing: "Enter your email to view expert profiles" — direct, transactional
- Headline / main text: Claude's discretion — keep it short and action-oriented (aligned with "unlock profiles" theme)
- Submit button label: **"Unlock profiles"**
- Short privacy note below the email field (e.g. "We'll never spam you.") — required

**Validation & error states:**
- Invalid email format: Claude's discretion on exact error display (standard inline validation UX)
- Gate is **mandatory** — no dismiss option, no skip, no clicking away to close. Cards stay locked until email is submitted
- Backend failure handling: Claude's discretion — prioritize UX (unlock on localStorage even if backend fails) vs data integrity
- Loading state: Yes — button shows a spinner and input is disabled while the backend call is in flight. Cards unlock after the call resolves (or per discretion if it fails)

### Claude's Discretion

- Exact error display for invalid email format
- Exact headline/heading text in the gate (user said "you decide")
- Whether to unlock on backend failure or show retry (user said "you decide" — recommend unlock-anyway for UX)
- Backend endpoint design: reuse existing chat email field vs new `/api/email-capture` endpoint (user said "you decide")
- Loading state duration handling (timeout, retry logic)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

Phase 5 is a pure UI/UX layer on top of the existing Expert Cards. No changes to the RAG pipeline, FAISS, or LLM are needed. The work splits into three bounded areas: (1) locked visual state for ExpertCard, (2) an inline EmailGate component rendered below cards in ChatMessage, and (3) a new backend `/api/email-capture` endpoint for lead storage plus a `useEmailGate` hook on the frontend for localStorage management.

The existing codebase makes this straightforward. `ExpertCard` already conditionally renders an `<a>` vs `<div>` based on whether `profileUrl` is truthy — the locked state is simply a third rendering mode (greyed out, pointer-events disabled, no href). `ChatMessage` already owns the card-rendering section; it just needs a flag and an inline gate component appended after the card list. `App.tsx` already initializes `PLACEHOLDER_EMAIL` as a hardcoded constant — Phase 5 replaces this with a real email from localStorage or the gate submission flow. The existing `/api/chat` endpoint accepts `email` as a required field; a separate `/api/email-capture` endpoint for explicit lead capture is the clean approach (no dual-purpose overloading of chat).

The most critical implementation decision is the unlock-on-backend-failure policy. The recommendation is to unlock immediately on localStorage write, regardless of backend outcome. The backend call is fire-and-forget from the UX perspective. This matches the user's instinct ("prioritize UX") and prevents the gate from permanently blocking users due to transient Railway/network errors.

**Primary recommendation:** Build `useEmailGate` hook (localStorage + backend POST), `EmailGate` inline component, and locked-mode `ExpertCard` variant. Wire everything through `ChatMessage` with a single boolean prop. No new library installs needed.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (useState, useEffect, useCallback) | ^19.2.0 (already installed) | Email gate state, form state, localStorage sync | Already in project; built-in hooks are sufficient |
| Tailwind CSS v3 | ^3.4.19 (already installed) | Locked card visual state (grayscale, opacity, pointer-events), gate form styling | Already in project; has all required utilities |
| FastAPI + Pydantic + SQLAlchemy | Already installed | New `/api/email-capture` POST endpoint | Same stack as existing chat endpoint |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `email-validator` | 2.1.* (already installed) | Server-side EmailStr validation on new endpoint | Already a project dependency |
| `sqlalchemy.dialects.sqlite.insert` | Part of sqlalchemy 2.0 (already installed) | INSERT OR IGNORE for duplicate email prevention | Use for idempotent lead capture |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom `useEmailGate` hook | `usehooks-ts` useLocalStorage | No new dependency needed; custom hook is 20 lines and exactly scoped |
| Tailwind `grayscale` filter | CSS `filter: saturate(0)` inline style | Tailwind utility is cleaner; same output |
| New `/api/email-capture` endpoint | Reuse `/api/chat` email field | Chat endpoint has required `query` field — using it for email-only capture would mean sending a dummy query. Separate endpoint is cleaner. |
| Unlock-on-backend-failure (recommended) | Block until backend succeeds | Blocking on backend failure traps users on transient Railway errors; localStorage write is the source of truth for UX |

**Installation:** No new packages required. All dependencies are already present.

---

## Architecture Patterns

### Recommended Project Structure

```
frontend/src/
├── hooks/
│   ├── useChat.ts              # existing
│   └── useEmailGate.ts         # NEW — localStorage + backend POST
├── components/
│   ├── ExpertCard.tsx          # MODIFIED — add locked prop
│   ├── ChatMessage.tsx         # MODIFIED — gate insertion + locked prop
│   ├── EmailGate.tsx           # NEW — inline form component
│   └── ...existing

app/
├── routers/
│   ├── chat.py                 # existing (unchanged)
│   ├── health.py               # existing (unchanged)
│   └── email_capture.py        # NEW — POST /api/email-capture
└── main.py                     # MODIFIED — include new router
```

### Pattern 1: useEmailGate Hook

**What:** Custom React hook that manages the email-unlocked state. Reads from localStorage on mount. Exposes `isUnlocked`, `email`, and `submitEmail` (async — POSTs to backend, then writes to localStorage).

**When to use:** Mount it once in `App.tsx` and pass `isUnlocked` and `submitEmail` down to `ChatMessage` / `ExpertCard`.

**Example:**
```typescript
// frontend/src/hooks/useEmailGate.ts
import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'tcs_gate_email'
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export interface UseEmailGateReturn {
  isUnlocked: boolean
  email: string | null
  submitEmail: (email: string) => Promise<void>
}

export function useEmailGate(): UseEmailGateReturn {
  // Lazy initializer — reads localStorage once on mount (client-only, no SSR concern for Vite)
  const [email, setEmail] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY)
  })

  const isUnlocked = email !== null

  const submitEmail = useCallback(async (submittedEmail: string) => {
    // Write to localStorage immediately — this is the source of truth for unlock state
    localStorage.setItem(STORAGE_KEY, submittedEmail)
    setEmail(submittedEmail)

    // Fire-and-forget backend call — failure does NOT re-lock the gate
    try {
      await fetch(`${API_URL}/api/email-capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: submittedEmail }),
      })
    } catch {
      // Intentional: backend failure is silent. UX is already unlocked via localStorage.
    }
  }, [])

  return { isUnlocked, email, submitEmail }
}
```

**Key insight:** `localStorage.getItem` in the lazy `useState` initializer runs synchronously on mount — the component renders with the correct initial state immediately, no `useEffect` flash of locked state for returning users.

### Pattern 2: Locked ExpertCard Variant

**What:** ExpertCard gains a `locked` boolean prop. When `locked=true`, renders a `<div>` (not `<a>`), applies Tailwind `grayscale opacity-60 pointer-events-none cursor-not-allowed` classes, and removes hover effects.

**When to use:** Pass `locked={!isUnlocked}` from `ChatMessage`.

**Example:**
```typescript
// Modified ExpertCard.tsx
interface Props {
  expert: Expert
  locked?: boolean  // NEW
}

export default function ExpertCard({ expert, locked = false }: Props) {
  // ...existing initials calculation...

  const profileUrl = expert.profile_url || null

  const inner = (
    // ...existing inner JSX, unchanged...
  )

  if (locked) {
    return (
      <div
        className="block w-full rounded-2xl border border-neutral-200 bg-white p-4 grayscale opacity-60 pointer-events-none cursor-not-allowed select-none"
        aria-hidden="true"
      >
        {inner}
      </div>
    )
  }

  if (profileUrl) {
    return (
      <a href={profileUrl} target="_blank" rel="noopener noreferrer"
         className="block w-full rounded-2xl border border-neutral-200 bg-white p-4 hover:border-brand-purple hover:shadow-md transition-all duration-200 group cursor-pointer">
        {inner}
      </a>
    )
  }

  return (
    <div className="block w-full rounded-2xl border border-neutral-200 bg-white p-4">
      {inner}
    </div>
  )
}
```

**Tailwind classes used:**
- `grayscale` — `filter: grayscale(100%)` — full desaturation (HIGH confidence, verified from Tailwind v3 docs)
- `opacity-60` — `opacity: 60%` — muted but still legible (HIGH confidence, verified from Tailwind v3 docs)
- `pointer-events-none` — `pointer-events: none` — prevents click/hover (HIGH confidence, verified from Tailwind v3 docs)
- `select-none` — prevents text selection (looks broken if text is selectable on a locked card)

**Why `aria-hidden="true"` on locked cards:** Screen readers should not announce locked cards as interactive links. The card content (name, title, rate) is still visible but the link intent is removed.

### Pattern 3: EmailGate Inline Component

**What:** A self-contained form rendered below the expert cards list within `ChatMessage`. No modal, no portal — plain JSX in the chat message flow.

**When to use:** Rendered only when `isUnlocked=false` AND the message has experts.

**Example:**
```typescript
// frontend/src/components/EmailGate.tsx
import { useState, type FormEvent } from 'react'

interface Props {
  onSubmit: (email: string) => Promise<void>
}

export default function EmailGate({ onSubmit }: Props) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()

    // Client-side email format validation — simple regex sufficient (server validates with EmailStr)
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
    if (!isValidEmail) {
      setError('Please enter a valid email address.')
      return
    }

    setError(null)
    setLoading(true)
    try {
      await onSubmit(trimmed)
      // Parent (via useEmailGate) sets isUnlocked=true → this component unmounts
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <p className="text-sm font-semibold text-neutral-900 mb-1">
        Unlock expert profiles
      </p>
      <p className="text-xs text-neutral-500 mb-3">
        Enter your email to view full profiles and connect with experts.
      </p>
      <form onSubmit={handleSubmit} noValidate>
        <input
          type="email"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(null) }}
          disabled={loading}
          placeholder="you@example.com"
          aria-label="Email address"
          aria-required="true"
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? 'email-gate-error' : undefined}
          className="w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-purple focus:border-transparent disabled:bg-neutral-100 disabled:cursor-not-allowed mb-2"
        />
        {error && (
          <p id="email-gate-error" className="text-xs text-red-500 mb-2" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="w-full rounded-xl bg-brand-purple text-white text-sm font-semibold py-2.5 hover:bg-purple-700 active:bg-purple-800 transition-colors disabled:bg-neutral-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Unlocking…
            </>
          ) : 'Unlock profiles'}
        </button>
        <p className="text-xs text-neutral-400 text-center mt-2">We'll never spam you.</p>
      </form>
    </div>
  )
}
```

### Pattern 4: ChatMessage Gate Insertion

**What:** `ChatMessage` receives `isUnlocked` and `onSubmitEmail` props. When an assistant message has experts AND `isUnlocked=false`, it renders locked cards AND the EmailGate below. When `isUnlocked=true`, renders normal clickable cards.

**Example:**
```typescript
// Modified ChatMessage.tsx
interface Props {
  message: Message
  thinkingQuote?: string
  isUnlocked: boolean                          // NEW
  onSubmitEmail: (email: string) => Promise<void>  // NEW
}

// Inside render, replace the expert cards section:
{!isUser && message.experts && message.experts.length > 0 && (
  <div className="mt-3 space-y-3">
    {message.experts.map((expert, i) => (
      <ExpertCard
        key={expert.profile_url ?? `${expert.name}-${i}`}
        expert={expert}
        locked={!isUnlocked}   // NEW
      />
    ))}
    {!isUnlocked && (
      <EmailGate onSubmit={onSubmitEmail} />  // NEW
    )}
  </div>
)}
```

### Pattern 5: App.tsx Wiring

**What:** `App.tsx` uses `useEmailGate` to get `isUnlocked` and `submitEmail`. Passes them to `ChatMessage`. Replaces `PLACEHOLDER_EMAIL` with the real email (or a fallback for the chat request when not yet unlocked — the existing `/api/chat` requires email).

**Important nuance:** The existing `/api/chat` endpoint requires a valid `email` field for DB logging. Before the gate is submitted, the chat requests still need an email. Use a placeholder for the chat request (since chat is accessible pre-gate) and use the real email once unlocked. The gate only gates the *click-through* — chat is still functional. This is already the existing behavior with `PLACEHOLDER_EMAIL`.

```typescript
// App.tsx
const { isUnlocked, email, submitEmail } = useEmailGate()

// useChat still uses PLACEHOLDER_EMAIL for DB logging during pre-gate chat
const { messages, status, sendMessage, retryLast } = useChat({
  email: email ?? PLACEHOLDER_EMAIL,
})

// In the messages render:
<ChatMessage
  key={message.id}
  message={message}
  thinkingQuote={...}
  isUnlocked={isUnlocked}
  onSubmitEmail={submitEmail}
/>
```

### Pattern 6: Backend /api/email-capture Endpoint

**What:** New FastAPI router at `app/routers/email_capture.py`. Accepts `{ email }` POST, stores in a new `EmailLead` table (or reuses `Conversation` — see open questions). Uses SQLite dialect `insert().on_conflict_do_nothing()` for idempotency.

**Example:**
```python
# app/routers/email_capture.py
from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import EmailLead  # new model

router = APIRouter()

class EmailCaptureRequest(BaseModel):
    email: EmailStr

@router.post("/api/email-capture", status_code=200)
def capture_email(body: EmailCaptureRequest, db: Session = Depends(get_db)):
    stmt = (
        insert(EmailLead)
        .values(email=str(body.email))
        .on_conflict_do_nothing(index_elements=["email"])
    )
    db.execute(stmt)
    db.commit()
    return {"status": "ok"}
```

**New SQLAlchemy model:**
```python
# In app/models.py — add:
class EmailLead(Base):
    __tablename__ = "email_leads"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )
```

**Register in main.py:**
```python
from app.routers import chat, health, email_capture
app.include_router(email_capture.router)
```

### Anti-Patterns to Avoid

- **Blocking on backend failure:** If `submitEmail` waits for the backend and the backend fails, the user's gate never unlocks. Always write localStorage FIRST, then fire the backend call.
- **Re-locking on page refresh:** Never read `isUnlocked` from React state alone — always derive from localStorage. State is lost on refresh; localStorage persists.
- **Showing the gate on every message:** The gate appears only on messages that HAVE experts. Clarification messages (no experts) never show the gate.
- **Using `display: none` to hide the EmailGate after unlock:** Instead, conditionally render (`{!isUnlocked && <EmailGate />}`). This unmounts the form entirely, cleaning up all form state.
- **Putting `grayscale` on the `<a>` tag and leaving `href`:** The `pointer-events-none` disables mouse events but keyboard users could still tab to the link and activate it. Use `<div>` (not `<a>`) for the locked render path.
- **Storing email in session storage:** Session storage is cleared when the tab closes. Use `localStorage` as decided.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email format validation | Custom regex | `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` simple regex + Pydantic `EmailStr` on server | Simple client regex is sufficient for UX; server-side `EmailStr` is the authoritative validator |
| Duplicate email prevention | Check-then-insert | SQLite `INSERT OR IGNORE` via `on_conflict_do_nothing()` | Check-then-insert has a TOCTOU race; dialect insert is atomic |
| localStorage abstraction | Third-party useLocalStorage library | Inline custom hook (20 lines) | No SSR concerns (Vite/SPA); inline hook avoids new dependency |
| Loading spinner | Custom animation | Tailwind `animate-spin` (already used in ChatInput.tsx) | Same pattern already in codebase |

**Key insight:** The entire phase requires zero new npm packages. All Tailwind utilities, React hooks, and FastAPI patterns are already established in the project.

---

## Common Pitfalls

### Pitfall 1: Flash of Locked State for Returning Users

**What goes wrong:** On page load, React renders with the initial state before localStorage is read (if using `useEffect` for the initial read), causing a brief flash where cards appear locked before snapping to unlocked.

**Why it happens:** Using `useEffect` to read localStorage means the effect runs after the first render — the component renders once with the default (locked) state.

**How to avoid:** Use a lazy `useState` initializer: `useState(() => localStorage.getItem(STORAGE_KEY))`. This runs synchronously before the first render, so the initial render is already correct.

**Warning signs:** Flash of grey/locked cards on hard refresh for users who previously submitted email.

### Pitfall 2: Gate Appears on Clarification Messages

**What goes wrong:** An assistant message with `type: 'clarification'` has `experts: []` — but if the gate check is on `message.experts` without checking length, it might render a gate below an empty cards list.

**Why it happens:** `message.experts` is `Expert[] | undefined` — checking only `message.experts` (truthy) would match `[]` (which is actually falsy for `length`, but truthy as an array).

**How to avoid:** Use `message.experts && message.experts.length > 0` as the condition (already the existing pattern in `ChatMessage.tsx`).

### Pitfall 3: Backend Email Already Captured on Subsequent Visits

**What goes wrong:** Returning user who already submitted their email makes a new chat query. The `useChat` hook now passes the real email to `/api/chat`. The email is fine for DB — but if the EmailGate also fires on returning visit, you get double submissions.

**Why it happens:** Not checking `isUnlocked` before showing the gate.

**How to avoid:** The gate is conditionally rendered only when `!isUnlocked`. If localStorage has an email, `isUnlocked=true` on mount — gate never shows, `submitEmail` is never called. No double submission is possible.

### Pitfall 4: Keyboard Accessibility of Locked Cards

**What goes wrong:** Screen reader users tab to a card rendered as `<a href="...">` but locked via CSS only. They can still activate the link with Enter key since `pointer-events-none` only affects mouse events, not keyboard navigation.

**Why it happens:** `pointer-events: none` is a CSS mouse-only mechanism. Keyboard focus and activation are separate.

**How to avoid:** The locked card renders as `<div>` (not `<a>`) with `aria-hidden="true"`. No href, no keyboard access to a broken link. The EmailGate form is fully accessible to keyboard users for submission.

### Pitfall 5: SQLite INSERT OR IGNORE Requires Dialect-Specific Import

**What goes wrong:** Using `from sqlalchemy import insert` (generic) instead of `from sqlalchemy.dialects.sqlite import insert` — the generic insert does not have `.on_conflict_do_nothing()`.

**Why it happens:** SQLAlchemy's generic insert is database-agnostic; conflict resolution is dialect-specific.

**How to avoid:** Always import from `sqlalchemy.dialects.sqlite` for the email capture insert. Add a comment flagging this for future Postgres migration (Postgres uses `sqlalchemy.dialects.postgresql.insert` with the same API).

### Pitfall 6: useChat Still Needs an Email Before Gate Submission

**What goes wrong:** The existing `/api/chat` endpoint requires a valid `email` field. If `useEmailGate` returns `null` before the gate is submitted, passing `null` to `useChat` would cause a 422 from the backend.

**Why it happens:** The chat interface is usable before the email gate — the gate only gates clicking through to profiles, not sending queries.

**How to avoid:** Keep `PLACEHOLDER_EMAIL` as the fallback in `useChat`: `email: email ?? PLACEHOLDER_EMAIL`. The real email replaces the placeholder after gate submission. Existing behavior is preserved.

---

## Code Examples

Verified patterns from official sources and existing codebase:

### localStorage Lazy Initializer (avoids flash)

```typescript
// Reads synchronously on first render — no flash
const [email, setEmail] = useState<string | null>(() => {
  return localStorage.getItem('tcs_gate_email')
})
```

### Tailwind Locked Card Classes (v3, verified)

```typescript
// grayscale: filter: grayscale(100%) — full desaturation
// opacity-60: opacity: 60% — muted but legible
// pointer-events-none: pointer-events: none — no mouse events
// select-none: user-select: none — prevents text selection
className="grayscale opacity-60 pointer-events-none select-none"
```

### SQLite Idempotent Email Insert (SQLAlchemy 2.0)

```python
from sqlalchemy.dialects.sqlite import insert  # NOT from sqlalchemy import insert

stmt = (
    insert(EmailLead)
    .values(email=str(body.email))
    .on_conflict_do_nothing(index_elements=["email"])
)
db.execute(stmt)
db.commit()
```

### Spinner Pattern (matches existing ChatInput.tsx)

```typescript
// Reuse exact same spinner pattern already in ChatInput.tsx:
<svg className="animate-spin w-4 h-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
</svg>
```

### Email Format Validation (client-side)

```typescript
// Simple, widely-used pattern. Server (Pydantic EmailStr) is authoritative.
const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
if (!isValidEmail) {
  setError('Please enter a valid email address.')
  return
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useEffect` to read localStorage (causes flash) | Lazy `useState` initializer for localStorage | React 16+ | No flash of wrong state on mount |
| `<a>` with `opacity-50` for locked links | `<div>` with no `href` + `aria-hidden` | Accessibility best practice | Keyboard users cannot activate locked links |
| Generic `sqlalchemy.insert` | Dialect-specific `sqlalchemy.dialects.sqlite.insert` with `on_conflict_do_nothing` | SQLAlchemy 2.0 | Atomic idempotent insert without race condition |
| `@app.on_event("startup")` | `asynccontextmanager lifespan` | FastAPI 0.90+ | Already used in this project (main.py) |

---

## Open Questions

1. **Should the EmailGate show on ALL assistant messages with experts, or only the LAST one?**
   - What we know: With multi-turn chat, multiple assistant messages may have expert cards. If the gate is shown on every message (not just the latest), a returning mid-session user might see gates on old messages until they submit.
   - What's unclear: The expected behavior for a user who sees two recommendation messages — does each show a gate?
   - Recommendation: Show the gate ONLY below the most recent recommendation message (track with message index). Previous messages' cards stay locked (greyed) but don't repeat the form. This prevents cluttered UI and is standard for gated chat.

2. **What to do if the backend call fails AND localStorage write succeeds?**
   - What we know: The user is unlocked client-side but the lead is not captured in the DB.
   - Recommendation (Claude's Discretion): Accept the data loss. Fire-and-forget. The alternative (retry queue, offline storage) is out of scope for v1. Optionally log to Sentry if available.

3. **Does the `email` from the gate replace the placeholder for ALL future chat requests?**
   - What we know: `useChat` takes `email` as an option; it's used in every chat request body. After gate submission, `useEmailGate` returns the real email, so subsequent `sendMessage` calls will use the real email in the request body.
   - What's unclear: Does this cause any re-render issue in `useChat`? The hook rebuilds its `sendMessage` callback when `email` changes.
   - Recommendation: This is fine — `sendMessage` rebuild is cheap and only happens once (on gate submission). The `historyRef` is maintained in the same hook instance; the email change does not reset conversation history.

---

## Sources

### Primary (HIGH confidence)

- Verified directly from `/Users/sebastianhamers/Documents/TCS/frontend/src/components/ExpertCard.tsx` — existing component structure, rendering patterns, Tailwind class conventions
- Verified directly from `/Users/sebastianhamers/Documents/TCS/frontend/src/hooks/useChat.ts` — existing hook pattern, email field usage, API call structure
- Verified directly from `/Users/sebastianhamers/Documents/TCS/frontend/src/App.tsx` — PLACEHOLDER_EMAIL usage, useChat wiring
- Verified directly from `/Users/sebastianhamers/Documents/TCS/app/routers/chat.py` — ChatRequest model, EmailStr, get_db pattern
- Verified directly from `/Users/sebastianhamers/Documents/TCS/app/models.py` — Conversation model, SQLAlchemy mapped_column patterns
- Verified directly from `/Users/sebastianhamers/Documents/TCS/frontend/package.json` — React 19.2, Tailwind CSS 3.4.19, no existing localStorage library
- Tailwind CSS v3 docs (WebFetch verified): `grayscale` = `filter: grayscale(100%)`, `opacity-60` = `opacity: 60%`, `pointer-events-none` = `pointer-events: none`
- SQLAlchemy 2.0 GitHub discussion #9675 (WebFetch verified): `from sqlalchemy.dialects.sqlite import insert` + `.on_conflict_do_nothing(index_elements=[...])`

### Secondary (MEDIUM confidence)

- LogRocket "Using localStorage with React Hooks" — lazy useState initializer pattern confirmed as standard
- MDN `<input type="email">` — HTML5 email input behavior

### Tertiary (LOW confidence)

- WebSearch results on React inline email gate UX patterns — no authoritative source found; pattern derived from first-principles based on codebase and CONTEXT.md decisions

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, versions confirmed from package.json and requirements.txt
- Architecture: HIGH — derived directly from reading actual codebase files; no guesswork about existing patterns
- Pitfalls: HIGH for code-level pitfalls (verified from docs); MEDIUM for UX pitfalls (derived from experience)

**Research date:** 2026-02-20
**Valid until:** 2026-04-20 (stable libraries; React 19, Tailwind v3, SQLAlchemy 2.0 are not fast-moving at this point)
