# Phase 27: Newsletter Gate + Easter Egg - Research

**Researched:** 2026-02-22
**Domain:** Zustand 5 persist, Framer Motion 12 container animation, FastAPI SQLAlchemy model, React modal redesign
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Modal tone & copy**
- Tone: exclusive & aspirational — "Get access" feel, slightly premium
- Headline copy: Claude's discretion (roadmap copy is a starting point, not locked)
- Supporting copy: Include a brief anti-spam reassurance (e.g. "No spam, ever") — something that lowers friction without listing frequency or content type
- Submit button: value-forward framing (e.g. "Unlock Profiles" or "Get Access", not "Subscribe")

**Gate strictness**
- Soft gate — modal is dismissible (X button present)
- After dismiss: modal re-appears on the next "View Full Profile" click (not once-per-session)
- Once subscribed: permanently unlocked (until localStorage cleared) — no expiry
- Email validation: basic format validation (must look like x@x.x before submit enables)
- Duplicate email submissions: Claude's discretion (handle gracefully, no alarming error)
- Post-subscribe unlock indicator: none — profiles just work, no toast or badge

**Easter egg**
- Trigger phrases: "barrel roll" and "do a flip" (in Sage input or search input)
- Spin duration, repeat behavior, input clearing, and any supplemental feedback: Claude's discretion — optimise for delight without being annoying

**Admin subscriber view**
- Location in admin: Claude's discretion (planner picks tab vs Leads section based on nav fit)
- Fields per subscriber: Claude's discretion (show whatever is naturally captured — at minimum email + signup date)
- CSV export button — one-click download of all subscriber emails (required)
- Subscriber count prominence: Claude's discretion (planner picks visual weight that fits admin layout)

**Existing infrastructure (locked, do not change)**
- `localStorage['tcs_email_unlocked']` bypass is unchanged — v2.0 users are already unlocked
- Barrel roll targets the VirtuosoGrid container element (not individual ExpertCards)
- The existing conversation/Sage tracking is retained as-is — no new tracking added

### Claude's Discretion
- All visual layout details (modal design, card styling)
- Easter egg animation specifics (duration, repeat, input handling, supplemental feedback)
- Duplicate email UX
- Admin subscriber section placement and visual weight
- Subscriber list fields beyond email

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NLTR-01 | Email gate redesigned as newsletter subscription CTA ("Get expert insights to your inbox. Unlock profiles.") | Existing ProfileGateModal + EmailGate components fully identified; redesign is targeted replacement of copy and modal shell; no structural rewrites needed |
| NLTR-02 | Email submission creates record in new `newsletter_subscribers` table (email, created_at, source) | New SQLAlchemy model `NewsletterSubscriber` + new POST endpoint; `Base.metadata.create_all()` creates table at startup automatically; no ALTER TABLE migration needed |
| NLTR-03 | Newsletter subscription state (subscribed, email) persists via Zustand + localStorage | Standalone `useNltrStore` with `persist` middleware using key `'tinrate-newsletter-v1'`; synchronous lazy initializer pattern confirmed from existing `useEmailGate`; Zustand 5.0.11 + `zustand/middleware` both available |
| NLTR-04 | Admin Leads page shows newsletter subscriber count and subscriber list | Existing LeadsPage architecture identified; new `GET /api/admin/newsletter-subscribers` endpoint feeds a new section; existing `useAdminData` pattern is the template; CSV download uses existing `StreamingResponse` CSV pattern |
| FUN-01 | Sage query or search containing playful trigger phrases (e.g. "barrel roll", "do a flip") triggers 360° card animation via Framer Motion on ExpertCards | `motion/react` v12.34.3 (framer-motion 12.34.3) confirmed; `useAnimate` hook targets VirtuosoGrid container element via `ref`; detect trigger in `useSage.handleSend` and in `SearchInput.handleChange`/`handleKeyDown`; barrel roll state shared via new `useNltrStore` boolean field or a separate `useBarrelRollStore` |
</phase_requirements>

---

## Summary

Phase 27 has three distinct technical workstreams that are largely independent: (1) redesigning the email gate modal as a newsletter CTA, (2) backend persistence of newsletter subscriptions with admin visibility, and (3) the barrel roll easter egg via Framer Motion on the VirtuosoGrid container.

