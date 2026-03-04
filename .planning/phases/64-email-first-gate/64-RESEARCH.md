# Phase 64: Email-First Gate - Research

**Researched:** 2026-03-04
**Domain:** Frontend email gate UX + backend event attribution
**Confidence:** HIGH

## Summary

Phase 64 replaces the existing profile-click-triggered newsletter gate with a mandatory page-entry email gate that blocks the entire Explorer until the visitor submits an email. The existing `useNltrStore` Zustand persist store (`tinrate-newsletter-v1` localStorage key) already handles the `subscribed` + `email` state and is read by `trackEvent()` for email enrichment. The main work involves: (1) creating a new full-screen entry gate component with blurred backdrop, (2) wiring it into `MarketplacePage` as a blocking overlay with synchronous bypass check, (3) removing the old `NewsletterGateModal` and its profile-gate trigger flow, (4) changing the Loops `source` tag from `"gate"` to `"page_entry"`, and (5) adding `user_events`-based search query entries to the admin lead timeline endpoint.

The backend `user_events` table already has an indexed `email` column (Phase 63). The `lead-timeline/{email}` endpoint currently fetches searches from `conversations` table and clicks from `lead_clicks` table, plus anonymous session events via `session_id`. For TRACK-03, we need to add `user_events` rows where `email` matches and `event_type = 'search_query'` as additional timeline entries.

