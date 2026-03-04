# Project Research Summary

**Project:** Expert Marketplace v5.2 — Email-First Gate, Admin See-All, Email-Based Tracking
**Domain:** B2B Expert Marketplace SPA (React + FastAPI, lead-gen-first)
**Researched:** 2026-03-04
**Confidence:** HIGH — all four research files derived from direct v5.1 production codebase inspection

## Executive Summary

v5.2 is a tightly scoped additive milestone on a shipped v5.1 product. Three capabilities are being added: moving the newsletter gate from a lazy trigger (on "View Full Profile" click) to an eager page-entry trigger; adding "See All" expansion to two admin overview cards; and attaching email identity to search and click events that are currently tracked anonymously via session_id. Zero new packages are required. Every needed component, store, endpoint, and data structure is already in production. The milestone is entirely about repositioning existing pieces and wiring existing data structures differently.

The recommended approach is a strict dependency-ordered build sequence: backend schema migration first (nullable `email` column on `user_events` with an index, idempotent startup ALTER TABLE), then frontend tracking enrichment, then the email-first gate UI, then the lead-timeline query update, and finally the admin "See All" expansion. This order means the backend accepts the new email field before the frontend starts sending it, and email attribution data accumulates from the moment tracking ships rather than being gated behind the UI change.

The two highest-probability failure modes are (1) the dual-key localStorage unlock state — the codebase has two parallel unlock mechanisms (`tcs_gate_email` legacy key and `useNltrStore` Zustand persist) and adding a third gate entry point without auditing which key it writes to will re-gate returning subscribers on next visit, and (2) a flash-of-gate for returning users if the gate's initial state is derived via `useEffect` instead of a synchronous lazy `useState` initializer. Both are fully preventable with known patterns already in the codebase (`useNltrStore.getState()` static read, Zustand rehydration is synchronous before first render).

## Key Findings

### Recommended Stack

The v5.1 stack handles all three features without modification. The backend (FastAPI 0.129, SQLAlchemy 2.0, SQLite WAL, Pydantic 2.12) and frontend (React 19.2, Vite 7.3, Tailwind 3.4, React Router v7.13, motion/react 12.34, Zustand 5.0.11) are confirmed working in production. No new packages, no version upgrades.

**Core technologies relevant to v5.2:**
- `useNltrStore` (Zustand 5.0.11 persist): Single source of truth for gate unlock state — `{ subscribed: boolean, email: string | null }` persisted to `localStorage` key `tinrate-newsletter-v1`. This key is LOCKED — do not change it.
- `NewsletterGateModal` (motion/react AnimatePresence): Existing modal component that becomes the page-entry gate after removing its dismiss button.
- `trackEvent()` (module function in `tracking.ts`): Will gain email injection via `useNltrStore.getState().email` — Zustand static read works outside React components, same pattern already used in `ExpertCard._fireLeadClick`.
- SQLite `ALTER TABLE ... ADD COLUMN` (idempotent startup migration): Adds nullable `email TEXT` column to `user_events`. Non-breaking. Existing migration pattern confirmed in `main.py` lifespan.

### Expected Features

**Must have (table stakes — v5.2 scope):**
- Email gate fires on page entry — every visitor who has not subscribed sees the gate before browsing. Returning subscribers bypass instantly via synchronous `useNltrStore.getState()` read (no flash).
- "See All" expansion on TopExpertsCard — already fetches the full list from the API but slices to 5 client-side. Expansion is a local `useState(showAll)` toggle with no re-fetch.
- "See All" expansion on TopQueriesCard — currently passes `limit: 5` to the API; change to `limit: 50` on mount, then toggle between sliced and full display.
- Email attribution on `user_events` — nullable `email` column with index; events before gate submit have `email = null`, events after have `email = <submitted>`.

**Should have (differentiators — confirmed from FEATURES.md):**
- In-card expansion (not navigate-away) for "See All" — keeps period toggle context intact, matches established admin card UX pattern (Vercel/Linear/Stripe). `max-h-96 overflow-y-auto` on expanded cards prevents layout jump.
- Distinct source value (`page_entry` vs `gate`) in newsletter subscribe call — enables Loops segmentation between pre-search and post-search lead cohorts.

**Defer (v5.x — after v5.2 data validation):**
- Email-attributed search events surfaced in lead journey timeline — requires a few days of v5.2 production data to confirm the email column is being populated, then a query update in `leads.py`.
- Rate-limit gate re-triggers for users who skip — requires session counting, not in v5.2 scope.
- Entry gate A/B test (mandatory vs dismissible) — requires a feature flag system.

