# Stack Research

**Domain:** Expert Marketplace — v5.2 Email-First Gate, Admin See-All, Email-Based Tracking
**Researched:** 2026-03-04
**Research Mode:** Ecosystem (Subsequent Milestone — stack additions only)
**Confidence:** HIGH — all claims derived from direct inspection of v5.1 production files (package.json, requirements.txt, models.py, tracking.ts, MarketplacePage.tsx, OverviewPage.tsx, and all relevant routers)

---

## Scope of This Document

Covers ONLY what is new or changed for v5.2. The existing production stack is validated and must not change:

- **Backend:** FastAPI 0.129.* + SQLAlchemy 2.0.* + SQLite (WAL) + faiss-cpu 1.13.* + google-genai 1.64.* + pydantic 2.12.* + email-validator 2.1.* + structlog 24.2.* + pyjwt 2.10.* + pwdlib[bcrypt] 0.3.* + slowapi 0.1.*
- **Frontend:** React 19.2 + Vite 7.3 + Tailwind v3.4 + React Router v7.13 + motion/react v12.34 + Zustand v5.0.11 + react-virtuoso 4.18 + lucide-react 0.575 + recharts 3.7 + @radix-ui/react-slider 1.3.6 + @tanstack/react-table 8.21

**The three new capability areas for v5.2:**

1. Email-first gate — show the newsletter gate modal on page entry, before any browsing, instead of only on "View Full Profile" click
2. Admin "See All" expansion — inline expand buttons on Top Experts and Top Searches overview cards
3. Direct email-based tracking — attach captured email to subsequent tracking events so admin can query activity directly by email without retroactive session joins

---

## Net-New Packages

**Zero.** Every capability needed for v5.2 is already installed in the v5.1 production stack. This milestone is entirely about repositioning existing components and wiring existing data structures differently.

### requirements.txt Changes

None.

### package.json Changes

None.

---

## Feature-by-Feature Stack Analysis

### 1. Email-First Gate

**What already exists:**

- `NewsletterGateModal` — fully-built glassmorphic modal at `frontend/src/components/marketplace/NewsletterGateModal.tsx`, uses `AnimatePresence` + `motion` from `motion/react` (installed at `^12.34.3`), accepts `isOpen`, `onSubscribe`, `onDismiss` props
- `useNltrStore` (Zustand) — persisted store at `frontend/src/store/nltrStore.ts` with `subscribed: boolean` and `email: string | null` backed to `localStorage` under key `tinrate-newsletter-v1`
- `NewsletterSubscriber` model — `email`, `source`, `session_id`, `created_at` with unique constraint on `email`, INSERT OR IGNORE idempotency
- `POST /api/newsletter/subscribe` — idempotent endpoint, fire-and-forget from frontend, syncs to Loops in background
- Legacy bypass — `MarketplacePage.tsx` already checks both `tcs_gate_email` and `tcs_email_unlocked` localStorage keys for returning users from v2.0

**What changes (no new packages):**

`MarketplacePage.tsx`:
- Change `showGate` initial state: derive synchronously from `useNltrStore` — show modal when `!subscribed && !legacyUnlocked` on mount. The synchronous read pattern already exists in `useEmailGate.ts` via a `useState` lazy initializer — avoids flash of unlocked state.
- Remove the `handleViewProfile` gate check: once the email-first gate guarantees every browsing user has submitted their email, the profile click can go directly to `window.open()`.
- `pendingProfileUrl` state can be removed entirely.

`NewsletterGateModal.tsx`:
- Remove the `×` close button and the `onDismiss` prop — a page-entry gate should not be dismissable (blocks browsing until email submitted).
- Update copy to page-entry framing: headline from "Unlock the Full Expert Pool" to entry-level framing. Copy change only; JSX structure unchanged.
- Keep `autoFocus` on the email input — correct for a blocking modal.

`handleSubscribe` in `MarketplacePage.tsx`:
- Keep writing to Zustand store first (source of truth for unlock).
- Keep fire-and-forget `POST /api/newsletter/subscribe` with `session_id` (no change to backend).
- Remove `pendingProfileUrl` redirect — no longer needed.

**Backend impact:** None. The existing `/api/newsletter/subscribe` endpoint handles this unchanged.

**Returning user bypass:** Already implemented — `useNltrStore` reads `subscribed` from localStorage on first render via Zustand persist. No FOUC risk. The `legacyUnlocked` check covers users who passed through the old v2.0 email gate.

---

### 2. Admin "See All" Expansion (TopExpertsCard, TopQueriesCard)

**What already exists:**

