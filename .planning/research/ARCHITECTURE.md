# Architecture Research: v5.2 Email-First Gate, Admin See-All, Email-Based Tracking

**Domain:** Expert Marketplace SPA — feature integration for v5.2 milestone
**Researched:** 2026-03-04
**Confidence:** HIGH — all findings from direct codebase inspection of v5.1 source
**Scope:** v5.2 feature integration only. Existing v5.1 system is ground truth. Only deltas documented.

---

## Context: v5.1 Ground Truth (verified by file inspection)

```
GATE MECHANISM  (frontend/src/store/nltrStore.ts + MarketplacePage.tsx)
  nltrStore: { subscribed, email } — Zustand persist to localStorage key 'tinrate-newsletter-v1'
  Gate fires: ONLY when user clicks "View Full Profile" on an ExpertCard (handleViewProfile)
  Gate bypasses: subscribed=true OR localStorage.tcs_gate_email OR localStorage.tcs_email_unlocked
  Gate modal: NewsletterGateModal.tsx — has dismiss (×) button; user can close without submitting
  On submit: setSubscribed(email) → Zustand+localStorage → POST /api/newsletter/subscribe
  Effect: user unlocked; pending profile opens in new tab

TRACKING MECHANISM  (frontend/src/tracking.ts)
  trackEvent(event_type, payload): module function — NOT a React hook
  Reads session_id from localStorage key 'tcs_session_id' (anonymous UUID)
  Sends: POST /api/events { session_id, event_type, payload }
  Email: NEVER included — tracking is fully anonymous
  Call sites: ExpertCard (card_click), useExplore (search_query), filter handlers (filter_change)

LEAD CLICK TRACKING  (frontend/src/components/marketplace/ExpertCard.tsx)
  _fireLeadClick(): module-scope function inside ExpertCard
  Reads email from useNltrStore.getState().email — Zustand static read (no hook needed)
  Sends: POST /api/admin/lead-clicks { email, expert_username, search_query }
  Fires only if email is non-null (user has passed the gate at least once)
  Result: stored in lead_clicks table (email-keyed)

ADMIN OVERVIEW CARDS  (frontend/src/admin/pages/OverviewPage.tsx)
  TopExpertsCard:
    - Fetches adminFetch('/events/exposure', { days }) → ExposureResponse
    - Slices result to top 5: (data?.exposure ?? []).slice(0, 5)
    - Links each expert to /admin/experts (not to a "See All" page)
    - NO "See all" link present
  TopQueriesCard:
    - Fetches adminFetch('/analytics/top-queries', { days, limit: 5 })
    - Displays rows directly
    - NO "See all" link present
  ZeroResultQueriesCard: HAS "See all →" link to /admin/gaps (reference pattern)

LEAD TIMELINE  (app/routers/admin/leads.py get_lead_timeline)
  Merges three sources:
    1. Conversation rows WHERE email = X (chat-flow searches only — legacy)
    2. LeadClick rows WHERE email = X (expert card clicks by identified users)
    3. UserEvent rows WHERE session_id = subscriber.session_id (pre-gate anonymous history)
  Gap: Post-gate search_query and filter_change events are NOT linked to email
       (they still use anonymous session_id in user_events, no email column)

BACKEND ADMIN ROUTER  (app/routers/admin/__init__.py)
  10-module package: analytics, compare, events, experts, exports, imports, leads, settings
  All protected by _require_admin JWT dependency
  Relevant endpoints:
    GET /analytics/top-queries?days=N&limit=N  → top search queries ranked by frequency
    GET /events/exposure?days=N                → experts ranked by card click volume (no limit param)
    GET /lead-timeline/{email}                 → merged timeline
    POST /lead-clicks                          → stores lead_clicks row (called from ExpertCard)

USER_EVENTS TABLE SCHEMA  (app/models.py UserEvent)
  Columns: id, session_id (String 64, indexed), event_type, payload (JSON text), created_at
  NO email column — anonymous only
```

---

