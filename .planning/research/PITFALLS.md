# Pitfalls Research

**Domain:** Adding dual-function Gemini calling, proactive AI personality, event tracking, and gap analysis dashboard to a live AI expert marketplace (v2.3 milestone)
**Researched:** 2026-02-22
**Confidence:** HIGH — based on direct codebase analysis of the actual running v2.2 system (`useSage.ts`, `pilot_service.py`, `useExplore.ts`, `store/index.ts`, `models.py`, `SageFAB.tsx`)

---

## Critical Pitfalls

### Pitfall 1: Gemini Chooses the Wrong Function — `search_experts` vs `apply_filters` Ambiguity

**What goes wrong:**
When both `apply_filters` and `search_experts` are declared in the same `types.Tool`, Gemini must choose between them on every turn. The two functions overlap semantically: "Find me a UX designer" could legitimately call either. Gemini will sometimes call `apply_filters` when the user intends a full search (no results shown yet), or call `search_experts` when the user wants to narrow existing results by rate. The user sees confusing behavior — the grid changes but Sage doesn't show results in-panel, or Sage shows results in-panel but the grid doesn't match.

**Why it happens:**
The existing `apply_filters` description in `pilot_service.py` says "Update the expert marketplace search filters based on user request" — this is generic enough to capture search intent. Adding `search_experts` alongside it without a clear semantic boundary creates a two-function disambiguation problem. Gemini 2.5 Flash will consistently misroute on short or ambiguous queries (< 5 words) because neither function clearly dominates for those inputs. This has been documented as a systemic behavior of Gemini function calling when descriptions overlap.

**How to avoid:**
- Write function descriptions that are mutually exclusive and define the trigger condition explicitly. `apply_filters` should say: "Adjust active search filters (rate range, tags, text query) when the user asks to narrow or refine the current results." `search_experts` should say: "Perform a fresh semantic search for experts when the user asks 'find me X', 'who can help with Y', or 'search for Z' — use this when the user wants to discover experts, not just filter existing ones."
- Seriously consider whether `search_experts` needs to call the backend at all, or whether it should simply write a `query` string to Zustand and let `useExplore`'s reactive `useEffect` handle the `/api/explore` call. The backend is already called reactively on every filter state change — a second direct call from Sage would be redundant and creates the race condition described in Pitfall 2.
- If keeping two functions: test with the 20 most recent real queries from the `conversations` table in SQLite before shipping. Assert `fn_call.name` in logs for each.

**Warning signs:**
- In QA testing: "find me a blockchain expert" calls `apply_filters` instead of `search_experts`
- Users report Sage search doesn't update the grid
- Log line `pilot: request processed` shows `has_filters=True` for messages that should have triggered `search_experts`
- Two simultaneous `/api/explore` requests visible in DevTools Network tab when Sage sends a message

**Phase to address:**
The phase adding `search_experts` — define function descriptions and decide whether the function calls the backend directly or dispatches to Zustand first. Lock this decision before writing any integration code.

---

### Pitfall 2: Grid Sync Race Condition — Sage Search vs `useExplore` Reactive Re-fetch Collision

**What goes wrong:**
`useExplore.ts` fires a fresh `/api/explore` fetch any time `query`, `rateMin`, `rateMax`, or `tags` changes in Zustand. If `search_experts` also calls `/api/explore` directly and writes results to the store via `setResults`, there are two concurrent writers racing to overwrite `experts`, `total`, and `cursor` in `resultsSlice`. The `AbortController` in `useExplore` cancels the previous in-flight request when state changes — but if `search_experts` wrote results first, then `useExplore` fires (triggered by the filter update that `search_experts` also dispatched), the grid will briefly flash the Sage results then be overwritten by `useExplore`'s response.

**Why it happens:**
`useExplore`'s `useEffect` dependency array is `[query, rateMin, rateMax, tags, sortBy, ...]`. Any filter change dispatched from `useSage` — whether via `apply_filters` or a side effect from `search_experts` — will trigger `useExplore` to re-fetch. If `search_experts` also calls `setResults` independently, there are now two code paths writing to `experts` in `resultsSlice`. The `AbortController` in `useExplore` only cancels its own previous request — it does not cancel Sage's request.