The existing codebase is highly favourable for this phase. The `ProfileGateModal` component already uses `AnimatePresence` + `motion` from `motion/react` and wraps the `EmailGate` form. The `useEmailGate` hook already demonstrates the exact synchronous localStorage initializer pattern that `useNltrStore` must use (lazy `useState` → replace with Zustand persist). The backend has a clear, repeatable pattern for new models (`EmailLead` → `NewsletterSubscriber`), new endpoints, and CSV export (`StreamingResponse`). The admin `LeadsPage` is the natural insertion point for newsletter subscriber data.

The barrel roll is the most novel piece. The critical architectural decision (from planning notes) is to animate the VirtuosoGrid *container element* — not individual ExpertCards — because VirtuosoGrid mounts/unmounts ExpertCards as they scroll, which would cause scroll-triggered re-animations. The `animate` imperative API from `motion/react` (backed by framer-motion 12.34.3) can animate any DOM element via a ref without requiring a `motion.div` wrapper, making it suitable for the VirtuosoGrid wrapper `div`.

**Primary recommendation:** Build `useNltrStore` as a standalone Zustand persist store (not touching `useExplorerStore`), add `NewsletterSubscriber` SQLAlchemy model and FastAPI endpoints following existing patterns exactly, redesign `ProfileGateModal`/`EmailGate` content in-place, and use `useAnimate` from `motion/react` on a wrapper `div` around `VirtuosoGrid` for the barrel roll.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | 5.0.11 (installed) | Newsletter subscription state + persist | Already the project store library; persist middleware confirmed available |
| motion (framer-motion) | 12.34.3 (installed) | Barrel roll 360° animation | Already used for ProfileGateModal, SagePanel, TagCloud — consistent import path `motion/react` |
| SQLAlchemy | Already installed | `NewsletterSubscriber` ORM model | All models use SQLAlchemy mapped_column pattern |
| FastAPI | Already installed | New newsletter + admin endpoints | All endpoints follow existing router pattern |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pydantic EmailStr | Already installed (via email-validator) | Validate newsletter email server-side | `POST /api/newsletter/subscribe` request body |
| sqlalchemy.dialects.sqlite.insert | Already imported in email_capture.py | INSERT OR IGNORE for duplicate emails | Newsletter subscriber dedup |
| StreamingResponse (FastAPI) | Already installed | CSV export of newsletter subscribers | `GET /api/admin/export/newsletter.csv` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| useAnimate (imperative) | motion.div wrapper around VirtuosoGrid | motion.div wrapper works but useAnimate gives cleaner integration; both work — useAnimate preferred since VirtuosoGrid has complex layout constraints |
| Standalone useNltrStore | Adding nltr fields to useExplorerStore | useExplorerStore is locked; its partialize is locked; standalone store is the only safe option |

**Installation:** No new packages required. All libraries are already installed.

---

## Architecture Patterns

### Recommended Project Structure

New files to create:

```
frontend/src/
├── store/
│   └── nltrStore.ts             # New: standalone useNltrStore with persist
├── hooks/
│   └── useBarrelRoll.ts         # New: barrel roll trigger detection + animation
├── components/
│   └── marketplace/
│       └── NewsletterGateModal.tsx  # New: replaces ProfileGateModal content

app/
├── models.py                    # Extend: add NewsletterSubscriber model
├── routers/
│   └── newsletter.py            # New: POST /api/newsletter/subscribe
└── main.py                      # Extend: include newsletter.router
```

Files to modify:

```
frontend/src/
├── pages/MarketplacePage.tsx    # Use useNltrStore instead of useEmailGate
├── components/
│   └── marketplace/
│       └── ProfileGateModal.tsx  # Update content/copy
│       └── ExpertGrid.tsx        # Wrap VirtuosoGrid with ref-able div
├── hooks/useSage.ts             # Detect barrel roll trigger in handleSend
├── components/sidebar/
│   └── SearchInput.tsx          # Detect barrel roll trigger in handleChange
└── admin/
    ├── pages/LeadsPage.tsx      # Add newsletter subscriber section
    ├── hooks/useAdminData.ts    # Add useNewsletterSubscribers hook
    └── types.ts                 # Add NewsletterSubscriber types

app/
└── routers/admin.py             # Add newsletter admin endpoints
```