## System Overview: v5.1 → v5.2 Delta

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Vercel)                            │
├─────────────────────────┬───────────────────────────────────────────┤
│  MarketplacePage.tsx    │  Admin (lazy-loaded)                       │
│                         │                                            │
│  BEFORE: Gate on        │  BEFORE: TopExpertsCard and                │
│  "View Full Profile"    │  TopQueriesCard show top-5, no "See all"   │
│  click only             │                                            │
│                         │  AFTER: Both cards gain "See all →"        │
│  AFTER: Gate on mount   │  links to new dedicated pages              │
│  (blocks grid render    │  /admin/top-experts?days=N                 │
│  until email submitted) │  /admin/top-searches?days=N                │
│                         │                                            │
│  ExpertCard._fireLeadCl │  NEW PAGES:                                │
│  → already email-based  │  TopExpertsPage.tsx (NEW)                  │
│                         │  TopSearchesPage.tsx (NEW)                 │
│                         │                                            │
│  tracking.ts            │  useAdminData.ts — adminFetch wrapper      │
│  BEFORE: session_id only│  (no changes to hook signatures needed)    │
│  AFTER: also sends email│                                            │
│  if useNltrStore.email  │                                            │
│  is non-null            │                                            │
├─────────────────────────┴───────────────────────────────────────────┤
│               State / Persistence (unchanged)                        │
│  useNltrStore: subscribed, email — localStorage 'tinrate-newsletter-v1'│
│  tcs_session_id — localStorage anonymous UUID for trackEvent()      │
└─────────────────────────────────────────────────────────────────────┘
                              │ HTTPS
┌─────────────────────────────┴───────────────────────────────────────┐
│                         BACKEND (Railway)                            │
├─────────────────────────────────────────────────────────────────────┤
│  UNCHANGED endpoints:                                                │
│  POST /api/newsletter/subscribe → newsletter_subscribers table       │
│  POST /api/admin/lead-clicks   → lead_clicks table (email-keyed)    │
│  GET  /api/admin/events/exposure     → top experts by click vol      │
│  GET  /api/admin/analytics/top-queries → top search queries          │
│  GET  /api/admin/lead-timeline/{email} → merged timeline             │
│                                                                      │
│  MODIFIED:                                                           │
│  POST /api/events — now accepts optional email field                 │
│  GET  /api/admin/lead-timeline/{email} — also queries user_events    │
│    WHERE email = X (new direct query, supplements session_id join)   │
│                                                                      │
│                     SQLite DB (WAL mode)                             │
│  user_events — ADD COLUMN email TEXT nullable indexed (NEW)          │
│  All other tables unchanged                                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Integration Points by Feature

### Feature 1: Email-First Gate

**Current state:** `NewsletterGateModal` is controlled by `showGate` state initialized to `false`. It only becomes `true` when `handleViewProfile` is called on a non-unlocked user. Users can browse the entire expert grid without submitting an email.

**Target state:** Gate fires immediately on page load if not already unlocked. The expert grid does not render until the gate is passed.

**Modified component: `MarketplacePage.tsx`**

```typescript
// BEFORE: gate fires only on "View Full Profile" click
const [showGate, setShowGate] = useState(false)

function handleViewProfile(url: string) {
  if (isUnlocked) {
    window.open(url, '_blank', 'noopener,noreferrer')
  } else {
    setPendingProfileUrl(url)
    setShowGate(true)  // ← gate opens here
  }
}

// AFTER: gate fires on mount if not unlocked
const [showGate, setShowGate] = useState(!isUnlocked)  // ← immediate if locked

function handleViewProfile(url: string) {
  // No gate check here — gate was already passed at page load
  window.open(url, '_blank', 'noopener,noreferrer')
}
```

The expert grid render is conditionally blocked:
```tsx
// AFTER: grid only renders after gate is passed
{isUnlocked ? (
  <ExpertGrid ... />
) : null}  // or: show blurred placeholder
```

**Modified component: `NewsletterGateModal.tsx`**

The dismiss button must be removed or disabled in the email-first gate mode. The existing modal has an `onDismiss` prop and an × button. Two approaches:

Option A — Add `allowDismiss?: boolean` prop (defaults to `true` for backward compat if modal is reused elsewhere):
```tsx
interface NewsletterGateModalProps {
  isOpen: boolean
  onSubscribe: (email: string) => void
  onDismiss: () => void
  allowDismiss?: boolean  // NEW — false for email-first mode
}
```

