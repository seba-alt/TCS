# Feature Research

**Domain:** Expert marketplace — email-first gate, admin "See All" expansion, email-based tracking
**Milestone:** v5.2 Email-First Gate & Admin See-All
**Researched:** 2026-03-04
**Confidence:** HIGH overall — codebase fully inspected; patterns verified against current sources

---

## Context: What Already Exists (do NOT re-implement)

This is an additive milestone on a shipped v5.1 product. All research below is scoped to the
three new feature areas only.

| Existing Baseline | Status |
|-------------------|--------|
| `useEmailGate` hook — `localStorage` key `tcs_gate_email`, lazy initializer, fire-and-forget backend call | Live — reuse, do NOT rewrite |
| `ProfileGateModal` — AnimatePresence modal wrapping `EmailGate` form, triggered on "View Full Profile" click | Live — keep as fallback for direct-link users who bypass page entry |
| `POST /api/email-capture` — idempotent SQLite upsert, Loops sync, returns `{status: "ok"}` | Live — no changes needed |
| `email_leads` table — `id`, `email` (unique), `created_at` | Live — the identity anchor for v5.2 |
| `user_events` table — `session_id` (anonymous), `event_type`, `payload`, `created_at` | Live — will gain `email` column for direct attribution |
| `lead_clicks` table — `email`, `expert_username`, `search_query`, `created_at` | Live — already email-keyed; model for new tracking approach |
| `OverviewPage` — `TopExpertsCard` (shows 5), `TopQueriesCard` (shows 5), period toggle | Live — add "See All" links/buttons to both cards |
| Admin `TopExpertsCard` fetches `GET /events/exposure?days=X` (returns full list, sliced to 5 on frontend) | Live — data already available; only the UI cap needs changing |
| Admin `TopQueriesCard` fetches `GET /analytics/top-queries?days=X&limit=5` | Live — `limit` param exists; change to `limit=50` or remove cap |
| `trackEvent()` module function — fire-and-forget `POST /api/events` with `session_id` | Live — extend to optionally include `email` |
| Lead journey timeline — expandable rows in `LeadsPage` with chronological search/click history | Live — will benefit from richer email-attributed data |

---

## Feature Landscape

### Table Stakes (Users Expect These)

These are the behaviors users and admins expect without being told. Missing them = confusion or
data gaps that erode trust in the product.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Email gate fires on page entry | Any gated marketplace gates before browsing. Users expect to identify themselves upfront — not be surprised mid-session. Gating on "View Full Profile" means the admin captures leads only after users browse, leaving early-exit visitors untracked. | LOW | New `EntryGateModal` component; shown when `!isUnlocked` on first render of `ExplorerPage`. Reuses existing `EmailGate` form + `useEmailGate` hook. Returning visitors bypass instantly via `localStorage` check (no flash). |
| "See All" on Top Experts card | Admin cards that cap a ranked list at 5 must link to the full list. Without it, the admin cannot act on data beyond rank 5 — the card is informational only, not actionable. | LOW | Inline expansion toggle (show all rows in-card) OR a `Link` to a dedicated full-list view. The data already comes back as a full list from the API; the cap is a frontend `.slice(0, 5)`. |
| "See All" on Top Searches card | Same rationale as Top Experts. The `limit=5` passed to `GET /analytics/top-queries` must be increased or removed to expose the full ranked list. | LOW | Same pattern as Top Experts — either expand in-card or link to full list. Backend `limit` param already supports arbitrary values. |
| Email identity on tracked events | When a user has submitted their email, all subsequent `user_events` rows should carry that email for direct attribution. Without it, the admin cannot correlate "who searched for X" with a known lead — the session_id is anonymous and not reliably linkable to email. | MEDIUM | Add `email: string \| null` to `EventRequest` Pydantic model and `UserEvent` table. Frontend passes `useEmailGate().email` at call sites in `trackEvent()`. SQLite `ALTER TABLE` migration at startup. |

### Differentiators (Competitive Advantage)