**Primary recommendation:** Build the entry gate as a self-contained component rendered in `MarketplacePage` that checks `useNltrStore.subscribed` synchronously on mount (via Zustand's lazy `useState` initializer pattern), completely blocking interaction until submission. Reuse the existing `newsletter/subscribe` backend endpoint with `source: "page_entry"`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Full-screen overlay with centered card on top of blurred Explorer backdrop
- Explorer is visible but blurred behind the gate — creates curiosity and motivation to submit
- Card includes Tinrate logo at top + tagline
- Copy tone: blend of value-first and professional/trustworthy — concise but can be a few lines. Do NOT mention number of experts
- Brief privacy note below the email input (e.g., "We respect your privacy. No spam.")
- Remove the existing newsletter subscription gate entirely — the page-entry gate replaces it
- Bypass check uses the existing localStorage key (same key the old subscription flow used)
- Gate writes email to the same localStorage key/format as the old subscription — unified key for bypass, trackEvent() email reading, and gate submission
- Loops API call is delayed after gate submission — give time for the first search query to be captured and sent alongside or associated with the Loops contact creation. Claude decides exact timing approach
- Loops source tag: `page_entry` (not `gate`)
- Validate on submit only — no real-time validation as user types
- Inline error message if email is invalid
- Submit button text: "Get Access"
- On successful submission: gate card and overlay fade out smoothly, revealing the Explorer
- Search queries appear inline as timeline entries alongside existing events (same visual treatment, new event type)
- Each search entry shows: query text + timestamp
- Lead events matched by email only — no session_id fallback. Only email-attributed events appear
- Event types shown in timeline: search queries, expert saves/bookmarks, expert card clicks (NOT page views)
- Each event type gets a distinct icon or label for visual differentiation in the timeline
- Gate cannot be dismissed by clicking outside or pressing Escape — only email submission unlocks it

### Claude's Discretion
- Exact gate copy wording (within the tone guidelines above)
- Fade-out animation duration and easing
- Loops call delay timing strategy
- Timeline icon choices per event type
- Exact privacy note wording

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GATE-01 | User sees mandatory email gate modal on first page load before browsing the Explorer | New `EmailEntryGate` component rendered as full-screen overlay in `MarketplacePage` with blurred backdrop; synchronous `useNltrStore.subscribed` check |
| GATE-02 | User cannot dismiss or skip the email gate — email submission is required | No close button, no onClick on overlay backdrop, no Escape keydown handler; only submit path unlocks |
| GATE-03 | Returning subscriber bypasses gate instantly with no flash (synchronous localStorage check) | Zustand `persist` with `createJSONStorage(() => localStorage)` hydrates synchronously; lazy `useState` initializer reads `subscribed` before first render |
| GATE-04 | Email gate submission sends distinct `source: "page_entry"` to Loops | Pass `source: "page_entry"` to existing `POST /api/newsletter/subscribe` endpoint which calls `sync_contact_to_loops(source=...)` |
| TRACK-03 | Admin lead journey timeline includes Explorer search queries attributed to the lead's email | Extend `GET /api/admin/lead-timeline/{email}` to query `user_events` WHERE `email = :email` for `search_query`, `card_click` event types; add distinct icons in timeline UI |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2 | UI framework | Already in use |
| Zustand | 5.0 | State management (nltrStore) | Already manages gate bypass state |
| motion/react | 12.34 | Animations (AnimatePresence, motion) | Already used by existing gate modals |
| Tailwind CSS | 3.4 | Styling | Already in use across all components |
| FastAPI | current | Backend API | Already in use |
| SQLAlchemy | current | Database ORM | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.575 | Icons for timeline event types | Already imported in admin components |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Full custom gate | Existing NewsletterGateModal | Can't reuse — different UX (full-screen vs centered small modal, no dismiss) |
| New localStorage key | Existing `tinrate-newsletter-v1` | LOCKED: must use existing key for unified bypass |

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/
├── components/
│   └── marketplace/
│       └── EmailEntryGate.tsx     # New full-screen entry gate
├── pages/
│   └── MarketplacePage.tsx        # Modified: render gate, remove old newsletter gate
├── store/
│   └── nltrStore.ts               # Unchanged: already has subscribed + email
└── tracking.ts                    # Unchanged: already reads email from nltrStore

app/
└── routers/
    └── admin/
        └── leads.py               # Modified: lead-timeline adds user_events search queries
```

### Pattern 1: Synchronous Bypass Check (Flash Prevention)
**What:** Use Zustand's `persist` middleware which hydrates from localStorage synchronously on store creation. The `subscribed` state is available before first render.
**When to use:** Always — for GATE-03 no-flash bypass.
**Example:**
```typescript
// In MarketplacePage.tsx — lazy useState initializer
const subscribed = useNltrStore((s) => s.subscribed)

// Because Zustand persist with createJSONStorage(() => localStorage)
// hydrates synchronously, `subscribed` is correct on first render.
// No useEffect needed. No flash.
```

### Pattern 2: Fade-Out Animation on Gate Dismiss
**What:** Use AnimatePresence + motion.div with exit animation when gate is dismissed.
**When to use:** On successful email submission — gate fades out smoothly.
**Example:**
```typescript
<AnimatePresence>
  {!subscribed && (
    <motion.div
      key="entry-gate"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="fixed inset-0 z-50 ..."
    >
      {/* gate card */}
    </motion.div>
  )}
</AnimatePresence>
```

### Pattern 3: Delayed Loops Sync with First Query Bundling
**What:** After gate submission, delay the Loops API call slightly to give the user time to perform their first search. Use a setTimeout in the frontend or delay the BackgroundTask in the backend.
**When to use:** On gate email submission — delay ~3-5 seconds or wait for first `search_query` event.
**Recommended approach:** Use a `setTimeout` wrapper around the `/api/newsletter/subscribe` fetch call (e.g., 3 seconds). This gives time for the user to type their first search, which `trackEvent('search_query', ...)` will fire with the email. The backend `sync_contact_to_loops` can then be called with `first_query` parameter if captured.

### Anti-Patterns to Avoid
- **useEffect for bypass check:** Causes flash-of-gate on returning visitors. Use synchronous Zustand state instead.
- **Separate localStorage key:** Decision is LOCKED — must use `tinrate-newsletter-v1` (unified with existing store).
- **onClick dismiss on overlay:** Gate is mandatory. Do NOT add overlay click handler.
- **session_id fallback for timeline:** Decision is LOCKED — match by email only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email validation | Custom regex engine | Simple `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` regex | Existing `EmailGate.tsx` already uses this pattern; server-side Pydantic `EmailStr` is authoritative |
| Gate animations | CSS keyframes | `motion/react` AnimatePresence | Already used by existing modals, handles mount/unmount animations correctly |
| localStorage persistence | Raw localStorage read/write | Zustand persist middleware | Already configured in `nltrStore.ts`, handles serialization/hydration |

## Common Pitfalls

### Pitfall 1: Flash-of-Gate on Returning Visitors
**What goes wrong:** Gate appears briefly before bypass check completes.
**Why it happens:** Using `useEffect` to check localStorage causes a render cycle where gate shows first.
**How to avoid:** Zustand's `persist` with `createJSONStorage(() => localStorage)` hydrates synchronously. Read `subscribed` directly from store — it's correct on first render.
**Warning signs:** Gate flickers for a frame on page refresh for subscribed users.

### Pitfall 2: Dual Legacy Key Check Not Migrated
**What goes wrong:** Users who subscribed via old `tcs_gate_email` or `tcs_email_unlocked` keys bypass the gate but their email isn't in the Zustand store, so `trackEvent()` sends `email: null`.
**Why it happens:** Current `MarketplacePage` already checks legacy keys but doesn't migrate them into `useNltrStore`.
**How to avoid:** The new entry gate only needs to check `useNltrStore.subscribed`. Legacy keys (`tcs_gate_email`, `tcs_email_unlocked`) were for the old profile-click gate. Since the entry gate replaces the newsletter gate (which already wrote to `tinrate-newsletter-v1`), returning subscribers from the newsletter flow are already covered. Legacy profile-gate-only users may need re-gating, which is acceptable behavior (they haven't provided email to newsletter flow).
**Warning signs:** STATE.md blocker item mentions auditing dual localStorage paths.

### Pitfall 3: Timeline Deduplication
**What goes wrong:** Same search appears twice — once from `conversations` table, once from `user_events` table.
**Why it happens:** `conversations` stores Sage/chat searches by email. `user_events` stores Explorer `search_query` events with email. If a user does an Explorer search, it appears in `user_events` but NOT in `conversations` (Explorer searches don't go through the chat endpoint). Conversely, Sage queries appear in `conversations` but also as `sage_query` events in `user_events`.
**How to avoid:** For TRACK-03, add `user_events` WHERE `event_type = 'search_query'` AND `email = :email` as a separate event source. The existing `conversations` entries are Sage/chat searches, `user_events.search_query` entries are Explorer searches — they are distinct activity types. No deduplication needed since they represent different search surfaces.

### Pitfall 4: Loops Source Tag Regression
**What goes wrong:** New gate submissions still send `source: "gate"` to Loops.
**Why it happens:** The `NewsletterSubscribeRequest` model defaults `source` to `"gate"`. Frontend must explicitly pass `source: "page_entry"`.
**How to avoid:** Pass `source: "page_entry"` in the request body from the gate component's subscribe call.

## Code Examples

### Entry Gate Component Pattern
```typescript
// EmailEntryGate.tsx — full-screen mandatory email gate
import { useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'

interface Props {
  onSubmit: (email: string) => void
}

export function EmailEntryGate({ onSubmit }: Props) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address.')
      return
    }
    setError(null)
    onSubmit(trimmed)
  }

  return (
    <motion.div
      key="entry-gate"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/50"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl"
      >
        {/* Logo + Copy + Form */}
      </motion.div>
    </motion.div>
  )
}
```

### Extended Timeline Backend Query
```python
# In leads.py — add user_events search queries to timeline
from app.models import UserEvent

