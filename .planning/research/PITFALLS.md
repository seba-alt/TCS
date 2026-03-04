# Pitfalls Research

**Domain:** Adding email-first gate, admin "See All" expansion, and direct email-based tracking to a live React + FastAPI expert marketplace (v5.1 → v5.2)
**Researched:** 2026-03-04
**Confidence:** HIGH — based on direct codebase analysis of `MarketplacePage.tsx`, `useEmailGate.ts`, `nltrStore.ts`, `NewsletterGateModal.tsx`, `tracking.ts`, `OverviewPage.tsx`, `AdminCard.tsx`, `newsletter.py`, `email_capture.py`, `events.py`, `models.py`, `leads.py`, `analytics.py`, `events.py` (admin), plus targeted analysis of the three-way data model split between `newsletter_subscribers`, `email_leads`, and `user_events`.

The three change areas in v5.2 each carry distinct, non-obvious failure modes:
1. Email-first gate — moving gate from lazy (on "View Full Profile") to eager (on page entry) with two localStorage keys and two unlock paths already in the codebase
2. Admin "See All" expansion — adding full-list views to cards that currently call paginated endpoints with `limit: 5`
3. Email-based tracking — attaching email to search and click events currently stored anonymously via `session_id`

---

## Critical Pitfalls

Mistakes that cause data loss, broken gates, or admin views that silently show incomplete data.

---

### Pitfall 1: Dual-Key localStorage Creates a Split-Brain Unlock State

**What goes wrong:**
The codebase currently has two parallel unlock mechanisms:
1. `useEmailGate` hook writes `tcs_gate_email` (used in the legacy email gate flow)
2. `useNltrStore` (Zustand persisted) writes to `tinrate-newsletter-v1` with a `subscribed` boolean and `email` field
3. `MarketplacePage.tsx` already checks BOTH: `legacyUnlocked = localStorage.getItem('tcs_gate_email') !== null || localStorage.getItem('tcs_email_unlocked') !== null`

The email-first gate will add a third entry point to this unlock surface. If the implementation writes to `useNltrStore.setSubscribed()` but the check logic at page load reads `tcs_gate_email`, returning users who subscribed via the newsletter gate are gated again. Conversely, if the gate writes to `tcs_gate_email` but the downstream "View Full Profile" flow still reads from `nltrStore.subscribed`, a user who submitted the page-entry gate can still be blocked by the profile modal.

The specific two-key check in `MarketplacePage.tsx` (line 48–52) is the single canonical unlock check for the profile flow — any new gate submission path that does not write to BOTH keys, or update the canonical check, creates a case where a user submits their email and still sees the gate again on next visit.

**Why it happens:**
The codebase has accumulated two separate gate implementations over multiple milestones (v1.0 email gate → v2.2 newsletter gate). The `legacyUnlocked` check exists specifically to bridge returning v2.0 users. Adding a third gate without auditing which key it writes to breaks this bridge.