`TopExpertsCard` in `OverviewPage.tsx`:
- Calls `GET /api/admin/events/exposure?days=N` via `adminFetch`
- Backend `get_exposure()` in `events.py` returns ALL rows ordered by click count — no server-side row limit
- Component slices client-side: `(data?.exposure ?? []).slice(0, 5)`

`TopQueriesCard` in `OverviewPage.tsx`:
- Calls `GET /api/admin/analytics/top-queries?days=N&limit=5` via `adminFetch`
- Backend `get_top_queries()` in `analytics.py` accepts a `limit` param — currently always called with `limit: 5`
- Component uses full response: `data?.queries ?? []` (no additional client slice)

**What changes (no new packages):**

For `TopExpertsCard`:
- Add `const [showAll, setShowAll] = useState(false)` local state
- Change render: when `!showAll`, display `rows.slice(0, 5)`; when `showAll`, display all rows
- Add a toggle button after the list: when `!showAll` and `data?.exposure.length > 5`, show `"See all {N}"` link; when `showAll`, show `"Show less"`
- The "See all" button style matches the existing `ZeroResultQueriesCard` pattern (`text-xs text-purple-400 hover:text-purple-300 transition-colors`)
- No re-fetch needed — full data is already in memory

For `TopQueriesCard`:
- Add `const [showAll, setShowAll] = useState(false)` local state
- When `showAll = true`, re-fetch with `limit: 50` instead of `limit: 5` — or prefetch all 50 on mount and slice client-side
- Preferred approach: always fetch `limit: 50`, slice to 5 on render when `!showAll`. This avoids a second network request on toggle. One extra query at mount is negligible.
- Add same toggle button pattern as TopExpertsCard

**Backend impact:** None for TopExpertsCard (already returns all). For TopQueriesCard, increase the fetch call from `limit: 5` to `limit: 50` — the endpoint already accepts this param.

---

### 3. Direct Email-Based Tracking

**What already exists:**

`tracking.ts` — `trackEvent()` module function:
- Reads `session_id` from `localStorage` key `tcs_session_id` (anonymous UUID, persisted)
- Posts to `POST /api/events` with `{session_id, event_type, payload}`
- Fire-and-forget with `keepalive: true`

`user_events` table — rows: `{id, session_id, event_type, payload (JSON blob), created_at}`. No `email` column.

`lead_clicks` table — rows: `{id, email, expert_username, search_query, created_at}`. Already email-keyed.

`newsletter_subscribers` table — rows: `{id, email, source, session_id, created_at}`. The `session_id` column exists precisely for retroactive session-to-email linking.

`lead-timeline` endpoint in `leads.py` — already joins `user_events` to email via `newsletter_subscribers.session_id`. When a subscriber row has a `session_id` that matches a `user_events` row, those events appear in the lead's timeline.

**The gap:** The `lead-timeline` join is retroactive — it joins events recorded BEFORE email capture. After the email-first gate, every user submits their email before any browsing activity is tracked. This means `newsletter_subscribers.session_id` is set when the first event fires, enabling the join for all subsequent events. The retroactive join now covers 100% of new users. No schema migration needed.

**What changes (no new packages):**

Zero-migration path — inject email into the `payload` JSON blob:

`tracking.ts`:
- Add `getEmail()` helper: reads `localStorage.getItem('tinrate-newsletter-v1')`, parses JSON, returns `.email` or `null`
- Inject `email` into the `payload` argument on every `trackEvent()` call: `payload = { ...payload, email: getEmail() }`
- The `POST /api/events` endpoint accepts `payload: dict[str, Any]` — no validation constraint on payload keys. No backend change required.
- Email appears in `user_events.payload` as `json_extract(payload, '$.email')` — admin queries can filter/group by this if needed without a schema migration

**Why not add an `email` column to `user_events`:**

SQLite `ALTER TABLE` only supports adding nullable columns. SQLAlchemy `create_all()` only creates missing tables, not missing columns — adding a column requires an explicit startup migration script. The payload injection approach achieves the same admin query capability (`json_extract`) with zero migration risk. If direct SQL `GROUP BY email` on `user_events` becomes a performance concern at scale, the column addition can be a v5.3 task with a proper migration.

**Concrete payload shape after v5.2:**

```json
// card_click event (after v5.2)
{
  "expert_id": "johndoe",
  "context": "grid",
  "rank": 3,
  "active_filters": {},
  "email": "user@example.com"
}

// search_query event (after v5.2)
{
  "query_text": "AI strategy consultant",
  "result_count": 12,
  "active_tags": [],
  "email": "user@example.com"
}
```

---

## Integration Points

### Frontend