These are the features that make v5.2 meaningfully better, not just technically complete.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Dismissible entry gate with hard skip option | A mandatory no-dismiss gate converts better for serious users but frustrates casual visitors who want to browse before committing. An optional "Skip for now — gate resurfaces on 'View Full Profile'" path reduces bounce while still capturing high-intent leads. Research: fullscreen welcome gates with an alternative exit path outperform mandatory-only gates (OptinMonster, 2025). | LOW | Add a "Skip for now" link below the CTA. On skip: do not set `localStorage`; gate re-triggers on "View Full Profile" click (existing behavior). This is a single `onDismiss` prop already present on `ProfileGateModal` — wire the same behavior to the entry modal. |
| In-card expansion (not redirect) for "See All" | Navigating away from Overview to see rank 6–50 breaks the admin's mental context (they are reviewing the period snapshot). Expanding in-card keeps the period toggle active and the full dashboard visible. Standard pattern in SaaS admin dashboards (Vercel, Linear, Stripe): overflow items hidden behind an expand toggle, not a page navigation. | LOW | `useState<boolean>(expanded)` in `TopExpertsCard` and `TopQueriesCard`; toggle renders full list vs `.slice(0, 5)`. "Show fewer" collapses back. No new route needed. |
| Email-attributed search tracking for lead timeline | The existing lead journey timeline in `LeadsPage` shows search/click history, but only when a lead's email was already on the `Conversation` table (chat flow) or `lead_clicks` table. Explorer search queries tracked via `user_events` are currently anonymous. Email-attributed `search_query` events would extend the timeline to Explorer sessions, making it a complete picture of what each lead searched for. | MEDIUM | Requires email column on `user_events` + passing email in `trackEvent()` at the `search_query` call site in `useExplore.ts`. The timeline query in the admin then joins on `user_events.email = lead.email` for `search_query` events. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Mandatory non-dismissible entry gate | "Capture email from every visitor, no exceptions" | Blocks all casual traffic, including shareable links passed around in sales contexts. A prospect receiving a link from a Tinrate rep who cannot browse without emailing is a friction point — not a conversion. Also: Google penalizes intrusive interstitials that block content on mobile (Core Web Vitals). | Dismissible gate with "Skip for now" link. Gate resurfaces on "View Full Profile" click (existing behavior). High-intent users email; casual browsers proceed. |
| Full-page entry gate (replaces router render) | "Prevent any rendering before email" | Breaks shareable filtered URLs — the URL params are loaded by the store but the grid never renders. Also prevents SEO indexing of the explorer surface (no content visible to crawlers). | Overlay modal on top of rendered content. Content is visible but blurred/pointer-events:none while modal is open, or simply obscured by modal backdrop. Store and filters load normally beneath. |
| Tie ALL existing `user_events` session_ids to emails retrospectively | "We want to know who did what before v5.2" | `user_events.session_id` is a random client-generated string with no persistent identity. There is no reliable way to correlate existing anonymous events to emails — the join does not exist in the data model. Any retrospective attribution would be guesswork. | Accept the data gap. Email attribution starts from v5.2 forward. Document the cutoff date in admin. |
| Replace `session_id` with email as the primary event identifier | "Email is more useful than session_id for analytics" | `session_id` serves anonymous pre-gate tracking (before the user emails). Removing it would create a gap where filter changes and card clicks before email submission are unrecorded. | Keep `session_id` on `UserEvent`. Add `email` as a nullable column that is populated once the gate is submitted. Both fields coexist — one for anonymous sessions, one for identified sessions. |
| Dedicated "See All" page routes (`/admin/top-experts`, `/admin/top-searches`) | "Cleaner UX to have a dedicated page" | Adds 2 new routes, 2 new components, 2 new sidebar entries (or hidden routes), and breaks the period toggle context (new page must re-implement the same toggle). Implementation cost is 5x the in-card expansion approach with no user-facing benefit. | In-card expansion toggle. "Show all / Show fewer" within the existing card. Data already available from the API. |

---

## Feature Dependencies