**Anti-features (explicitly ruled out):**
- Non-dismissible full-page gate that blocks routing — breaks shareable filtered URLs.
- Retroactive email attribution for pre-v5.2 anonymous events — no reliable cross-device identity link exists.
- Dedicated "See All" routes (`/admin/top-experts`, `/admin/top-searches`) — 5x implementation cost of in-card toggle with no user-facing benefit.
- Email in `user_events.payload` JSON blob instead of indexed column — creates full-table scans on lead-timeline queries as `user_events` grows.

### Architecture Approach

v5.2 modifies five existing frontend files and four existing backend files, and adds two new admin page components (`TopExpertsPage.tsx`, `TopSearchesPage.tsx`) as lazy-loaded routes. The page-entry gate replaces the lazy `useState(false)` in `MarketplacePage.tsx` with a synchronous lazy initializer reading `useNltrStore.getState()`. Email flows from the Zustand store into `trackEvent()` via static `.getState()` call at module scope (no React hook constraint). The admin lead-timeline merges four sources post-v5.2: conversations, lead_clicks, session-linked user_events (existing bridge), and email-keyed user_events (new direct query).

**Modified components:**

1. `MarketplacePage.tsx` — gate fires on mount (`useState(!isUnlocked)`); `handleViewProfile` removes gate check; ExpertGrid gated on `isUnlocked`
2. `NewsletterGateModal.tsx` — remove dismiss button and overlay-click dismiss handler
3. `tracking.ts` — import `useNltrStore`; inject `.getState().email` into every event request body when non-null
4. `OverviewPage.tsx` — add `showAll` state and expand/collapse toggle to both cards; fetch `limit: 50` for TopQueriesCard
5. `app/models.py` — add `email: Mapped[str | None]` column + index to `UserEvent`
6. `app/main.py` — idempotent `ALTER TABLE user_events ADD COLUMN email TEXT` in lifespan
7. `app/routers/events.py` — add `email: str | None = None` to `EventRequest`; persist to `UserEvent`
8. `app/routers/admin/leads.py` — add `UserEvent WHERE email = X` query to `get_lead_timeline()`

**New components:**

1. `TopExpertsPage.tsx` — full ranked list of experts by click volume; reads `?days` from URL; no `.slice()`
2. `TopSearchesPage.tsx` — full ranked list of search queries; fetches `limit: 50` or higher

### Critical Pitfalls

1. **Split-brain localStorage unlock state** — The codebase has two unlock keys (`tcs_gate_email` legacy, `tinrate-newsletter-v1` Zustand persist). The email-first gate must call `setSubscribed(email)` from `useNltrStore` exclusively — not write to a new localStorage key. Audit all unlock paths before implementation.

2. **Flash-of-gate for returning subscribers** — Using `useState(false)` + `useEffect` for the gate open decision causes a visible 100-200ms flash for every returning subscriber. Use synchronous lazy initializer: `useState(() => !useNltrStore.getState().subscribed && !legacyUnlocked)`. Zustand persist rehydration is synchronous before first render.

3. **Email in unindexed payload JSON** — Putting email in `user_events.payload` blob avoids schema migration but forces `json_extract(payload, '$.email')` in all admin queries — no index possible, full table scan as events grow. Always add the dedicated `email TEXT NULL` column with `CREATE INDEX`. The idempotent startup `ALTER TABLE` migration is the correct pattern (precedent exists in `main.py`).

4. **"See All" discards period toggle context** — If "See All" navigates away without encoding `days` in the URL, the admin lands on the destination page with a default period. For in-card expansion this is not an issue. For navigate-away: pass `?days=${days}` in the Link URL.

5. **Wrong Loops source field** — Calling `POST /api/newsletter/subscribe` with `source: "gate"` from the page-entry path makes pre-search and post-search leads indistinguishable in Loops. Use `source: "page_entry"` for the new gate and update `loops.py` to forward the source as a contact property.

6. **Intercom blocked behind gate overlay** — The existing `NewsletterGateModal` uses `z-50`. Keep gate at `z-50`; Intercom's fixed z-index (2147483001) wins above it. Do NOT add `pointer-events: none` to Intercom areas. Test on production (Intercom only renders with a live appId).

## Implications for Roadmap