Option B — Remove dismiss entirely since the modal is only used in one place (MarketplacePage). Cleaner.

Recommended: Option B, since `NewsletterGateModal` is only rendered in `MarketplacePage.tsx` (verified by inspection).

**Bypass logic unchanged:**
```typescript
// These three conditions all short-circuit the gate — unchanged
const legacyUnlocked =
  localStorage.getItem('tcs_gate_email') !== null ||
  localStorage.getItem('tcs_email_unlocked') !== null
const isUnlocked = subscribed || legacyUnlocked
```

The `useNltrStore` storage key `'tinrate-newsletter-v1'` is LOCKED — do not change it.

**What changes:**

| Location | Change | Type |
|----------|--------|------|
| `MarketplacePage.tsx` | `useState(!isUnlocked)` instead of `useState(false)` for `showGate` | MODIFIED |
| `MarketplacePage.tsx` | `handleViewProfile` — remove gate check, always open profile directly | MODIFIED |
| `MarketplacePage.tsx` | Wrap ExpertGrid/ExpertList render in `{isUnlocked ? ... : null}` | MODIFIED |
| `NewsletterGateModal.tsx` | Remove × dismiss button; remove `onDismiss` call from overlay click | MODIFIED |
| Backend | No changes | UNCHANGED |

---

### Feature 2: Admin "See All" Buttons on TopExpertsCard and TopQueriesCard

**Current state:** Both cards in `OverviewPage.tsx` are self-contained components that fetch data, slice to top-5, and render inline. `ZeroResultQueriesCard` already has `<Link to="/admin/gaps">See all &rarr;</Link>` as the reference pattern.

**Target state:** Both cards add a "See all →" link navigating to a dedicated full-list page. The pages pass the current `days` value as a URL param so the same period filter applies on the destination.

**Modified component: `TopExpertsCard` in `OverviewPage.tsx`**

```tsx
// BEFORE: no link
<div className="flex items-center gap-2 mb-4">
  <TrendingUp className="w-4 h-4 text-purple-400" />
  <h2 className="text-sm font-semibold text-white">Top Clicks</h2>
</div>

// AFTER: add "See all →" link matching ZeroResultQueriesCard pattern
<div className="flex items-center justify-between mb-4">
  <div className="flex items-center gap-2">
    <TrendingUp className="w-4 h-4 text-purple-400" />
    <h2 className="text-sm font-semibold text-white">Top Clicks</h2>
  </div>
  <Link to={`/admin/top-experts?days=${days}`} className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
    See all &rarr;
  </Link>
</div>
```

**Modified component: `TopQueriesCard` in `OverviewPage.tsx`** — same pattern, links to `/admin/top-searches?days={days}`.

**New component: `TopExpertsPage.tsx`**

```typescript
// frontend/src/admin/pages/TopExpertsPage.tsx
// Reads ?days from URL, fetches full exposure list, renders ranked table

export default function TopExpertsPage() {
  const [searchParams] = useSearchParams()
  const [days, setDays] = useState(Number(searchParams.get('days')) || 7)

  // adminFetch('/events/exposure', { days }) — same endpoint as OverviewPage card
  // but NO slice(0, 5) — render full list
  // Uses same AdminCard/AdminPageHeader components
}
```

**New component: `TopSearchesPage.tsx`**

```typescript
// frontend/src/admin/pages/TopSearchesPage.tsx
// adminFetch('/analytics/top-queries', { days, limit: 100 })
// 'limit: 100' instead of 'limit: 5'
```

**Router registration** in `AdminApp.tsx` (or wherever admin routes are registered):
```tsx
const TopExpertsPage = lazy(() => import('./pages/TopExpertsPage'))
const TopSearchesPage = lazy(() => import('./pages/TopSearchesPage'))
// Add routes: /admin/top-experts, /admin/top-searches
```

**What changes:**