```
[Entry gate modal on page load]
    └──reuses──> [useEmailGate hook] (already built, STORAGE_KEY unchanged)
    └──reuses──> [EmailGate form component] (already built)
    └──reuses──> [AnimatePresence from motion/react] (already in codebase)
    └──renders over──> [ExplorerPage] (page loads normally beneath)
    └──bypasses on──> [localStorage STORAGE_KEY present] (returning visitors)
    └──skip path────> [onDismiss: no localStorage write → gate resurfaces on "View Full Profile"]
    └──note: ProfileGateModal stays in codebase for users who somehow reach the page
             while unlocked=false (e.g. a direct link after clearing storage)

["See All" expansion on TopExpertsCard]
    └──requires no API change──> [GET /events/exposure already returns full list]
    └──frontend change only──> [remove .slice(0, 5) behind useState(expanded) toggle]
    └──independent of all other v5.2 features]

["See All" expansion on TopQueriesCard]
    └──requires minor API change──> [GET /analytics/top-queries?limit=5 → remove limit cap or increase to 50]
    └──frontend change──> [remove .slice behind expanded toggle]
    └──independent of all other v5.2 features]

[Email-attributed event tracking]
    └──requires──> [email column on user_events table (SQLite ALTER TABLE nullable)]
    └──requires──> [email field on EventRequest Pydantic model (optional, default null)]
    └──requires──> [trackEvent() accepts optional email param]
    └──requires──> [call sites pass useEmailGate().email — ExpertCard, useExplore, RateSlider, TagMultiSelect]
    └──enhances──> [lead journey timeline in LeadsPage — can now include Explorer search events]
    └──note: no change to session_id — it stays as the anonymous identifier pre-gate]
    └──note: email column is nullable — events before gate submission have email=null]

[Entry gate modal] ──enables──> [Email-attributed event tracking]
    (email is set in localStorage/state after gate submit; subsequent events carry it)
```

### Dependency Notes

- **Entry gate is independent of email attribution:** The gate can ship and capture emails
  without the events table change. Attribution is additive and ships in the same milestone.
- **"See All" is fully independent:** No backend changes for TopExpertsCard; one query param
  change for TopQueriesCard. These are low-risk, ship first.
- **Email attribution requires a startup migration:** `ALTER TABLE user_events ADD COLUMN email
  TEXT NULL` is idempotent and safe on SQLite. Match the existing startup migration pattern
  (`idempotent_startup_migration`).
- **No breaking change to existing `trackEvent()` callers:** Email is an optional param with
  default `null`. All existing call sites work without modification; only the 4-5 relevant
  call sites need updating.
- **`lead_clicks` table already uses email as key:** The pattern is proven in the codebase.
  `user_events` adopts the same identity model for email-known sessions.

---

## MVP Definition

### Launch With (v5.2 — the three agreed features)

- [ ] "See All" expansion on TopExpertsCard — independent, lowest risk, ship first
- [ ] "See All" expansion on TopQueriesCard — same pattern, ship together
- [ ] Entry gate modal on page load — reuses existing components, returning visitor bypass built in
- [ ] Email attribution on `user_events` — `email` column + optional param in `trackEvent()`

### Add After Validation (v5.x)

- [ ] Email-attributed search events in lead journey timeline — requires joining
  `user_events WHERE event_type='search_query' AND email=lead.email`; ship once v5.2
  attribution data has accumulated (a few days of production data confirms the column
  is being populated correctly)
- [ ] "Show fewer" collapse on expanded cards — QoL; ship with the expansion feature or
  immediately after if the expanded list feels overwhelming

### Future Consideration (v6+)

- [ ] Rate-limit gate re-triggers for skip users (e.g. show entry gate again after 3 sessions
  without submitting) — requires session counting, not in scope
- [ ] Entry gate A/B test (mandatory vs dismissible) — requires a feature flag system

---

## Feature Prioritization Matrix

| Feature | User/Admin Value | Implementation Cost | Priority |
|---------|-----------------|---------------------|----------|
| "See All" — TopExpertsCard | HIGH (admin can act on data beyond rank 5) | LOW (frontend only) | P1 |
| "See All" — TopQueriesCard | HIGH (same rationale) | LOW (one query param + frontend toggle) | P1 |
| Entry gate on page load | HIGH (captures leads who browse and exit without clicking a profile) | LOW (reuses all existing components) | P1 |
| Email attribution on user_events | MEDIUM (enriches lead timeline; unlocks search attribution) | MEDIUM (DB migration + 4-5 call site updates) | P1 |
| "Show fewer" collapse on cards | LOW (nice-to-have polish) | LOW | P2 |
| Email events in lead timeline join | MEDIUM (more complete lead journey) | LOW (query change in admin endpoint) | P2 |