Based on the dependency ordering confirmed across all four research files, the build sequence has a clear internal logic: backend schema must precede frontend tracking; tracking enrichment should precede gate UI (so the first gated users' events are attributed immediately); gate precedes timeline query update (which benefits from having email data to query); "See All" is fully independent and can close out the milestone.

### Phase 1: Backend Schema and Event Endpoint

**Rationale:** The email column on `user_events` must exist before the frontend starts sending email in tracking requests. This is the foundation all three features depend on. It is a non-breaking additive change with zero risk to v5.1 behavior.
**Delivers:** Nullable indexed `email` column on `user_events`; `EventRequest` Pydantic model accepts optional email field; `record_event()` persists it; idempotent startup migration in `main.py` lifespan.
**Addresses:** Email attribution database layer
**Avoids:** Unindexed payload JSON anti-pattern (Pitfall 3)

### Phase 2: Frontend Tracking Enrichment

**Rationale:** With the backend accepting email, frontend tracking can immediately start attributing events to identified users. This is a single-file change (`tracking.ts`) with no user-visible effects. Shipping it before the gate means that the moment the gate goes live, all subsequent events are email-attributed from day one.
**Delivers:** `trackEvent()` reads `useNltrStore.getState().email` (static Zustand read); email included in POST `/api/events` body when non-null; all existing call sites remain backward-compatible (email is additive).
**Uses:** Zustand `.getState()` static read pattern (established in `ExpertCard._fireLeadClick`)
**Avoids:** React hook-in-module anti-pattern (use `.getState()`, never hook call in `tracking.ts`)

### Phase 3: Email-First Gate UI

**Rationale:** Gate moves from lazy (on profile click) to eager (on page mount). With tracking enrichment already live, the first gated users' subsequent events are immediately email-attributed. This is the highest-visibility change and should follow the infrastructure work.
**Delivers:** `MarketplacePage.tsx` shows `NewsletterGateModal` on mount for non-subscribed users; dismiss button removed from modal; `handleViewProfile` no longer checks gate state; ExpertGrid gated on `isUnlocked`; `source: "page_entry"` in subscribe call; Loops contact property updated.
**Addresses:** Page-entry gate table stakes; Loops source segmentation
**Avoids:** Dual-key localStorage split-brain (Pitfall 1); flash-of-gate via useEffect (Pitfall 2); wrong Loops source field (Pitfall 5); Intercom blocked by overlay (Pitfall 6)

### Phase 4: Lead Timeline Query Update

**Rationale:** With email data accumulating in `user_events` (from Phases 1-3), the lead timeline can be extended to query `user_events WHERE email = X` directly. This phase requires Phase 1 (email column must exist) and benefits from at least some email-attributed events being present.
**Delivers:** `get_lead_timeline()` in `leads.py` gains a fourth source query (email-keyed `user_events` WHERE `event_type = 'search_query'`); post-gate search events appear in admin lead timeline; deduplication merge by `created_at` with existing session_id bridge.
**Implements:** Four-source timeline merge (conversations + lead_clicks + session-linked events + email-keyed events)
**Avoids:** Data model confusion — NULL gap for pre-v5.2 events is explicitly accepted; session_id bridge retained for pre-gate anonymous events

### Phase 5: Admin "See All" Expansion

**Rationale:** Fully independent of Phases 1-4. No backend changes for TopExpertsCard (full data already returned); one query param change for TopQueriesCard. Placed last to let the tracking and gate work stabilize first. Low risk, high admin value.
**Delivers:** `TopExpertsCard` — local `showAll` state, toggle removes `.slice(0, 5)`, expand/collapse button; `TopQueriesCard` — fetch `limit: 50` on mount, same toggle; `max-h-96 overflow-y-auto` on expanded card prevents layout jump; optional new `TopExpertsPage.tsx` and `TopSearchesPage.tsx` if deeper navigation is desired.
**Addresses:** "See All" table stakes; in-card expansion pattern over navigate-away
**Avoids:** Period context lost on navigate (Pitfall 4); layout jump from unbounded card expansion; hardcoding `limit: 5` in expanded view

### Phase Ordering Rationale

- Backend before frontend: `EventRequest` must accept `email` before `tracking.ts` sends it. Pydantic v2 ignores extra fields by default, but if `extra='forbid'` is set, Phase 1 must deploy before Phase 2.
- Tracking before gate: ensures the very first post-gate events are email-attributed. If gate ships before tracking, there is a window where gated users' events have no email attribution.
- Gate before timeline: the timeline query's fourth source is only useful once email-attributed events exist. Shipping the query before any data accumulates is harmless but wasteful to validate.
- "See All" last: independent, low-risk, can ship at any point. Placing it last keeps the riskier schema migration and gate UI work in the critical path with dedicated focus.

### Research Flags

Phases with standard patterns (research-phase not needed):

- **Phase 1 (Backend Schema):** SQLite nullable column migration is well-documented; idempotent startup migration pattern already in codebase. Implement directly.
- **Phase 2 (Tracking Enrichment):** Single-file change using established Zustand static read pattern. Implement directly.
- **Phase 5 (Admin See-All):** In-card toggle is a standard SaaS admin pattern; data already available from existing endpoints. Implement directly.

Phases that merit careful pre-implementation checklist review (not external research):

- **Phase 3 (Email-First Gate):** Six pitfalls intersect here. Conduct a pre-implementation audit of all localStorage unlock paths. Explicit test checklist: returning subscriber bypass (no flash), Intercom accessibility, Loops source value in DB after test submission, duplicate email deduplication returns `{"status": "ok"}`.
- **Phase 4 (Lead Timeline):** Four-source merge-sort needs explicit test coverage — verify that an event does not appear twice when both the session_id bridge and the email column match the same row.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All findings from direct production file inspection; no new packages required; confirmed working versions |
| Features | HIGH | Codebase inspection is the primary source; external UX research (OptinMonster, Intercom, ProductLed) at MEDIUM used only to validate the in-card vs navigate-away decision |
| Architecture | HIGH | All component boundaries, data flows, and build order derived from actual running v5.1 code; no inference required |
| Pitfalls | HIGH | All 6 critical pitfalls derived from actual code patterns: dual localStorage keys verified line-by-line, Zustand rehydration behavior confirmed, SQLite ALTER TABLE semantics confirmed, Intercom z-index from Intercom docs |

**Overall confidence:** HIGH

### Gaps to Address

- **Loops custom property registration:** Forwarding `source` as a Loops contact property requires the property to be registered in the Loops dashboard first. Verify the Loops API accepts the chosen property name (e.g., `contactSource`) before shipping Phase 3. This is a one-time manual step in Loops UI, not a code gap.
- **FastAPI `extra` config on `EventRequest`:** Pydantic v2 ignores extra fields by default. Confirm `EventRequest` does not have `model_config = ConfigDict(extra='forbid')` set, which would reject the new optional `email` field from Phase 2 before Phase 1 deploys. If it does, Phase 1 (Pydantic model update) must deploy before Phase 2 (frontend sends email).
- **`user_events` row volume at scale:** The indexed `email` column is sufficient for current and near-term scale. If `user_events` exceeds ~1M rows, the `get_lead_timeline()` four-source merge-sort may need a materialized approach. Flag as a v5.3+ consideration.

## Sources

### Primary (HIGH confidence — direct codebase inspection)

- `frontend/src/pages/MarketplacePage.tsx` — gate trigger logic, `legacyUnlocked` dual-key check (lines 44-52)
- `frontend/src/store/nltrStore.ts` — Zustand persist shape, localStorage key `tinrate-newsletter-v1`
- `frontend/src/components/marketplace/NewsletterGateModal.tsx` — existing modal, `z-50`, dismiss button location
- `frontend/src/hooks/useEmailGate.ts` — lazy initializer pattern, flash-prevention design note
- `frontend/src/tracking.ts` — anonymous `session_id` tracking, fire-and-forget with keepalive
- `frontend/src/components/marketplace/ExpertCard.tsx` — `_fireLeadClick` Zustand static read pattern
- `frontend/src/admin/pages/OverviewPage.tsx` — `TopExpertsCard` `.slice(0, 5)`, `TopQueriesCard` `limit: 5`, `ZeroResultQueriesCard` "See all" reference pattern
- `app/models.py` — `UserEvent` schema (no email column confirmed), `NewsletterSubscriber` schema
- `app/main.py` — idempotent startup migration pattern (existing precedent confirmed)
- `app/routers/events.py` — `EventRequest`, `record_event()`, payload is free-form dict
- `app/routers/newsletter.py` — `POST /api/newsletter/subscribe`, idempotent INSERT OR IGNORE
- `app/routers/admin/events.py` — `get_exposure()` returns all rows, no server-side LIMIT
- `app/routers/admin/analytics.py` — `get_top_queries()` accepts `limit` param
- `app/routers/admin/leads.py` — `get_lead_timeline()` three-source merge; `session_id` bridge confirmed
- `app/loops.py` — Loops contact sync, source field handling
- `frontend/package.json`, `requirements.txt` — confirmed installed versions, no new dependencies needed

### Secondary (MEDIUM confidence — external sources)

- OptinMonster (2025/2026) — email gate timing and dismiss patterns
- Eleken, Userpilot — modal UX best practices for SaaS
- ProductLed — gated content strategy
- Intercom docs — Intercom launcher z-index value (2147483001)
- SQLite documentation — `ALTER TABLE ADD COLUMN` semantics (non-destructive, DEFAULT NULL for existing rows)

---
*Research completed: 2026-03-04*
*Ready for roadmap: yes*