### Pattern 1: Standalone Zustand Persist Store (useNltrStore)

**What:** A separate Zustand store with localStorage persistence for newsletter subscription state.
**When to use:** Any time state must survive page refresh without touching `useExplorerStore`.

```typescript
// frontend/src/store/nltrStore.ts
// Source: existing store/index.ts pattern + Zustand 5 docs (confirmed installed)
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// CRITICAL: Synchronous localStorage read in initial state (not useEffect)
// This prevents a flash of "locked" state for returning users.
// Pattern verified in: frontend/src/hooks/useEmailGate.ts (lazy useState initializer)
// Zustand persist handles this automatically — store hydrates synchronously from localStorage.

interface NltrState {
  subscribed: boolean
  email: string | null
  setSubscribed: (email: string) => void
}

export const useNltrStore = create<NltrState>()(
  persist(
    (set) => ({
      // Synchronous initial state — persist middleware reads localStorage before first render
      subscribed: false,
      email: null,
      setSubscribed: (email: string) => set({ subscribed: true, email }),
    }),
    {
      name: 'tinrate-newsletter-v1',  // LOCKED persist key — do NOT change
      storage: createJSONStorage(() => localStorage),
      // Persist all fields — subscribed + email are both needed
      // Do NOT use partialize unless excluding a field deliberately
    }
  )
)
```

**Legacy v2.0 bypass:** `useNltrStore` must also check `localStorage['tcs_email_unlocked']` at initialization time. Existing users with this key should be treated as `subscribed: true` without re-subscribing. Pattern:

```typescript
// In MarketplacePage, after useNltrStore:
const { subscribed } = useNltrStore()
const legacyUnlocked = localStorage.getItem('tcs_email_unlocked') !== null
const isUnlocked = subscribed || legacyUnlocked
```

Note: `localStorage['tcs_gate_email']` is the key used by `useEmailGate` (v2.0 storage key). The CONTEXT.md states the bypass key is `tcs_email_unlocked` — verify the exact key in `useEmailGate.ts`. Actual key in codebase: `STORAGE_KEY = 'tcs_gate_email'`. The CONTEXT.md and planning notes refer to `tcs_email_unlocked` — this discrepancy needs resolution. The safe approach: check BOTH keys (`tcs_gate_email` AND `tcs_email_unlocked`) as bypass conditions so no returning user loses access.

### Pattern 2: NewsletterSubscriber SQLAlchemy Model

**What:** New ORM model following the exact `EmailLead` pattern. Created by `Base.metadata.create_all()` — no migration needed.

```python
# app/models.py — add after EmailLead class
# Source: existing EmailLead model pattern in app/models.py

class NewsletterSubscriber(Base):
    """
    Newsletter subscribers from the Phase 27 newsletter gate.
    Created by Base.metadata.create_all() at startup — no ALTER TABLE needed.
    Idempotent: use INSERT OR IGNORE for duplicate emails.
    """
    __tablename__ = "newsletter_subscribers"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="gate")  # "gate" | future
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )
```

### Pattern 3: Newsletter Subscribe Endpoint

**What:** New public endpoint (no admin auth) for newsletter subscription. Follow `email_capture.py` pattern exactly.

```python
# app/routers/newsletter.py
# Source: app/routers/email_capture.py pattern

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import NewsletterSubscriber

router = APIRouter()

class NewsletterSubscribeRequest(BaseModel):
    email: EmailStr
    source: str = "gate"

@router.post("/api/newsletter/subscribe", status_code=200)
def subscribe(body: NewsletterSubscribeRequest, db: Session = Depends(get_db)):
    """
    Subscribe email to newsletter. Silently ignores duplicate emails (idempotent).
    Returns {"status": "ok"} on success including duplicates.
    Frontend unlocks on Zustand write — backend failure is silent.
    """
    stmt = (
        insert(NewsletterSubscriber)
        .values(email=str(body.email), source=body.source)
        .on_conflict_do_nothing(index_elements=["email"])
    )
    db.execute(stmt)
    db.commit()
    return {"status": "ok"}
```