# After existing search_events and click_events gathering:

# 4. Fetch email-attributed user_events (TRACK-03)
ue_rows = db.scalars(
    select(UserEvent).where(
        UserEvent.email == email,
        UserEvent.event_type.in_(["search_query", "card_click"]),
    )
).all()

for row in ue_rows:
    payload_data = json.loads(row.payload or "{}")
    if row.event_type == "search_query":
        search_events.append({
            "type": "explorer_search",  # distinct from "search" (Sage)
            "query": payload_data.get("query_text", ""),
            "result_count": payload_data.get("result_count", 0),
            "created_at": row.created_at.isoformat(),
        })
    elif row.event_type == "card_click":
        click_events.append({
            "type": "explorer_click",  # distinct from "click" (lead_clicks)
            "expert_username": payload_data.get("expert", ""),
            "expert_name": payload_data.get("expert", ""),
            "search_query": None,
            "created_at": row.created_at.isoformat(),
        })
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Profile-click gate (NewsletterGateModal) | Page-entry gate (EmailEntryGate) | Phase 64 | Gate triggers on page load, not profile click |
| `source: "gate"` in Loops | `source: "page_entry"` in Loops | Phase 64 | Distinct lead segmentation for page-entry vs legacy gate |
| Timeline: conversations + lead_clicks only | Timeline: + user_events email-attributed | Phase 64 | Explorer search queries visible in admin timeline |