**Priority key:**
- P1: Must have for v5.2 milestone
- P2: Add once v5.2 data has been validated in production
- P3: Defer to later milestone

---

## Per-Feature Implementation Notes

### 1. Entry Gate Modal on Page Load

**Current state:** `ProfileGateModal` is triggered on "View Full Profile" click in `ExpertCard`.
`useEmailGate()` returns `isUnlocked` (from `localStorage`). Returning visitors are immediately
unlocked with no flash.

**Target state:** `ExplorerPage` (or `App.tsx` root) checks `isUnlocked` on mount. If false,
renders a full-screen `EntryGateModal` over the page. The page content loads normally beneath —
grid renders, filters work, store hydrates — but the modal backdrop covers it visually.

**Key design decisions:**
- Do NOT block rendering. Page loads behind the modal so the first interaction after email submit
  feels instant (grid is already loaded).
- Include a "Skip for now" dismiss path. On skip: no `localStorage` write; modal closes; gate
  returns on "View Full Profile" click (existing `ProfileGateModal` behavior unchanged).
- The `EntryGateModal` is a new thin wrapper component — it calls `useEmailGate().submitEmail`
  on submit, same as `ProfileGateModal`. No changes to `useEmailGate`, `EmailGate`, or
  `POST /api/email-capture`.
- Returning visitors: `isUnlocked=true` on first render (lazy `localStorage` read). Modal never
  mounts. Zero flash.

**Component:**
```tsx
// EntryGateModal.tsx — wraps EmailGate with entry-specific copy + optional dismiss
function EntryGateModal({ onSubmit, onSkip }: { onSubmit: ..., onSkip: () => void }) {
  // AnimatePresence wrapper (same as ProfileGateModal)
  // Headline: "Meet the experts" / body: "Enter your email to browse full profiles"
  // EmailGate form (reused)
  // "Skip for now" text link below CTA (calls onSkip)
}
```

**ExplorerPage usage:**
```tsx
const { isUnlocked, submitEmail } = useEmailGate()
const [skipped, setSkipped] = useState(false)

{!isUnlocked && !skipped && (
  <EntryGateModal onSubmit={submitEmail} onSkip={() => setSkipped(true)} />
)}
```

**Confidence:** HIGH — pure component composition over existing hooks and components.

---

### 2. "See All" Expansion on Admin Overview Cards

**Current state:** `TopExpertsCard` calls `.slice(0, 5)` on the full `exposure` array returned
by the API. `TopQueriesCard` passes `limit: 5` as a query param to
`GET /analytics/top-queries`.

**Target state:** Both cards have an expanded/collapsed state. Collapsed shows 5 rows (default).
Expanded shows all rows. Toggle button below the list: "Show all X" / "Show fewer".

**TopExpertsCard change (frontend only):**
```tsx
const [expanded, setExpanded] = useState(false)
const rows = expanded ? (data?.exposure ?? []) : (data?.exposure ?? []).slice(0, 5)
// Add below list:
{(data?.exposure ?? []).length > 5 && (
  <button onClick={() => setExpanded(e => !e)}>
    {expanded ? 'Show fewer' : `Show all ${data.exposure.length}`}
  </button>
)}
```

**TopQueriesCard change (frontend + minor backend):**
- Change `adminFetch<TopQueriesResponse>('/analytics/top-queries', { days, limit: 5 })` to
  `limit: 50` (or omit limit entirely if the backend supports it).
- Check `GET /analytics/top-queries` backend: if `limit` is required, set default=50 in the
  query param handler.
- Same expanded/collapsed toggle pattern as TopExpertsCard.

**Confidence:** HIGH — additive state toggle, no new components, data already available.

---

### 3. Email Attribution on User Events

**Current state:** `UserEvent` has `session_id` (anonymous, required) but no `email` column.
`trackEvent()` sends `{session_id, event_type, payload}`. Email is captured separately in
`email_leads` with no link to `user_events`.

**Target state:** `user_events` gains a nullable `email` column. After the entry gate is
submitted (or after any gate submit), `trackEvent()` includes the email in the payload.
Events before gate submit have `email=null`. Events after submit have `email=<submitted>`.