### Pattern 4: Barrel Roll via useAnimate on Container

**What:** Detect trigger phrases in Sage send and search input; animate the VirtuosoGrid wrapper div 360°.
**When to use:** User submits/types a phrase matching "barrel roll" or "do a flip".

The VirtuosoGrid container cannot be a `motion.div` directly (VirtuosoGrid manages its own DOM). Instead, wrap VirtuosoGrid in a plain `div` with a ref, then use `animate` from `motion/react` imperative API on that ref.

```typescript
// frontend/src/components/marketplace/ExpertGrid.tsx
// Source: motion/react (framer-motion 12.34.3) — useAnimate confirmed exported

import { useRef } from 'react'
import { animate } from 'motion/react'
import { VirtuosoGrid } from 'react-virtuoso'

// ExpertGrid receives a triggerSpin prop (boolean)
// When triggerSpin changes to true, fire animation once then reset

interface ExpertGridProps {
  // ... existing props
  onViewProfile: (url: string) => void
  triggerSpin: boolean          // new prop
  onSpinComplete: () => void    // new prop — reset trigger after animation
}

export function ExpertGrid({ ..., triggerSpin, onSpinComplete }: ExpertGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!triggerSpin || !containerRef.current) return
    animate(
      containerRef.current,
      { rotate: 360 },
      { duration: 0.7, ease: 'easeInOut' }
    ).then(() => {
      // Reset rotation so element returns to 0 cleanly for next spin
      animate(containerRef.current!, { rotate: 0 }, { duration: 0 })
      onSpinComplete()
    })
  }, [triggerSpin, onSpinComplete])

  return (
    <div ref={containerRef} style={{ height: '100%' }}>
      <VirtuosoGrid ... />
    </div>
  )
}
```

**Trigger detection — in useSage.handleSend:**

```typescript
// frontend/src/hooks/useSage.ts
// Add before the API call in handleSend

const BARREL_ROLL_PHRASES = ['barrel roll', 'do a flip']

function isBarrelRoll(text: string): boolean {
  const lower = text.toLowerCase()
  return BARREL_ROLL_PHRASES.some(p => lower.includes(p))
}

// In handleSend, before the API call:
if (isBarrelRoll(text)) {
  // Signal barrel roll (via callback prop or store)
  return  // or continue to API call per discretion — user choice
}
```

**Barrel roll state sharing:** Use a simple boolean in `useNltrStore` (`spinTrigger: boolean`) or a dedicated minimal store. The `spinTrigger` field should NOT be persisted (use partialize to exclude it).

### Pattern 5: Admin Newsletter Subscriber Section

**What:** New section in `LeadsPage.tsx` showing subscriber count and list, plus CSV download.
**Location:** Top of `LeadsPage` — above the existing leads table — as a distinct stats card.

```typescript
// Follows existing useAdminLeads() + adminFetch() pattern exactly
// New hook in frontend/src/admin/hooks/useAdminData.ts:

export function useNewsletterSubscribers() {
  const [data, setData] = useState<NewsletterSubscribersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    adminFetch<NewsletterSubscribersResponse>('/newsletter-subscribers')
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading, error }
}
```

**CSV export — single anchor download (no backend streaming required for small lists):**

```typescript
// In LeadsPage, download button:
function downloadNewsletterCsv() {
  const url = `${API_URL}/api/admin/export/newsletter.csv`
  const a = document.createElement('a')
  a.href = url
  a.click()
}
```

### Anti-Patterns to Avoid