```
MarketplacePage.tsx
  ├── reads useNltrStore({ subscribed, email }) synchronously on mount
  ├── shows NewsletterGateModal when !subscribed && !legacyUnlocked (page entry, not profile click)
  └── handleSubscribe() — sets Zustand store, fires POST /api/newsletter/subscribe

tracking.ts
  └── getEmail() — reads tinrate-newsletter-v1 from localStorage, parses JSON, extracts .email
      └── injected into payload on every trackEvent() call

OverviewPage.tsx → TopExpertsCard
  └── showAll local state — slice(0, 5) vs full array toggle

OverviewPage.tsx → TopQueriesCard
  └── showAll local state — fetch with limit: 50, slice(0, 5) vs full array toggle
```

### Backend

```
POST /api/newsletter/subscribe (newsletter.py) — unchanged
GET /api/admin/events/exposure (events.py) — unchanged, already returns all rows
GET /api/admin/analytics/top-queries (analytics.py) — unchanged, limit param already exists
POST /api/events (events.py) — unchanged, payload is free-form dict; email appears in blob
```

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| New modal/dialog library (Radix Dialog, headlessui) | `NewsletterGateModal` already uses motion/react AnimatePresence — consistent with existing codebase, no new dependency | Existing `NewsletterGateModal` component |
| New Zustand store for gate | `useNltrStore` already tracks `subscribed` + `email` with localStorage persist; adding a second store creates split truth | Extend gate logic within `useNltrStore` or add `gateShown` flag if needed |
| `email` column on `user_events` table | Requires SQLite ALTER TABLE startup migration; payload injection achieves same result with zero downside | Inject `email` into `payload` JSON blob in `tracking.ts` |
| Separate "See All" route/page for overview cards | Adds navigation complexity; in-card expand matches the established admin UX pattern | Local `showAll` boolean state per card |
| `useEffect` for gate show/hide decision | `useEffect` causes one-render flash of unlocked state for returning users — the bug documented in `useEmailGate.ts` comments | Lazy `useState` initializer or synchronous Zustand selector read |
| Server-side gate enforcement | This is a lead-gen gate, not a security gate; localStorage bypass for returning users is correct behavior | Client-side Zustand persist check |

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Email in `user_events.payload` blob | New `email` column on `user_events` | Use column approach if direct SQL `GROUP BY email` on user_events becomes a query performance need |
| In-card showAll toggle for See All | Navigate to /admin/data or /admin/gaps | Only if the full-page view adds value beyond list expansion (e.g., date filters, export) — not needed here |
| Fetch limit: 50 on mount for TopQueriesCard | Re-fetch with limit: 50 on toggle | Re-fetch approach is also fine; prefetch avoids perceived latency on toggle at cost of one extra query at mount |
| Remove dismiss from page-entry gate | Keep dismiss, block profile view until email | Removing dismiss is cleaner; keeping dismiss with profile view block as the gate incentive is a valid softer alternative |
| Read gate state synchronously from useNltrStore | useEffect to check localStorage on mount | Synchronous read prevents flash; useEffect always causes one render with wrong state |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| motion `^12.34.3` | React 19 | Confirmed working in v5.1 production |
| zustand `^5.0.11` | React 19 | Confirmed working in v5.1 production; persist middleware stable |
| pydantic `2.12.*` | FastAPI `0.129.*` | EmailStr validation already in use on newsletter endpoint |

---

## Sources

- `frontend/src/pages/MarketplacePage.tsx` — current gate trigger logic (profile click, not page entry)
- `frontend/src/store/nltrStore.ts` — existing gate state shape, localStorage key `tinrate-newsletter-v1`
- `frontend/src/components/marketplace/NewsletterGateModal.tsx` — existing modal component, dismiss button present
- `frontend/src/hooks/useEmailGate.ts` — lazy initializer pattern, flash-prevention design note
- `frontend/src/tracking.ts` — current anonymous session_id tracking, no email injection
- `frontend/src/admin/pages/OverviewPage.tsx` — TopExpertsCard slice(0,5), TopQueriesCard limit:5 call
- `app/routers/admin/events.py` — `get_exposure()` returns all rows, no server-side LIMIT
- `app/routers/admin/analytics.py` — `get_top_queries()` accepts `limit` param
- `app/routers/admin/leads.py` — `get_lead_timeline()` joins user_events via newsletter_subscribers.session_id
- `app/models.py` — `UserEvent.payload` is free-form JSON Text column; `NewsletterSubscriber.session_id` exists
- `app/routers/newsletter.py` — POST /api/newsletter/subscribe, idempotent, already in production
- `frontend/package.json` — installed versions (no new dependencies needed)
- `requirements.txt` — installed Python packages (no new dependencies needed)

---
*Stack research for: Expert Marketplace v5.2 Email-First Gate & Admin See-All*
*Researched: 2026-03-04*