**How to avoid:**
Decide on a single unlock source of truth before implementation: `useNltrStore` is the right choice (it's Zustand-persisted, has richer state, and is what `MarketplacePage.tsx` already treats as primary). The email-first gate should call `setSubscribed(email)` from `useNltrStore` on submission — not create a new localStorage key. The `legacyUnlocked` check should remain as-is for backward compatibility with pre-newsletter users.

**Warning signs:**
- Users who submit the page-entry gate are still shown the gate on next page visit
- Users who submitted the old email gate (`tcs_gate_email`) are shown the new page-entry gate on first visit after deploy
- In dev tools, localStorage shows multiple gate-related keys with conflicting state (one shows subscribed=true, another shows no key)

**Phase to address:** Email-first gate phase — audit all unlock paths before adding a new entry point; write to `useNltrStore.setSubscribed()` exclusively.

---

### Pitfall 2: Page-Entry Gate Blocks the Explorer on Every Cold-Start for Returning Users if State Check Fires Too Late

**What goes wrong:**
The current gate in `MarketplacePage.tsx` is lazy — it only shows when the user clicks "View Full Profile". The `isUnlocked` check runs synchronously from `nltrStore.subscribed || legacyUnlocked`, which reads localStorage synchronously before first render (Zustand persist rehydration).

The email-first gate shows a full-page modal on load. If the gate is implemented as a `useState(false)` initialized to `false` and then set to `true` in a `useEffect` only when the user is NOT unlocked, there is a flash: the gate modal briefly renders as open, then immediately closes when the `useEffect` fires and discovers the user is already subscribed. On slow devices or cold cache loads, this flash is visible as a jarring overlay that disappears within 100–200ms.

The existing `useEmailGate` hook deliberately avoids this with a synchronous lazy `useState` initializer (`() => localStorage.getItem(STORAGE_KEY)`). If the page-entry gate does not use the same pattern, it will produce a flash of the gate overlay for all returning users on every page load.

**Why it happens:**
Developers default to `useState(false)` + `useEffect` for "should I show this?" UI patterns. The flash-of-incorrect-content problem is subtle — it works correctly in localhost (no network latency, instant hydration) but is noticeable on production Vercel with slower devices.

**How to avoid:**
The gate `isOpen` state must be initialized synchronously:
```typescript
// Correct: synchronous check, no flash
const [showGate, setShowGate] = useState(() => {
  const subscribed = useNltrStore.getState().subscribed
  const legacy = localStorage.getItem('tcs_gate_email') !== null || localStorage.getItem('tcs_email_unlocked') !== null
  return !subscribed && !legacy
})
```
Alternatively, read directly from `useNltrStore` via the hook (which reads from the Zustand store that is already hydrated from localStorage before first render). Do not use `useEffect` to determine whether to show the gate — it always fires after paint.

**Warning signs:**
- Returning users briefly see the gate overlay flash on every page load before it disappears
- Gate overlay appears for ~100ms on mobile devices even for subscribed users
- In React DevTools, the gate component mounts as `isOpen=true` and immediately re-renders to `isOpen=false` for subscribed users

**Phase to address:** Email-first gate phase — implement with synchronous state initialization, test on a throttled mobile connection in Chrome DevTools before shipping.

---

### Pitfall 3: Email-First Gate Breaks the Loops Integration for the "Source" Field

**What goes wrong:**
The newsletter gate currently calls `POST /api/newsletter/subscribe` with `source: "gate"` (hardcoded in the frontend) and the `sync_contact_to_loops` background task uses this source field to set the Loops userGroup. The `loops.py` contact sync sends `userGroup: "search"` regardless of source — the source field is stored in the DB but not currently forwarded to Loops as a group discriminator.

When the email-first gate is added, there will be two distinct lead acquisition moments:
1. Page entry (before any searching) — user has not yet shown search intent
2. "View Full Profile" click (after searching) — user has shown high purchase intent

If both paths call the same `POST /api/newsletter/subscribe` endpoint with the same `source: "gate"`, it becomes impossible to distinguish in Loops (or in the admin dashboard) which leads were captured pre-search vs. post-search. The admin will see a homogeneous leads list when the business distinction between these two cohorts is commercially significant.

Additionally, `newsletter.py` uses `on_conflict_do_nothing(index_elements=["email"])` — if a user submits the page-entry gate and then later clicks "View Full Profile", the second subscribe call is silently ignored. The source field is never updated to reflect the higher-intent action.

**Why it happens:**
The `source` field in `newsletter_subscribers` was designed for a single capture point. Adding a second capture point without adding a distinct source value makes the data ambiguous. The idempotency design (INSERT OR IGNORE) compounds this by making first-write-wins the rule, which means early low-intent captures shadow later high-intent captures.

**How to avoid:**
- Add a new source value for page-entry capture, e.g., `source: "page_entry"` vs. the existing `source: "gate"` (profile unlock trigger).
- Update `loops.py` to forward the source field to Loops as a custom contact property (`contactSource`) so the Loops contact record shows which acquisition point captured the lead.
- Accept that the idempotency behavior (first write wins for the same email) is correct for the DB but make the source meaningful on first capture. The "View Full Profile" gate should still work even if the email is already in the DB — the user is already unlocked at that point.

**Warning signs:**
- All leads in admin dashboard show `source: "gate"` with no distinction between page-entry captures and profile-unlock captures
- Loops contact list shows uniform userGroup with no way to segment pre-search vs post-search leads
- A user who submits the page-entry gate and then clicks "View Full Profile" is NOT redirected to their profile (the subscribe call is silently ignored but the redirect logic may depend on the subscribe response)

**Phase to address:** Email-first gate phase — define source values before building the gate UI; test the duplicate email flow explicitly.

---

### Pitfall 4: "See All" Links Navigate Away Instead of Expanding In-Place, Breaking Admin UX Flow

**What goes wrong:**
The existing "See All" pattern on `OverviewPage.tsx` uses React Router `Link` to navigate away:
- `ZeroResultQueriesCard` links to `/admin/gaps`
- `RecentLeadsCard` links to `/admin/leads`
- `RecentExploreSearchesCard` links to `/admin/data`

The v5.2 milestone wants "See All" expansion buttons on `TopExpertsCard` and `TopQueriesCard`. There are two interpretations:
1. **Navigate away** — `Link to="/admin/data"` (consistent with existing pattern, but loses the period toggle context)
2. **Expand in-place** — show more rows within the same card (richer UX, but requires local state + API call changes)

The risk is in-place expansion: `TopExpertsCard` fetches `/events/exposure` with `days` from the parent, and `TopQueriesCard` fetches `/analytics/top-queries` with `days` and `limit: 5`. The endpoints already support larger limits. But the card layout (AdminCard with `p-5`) is fixed-height in the current design — expanding to 20+ rows will overflow and either clip (if `overflow: hidden` is inherited) or expand the card to push all content below it down the page unexpectedly.

If "See All" navigates away to `/admin/data`, the period toggle selection (Today/7d/30d/All) is lost because `days` is local state in `OverviewPage` that is not persisted to the URL or to any shared store.

**Why it happens:**
The Overview page's period toggle controls all insight cards via a shared `days` prop, but this context is not propagated to other admin pages. "See All" navigation discards the current context.

**How to avoid:**
- For in-place expansion: add a `showAll: boolean` toggle to each card component with a local `useState`. When true, remove the `slice(0, 5)` from the data and switch the card to a scrollable container with `max-h-96 overflow-y-auto`. This avoids layout shift for the full page.
- For navigation: pass `days` as a query param in the Link URL (`to={/admin/data?days=${days}}`). The destination page can read it from `useSearchParams()` to restore context.
- Do not add a "See All" that fetches the full unfiltered dataset in a single API call without the `days` filter — this can return hundreds of rows and slow the admin panel.
- The simplest correct implementation: in-place expansion with a `max-h` scrollable container, no additional API calls (the current endpoints already return all results — the `slice(0, 5)` is client-side).

**Warning signs:**
- "See All" click navigates to the Data page with Today filter selected (default) rather than the period the admin was viewing on Overview
- In-place expansion causes the entire Overview page to jump as the card expands and pushes content below it down
- Expanded card is taller than the viewport on mobile, with no scroll affordance
- "See All" fetch hits the same endpoint but without a `limit` param — returns 500+ rows and the card hangs

**Phase to address:** Admin See-All phase — decide navigate vs. in-place before implementation; if in-place, cap with `max-h` + overflow scroll.

---

### Pitfall 5: Direct Email-Based Tracking Creates a Dual Data Model Without Retroactive Backfill

**What goes wrong:**
The current tracking architecture is:
- Anonymous: `user_events` table uses `session_id` (UUID in localStorage)
- Identified: `lead_clicks` table uses `email` (written by frontend when email is known)
- Bridge: `newsletter_subscribers.session_id` column links the two — but only for users who subscribed via the newsletter gate (not all users have this link)

The v5.2 goal is "direct email-based tracking" — attaching email to searches and clicks. The data model implication is:

**Option A — Add `email` column to `user_events`:** All new events from gated users carry email. Historical events (all events before v5.2) have `email = NULL`. Admin queries that aggregate by email will silently exclude all pre-v5.2 activity for every user. The lead timeline in `LeadsPage.tsx` already does a three-way merge (conversations + lead_clicks + session-linked user_events) — adding a fourth path (email-keyed user_events) will complicate this merge further.

**Option B — Continue using session_id + post-capture linking:** The subscribe endpoint already captures `session_id` at the moment of subscription. Pre-subscription events linked to that session_id can be joined at query time. This is the current approach but it only works if the session_id captured at subscribe time matches the session_id used for events — which breaks if the user clears localStorage or switches browsers.

**Option C — Client sends email in event payload:** After gate submission, `tracking.ts` could include the stored email in every event's payload. This adds email to the payload JSON blob without schema change. But `user_events.payload` is a JSON text column — querying by email requires `json_extract(payload, '$.email')` which is slow and cannot be indexed.

The risk is implementing Option C as a shortcut: it avoids schema changes but creates an unindexed email field in a JSONB blob that the admin queries will need to extract. As `user_events` grows (every search, every click), this becomes an O(n) scan for any per-email query.

**Why it happens:**
Email-in-payload feels like "just adding one field" and avoids a migration. The performance and indexing implications only surface when the admin timeline query becomes slow as the table grows.

**How to avoid:**
- Add a nullable `email` column to `user_events` with an index: `email: Mapped[str | None] = mapped_column(String(320), nullable=True, index=True)`. This is a non-breaking schema change (SQLite `Base.metadata.create_all` does not add columns to existing tables — requires an explicit `ALTER TABLE` migration).
- Write the migration explicitly: `ALTER TABLE user_events ADD COLUMN email TEXT;` as a startup migration in `main.py` (same pattern as the email purge migration).
- After gate submission, store email in `tracking.ts` alongside session_id: when email is available, include it in the event payload AND set `UserEvent.email` on the backend.
- The lead timeline query in `leads.py` can then join `user_events` directly on `email` instead of the session_id bridge — simpler, more reliable, and works retroactively for any events where email was captured.

**Warning signs:**
- Admin lead timeline shows blank activity for users who submitted the email-first gate (session_id at submit time does not match session from earlier browsing)
- "See All" for top searches doesn't show which emails drove which searches (data is session-only, no email attribution)
- `EXPLAIN QUERY PLAN` on the lead timeline query shows a full table scan on `user_events` when email filtering is done via `json_extract`

**Phase to address:** Email-based tracking phase — add the indexed `email` column to `user_events` via an explicit startup migration before building the frontend tracking changes.

---

### Pitfall 6: Gate on Page Entry Blocks Intercom and Analytics from Firing Until After Submission

**What goes wrong:**
GA4 and Microsoft Clarity both fire page_view events as soon as the page loads (the `Analytics` component calls `logPageView()` on route change). Intercom initializes via `IntercomProvider` in `RootLayout.tsx`. These run regardless of gate state.

However, if the page-entry gate is implemented as a full-page blocking modal with `pointer-events: none` on everything behind it, Intercom's launcher button becomes inaccessible to users who have not yet submitted their email. A user who sees the gate and wants help via Intercom cannot reach the chat widget. This is a support flow regression: the current system allows free browsing (no gate until profile click), so users can always reach Intercom.

Additionally, if the gate is implemented with a `z-index: 50` overlay (as `NewsletterGateModal.tsx` currently uses), Intercom's launcher sits at a lower z-index and is visually covered. The user sees a dark overlay but no chat button.

**Why it happens:**
Gate UX is typically designed in isolation without checking what other UI elements sit behind the overlay. Intercom's launcher z-index is fixed at 2147483001 (the Intercom default) which should win — but if the overlay is `position: fixed` with `z-index: 9999` or higher and `pointer-events: all`, clicks on the Intercom launcher position will be captured by the overlay instead.

**How to avoid:**
- Keep the gate modal at `z-index: 50` (same as current `NewsletterGateModal`) and rely on Intercom's hard-coded high z-index to remain clickable above the overlay.
- Verify Intercom launcher remains accessible behind the gate by testing on a production-like environment (Intercom only initializes with a real `appId`).
- If a dismiss option is added to the page-entry gate, ensure clicking the backdrop calls `onDismiss` to close the modal — the current `NewsletterGateModal` already does this (`onClick={onDismiss}` on the overlay div) and this should be preserved.
- Do NOT use `pointer-events: none` on the Intercom launcher area as a "hide until subscribed" mechanism — this silently removes support access for new users who hit friction.

**Warning signs:**
- Intercom chat button is not clickable while the gate is open
- Users who want help before submitting email have no support channel
- Intercom widget appears behind the gate overlay (visible but not clickable)

**Phase to address:** Email-first gate phase — test Intercom accessibility with the gate open before shipping; use the existing NewsletterGateModal z-index (50) as the baseline.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Writing email in `user_events.payload` JSON instead of indexed column | No schema migration needed | All per-email event queries do full table scan via `json_extract` | Never — add the column with index |
| Using the same `source: "gate"` for page-entry and profile-unlock captures | No code change to Loops integration | Cannot segment leads by acquisition intent in Loops or admin | Never — distinct source values cost nothing |
| "See All" navigates away without passing `days` context | Simple implementation with `Link` | Admin loses period context on every drill-down | Acceptable only if destination page defaults to the most useful period (All-time) |
| Dismissible page-entry gate (user can skip it) | Lower friction UX | Loses the lead capture purpose entirely; returning users who skip are never captured | Depends on business decision — if the gate is hard (no dismiss), this is N/A |
| Re-using `NewsletterGateModal` component for page-entry gate with different copy | No new component needed | Tight coupling between modal and trigger context makes the two gates hard to evolve independently | Acceptable if copy is passed as props, not hardcoded |

---

## Integration Gotchas

Common mistakes when connecting the new features to the existing system.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Loops + page-entry gate | Calling `sync_contact_to_loops` with source `"gate"` from page-entry path | Add `source: "page_entry"` and pass it through to Loops as a custom contact property |
| `useNltrStore` + page-entry gate | Calling `localStorage.setItem('tcs_gate_email', email)` directly | Call `setSubscribed(email)` from `useNltrStore` — this writes to the Zustand persist key and triggers the reactive `isUnlocked` check in `MarketplacePage.tsx` |
| `user_events` + email tracking | Including email in `payload` JSON blob | Add indexed `email TEXT` column via startup `ALTER TABLE` migration; pass email field in the POST `/api/events` body |
| `nltrStore` Zustand persist + new gate | Changing the persist key name `tinrate-newsletter-v1` | Do NOT change the key — this would force all subscribed users to re-submit the gate. Bump only the internal `version` number with a `migrate` function if the state shape changes |
| Admin "See All" + period toggle | Hardcoding `days: 0` (all-time) in the expanded view | Read `days` from the parent's period toggle state and pass it as a prop to the expanded view |
| Admin "See All" + exposure endpoint | Calling `/events/exposure` without a limit | The endpoint already returns all rows ordered by clicks — client-side `slice(0, 5)` is the current limit. Adding a "See All" just removes the slice; no backend change needed |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `json_extract(payload, '$.email')` on `user_events` for email filtering | Lead timeline query becomes slow as events table grows | Add indexed `email` column; use direct column equality for filtering | At ~10,000+ rows in `user_events` |
| Fetching all rows for "See All" without pagination | Large teams with high search volume cause `/events/exposure` to return 500+ rows and slow the admin overview | Add `limit` param to "See All" fetch, or add scroll-loaded pagination | At 100+ experts with active click tracking |
| Page-entry gate shows on every page load for test/preview environments | Gate fires in Railway preview PRs, making it harder to test admin changes | Read an env var or URL param to bypass the gate in staging (e.g., `?bypass_gate=1` in non-prod) | Immediately in staging environments |
| Full `user_events` table scan in lead timeline for the session_id bridge | Timeline query joins three tables with a subquery on `user_events.session_id` | The current query is already bounded per-email — acceptable. Risk is if `user_events` grows to 100k+ rows without an index on `session_id` | `user_events.session_id` already has `index=True` — current implementation is fine |

---

## Security Mistakes

Domain-specific security issues relevant to v5.2 changes.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Sending email in `POST /api/events` payload without rate limiting | Attacker can enumerate valid emails by submitting them as tracking events | The events endpoint already has no auth and no rate limit — email in payload is fine because the endpoint does not confirm or deny email validity |
| Persisting email in localStorage under a new key after the gate | Multiple keys for the same email can accumulate in localStorage over time | Write only to `useNltrStore` (Zustand persist, single key `tinrate-newsletter-v1`) |
| Gate bypass via localStorage manipulation | Technically-savvy users can set `tcs_gate_email` in dev tools to bypass the gate | This is intentional (not a security threat) — the gate is a lead capture mechanism, not access control; the expert profiles are public anyway |
| "See All" endpoint returns more data than paginated endpoint | Admin sees full list without pagination — acceptable since it's behind JWT auth | No action needed — this is correct behavior for the admin panel |

---

## UX Pitfalls

Common user experience mistakes specific to v5.2 changes.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Page-entry gate has no dismiss option | Users who don't want to submit email are completely blocked from browsing | Depends on business decision — if hard gate, this is intentional; if soft gate, add a dismiss that records a "skipped" flag in sessionStorage (not localStorage) so the gate re-appears on next session |
| Gate copy doesn't explain why email is needed | Users are suspicious and abandon | Lead with value: "Get curated expert insights + instant access to profiles" — the existing `NewsletterGateModal` copy already does this correctly |
| "See All" opens full list but there's no way to collapse it | Admin sees a very long list with no way to return to the 5-row summary view | Add a "Show Less" button that toggles `showAll` back to false |
| Email-first gate fires on direct navigation to a specific expert URL | Users who share filtered URLs or direct links are immediately gated before seeing content | Check if there's a `?ref=` or direct URL context that should bypass the gate (or show a lighter interstitial) |
| Admin "See All" for TopExpertsCard navigates to `/admin/experts` (current behavior for expert links) | Expert links on Overview go to the experts page, not a click-detail view | Keep this behavior — it's consistent with the existing `Link to="/admin/experts"` in `TopExpertsCard` |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Email-first gate:** Gate shows correctly for new users — verify returning subscribed users do NOT see it (test by opening in an incognito tab after localStorage has `tinrate-newsletter-v1` set with `subscribed: true`)
- [ ] **Email-first gate:** Gate dismissal (if dismissible) writes to `sessionStorage`, not `localStorage` — a dismissed gate should re-appear on next session
- [ ] **Email-first gate:** Loops receives `source: "page_entry"` (not `"gate"`) for page-entry captures — verify in Loops contacts list after a test submission
- [ ] **Email-first gate:** Backend `POST /api/newsletter/subscribe` deduplication still works — second submission from the same email returns `{"status": "ok"}` with no error
- [ ] **Email-first gate:** Intercom launcher remains clickable while the gate modal is open — test on production (Intercom only renders with a live appId)
- [ ] **Admin See-All:** "See All" on TopExpertsCard shows the same period as the parent's period toggle — verify switching from "7d" to "All" on the toggle also changes the expanded list
- [ ] **Admin See-All:** Expanded card does not cause the rest of the Overview page to jump — use `max-h` + scroll instead of full height expansion
- [ ] **Email-based tracking:** `user_events` table has `email` column after startup migration — verify with `SELECT * FROM user_events LIMIT 1` in Railway SQLite
- [ ] **Email-based tracking:** Lead timeline in `LeadsPage.tsx` shows events from email-keyed `user_events` rows — test by submitting the gate, performing a search, then checking the lead's timeline in admin
- [ ] **Email-based tracking:** Users who browse before submitting the gate still show pre-gate events in their timeline via the `session_id` bridge — verify the existing session_id linking still works alongside the new email-keyed path

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Split-brain unlock state (returning users re-gated) | MEDIUM | Add the missing `legacyUnlocked` check to the new gate component; redeploy Vercel (~30s). No data loss. |
| Flash of gate modal for returning users | LOW | Switch gate `isOpen` state to synchronous init; redeploy. No data loss. |
| Wrong Loops source field for page-entry captures | LOW | Update `source` value in the subscribe call and the `loops.py` sync; existing DB records keep old source value (not retroactively fixable without a data migration, but new captures are correct) |
| "See All" discards period context | LOW | Add `days` as a query param in the Link URL or pass it as a prop; redeploy |
| Email in `user_events.payload` without index | MEDIUM | Run `ALTER TABLE user_events ADD COLUMN email TEXT; CREATE INDEX ix_user_events_email ON user_events(email);` on the Railway SQLite file; requires Railway SSH access or a startup migration hotfix |
| Intercom inaccessible behind gate | LOW | Reduce gate z-index to 50 (matches current `NewsletterGateModal`); Intercom's hard-coded high z-index takes over. Redeploy. |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Split-brain unlock state | Email-first gate phase — audit all unlock paths first | Returning newsletter subscribers do not see page-entry gate; legacy `tcs_gate_email` users also bypassed |
| Flash of gate for returning users | Email-first gate phase — synchronous state init | Gate does not appear even for 1 frame in returning-user test in React DevTools |
| Wrong Loops source field | Email-first gate phase — define source values before building | Loops contacts table shows `page_entry` source for page-entry submits |
| "See All" discards period context | Admin See-All phase — pass `days` to expanded view | Clicking "See All" while "7d" is active shows 7d data in expanded list |
| Email in unindexed payload | Email tracking phase — add indexed column migration first | `EXPLAIN QUERY PLAN` on lead timeline query shows index seek, not full scan |
| Intercom blocked by gate overlay | Email-first gate phase — test Intercom with gate open | Intercom launcher is clickable while gate is visible in production test |
| Dual data model without retroactive backfill | Email tracking phase — accept the NULL gap explicitly | Lead timeline documents that events before v5.2 use session_id bridge; events after v5.2 use email column directly |

---

## Sources

- Direct codebase analysis: `frontend/src/pages/MarketplacePage.tsx` (lines 44–52 legacy unlock check), `frontend/src/store/nltrStore.ts`, `frontend/src/hooks/useEmailGate.ts`, `frontend/src/components/marketplace/NewsletterGateModal.tsx`, `frontend/src/tracking.ts`, `frontend/src/admin/pages/OverviewPage.tsx` (TopExpertsCard, TopQueriesCard, ZeroResultQueriesCard), `frontend/src/admin/components/AdminCard.tsx`, `app/routers/newsletter.py`, `app/routers/email_capture.py`, `app/routers/events.py`, `app/routers/admin/events.py`, `app/routers/admin/analytics.py`, `app/routers/admin/leads.py`, `app/models.py`, `app/loops.py`
- Known `NewsletterGateModal` z-index value: `z-50` (line 30 of `NewsletterGateModal.tsx`) vs. Intercom default z-index: 2147483001 (Intercom docs)
- Zustand persist rehydration: synchronous before first render — `useNltrStore.getState()` is available immediately without `useEffect`
- SQLite `ALTER TABLE ADD COLUMN` semantics: non-destructive, adds column with `DEFAULT NULL` for existing rows, supported in SQLite 3.x
- SQLite startup migration pattern: existing precedent in `main.py` lifespan (`UPDATE experts SET email=''`) — same pattern applicable for `ALTER TABLE user_events ADD COLUMN email TEXT`
- Loops API `/contacts/create` — idempotent by email, source field is a standard property; custom properties require Loops property registration

---
*Pitfalls research for: v5.2 Email-First Gate, Admin See-All, and Email-Based Tracking*
*Researched: 2026-03-04*