- **Modifying useExplorerStore or its partialize:** Explicitly locked in planning notes. `useNltrStore` is fully standalone.
- **Animating individual ExpertCards:** VirtuosoGrid unmounts/remounts cards on scroll. Animating cards causes scroll-triggered re-animations. Animate the container div instead.
- **Using a motion.div directly as the VirtuosoGrid wrapper:** VirtuosoGrid's `style={{ height: '100%' }}` must be on the VirtuosoGrid element itself. The wrapper div just needs `style={{ height: '100%' }}` too, and the ref for animation.
- **ALTER TABLE for newsletter_subscribers:** `Base.metadata.create_all()` creates the table automatically. ALTER TABLE is only needed for adding columns to existing tables (as in prior phases for `conversations`).
- **Using useEffect for localStorage bypass check:** Use synchronous check at render time (same pattern as `useEmailGate`'s lazy useState initializer). Zustand persist hydrates synchronously.
- **Clearing the Sage input after barrel roll by default:** CONTEXT.md says this is Claude's discretion. Research recommendation: do NOT clear the Sage input — clearing mid-conversation would confuse users. The easter egg fires as a side effect of the real query.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Animation on DOM ref | CSS transform + requestAnimationFrame | `animate()` from `motion/react` | framer-motion handles easing, completion callbacks, interrupt handling |
| Email deduplication | Manual SELECT then INSERT | `INSERT OR IGNORE` via `sqlalchemy.dialects.sqlite.insert.on_conflict_do_nothing()` | Race-condition safe, exact pattern already in `email_capture.py` |
| CSV download | Custom serializer | Python `csv.writer` + FastAPI `StreamingResponse` | Exact pattern already in `export_searches_csv` and `export_gaps_csv` |
| Trigger phrase matching | Regex | Simple `str.includes()` / `str.lower().includes()` | Two static phrases — no regex needed, simpler, no edge cases |

**Key insight:** Every pattern needed for this phase already exists in the codebase. This is a composition phase — no new architectural patterns, only applying established ones in new locations.

---

## Common Pitfalls

### Pitfall 1: Wrong localStorage Key for Legacy Bypass

**What goes wrong:** Using `tcs_email_unlocked` as the bypass key when the existing hook uses `tcs_gate_email`.
**Why it happens:** CONTEXT.md and planning notes state `tcs_email_unlocked` but `useEmailGate.ts` uses `STORAGE_KEY = 'tcs_gate_email'`.
**How to avoid:** Check BOTH `tcs_gate_email` AND `tcs_email_unlocked` for bypass. This covers users from both possible prior versions.
**Warning signs:** Reports of returning users seeing the newsletter modal unexpectedly.

### Pitfall 2: Barrel Roll Animates 360° Then Snaps to 0°

**What goes wrong:** After `animate(el, { rotate: 360 })`, the element stays at 360° transform state. Next spin goes 360→720° (additive) or resets visibly.
**Why it happens:** `framer-motion` does not reset transform state automatically after animation completes.
**How to avoid:** In the `.then()` callback, immediately call `animate(el, { rotate: 0 }, { duration: 0 })` to reset without visual transition before `onSpinComplete()`.
**Warning signs:** Second barrel roll command spins in the wrong direction or shows a flash.

### Pitfall 3: VirtuosoGrid Wrapper Height

**What goes wrong:** Wrapping VirtuosoGrid in a `div` causes VirtuosoGrid to not fill its container, resulting in broken virtual scroll.
**Why it happens:** VirtuosoGrid requires `style={{ height: '100%' }}` and its parent must also have a defined height.
**How to avoid:** Set `style={{ height: '100%' }}` on both the wrapper `div` (the one with ref) and on VirtuosoGrid itself (already present in existing code).
**Warning signs:** VirtuosoGrid shows only first few cards, no scroll.

### Pitfall 4: Zustand Persist + Legacy localStorage Conflict

**What goes wrong:** `useNltrStore` with persist key `'tinrate-newsletter-v1'` does not interfere with `'explorer-filters'` (correct). However, if the store is accidentally named `'explorer-filters'` or `'tcs_gate_email'`, it will corrupt existing state.
**Why it happens:** Copy-paste from `useExplorerStore` template.
**How to avoid:** Persist key MUST be exactly `'tinrate-newsletter-v1'` per planning notes.
**Warning signs:** Filter state resets or users lose their newsletter subscription on refresh.

### Pitfall 5: Newsletter Subscribe Endpoint Not in main.py

**What goes wrong:** The new `newsletter.router` is created but not included in `main.py`, so `POST /api/newsletter/subscribe` returns 404.
**Why it happens:** Easy to miss when adding a new router file.
**How to avoid:** Add `from app.routers import newsletter` and `app.include_router(newsletter.router)` in `main.py` immediately after writing the router.
**Warning signs:** Frontend console shows 404 on email submission.

### Pitfall 6: CORS Header for New Endpoint

**What goes wrong:** The new `/api/newsletter/subscribe` endpoint is blocked by CORS.
**Why it happens:** The existing CORS config in `main.py` uses `allow_methods=["GET", "POST"]` — POST is already allowed. This is NOT a pitfall for this project. Include for completeness.
**How to avoid:** No action needed — existing CORS config covers POST.

---

## Code Examples

### Zustand 5 Persist with Partialize (exclude spinTrigger)

```typescript
// Source: Zustand 5 middleware — confirmed zustand@5.0.11 installed

interface NltrState {
  subscribed: boolean
  email: string | null
  spinTrigger: boolean       // NOT persisted
  setSubscribed: (email: string) => void
  triggerSpin: () => void
  resetSpin: () => void
}

export const useNltrStore = create<NltrState>()(
  persist(
    (set) => ({
      subscribed: false,
      email: null,
      spinTrigger: false,
      setSubscribed: (email) => set({ subscribed: true, email }),
      triggerSpin: () => set({ spinTrigger: true }),
      resetSpin: () => set({ spinTrigger: false }),
    }),
    {
      name: 'tinrate-newsletter-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        subscribed: state.subscribed,
        email: state.email,
        // spinTrigger intentionally excluded — ephemeral UI state only
      }),
    }
  )
)
```

### Admin Newsletter Endpoint (Backend)

```python
# app/routers/admin.py — add to router (with _require_admin dep)
# Source: existing GET /admin/leads pattern

from app.models import NewsletterSubscriber

@router.get("/newsletter-subscribers")
def get_newsletter_subscribers(db: Session = Depends(get_db)):
    """
    Return all newsletter subscribers ordered by most recent first.
    Response: {count: int, subscribers: [{email, created_at, source}]}
    """
    rows = db.scalars(
        select(NewsletterSubscriber).order_by(NewsletterSubscriber.created_at.desc())
    ).all()
    return {
        "count": len(rows),
        "subscribers": [
            {
                "email": r.email,
                "created_at": r.created_at.isoformat(),
                "source": r.source,
            }
            for r in rows
        ],
    }


@router.get("/export/newsletter.csv")
def export_newsletter_csv(db: Session = Depends(get_db)):
    """
    Download all newsletter subscriber emails as CSV.
    Source: existing export_searches_csv / export_gaps_csv pattern.
    """
    rows = db.scalars(
        select(NewsletterSubscriber).order_by(NewsletterSubscriber.created_at.desc())
    ).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["# Export date", date.today().isoformat()])
    writer.writerow(["# Total subscribers", len(rows)])
    writer.writerow([])
    writer.writerow(["email", "created_at", "source"])
    for r in rows:
        writer.writerow([r.email, r.created_at.isoformat(), r.source])

    filename = f"newsletter-subscribers-{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
```

### MarketplacePage Gate Integration

```typescript
// frontend/src/pages/MarketplacePage.tsx
// Replace useEmailGate with useNltrStore

import { useNltrStore } from '../store/nltrStore'

// In component:
const { subscribed, setSubscribed, triggerSpin, spinTrigger, resetSpin } = useNltrStore()
const legacyUnlocked = localStorage.getItem('tcs_gate_email') !== null
  || localStorage.getItem('tcs_email_unlocked') !== null
const isUnlocked = subscribed || legacyUnlocked

async function handleEmailSubmit(email: string) {
  // Write Zustand store FIRST (source of truth for unlock)
  setSubscribed(email)

  // Fire-and-forget backend call
  fetch(`${API_URL}/api/newsletter/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }).catch(() => {})  // Silent failure — user already unlocked

  // Open pending profile (same pattern as existing handleEmailSubmit)
  if (pendingProfileUrl) {
    window.open(pendingProfileUrl, '_blank', 'noopener,noreferrer')
    setPendingProfileUrl(null)
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useEmailGate` hook (useState + localStorage) | `useNltrStore` (Zustand persist) | Phase 27 | Zustand persist syncs across tabs, no manual localStorage.getItem needed in components |
| `EmailGate` inline form component | `NewsletterGateModal` with newsletter CTA copy | Phase 27 | Modal copy is now value-exchange framing, not utility capture |
| Hard gate (no dismiss) | Soft gate (dismissible, re-appears on next click) | Phase 27 | Lower friction; modal re-appears until subscribed |

**What does NOT change:**
- `useEmailGate.ts` and the old `EmailGate.tsx` — keep them in place; they are no longer used by `MarketplacePage` after this phase but should not be deleted (may be used elsewhere or serve as reference)
- `ProfileGateModal.tsx` — can be repurposed into `NewsletterGateModal.tsx` or updated in-place
- `useExplorerStore` and all its slices — untouched

---

## Open Questions

1. **Exact legacy localStorage key name**
   - What we know: `useEmailGate.ts` uses `STORAGE_KEY = 'tcs_gate_email'`; CONTEXT.md references `tcs_email_unlocked`
   - What's unclear: Which key(s) do v2.0 production users have in their localStorage?
   - Recommendation: Check both `tcs_gate_email` AND `tcs_email_unlocked` as bypass conditions. This is a 2-line check that costs nothing and ensures no user loses access.

2. **Barrel roll: stop Sage from also processing the query as a real search command**
   - What we know: `useSage.handleSend` sends the query to the API regardless; "barrel roll" will return a confused Sage response
   - What's unclear: Should barrel roll queries be intercepted before hitting the API, or should the API call proceed?
   - Recommendation: Intercept before API call. Display a playful canned Sage message instead (e.g., "Wheeeee! 🎡"). This avoids a nonsensical Sage response and makes the easter egg feel complete.

3. **Search input: does barrel roll in search trigger a grid re-fetch?**
   - What we know: `SearchInput` debounces and calls `setQuery()` which triggers `useExplore` re-fetch with "barrel roll" as a semantic query
   - What's unclear: Should the search query be cleared after barrel roll detection, or left as-is?
   - Recommendation: Detect in `handleChange` before debounce fires. If trigger phrase detected, fire spin, but do NOT call `setQuery()` (so no grid re-fetch for "barrel roll"). Reset `localValue` to empty string after spin trigger.

---

## Sources

### Primary (HIGH confidence)

- Codebase read — `frontend/src/store/index.ts` — Zustand 5 persist pattern, partialize, createJSONStorage
- Codebase read — `frontend/src/hooks/useEmailGate.ts` — synchronous localStorage initializer pattern
- Codebase read — `frontend/src/components/marketplace/ProfileGateModal.tsx` — existing modal using motion/react
- Codebase read — `frontend/src/components/marketplace/ExpertGrid.tsx` — VirtuosoGrid usage, height constraints
- Codebase read — `frontend/src/hooks/useSage.ts` — handleSend intercept point for barrel roll
- Codebase read — `frontend/src/components/sidebar/SearchInput.tsx` — handleChange intercept point
- Codebase read — `app/models.py` — EmailLead model pattern for NewsletterSubscriber
- Codebase read — `app/routers/email_capture.py` — INSERT OR IGNORE pattern
- Codebase read — `app/routers/admin.py` — GET /leads, CSV export, admin router pattern
- Codebase read — `app/main.py` — lifespan, Base.metadata.create_all(), router inclusion
- Codebase read — `frontend/src/admin/pages/LeadsPage.tsx` — admin page structure for newsletter section
- Codebase read — `frontend/src/admin/hooks/useAdminData.ts` — useAdminLeads hook template
- `node_modules/framer-motion/package.json` — version 12.34.3 confirmed
- `node_modules/zustand/package.json` — version 5.0.11 confirmed
- `node_modules/motion/dist/react.d.ts` — exports framer-motion; import path `motion/react` confirmed

### Secondary (MEDIUM confidence)

- framer-motion v12 `animate()` imperative API with DOM ref — confirmed via `typeof m.animate === 'function'` check; `useAnimate` also confirmed. Full API verified via type exports.

### Tertiary (LOW confidence)

- None required — all needed APIs confirmed via direct codebase inspection and node module checks.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed installed and in use
- Architecture: HIGH — all patterns derived directly from existing codebase code
- Pitfalls: HIGH — identified from direct code reading and known framer-motion behaviors

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable libraries, no fast-moving APIs in scope)