| Location | Change | Type |
|----------|--------|------|
| `OverviewPage.tsx` — `TopExpertsCard` | Add "See all →" link to `/admin/top-experts?days=${days}` | MODIFIED |
| `OverviewPage.tsx` — `TopQueriesCard` | Add "See all →" link to `/admin/top-searches?days=${days}` | MODIFIED |
| `TopExpertsPage.tsx` | Full ranked exposure list, reads `?days` from URL | NEW |
| `TopSearchesPage.tsx` | Full ranked query frequency list, reads `?days` from URL | NEW |
| `AdminApp.tsx` or router file | Register two new lazy-loaded routes | MODIFIED |
| Backend `GET /api/admin/events/exposure` | No change — already returns all rows (no limit param) | UNCHANGED |
| Backend `GET /api/admin/analytics/top-queries` | No change — already accepts `limit` param | UNCHANGED |
| `AdminSidebar.tsx` | Optionally add nav items; can defer since pages reachable from cards | OPTIONAL |

---

### Feature 3: Email-Based Activity Tracking

**Current state:** `tracking.ts` sends only `session_id` (anonymous). The `lead_timeline` endpoint merges identified activity (via email on `conversations` and `lead_clicks`) with pre-gate anonymous activity (via `session_id` on `user_events` — only the session_id captured at newsletter signup time). Post-gate search and filter events in `user_events` are NOT attributed to the lead's email.

**The gap in the current timeline:** After a user submits their email at the gate, their subsequent `search_query` and `filter_change` events in `user_events` are stored under an anonymous `session_id`. The admin lead timeline cannot show these events because there's no join between `user_events.session_id` and the lead's email.

**Target state:** After email submission, `trackEvent()` includes the known email in the request. The `user_events` table stores a nullable `email` column. `lead_timeline` gains a direct `WHERE email = X` query on `user_events`.

**Schema change: `app/models.py`**

```python
class UserEvent(Base):
    __tablename__ = "user_events"
    __table_args__ = (
        Index("ix_user_events_type_created", "event_type", "created_at"),
        Index("ix_user_events_email", "email"),  # NEW index
    )
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    session_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    payload: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)  # NEW
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, ...)
```

**Migration: `app/main.py` lifespan** (idempotent, established pattern):
```python
with engine.connect() as _conn:
    try:
        _conn.execute(_text("ALTER TABLE user_events ADD COLUMN email TEXT"))
        _conn.commit()
    except Exception:
        pass  # Already exists — idempotent
```

**Backend change: `app/routers/events.py`**

```python
class EventRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=64)
    event_type: EVENT_TYPES
    payload: dict[str, Any] = Field(default_factory=dict)
    email: str | None = None  # NEW — optional, from identified users only

@router.post("/api/events", status_code=202)
def record_event(body: EventRequest, db: Session = Depends(get_db)):
    record = UserEvent(
        session_id=body.session_id,
        event_type=body.event_type,
        payload=json.dumps(body.payload),
        email=body.email,  # NEW — stored if provided, None otherwise
    )
    db.add(record)
    db.commit()
    return {"status": "accepted"}
```

**Frontend change: `frontend/src/tracking.ts`**

```typescript
// BEFORE
export function trackEvent(event_type: EventType, payload: TrackPayload = {}): void {
  const session_id = getSessionId()
  void fetch(`${API_BASE}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ session_id, event_type, payload }),
  })
}

// AFTER — add email read from Zustand store
import { useNltrStore } from './store/nltrStore'