**Backend changes:**
1. Startup migration: `ALTER TABLE user_events ADD COLUMN email TEXT NULL`
2. `EventRequest` Pydantic model: `email: str | None = None`
3. `UserEvent` model: `email: Mapped[str | None] = mapped_column(String(320), nullable=True)`
4. `record_event` endpoint: pass `email=body.email` to `UserEvent(...)` constructor

**Frontend changes:**
1. `trackEvent()` signature: `trackEvent(event_type, payload, email?: string | null)`
2. `tracking.ts` internal: include `email` in the fetch body (or null if not provided)
3. Call sites to update (pass `useEmailGate().email`):
   - `useExplore.ts` — `search_query` events (most valuable for lead timeline)
   - `ExpertCard.tsx` — `card_click` events
   - `useHeaderSearch.ts` — `filter_change` events
   - `RateSlider.tsx` — `filter_change` events
   - `TagMultiSelect.tsx` — `filter_change` events

**Note on call site access:** These components do not currently call `useEmailGate()`.
Options:
- a) Add `useEmailGate()` hook call at each call site — clean, self-contained.
- b) Store `email` in Zustand (e.g. a `userSlice`) and read from store — removes hook
  coupling at individual components. Recommended if more than 5 call sites need it.
- c) Pass email as a param from parent component — adds prop-drilling, not preferred.

**Recommendation:** Add a `userSlice` to Zustand with `email: string | null` set on gate submit.
`trackEvent()` reads from `useExplorerStore.getState().email` (module-level call — avoids
React hook constraints). This is the cleanest extension of the existing pattern.

**Confidence:** HIGH for schema change (proven pattern from `lead_clicks` table). MEDIUM for
Zustand user slice (new, but simple). LOW for retrospective attribution (explicitly not in scope).

---

## Competitor Feature Analysis

| Feature | Standard Pattern | Our v5.2 Approach |
|---------|-----------------|-------------------|
| Email gate timing | Entry gate (before browse) OR action gate (before key action). Entry gate is standard for lead-gen-first products (Clearbit, Bombora). Action gate is standard for product-led products (Figma community). | Move to entry gate — Tinrate is lead-gen-first; every visitor is a potential qualified lead. |
| Gate dismiss option | Most welcome gates provide an exit option (close button or "No thanks" link). Mandatory-only gates see higher immediate bounce. | "Skip for now" link — captures high-intent visitors, reduces friction for casual browsers. |
| Admin card "See All" | Vercel/Linear/Stripe pattern: top-N items visible, "Show all" expansion in-card. Dedicated page for full history. | In-card expansion — keeps period toggle context intact, lower implementation cost. |
| Event identity model | Most analytics tools use both anonymous ID + identified ID. Identify call links them: `analytics.identify(userId, {email})`. | Retain session_id (anonymous pre-gate), add email column (identified post-gate). Same dual-identity pattern used by Segment/Amplitude. |

---

## Sources

- **Codebase inspection (HIGH confidence):** `frontend/src/hooks/useEmailGate.ts`,
  `frontend/src/components/EmailGate.tsx`, `frontend/src/components/marketplace/ProfileGateModal.tsx`,
  `frontend/src/admin/pages/OverviewPage.tsx`, `app/models.py`, `app/routers/events.py`,
  `app/routers/email_capture.py`, `frontend/src/tracking.ts`
- [Email Capture Best Practices 2026 — OptiMonk](https://www.optimonk.com/email-capture-best-practices/) — MEDIUM confidence
- [Mastering Modal UX Best Practices — Eleken](https://www.eleken.co/blog-posts/modal-ux) — MEDIUM confidence
- [Modal UX Design for SaaS 2026 — Userpilot](https://userpilot.com/blog/modal-ux-design/) — MEDIUM confidence
- [Gated Content Strategy — ProductLed](https://productled.com/blog/when-you-should-ungate-content) — MEDIUM confidence
- [Welcome Gate Best Practices — Intercom](https://www.intercom.com/blog/welcome-page/) — MEDIUM confidence
- Internal codebase patterns: `lead_clicks` table (email-keyed), `newsletter_subscribers.session_id` (cross-identity linking precedent)

---

*Feature research for: Tinrate Expert Marketplace v5.2 Email-First Gate & Admin See-All*
*Researched: 2026-03-04*