## Open Questions

1. **Legacy localStorage key cleanup**
   - What we know: `tcs_gate_email` and `tcs_email_unlocked` keys exist from old gate flows. Current MarketplacePage checks these for bypass.
   - What's unclear: Whether to keep legacy bypass for these keys or force re-gating.
   - Recommendation: Remove legacy key checks. The new entry gate replaces all gates. Users with only legacy keys (never subscribed via newsletter) will see the entry gate once — this is acceptable and captures them properly in the newsletter_subscribers table.

2. **contactSource Loops custom property**
   - What we know: STATE.md lists "Register Loops contactSource custom property in Loops dashboard" as a pre-check.
   - What's unclear: Whether this is already done.
   - Recommendation: The `source` field in `sync_contact_to_loops` already sends as a property. If not registered in Loops dashboard, it will be silently ignored but not cause errors. Implementation can proceed; manual Loops dashboard step is independent.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | Implicit Vite config (no vitest.config.ts — uses vite.config.ts) |
| Quick run command | `cd frontend && npx vitest run --reporter=verbose` |
| Full suite command | `cd frontend && npx vitest run` |
| Estimated runtime | ~5 seconds |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GATE-01 | Entry gate renders for unsubscribed users | unit | `cd frontend && npx vitest run src/components/marketplace/EmailEntryGate.test.ts -t "renders gate"` | No — Wave 0 gap |
| GATE-02 | Gate has no dismiss path (no close button, no overlay click) | unit | `cd frontend && npx vitest run src/components/marketplace/EmailEntryGate.test.ts -t "no dismiss"` | No — Wave 0 gap |
| GATE-03 | Subscribed users bypass gate (no flash) | unit | `cd frontend && npx vitest run src/pages/MarketplacePage.test.ts -t "bypass"` | No — Wave 0 gap |
| GATE-04 | Subscribe call sends source "page_entry" | unit | `cd frontend && npx vitest run src/components/marketplace/EmailEntryGate.test.ts -t "page_entry"` | No — Wave 0 gap |
| TRACK-03 | Timeline includes email-attributed user_events | manual-only | Requires running backend + DB with test data | N/A — backend endpoint, no existing backend test infra |

### Nyquist Sampling Rate
- **Minimum sample interval:** After every committed task → run: `cd frontend && npx vitest run --reporter=verbose`
- **Full suite trigger:** Before merging final task of any plan wave
- **Phase-complete gate:** Full suite green before verification
- **Estimated feedback latency per task:** ~5 seconds

### Wave 0 Gaps (must be created before implementation)
- [ ] `frontend/src/components/marketplace/EmailEntryGate.test.ts` — covers GATE-01, GATE-02, GATE-04
- [ ] Test stubs for gate rendering, no-dismiss behavior, source tag

*(Note: GATE-03 requires DOM-level testing of MarketplacePage with mocked Zustand store — may be deferred to manual verification. TRACK-03 is backend-only with no existing pytest infrastructure — verified manually.)*

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `frontend/src/store/nltrStore.ts` — Zustand persist store structure
- Codebase analysis: `frontend/src/tracking.ts` — email enrichment from localStorage
- Codebase analysis: `frontend/src/pages/MarketplacePage.tsx` — current gate flow
- Codebase analysis: `frontend/src/components/marketplace/NewsletterGateModal.tsx` — existing gate UI
- Codebase analysis: `app/routers/admin/leads.py` — lead timeline endpoint
- Codebase analysis: `app/routers/newsletter.py` — subscribe endpoint with Loops sync
- Codebase analysis: `app/routers/events.py` — user_events recording with email
- Codebase analysis: `app/models.py` — UserEvent model with email column

### Secondary (MEDIUM confidence)
- Zustand persist middleware synchronous hydration with `createJSONStorage(() => localStorage)` — documented behavior

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, no new dependencies
- Architecture: HIGH — patterns match existing codebase patterns exactly
- Pitfalls: HIGH — identified from direct codebase analysis, not speculation

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable stack, no external dependency changes)