**How to avoid:**
- Establish a single ownership rule: `setResults` is called exclusively from `useExplore`. No other hook or function calls `setResults` directly.
- If Sage must show results in its panel (per v2.3 requirement): add a `sageResults: Expert[]` field to `pilotSlice` (already non-persisted per the store's `partialize` config). Sage populates `sageResults` independently. The main `experts` array in `resultsSlice` remains owned exclusively by `useExplore`.
- The grid sync then works automatically: Sage dispatches filter state (e.g., calls `setQuery`), `useExplore` reacts and fetches the grid results, Sage shows its own `sageResults` in the panel. Grid and panel may show slightly different result sets briefly, which is acceptable.
- Never call `setResults` from `useSage`. Make this a code review requirement.

**Warning signs:**
- Grid flickers when Sage runs a search
- `cursor` resets unexpectedly mid-scroll after a Sage interaction
- Two simultaneous GET `/api/explore` requests visible in DevTools when Sage sends a message
- `appendResults` being called while `setResults` was also called in the same render cycle

**Phase to address:**
The phase implementing Sage search — define data ownership boundary (who owns `experts` in the store) as the first architectural decision before any code is written.

---

### Pitfall 3: Proactive Empty-State Nudge Fires at Wrong Times — On Page Load or Repeatedly

**What goes wrong:**
The proactive nudge ("Your search returned no results — want me to help?") must fire exactly once when the grid enters an empty state. Implemented naively — watching `experts.length === 0` in a `useEffect` — it fires on page load before the first fetch completes (the initial store state has `experts: []`), when the user rapidly types and gets intermediate empty results, and every time the user returns to an empty state after clearing filters.

**Why it happens:**
The initial state of `resultsSlice` is `experts: [], total: 0, loading: false`. The `useEffect` watching `!loading && experts.length === 0` fires immediately on mount before the first fetch has been initiated, because `loading` hasn't been set to `true` yet. The sequence is: mount → `useEffect` nudge fires (false positive) → `useExplore` fires → `loading=true` → `loading=false, experts=[results]`. Additionally, if the user clears all filters back to empty results, the nudge fires again even though the user is actively exploring.

**How to avoid:**
- Guard the nudge with a `hasFetchedOnce` ref (not state — avoids extra renders): set it to `true` after `loading` transitions from `true` to `false` for the first time. Only check the empty condition after `hasFetchedOnce === true`.
- Track `nudgeSent` as a boolean in `pilotSlice` (non-persisted). Set it to `true` once the nudge message is added to `messages`. Never fire the nudge again in the same session unless `resetPilot` is called.
- Full guard: `hasFetchedOnce && !loading && experts.length === 0 && total === 0 && !nudgeSent && !isStreaming`.
- Debounce the trigger by 1500ms after `loading` goes false — prevents firing during rapid filter changes where the user bounces through empty states.

**Warning signs:**
- Sage adds "I noticed your results are empty" on page load before any results appear
- Nudge fires multiple times in the same session when user toggles filters
- Nudge fires while `isStreaming` is true (Sage is already processing something)
- Nudge fires while user is mid-typing in the search input

**Phase to address:**
The phase implementing Sage personality — the nudge trigger logic must be built with all guard conditions from the start, not added as an afterthought.

---

### Pitfall 4: FAB Pulse/Glow Animation Conflicts with Existing `whileHover`/`whileTap` Gesture Props

**What goes wrong:**
`SageFAB.tsx` already uses `motion.button` with `whileHover={{ scale: 1.05 }}` and `whileTap={{ scale: 0.95 }}`. Adding a continuous pulse/glow animation (e.g., `animate={{ boxShadow: [...keyframes] }}` loop) to the same `motion.button` can conflict with Framer Motion's internal animation state machine. The hover scale and the loop animation may compete — Framer Motion drops the hover scale when the loop fires, or the loop pauses when the user hovers, breaking the visual feedback chain.

**Why it happens:**
Framer Motion's `animate` prop and gesture props (`whileHover`, `whileTap`) both write to the same motion values. When both animate `scale`, the last write wins. A continuous `keyframes` loop on `animate` will be interrupted by `whileHover` and may not resume correctly after hover ends. This is a documented Framer Motion behavior when the same property is driven by both `animate` and gesture variants.

**How to avoid:**
- Separate the pulse/glow into a wrapper element that does not have gesture props. The outer `motion.div` handles the pulse animation on `boxShadow` only; the inner `motion.button` retains `whileHover`/`whileTap` on `scale` only. `boxShadow` and `scale` are independent CSS properties — no collision.
- Alternatively, implement the glow ring as a pure CSS `@keyframes` animation on a pseudo-element (`::before` or `::after`) positioned around the button. CSS animations do not conflict with Framer Motion's transform animations.
- If using Framer Motion for the pulse: animate only `opacity` or `boxShadow` on the wrapper — never `scale` — and keep `scale` exclusively on the `motion.button`'s gesture props.

**Warning signs:**
- FAB hover doesn't scale when pulse is active
- Glow animation freezes when user hovers over the FAB
- FAB feels sluggish on mobile (gesture recognition competing with animation loop)
- Framer Motion devtools shows multiple animations targeting the same property

**Phase to address:**
The phase implementing FAB animated reactions — prototype the glow/pulse in isolation before integrating with the existing gesture props.

---

### Pitfall 5: Event Tracking `await`-ing in Click Handlers Blocks the Interaction Path

**What goes wrong:**
Expert card clicks and filter events must feel instant. If the tracking `POST /api/events` is awaited in the click handler — even with a 50ms Railway SQLite round-trip — the profile gate modal will appear late. Users on mobile notice this latency as a "broken" click. The existing `onViewProfile` call in `ExpertCard.tsx` is synchronous; any tracking added before it that blocks will break the expected instant response.

**Why it happens:**
`ExpertCard.tsx` calls `onViewProfile(expert.profile_url)` directly in the button's `onClick`. Adding `await fetch('/api/track', ...)` before `onViewProfile` introduces a mandatory network round-trip before the UI responds. Railway's SQLite volume has higher latency than local disk (50–200ms per write), making this worse in production than in development.

**How to avoid:**
- Use `void fetch('/api/track', { method: 'POST', body: ... })` — the `void` keyword makes the fire-and-forget intent explicit in code review and suppresses unhandled promise warnings.
- For card click tracking specifically, prefer `navigator.sendBeacon('/api/track', JSON.stringify(payload))` — `sendBeacon` is designed for analytics payloads and survives page transitions/unloads, which is relevant if clicking a card triggers navigation.
- Never `await` tracking in any user interaction handler. This must be a code review requirement.
- On the backend: the tracking endpoint must use `async def` with `await loop.run_in_executor(None, lambda: ...)` for the SQLite write, following the same pattern as `explore.py`. A synchronous DB write in a FastAPI async endpoint blocks the event loop.

**Warning signs:**
- Profile modal takes > 100ms to open after clicking a card
- Filter chip interactions feel laggy after tracking code is added
- DevTools Network tab shows the tracking request completing before the modal appears (confirms it was awaited)
- Railway logs show tracking endpoint avg > 50ms

**Phase to address:**
The phase implementing event tracking — the fire-and-forget pattern is non-negotiable and must be specified in the implementation plan before writing any click handler code.

---

### Pitfall 6: SQLite Migration Missing — New Columns Not Added to Existing Tables on Railway

**What goes wrong:**
Adding tracking columns to `Conversation` (e.g., `sage_function_called`, `result_count`) or adding a new `UserEvent` model requires a database migration. The existing codebase uses `Base.metadata.create_all(engine)` at startup in `main.py`. `create_all` creates new tables but does not add columns to existing tables — SQLite has no automatic schema diffing. The `conversations` table already exists on Railway's persistent volume from v1.0. After deploying new `models.py` columns, `create_all` silently skips the existing table, and the first query touching a new column crashes with `OperationalError: no such column`.

**Why it happens:**
Developers add a new field to `Conversation` in `models.py`, run `create_all` locally (which creates the column on a fresh local SQLite), and it works. On Railway, the persistent volume has an existing DB from v1 — `create_all` sees the table exists and skips it entirely. There is no Alembic or migration framework in this codebase, and the `main.py` lifespan has no migration logic.

**How to avoid:**
- For new tables (e.g., `UserEvent`): `create_all` is sufficient. New tables don't exist yet and will be created on first deploy.
- For new columns on existing tables: add a startup migration using raw SQLite `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `main.py`'s `lifespan` function, executed before the `yield`. The `IF NOT EXISTS` syntax makes it idempotent:
  ```python
  from sqlalchemy import text
  with SessionLocal() as db:
      db.execute(text("ALTER TABLE conversations ADD COLUMN sage_function_called TEXT"))
      db.execute(text("ALTER TABLE conversations ADD COLUMN result_count INTEGER"))
      db.commit()
  ```
  Note: SQLite's `ALTER TABLE ADD COLUMN` is idempotent by default if the column doesn't exist — if not, wrap in try/except for `OperationalError: duplicate column name`.
- Keep a `MIGRATIONS.md` note of every `ALTER TABLE` run, indexed by version.

**Warning signs:**
- `OperationalError: no such column: conversations.X` in Railway logs immediately after deploy
- Admin Searches tab stops loading after adding new tracking fields to `Conversation`
- Local dev works but Railway deploy breaks (confirms it's a migration issue, not a code bug)
- `create_all` output in logs says "table already exists" for `conversations`

**Phase to address:**
Any phase adding columns to existing models — the `ALTER TABLE` migration must be the first task in that phase, before any code that queries the new columns.

---

### Pitfall 7: Sage Personality Loops Clarifying Questions — Grid Never Updates

**What goes wrong:**
A warmer Sage personality that asks follow-up clarifying questions can trap the user in a loop where Sage keeps asking instead of ever calling a function. The user answers the question, Sage asks another, user answers again, Sage asks a third. The grid never updates. The current system prompt already includes "If unsure, ask a clarifying question rather than guessing" — strengthening this instruction increases the clarification rate significantly, especially for short queries.

**Why it happens:**
Gemini 2.5 Flash, when given explicit permission to ask clarifying questions, frequently prefers asking over committing to a function call — particularly for queries under 5 words or queries with multiple plausible interpretations. The model's default behavior is conservative: if the function arguments could be wrong, it asks. The warmer personality rewrite risks amplifying this by adding instructions like "make sure you understand what the user needs" which Gemini interprets as permission to ask more questions.

**How to avoid:**
- Hard-limit clarification depth in the system prompt: "You may ask at most ONE clarifying question per conversation. After the user responds to any question, always take action by calling a function — never ask a second question."
- Add a conversation context signal: include the current turn index in the system prompt context so Gemini knows to act on later turns: `f"This is turn {turn_number} of the conversation. After turn 2, always call a function."`.
- In `useSage.ts`, track consecutive turns where `data.filters === null` (no function call). After 2 consecutive non-function turns, automatically add a frontend-generated message: "Let me show you some results based on what you've described." and trigger a reset of filters. This is a safety net, not the primary mechanism.

**Warning signs:**
- QA testing shows 3+ clarifying questions before any filter update for ambiguous queries
- `data.filters === null` for more than 2 consecutive messages in the Sage panel
- System prompt includes "make sure you understand" or "clarify before acting" phrases that Gemini interprets too broadly

**Phase to address:**
The phase implementing the system prompt rewrite — clarification depth must be a hard constraint in the prompt, not a soft guideline. Test with at least 10 ambiguous real-world queries before shipping.

---

### Pitfall 8: Event Tracking Noise Makes Gap Analysis Misleading from Day One

**What goes wrong:**
The Admin Gaps tab surfaces "unmet demand" — filter combos and queries with poor results. If tracking captures every intermediate filter state (e.g., user drags the rate slider through 50 positions before settling), the Gaps table is polluted with filter combos representing UI noise, not real user intent. An admin sees "€100–€200 + Finance" as a high-frequency gap signal when in reality one user dragged a slider. This makes the entire Gaps analysis untrustworthy on day one.

**Why it happens:**
Filter events are tempting to track on every Zustand store mutation — it's the simplest implementation. But `useExplorerStore` dispatches `setRateRange` on every rate slider position (debounce in the UI component, but not in the store). Tracking every `setRateRange` dispatch would generate 10–100 events per slider interaction.

**How to avoid:**
- Track filter events only on "settled" state: after a debounce of 1000ms since the last filter mutation, not on every store write. Use a `useEffect` with `setTimeout` that resets on every filter change.
- For the rate slider specifically: track only on drag-end (`onMouseUp`/`onTouchEnd` from `RateSlider.tsx`), not on every drag position.
- Sage query tracking is the highest-signal event (high intent, explicit user action) — prioritize this as the primary gap signal and treat filter events as secondary.
- In the admin Gaps tab backend: aggregate filter events by session (using a browser-generated `sessionId` or `Date.now()` bucketed to 30-minute windows) before computing gap frequency.

**Warning signs:**
- Gaps table shows dozens of rate-range combinations as high-frequency signals
- A single rate slider drag generates > 10 tracking events in the Network tab
- Gap analysis shows rate filters as the dominant unmet demand category (almost always noise)
- `user_events` table grows by 100+ rows per active user session

**Phase to address:**
The phase implementing event tracking — debounced settled-state tracking must be the default design, not an optimization added after the fact.

---

### Pitfall 9: Cold Start — Admin Gaps Tab Is Empty and Looks Broken on Day One

**What goes wrong:**
The Admin Gaps tab showing "unmet demand" and "expert exposure distribution" requires collected tracking data to be useful. On day 1 of v2.3 deployment, there are zero click events, zero Sage query tracking events, and zero filter events. The admin opens the Gaps tab and sees either an empty table or a loading error. Admins interpret empty as "broken" and file a report.

**Why it happens:**
Any analytics feature built on newly-collected data has this structural cold-start problem. The UX of an empty admin page is underestimated — admins have no baseline for what "normal" looks like on day one.

**How to avoid:**
- Design the Gaps tab for empty state explicitly: show "Tracking started [timestamp] — insights will appear after ~50 page views" as the empty state message. Never show an empty table or loading spinner that persists indefinitely.
- Use existing data for the initial version: the `conversations` table already has gap data (`top_match_score < GAP_THRESHOLD`, `response_type = 'clarification'`) from the v1/v2 chat endpoint. This can populate a "Sage Gaps" section of the Gaps tab immediately on day one without any new tracking data.
- For expert exposure distribution: the `conversations.response_experts` JSON column already stores which experts were returned in chat responses. Backfill the exposure chart from this data for the initial launch.
- Add a `data_since` field to every Gaps API response so the frontend can show "Event tracking since: [date]" to set admin expectations.

**Warning signs:**
- Admin opens Gaps tab with empty `user_events` table and sees no helpful context
- Charts render with 1–3 data points showing misleadingly large percentage values
- No empty state UI — just an empty `<table>` or a null error

**Phase to address:**
The phase implementing the Admin Gaps tab frontend — empty state UX must be built before the data-loading logic. Build the empty state first, then layer in data.

---

### Pitfall 10: Reactive Zustand Selector vs `getState()` Snapshot Used Incorrectly for Proactive Nudge

**What goes wrong:**
The existing `useSage.ts` uses `useExplorerStore.getState()` to snapshot filter state at the time of the async Gemini call. This is the correct pattern for async handlers (documented in Phase 18 as "async handler captures store state at call time; reactive selectors cause stale closure in async context"). But the proactive nudge must observe `experts.length` reactively as it changes over time. If the nudge logic is placed inside `handleSend` (which uses `getState()` snapshots), it will only see the store state at the moment the user sends a message — not when the grid becomes empty later due to a filter change.

**Why it happens:**
The `getState()` pattern is established and works well for its intended purpose. When adding the nudge feature, the natural place to put the trigger is inside `useSage`'s `handleSend` — but that only fires on user input, not on store state changes. Copy-pasting the `getState()` snapshot pattern into a reactive observer context produces a hook that never observes state changes between user messages.

**How to avoid:**
- The nudge trigger must live in a separate `useEffect` that uses reactive Zustand selectors, not `getState()`. Place this in a `useSageNudge` hook or directly in `SagePanel`:
  ```ts
  const experts = useExplorerStore(s => s.experts)   // reactive
  const loading = useExplorerStore(s => s.loading)   // reactive
  const total = useExplorerStore(s => s.total)       // reactive
  const isStreaming = useExplorerStore(s => s.isStreaming)

  useEffect(() => {
    if (!hasFetchedOnce.current) return
    if (loading || isStreaming || nudgeSent) return
    if (experts.length === 0 && total === 0) {
      // fire nudge
    }
  }, [experts.length, loading, total, isStreaming, nudgeSent])
  ```
- Reserve `getState()` exclusively for async handlers (inside `useCallback` or `async` functions). Use reactive selectors for everything that reacts to state changes.
- Enforce this in code review: any `getState()` call outside of an async handler is a red flag.

**Warning signs:**
- Nudge never fires even when the grid is visibly empty for > 2 seconds
- Nudge fires once and then never again after the user sees another empty state
- The nudge logic lives inside `handleSend` or another user-triggered handler instead of a `useEffect`

**Phase to address:**
The phase implementing the proactive nudge — the reactive-vs-snapshot distinction must be called out explicitly in the implementation spec.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Track all event types in one `user_events` table | One table, one endpoint | Querying event-type subsets requires WHERE filters; schema evolution harder as event types grow | Acceptable for v2.3 at low volume |
| Store Sage search results in `pilotSlice` instead of a dedicated `sageResultsSlice` | No new slice file | Pilot slice grows; risk of accidentally persisting pilot state | Acceptable if `sageResults` is explicitly excluded from `partialize` |
| Use `Date.now()` bucketed to 30-min windows as session ID for event deduplication | Zero setup | Multi-tab users create separate sessions; can't distinguish one user from another across sessions | Acceptable for anonymous users in v2.3 |
| Track filter events on every `useEffect` fire without debounce | Simple implementation | DB grows 50–100x faster; Gaps analysis becomes noise immediately | Never — debounce is required from day one |
| `search_experts` function dispatches to Zustand instead of calling backend directly | Eliminates race condition with `useExplore` | Sage panel cannot show results independently from the grid | Acceptable tradeoff — grid is the authoritative result display |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Gemini function calling with 2 functions | Declaring both in same `Tool` with overlapping descriptions | Write mutually exclusive semantic descriptions; test against 20 real queries before shipping |
| Zustand + proactive nudge | Placing nudge trigger inside `handleSend` using `getState()` snapshot | Nudge trigger lives in a `useEffect` using reactive `useExplorerStore(s => s.experts)` selector |
| SQLite `ALTER TABLE` on Railway | Adding a column to `models.py` and relying on `create_all` | Add `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` to `main.py` lifespan before the `yield` |
| ExpertCard click tracking | Adding `await fetch(...)` before `onViewProfile` in the click handler | `void fetch(...)` or `navigator.sendBeacon` — never `await` in click paths |
| VirtuosoGrid + new tracking wrapper | Wrapping `ExpertCard` in a new `div` inside `itemContent` that adds props | Track via the existing `onViewProfile` prop; do not add new DOM wrappers inside `itemContent` — VirtuosoGrid's fixed-height assumption breaks |
| Framer Motion FAB pulse + gesture props | Adding `animate={{ scale: loop }}` on the same `motion.button` that has `whileHover={{ scale: 1.05 }}` | Separate glow into a wrapper `motion.div`; keep `scale` exclusively on gesture props of inner `motion.button` |
| FastAPI event tracking endpoint | Using `def` (synchronous) for the tracking endpoint; SQLite write blocks the event loop | Use `async def` with `await loop.run_in_executor` (same pattern as `explore.py`) |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Tracking every Zustand filter mutation | Hundreds of DB writes per session; Railway SQLite I/O lock contention | Debounce 1000ms after last mutation; settled-state pattern | From day 1 with any active user |
| Sage `search_experts` calling `/api/explore` while `useExplore` fires simultaneously | Two concurrent requests; grid flickers; AbortController kills the wrong request | Single source of truth: `useExplore` owns all grid fetches; Sage dispatches filter state only | Any time a Sage search is triggered |
| Framer Motion continuous loop animation on FAB while VirtuosoGrid is scrolling | Jank on mobile — browser paints FAB animation + virtualizes grid simultaneously | Use CSS `@keyframes` for the glow ring; keep Framer Motion only for the gesture `scale` | Immediately on mobile/low-end hardware |
| Loading all `user_events` rows for Gaps tab without aggregation | Admin Gaps tab hangs after > 10k events | Aggregate at query time with `GROUP BY`; add index on `(event_type, created_at)` | After ~30 days of active tracking |
| `useEffect` nudge with broad dependency array (all store state) | Re-evaluates nudge on every store mutation; performance regression | Narrow deps to `[experts.length, loading, total, isStreaming]` only | From day 1 if implemented with broad deps |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Tracking endpoint accepts arbitrary `event_type` strings from client | Admin Gaps tab gets attacker-injected event categories | Validate `event_type` against an explicit allowlist (`["card_click", "sage_query", "filter_change"]`) in the Pydantic model |
| Tracking endpoint has no rate limiting | Spam tracking writes from bots or accidental loops inflate Gap analysis and grow SQLite storage | Add a per-IP request counter in Railway's NGINX config or a simple in-memory rate limiter; 20 req/s per IP is sufficient |
| Storing raw user queries in `user_events` with no length cap | Adversarially long queries bloat SQLite storage | Cap `query` field at 2000 chars in the Pydantic model (matches the existing `/api/pilot` limit) |
| Admin Gaps tab exposure distribution endpoint exposed without auth | Expert popularity/exposure data visible to anyone | Wrap in the existing `_require_admin` dependency (already on all `/api/admin/*` routes) — no new security work needed |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Sage shows search results in panel AND grid updates simultaneously, with different results momentarily | Users don't know where to look; conflicting result sets break trust | Show only result count + "Check the grid for all results" in Sage panel; let grid be the authoritative display |
| Proactive nudge fires while user is mid-typing | Sage interrupts the user's search flow with unsolicited help | Only fire nudge when `loading === false` and `experts.length === 0` for at least 1500ms — well after typing debounce |
| Sage asks "what kind of expert are you looking for?" when user already has a text query active | Sage ignores the user's active query context; feels stupid | `current_filters.query` is already passed in the system prompt — the warmer personality rewrite must preserve this context injection |
| FAB pulse animation fires at unpredictable times | Users learn to ignore the FAB; animation loses meaning | Pulse should have explicit semantic triggers: "new results available" or "empty state detected" — not random idle pulses |
| Empty Gaps tab on day 1 confuses admin into thinking tracking is broken | Support ticket; feature perceived as non-functional | Explicit empty state with "Tracking started [timestamp]" and estimated time to first insights |

---

## "Looks Done But Isn't" Checklist

- [ ] **Sage dual functions:** Tested with 20+ real user queries from the existing `conversations` table in SQLite to verify correct function routing — check `fn_call.name` in Railway logs
- [ ] **Grid sync:** DevTools Network tab confirms only ONE `/api/explore` request fires when Sage sends a message (not two simultaneous requests)
- [ ] **Proactive nudge:** Does NOT fire on page load before first fetch resolves; does NOT fire twice in one session for the same empty state; does NOT fire while `isStreaming === true`
- [ ] **FAB animation:** `whileHover` scale still works while pulse is active; tested on mobile Safari (gesture + animation coexistence)
- [ ] **SQLite migration:** New `user_events` table (or added columns) confirmed to exist on Railway after first deploy — check Railway logs for `OperationalError` in first 60 seconds
- [ ] **Fire-and-forget tracking:** Zero `await` in any click handler path; card click → modal open latency is < 16ms in DevTools Performance tab
- [ ] **Event tracking debounce:** Rate slider drag generates exactly 1 tracking event per settled position, not per pixel of movement — confirmed in DevTools Network tab
- [ ] **Admin Gaps tab empty state:** Opening the tab with zero `user_events` rows shows a helpful message with tracking start timestamp, not an empty table or JS error
- [ ] **Tracking endpoint security:** `event_type` field is validated against an explicit allowlist; any arbitrary string returns HTTP 422
- [ ] **Personality depth limit:** Sage asks at most 1 clarifying question before calling a function — confirmed across 10 ambiguous test queries

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong function chosen by Gemini in production | LOW | Update `APPLY_FILTERS_DECLARATION` and `SEARCH_EXPERTS_DECLARATION` descriptions in `pilot_service.py`; push to `main` — Railway auto-deploys; no DB changes needed |
| Grid sync race condition causing flickering | MEDIUM | Add `sageResults: Expert[]` to `pilotSlice`; remove any `setResults` calls from `useSage`; redeploy — requires frontend refactor |
| Proactive nudge fires repeatedly in production | LOW | Add `nudgeSent` boolean to `pilotSlice` with correct guards; redeploy |
| FAB animation conflict freezing hover | LOW | Move glow to wrapper `div`; CSS or Framer Motion property separation; redeploy |
| SQLite missing column crash on Railway | HIGH | Service is down until redeploy completes (~2–3 min on Railway); add `ALTER TABLE` to `main.py` lifespan; push to `main`; no data loss |
| Tracking noise polluting Gaps analysis | MEDIUM | Add debounce to tracking hooks; back-fill requires running a DELETE on noisy `user_events` rows via Railway shell or a one-off admin endpoint |
| Sage loops clarifying questions | LOW | Tighten system prompt with explicit depth limit; push to `main` — Railway auto-deploys `pilot_service.py`; one-line change |
| Cold-start admin confusion on day 1 | LOW | Add empty state copy to `GapsPage.tsx`; backfill exposure chart from `conversations.response_experts`; no schema changes needed |
| Event tracking endpoint too slow | MEDIUM | Switch to `sendBeacon` on frontend; add `run_in_executor` to tracking endpoint on backend; both are small isolated changes |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Gemini wrong function routing | Phase: Sage dual function implementation | QA: 20 queries from `conversations` table; assert `fn_call.name` in logs for each |
| Grid sync race condition | Phase: Sage dual function implementation | DevTools: single `/api/explore` request per Sage message |
| Proactive nudge fires at wrong time | Phase: Sage personality upgrade | QA: page load, rapid typing, returning to empty state twice — nudge fires max once per session |
| FAB animation + gesture conflict | Phase: Sage personality / FAB reactions | QA: hover while pulse active on Chrome and Safari mobile; scale still responds |
| Fire-and-forget tracking blocks click | Phase: Event tracking implementation | Performance: card click → modal open < 16ms in DevTools |
| SQLite migration crash | Phase: Event tracking backend | Post-deploy: Railway log scan for `OperationalError` in first 60s; smoke test new table with INSERT |
| Sage personality loops questions | Phase: Sage personality upgrade | QA: 10 ambiguous queries; max 1 clarifying question before function call |
| Tracking noise in Gaps analysis | Phase: Event tracking implementation | Rate slider test: drag generates 1 event per settled position confirmed in Network tab |
| Cold-start empty Gaps tab | Phase: Admin Gaps tab implementation | Manual: open Gaps tab with zero `user_events`; helpful empty state shown, not empty table |
| `getState()` misused for reactive nudge | Phase: Sage personality upgrade | Code review: nudge trigger uses reactive `useExplorerStore(s => s.experts)` selector in `useEffect`, not `getState()` inside `handleSend` |

---

## Sources

- Direct codebase analysis: `/Users/sebastianhamers/Documents/TCS/frontend/src/hooks/useSage.ts` — existing two-turn Gemini pattern, `getState()` snapshot decision, `validateAndApplyFilters` function
- Direct codebase analysis: `/Users/sebastianhamers/Documents/TCS/frontend/src/hooks/useExplore.ts` — reactive deps array, AbortController pattern, `setResults`/`setLoading`/`appendResults` call sites
- Direct codebase analysis: `/Users/sebastianhamers/Documents/TCS/frontend/src/store/index.ts` + `pilotSlice.ts` + `resultsSlice.ts` — store ownership, persist boundary, `partialize` config
- Direct codebase analysis: `/Users/sebastianhamers/Documents/TCS/frontend/src/components/pilot/SageFAB.tsx` — existing `whileHover={{ scale: 1.05 }}` and `whileTap={{ scale: 0.95 }}` on `motion.button`
- Direct codebase analysis: `/Users/sebastianhamers/Documents/TCS/app/services/pilot_service.py` — current single-function `apply_filters` Gemini two-turn pattern, `APPLY_FILTERS_DECLARATION`
- Direct codebase analysis: `/Users/sebastianhamers/Documents/TCS/app/models.py` — existing table schema, `create_all` pattern, no Alembic migration framework
- Direct codebase analysis: `/Users/sebastianhamers/Documents/TCS/app/routers/explore.py` — `run_in_executor` pattern for synchronous SQLAlchemy calls in async FastAPI
- Direct codebase analysis: `/Users/sebastianhamers/Documents/TCS/app/routers/admin.py` — `GAP_THRESHOLD`, existing gaps endpoint, gap flag logic, `_is_gap` helper
- Direct codebase analysis: `/Users/sebastianhamers/Documents/TCS/frontend/src/components/marketplace/ExpertCard.tsx` — `onViewProfile` call site, CSS-only hover pattern
- Project decisions: `.planning/PROJECT.md` — locked decisions: CSS hover for ExpertCard (no Framer Motion on cards), `filterSlice.setTags` (not `toggleTag`) for Sage, `useExplorerStore.getState()` snapshot in useSage for async handlers, `motion from 'motion/react'` for modals/FAB only
- Framer Motion documented behavior: gesture props (`whileHover`, `whileTap`) and `animate` prop compete when targeting the same CSS property (documented in Motion API reference)

---

*Pitfalls research for: v2.3 Sage Evolution & Marketplace Intelligence — dual-function Gemini, proactive personality, event tracking, Admin Gaps tab*
*Researched: 2026-02-22*