export function trackEvent(event_type: EventType, payload: TrackPayload = {}): void {
  const session_id = getSessionId()
  const email = useNltrStore.getState().email  // null if not yet subscribed
  void fetch(`${API_BASE}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({
      session_id,
      event_type,
      payload,
      ...(email ? { email } : {}),  // Only include if non-null
    }),
  })
}
```

Note: `useNltrStore.getState()` is a Zustand static method — works outside React components. The same pattern is already used in `ExpertCard._fireLeadClick` (`useNltrStore.getState().email`). No hook constraint applies.

**Backend change: `app/routers/admin/leads.py` — `get_lead_timeline()`**

```python
# AFTER: add direct email query on user_events in addition to session_id join
# Step 3 (existing): session-linked events via subscriber.session_id
# Step 3b (NEW): direct email-keyed user_events
email_event_rows = db.scalars(
    select(UserEvent).where(
        UserEvent.email == email,
        UserEvent.event_type == "search_query",
    )
).all()
for row in email_event_rows:
    payload_data = json.loads(row.payload or "{}")
    search_events.append({
        "type": "search",
        "query": payload_data.get("query_text", ""),
        "result_count": payload_data.get("result_count", 0),
        "created_at": row.created_at.isoformat(),
    })
# Deduplication: sort by created_at handles any overlap between session_id and email queries
```

**What changes:**

| Location | Change | Type |
|----------|--------|------|
| `app/models.py` — `UserEvent` | Add `email: Mapped[str | None]` column + index | MODIFIED |
| `app/main.py` lifespan | Add idempotent `ALTER TABLE user_events ADD COLUMN email TEXT` | MODIFIED |
| `app/routers/events.py` — `EventRequest` | Add `email: str | None = None` field | MODIFIED |
| `app/routers/events.py` — `record_event()` | Pass `email=body.email` to `UserEvent()` | MODIFIED |
| `frontend/src/tracking.ts` | Import `useNltrStore`; read `.getState().email`; include in request body | MODIFIED |
| `app/routers/admin/leads.py` — `get_lead_timeline()` | Add `UserEvent WHERE email = X` query; append to `search_events` list | MODIFIED |

---

## Component Boundaries: New vs Modified

| Component | Status | File | What Changes |
|-----------|--------|------|--------------|
| `MarketplacePage.tsx` | MODIFIED | `frontend/src/pages/MarketplacePage.tsx` | Gate on mount; `handleViewProfile` removes gate check; grid conditional on `isUnlocked` |
| `NewsletterGateModal.tsx` | MODIFIED | `frontend/src/components/marketplace/NewsletterGateModal.tsx` | Remove × dismiss button and overlay-click dismiss |
| `tracking.ts` | MODIFIED | `frontend/src/tracking.ts` | Import `useNltrStore`; include email if non-null |
| `OverviewPage.tsx` | MODIFIED | `frontend/src/admin/pages/OverviewPage.tsx` | Add "See all →" links in `TopExpertsCard` and `TopQueriesCard` header rows |
| `UserEvent` model | MODIFIED | `app/models.py` | Add `email TEXT` nullable column + index |
| `EventRequest` Pydantic | MODIFIED | `app/routers/events.py` | Add optional `email` field |
| `record_event()` | MODIFIED | `app/routers/events.py` | Persist `email` to `UserEvent` row |
| `get_lead_timeline()` | MODIFIED | `app/routers/admin/leads.py` | Add direct email-keyed `UserEvent` query |
| `main.py` lifespan | MODIFIED | `app/main.py` | Add idempotent `user_events.email` column migration |
| `TopExpertsPage.tsx` | NEW | `frontend/src/admin/pages/TopExpertsPage.tsx` | Full ranked list of experts by click volume |
| `TopSearchesPage.tsx` | NEW | `frontend/src/admin/pages/TopSearchesPage.tsx` | Full ranked list of search queries by frequency |
| Admin route config | MODIFIED | `frontend/src/admin/AdminApp.tsx` or router | Register two new lazy-loaded routes |

---

## Data Flow

### Email-First Gate Flow

```
App mounts (MarketplacePage)
  → isUnlocked = useNltrStore.subscribed || legacy localStorage keys
  → false → useState(!isUnlocked) = useState(true) → showGate = true immediately
  → NewsletterGateModal renders as blocking overlay (no dismiss)
  → ExpertGrid: {isUnlocked ? <ExpertGrid /> : null} — not rendered yet

  → User types email + submits
  → handleSubscribe(email):
      1. useNltrStore.setSubscribed(email) → Zustand + localStorage persist
      2. setShowGate(false)
      3. fire-and-forget POST /api/newsletter/subscribe {email, session_id}
  → isUnlocked becomes true → ExpertGrid renders

  → Returning visitor (isUnlocked = true from localStorage):
      → useState(!isUnlocked) = useState(false) → showGate never opens
      → ExpertGrid renders immediately (no gate flash)
```

### Email-Enriched Event Tracking Flow

```
User action (card_click, search_query, filter_change) — post-gate
  → trackEvent('search_query', { query_text, result_count, ... })
      → email = useNltrStore.getState().email  → 'user@example.com'
      → POST /api/events { session_id, event_type, payload, email: 'user@example.com' }
          → UserEvent row: { session_id, event_type, payload, email: 'user@example.com' }

User action — pre-gate (no email in nltrStore yet)
  → trackEvent('search_query', { ... })
      → email = useNltrStore.getState().email  → null
      → POST /api/events { session_id, event_type, payload }  (no email field)
          → UserEvent row: { session_id, event_type, payload, email: null }

Admin views lead timeline for email X:
  → GET /api/admin/lead-timeline/{email}
      1. Conversations WHERE email = X          [chat flow, legacy]
      2. LeadClicks WHERE email = X             [expert card clicks by identified users]
      3. UserEvents WHERE session_id = subscriber.session_id  [pre-gate anon session]
      4. UserEvents WHERE email = X             [NEW: post-gate events enriched with email]
      → merge all four sources → sort newest-first → paginate
```

### "See All" Navigation Flow

```
OverviewPage (days=7)
  → TopExpertsCard renders top-5 from /events/exposure
  → "See all →" link → /admin/top-experts?days=7
      → TopExpertsPage reads useSearchParams('days') → 7
      → adminFetch('/events/exposure', { days: 7 })  → all rows (no limit)
      → Full ranked list rendered with period toggle

  → TopQueriesCard renders top-5 from /analytics/top-queries?limit=5
  → "See all →" link → /admin/top-searches?days=7
      → TopSearchesPage reads useSearchParams('days') → 7
      → adminFetch('/analytics/top-queries', { days: 7, limit: 100 })
      → Full ranked list rendered with period toggle
```

---

## Build Order

```
1. Backend schema + events endpoint (user_events.email column + EventRequest update)
   Why first: Frontend tracking.ts can start sending email immediately once backend
   accepts the field. Schema change is additive (nullable column) — no breaking change.
   Risk: zero — nullable column, backward-compatible endpoint change.
   Files: models.py, main.py (migration), events.py

2. Frontend tracking.ts email enrichment
   Why second: Depends on backend accepting email field (step 1).
   Simple change: one import, one .getState() call, one spread in request body.
   Immediate effect: all post-gate events from this point get email attribution.
   Files: tracking.ts

3. Frontend email-first gate (MarketplacePage + NewsletterGateModal)
   Why third: Independent of tracking but builds on the same useNltrStore.
   After this ships, email is captured earlier — tracking enrichment (step 2) now
   applies from the very first page interaction, not just post "View Full Profile".
   Files: MarketplacePage.tsx, NewsletterGateModal.tsx

4. Backend lead-timeline email query update
   Why fourth: Depends on step 1 (email column must exist). More useful after
   steps 2-3 have populated some email-enriched events in user_events.
   Files: app/routers/admin/leads.py

5. Admin "See All" pages + OverviewPage links
   Why fifth: Fully independent of steps 1-4. Can be built at any point.
   Placed last to allow tracking/gate work to stabilize first.
   Files: TopExpertsPage.tsx, TopSearchesPage.tsx, OverviewPage.tsx, AdminApp.tsx router
```

---

## Existing Contracts That Must Not Break

| Contract | Used By | Risk if Changed |
|----------|---------|-----------------|
| `useNltrStore` localStorage key `'tinrate-newsletter-v1'` | All returning visitors | LOCKED — changing it forces re-gate for all existing subscribers |
| `useNltrStore` shape `{ subscribed, email }` | MarketplacePage, ExpertCard, tracking.ts (after v5.2) | No shape change needed |
| `POST /api/newsletter/subscribe` body `{email, source?, session_id?}` | MarketplacePage.handleSubscribe | No change needed |
| `POST /api/events` body `{session_id, event_type, payload}` | tracking.ts (all call sites) | Adding optional `email` is backward-compatible; existing payloads without email still valid |
| `TopExpertsCard` and `TopQueriesCard` `days` prop from `OverviewPage` | OverviewPage period toggle | Not changing; `days` still passed as prop; link encodes it in URL |
| `lead_clicks` POST at `/api/admin/lead-clicks` | ExpertCard._fireLeadClick | No change — this remains the primary identified-click path |
| `ExpertCard` `onViewProfile` prop signature | ExpertGrid, ExpertList | Prop still required; implementation in MarketplacePage changes (removes gate check) |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Dual Gate Enforcement

**What people do:** Leave the "View Full Profile" gate check inside `handleViewProfile` alongside the new mount-time gate.
**Why it's wrong:** Users who bypass localStorage (private browsing) see the gate twice — once on mount and once on click. Returning visitors who somehow clear storage mid-session see inconsistent behavior.
**Do this instead:** After the mount-time gate is confirmed working, remove the gate check from `handleViewProfile` entirely. The mount gate is the single enforcement point.

### Anti-Pattern 2: Email in payload JSON blob instead of a dedicated column

**What people do:** Include `email` inside the `payload` dict in `user_events` rather than adding a column.
**Why it's wrong:** Requires `json_extract(payload, '$.email')` in every admin query. No index possible. The `get_lead_timeline()` join becomes a full table scan.
**Do this instead:** Dedicated `email TEXT` column with an index. One `ALTER TABLE` migration.

### Anti-Pattern 3: Calling useNltrStore as a React hook inside tracking.ts

**What people do:** Try to call `const { email } = useNltrStore()` inside `trackEvent()`.
**Why it's wrong:** `tracking.ts` is a module function, not a React component. React hooks are illegal outside component render context — this throws "Invalid hook call".
**Do this instead:** `useNltrStore.getState().email` — Zustand's static `.getState()` works in any context. The identical pattern already exists in `ExpertCard._fireLeadClick`.

### Anti-Pattern 4: Hard-coding limit: 5 in "See All" pages

**What people do:** Copy `TopExpertsCard` fetch logic into `TopExpertsPage` but forget to remove the `.slice(0, 5)` or `limit: 5`.
**Why it's wrong:** "See All" page shows the same 5 rows as the overview card — useless.
**Do this instead:** `adminFetch('/events/exposure', { days })` with no limit param (endpoint returns all rows); `adminFetch('/analytics/top-queries', { days, limit: 100 })`.

### Anti-Pattern 5: Blocking ExpertGrid with a loading spinner instead of null

**What people do:** Show a full-page spinner while waiting for gate, then animate the grid in.
**Why it's wrong:** Creates a confusing "loading" state when the page is actually waiting for user input, not data.
**Do this instead:** Render `null` for the grid area while the gate modal is open. The gate modal IS the content. No spinner needed.

---

## Scaling Considerations

At current scale (hundreds of leads, single Railway instance), all three features are low-risk additions.

| Concern | At Current Scale | At Scale |
|---------|-----------------|----------|
| `user_events.email` index | Zero risk — nullable index on a modest table | Fine to 10M rows with this index |
| `get_lead_timeline()` merge-sort | Fine — per-lead data volumes are small | Would need materialized table at 100k+ leads |
| "See All" pages | Zero risk — same queries as overview cards, just without limit | Same as today |
| Email-first gate UX | Negligible impact — one synchronous localStorage read | N/A — client-side only |

---

## Sources

- Direct codebase inspection at `/Users/sebastianhamers/Documents/TCS` (v5.1)
- `app/models.py`, `app/routers/events.py`, `app/routers/newsletter.py`
- `app/routers/admin/leads.py`, `app/routers/admin/analytics.py`, `app/routers/admin/events.py`, `app/routers/admin/__init__.py`
- `frontend/src/tracking.ts`, `frontend/src/store/nltrStore.ts`, `frontend/src/hooks/useEmailGate.ts`
- `frontend/src/pages/MarketplacePage.tsx`, `frontend/src/components/marketplace/ExpertCard.tsx`
- `frontend/src/components/marketplace/NewsletterGateModal.tsx`, `frontend/src/components/marketplace/ProfileGateModal.tsx`
- `frontend/src/admin/pages/OverviewPage.tsx`, `frontend/src/admin/hooks/useAdminData.ts`
- `frontend/src/admin/pages/LeadsPage.tsx`
- Confidence: HIGH — all conclusions drawn from actual running v5.1 code

---

*Architecture research for: v5.2 Email-First Gate, Admin See-All, Email-Based Tracking*
*Researched: 2026-03-04*
