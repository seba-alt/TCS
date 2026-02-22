# Feature Research

**Domain:** AI Expert Marketplace — v2.3 Sage Evolution & Marketplace Intelligence
**Milestone:** v2.3 (adding to existing v2.2 codebase)
**Researched:** 2026-02-22
**Confidence:** MEDIUM — Sage dual-function UX and clarifying question patterns are MEDIUM (cross-verified with multiple 2025 sources); event tracking schema is HIGH (well-established GA4/analytics industry standards); gap dashboard UX is MEDIUM (Algolia analytics patterns + marketplace analytics literature verified); FAB animation reactions are MEDIUM (Material Design docs + animation UX literature).

---

## Context: What Already Exists (do NOT re-implement)

| Existing Feature | Status | Notes |
|-----------------|--------|-------|
| Sage FAB + slide-in panel (380px, Framer Motion AnimatePresence) | Live | FAB hides when panel is open |
| Gemini two-turn function calling (`apply_filters`) | Live | Calls `filterSlice.setTags/setRate` — no search API call |
| Hybrid search `/api/explore` (FAISS + BM25) | Live | Three-stage pipeline, accepts `query`, `tags`, `rate_min`, `rate_max`, `page`, `limit` |
| Zustand `useExplorerStore` (filter + results + pilot slices) | Live | `filterSlice`, `resultsSlice`, `pilotSlice` |
| No-results empty state (6 tag suggestions + Sage CTA) | Live | Visible when `results.length === 0` |
| Admin analytics (searches, leads, expert management, intelligence, t-SNE) | Live | In `/admin` |
| `conversations` table in SQLite | Live | Stores query text, timestamp, result count, OTR@K |
| Aurora aesthetic, glassmorphism, bento cards | Live | Shipped v2.2 |

All v2.3 features extend this foundation without replacing any of the above.

---

## Feature Landscape

### Table Stakes (Users Expect These)

For an AI co-pilot that claims to help users "find experts," these behaviors are the minimum that makes the experience feel functional and trustworthy. Missing any of these makes Sage feel broken or misleading.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Sage search results visible in panel (not just filter adjustments) | Users who ask "show me experts in X" expect to see expert results in the conversation — not just a filter sidebar that silently changes. Confirmed by 2025 UX research: chat-dominated experiences without visible state feedback cause users to miss critical context. | MEDIUM | Render expert result cards (compact, 2-3 fields: name, title, rate) inside the Sage panel chat bubble. Do NOT try to render full bento cards — the panel is 380px wide. Use a condensed list format. |
| Grid syncs when Sage searches | If Sage searches and the main grid doesn't update, users lose trust in which source is "correct." The grid and panel must show the same results after a Sage search. | MEDIUM | After `search_experts` returns, dispatch results to `resultsSlice` (same slice that `/api/explore` normally populates). This is the same as `apply_filters` already does — just also fire the search. |
| Sage confirms what it did in natural language | Users need text confirmation after every function call ("I found 8 experts in fintech under $200/hr"). Returning raw data without a summary creates a "dead" AI feeling. | LOW | Already done for `apply_filters` in the two-turn pattern. Extend to `search_experts`: Turn 2 prompt instructs Gemini to summarize results found (count, domain, notable names). |
| Sage handles zero results gracefully | When search returns nothing, Sage must acknowledge it and suggest a next action — not silently show an empty panel. | LOW | Detect `results.length === 0` in the function result, pass this context to Turn 2 so Gemini responds with a redirect (e.g., "No exact matches — try broadening the domain or adjusting the rate"). Existing no-results empty state on the grid can remain. |
| Event tracking fires without blocking UX | Behavior tracking must be invisible — no latency on clicks, no UI freezes, no error surfaces if tracking POST fails. | LOW | Fire-and-forget pattern: POST to tracking endpoint and ignore response. Never `await` tracking calls in the critical path. Use `navigator.sendBeacon()` or background `fetch()` with no error handling surfaced to user. |
| Admin can view zero-result queries | This is table stakes for any search analytics dashboard. Algolia, Elastic, and every search analytics product exposes this as the first data point. Without it, admins cannot identify unmet demand. | MEDIUM | Query the `events` table: `SELECT query_text, COUNT(*) as occurrences FROM search_events WHERE result_count = 0 GROUP BY query_text ORDER BY occurrences DESC`. Present as a sortable table in the Admin Gaps tab. |

---

### Differentiators (Competitive Advantage)

These are the features that make v2.3 more than "adding tracking." None of these are standard behavior for marketplace co-pilots as of early 2026.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Sage dual-function calling (`apply_filters` + `search_experts`) | Sage can either adjust filters (when user wants to browse) OR perform a full search (when user wants direct results). No competitor marketplace AI co-pilot resolves this split — they either filter or search, not both. | HIGH | Add `search_experts` as a second function in the Gemini function schema alongside `apply_filters`. Gemini decides which to call based on intent signals in the query. Clear intent heuristic: "show me" / "find me" → `search_experts`; "filter by" / "only show" → `apply_filters`. Both functions must sync the grid as a side effect. See dependency notes. |
| Sage clarifying questions for ambiguous queries | When query is ambiguous, inserting one clarifying question reduces error rates by 27% and ambiguity-induced retries from 4.1 to 1.3 per session (2025 research finding, haptik.ai). No other marketplace co-pilot does this. | MEDIUM | Implement as a third Gemini function `ask_clarification(question: string)` or as a Turn 2 instruction: if Gemini's Turn 2 text includes a question, render it as a question bubble with optional quick-reply chips (e.g., "Product strategy" / "Technical architecture"). Trigger: system prompt instructs Sage to ask one question when budget, domain, or experience level is missing from the query. |
| Sage proactive empty-state nudge | When the grid shows zero results (detected via Zustand store), Sage FAB pulses and Sage proactively surfaces a suggestion — unprompted. This closes the "dead end" gap where users stare at an empty grid without knowing what to do. | MEDIUM | Subscribe to `resultsSlice.results.length` in the Sage component. When it drops to 0 and Sage panel is closed, trigger FAB pulse animation + inject a system-generated message into the pilot history: "No experts matched those filters — want me to broaden the search?" This is a proactive AI nudge pattern (confirmed via ShapeOfAI.com patterns). |
| FAB animated reactions (pulse/glow on user activity) | Sage FAB draws attention at moments when Sage can add value (empty state, first load, user inactivity). Animated FABs with contextual motion signals are proven to increase engagement with the underlying feature (Material Design research). | LOW | Two states: (1) `pulse` — soft radial keyframe animation when grid hits zero results or user has been idle 30s; (2) `glow` — aurora-colored box-shadow intensification when Sage receives a message response. Framer Motion `animate` prop on the FAB div. Do NOT animate continuously — only on the specific trigger events. |
| Expert exposure distribution in admin | Shows which experts appear in search results most vs least — identifies "invisible" experts who are almost never surfaced. No public competitor marketplace dashboard exposes this. This is borrowed from Elastic's search analytics patterns (impression tracking per document ID). | HIGH | Requires the event tracking layer to log which expert IDs appeared in each search result set (not just clicks). Exposure = appearance in results. Click-through = user clicked the card. Display as a ranked table: Expert Name, Appearances, Clicks, CTR. Sortable by "least exposed" to surface invisible experts. |
| Admin Gaps tab: unmet demand + exposure in one view | Combining zero-result queries (demand) with low-exposure experts (supply) in one screen gives admins an actionable market intelligence view. Comparable to Algolia's Analytics dashboard for enterprise customers, but here it's native to the marketplace with domain-specific context. | HIGH | Two sections on the tab: (1) Unmet Demand — top zero-result queries grouped by likely domain; (2) Expert Exposure — ranked list of experts by appearance count. Secondary metric: queries that returned results but had low engagement (high impressions, zero clicks = low relevance indicator). |
| Warmer/wittier Sage personality | System prompt rewrite: Sage shifts from functional assistant to personality-driven guide. 2025 conversational AI UX research (TELUS Digital, Haptik) shows users form stronger product attachment to assistants with distinct voice. Current Sage is competent but neutral. | LOW | System prompt rewrite is a low-risk, high-impact change with no infrastructure changes required. Key principles: use contractions, occasional light humor, acknowledge the user's goal before diving into results, avoid corporate hedging phrases. Example: "I found 6 fintech experts who know their stuff — let me show you the standouts." vs current: "Here are the experts matching your query:" |

---

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Sage auto-searches on every user message | "Sage should always search, not just sometimes" | Creates confusion when user is asking a clarifying follow-up or saying "thanks" — firing a search on "Thanks, what else?" produces nonsensical results and wastes Gemini API calls. Also breaks the `apply_filters` use case which is intentionally filter-only. | Keep dual-function model: Gemini decides when to call `search_experts` vs `apply_filters` vs respond in plain text. Trust the LLM's intent classification — it's reliable for these two clear function signatures. |
| Rendering full bento cards inside Sage panel | "Show the same cards in Sage as in the grid" | The Sage panel is 380px wide. Full bento cards are designed for a grid at 2-3 column widths. Rendering them in the panel produces a broken, over-constrained layout that looks unpolished. | Compact expert result format inside Sage panel: name, job title, rate badge — 3 fields max. Clicking an item in the panel highlights/scrolls to the card in the main grid (a "select" action, not a new view). |
| Storing full search result payloads in the events table | "Track everything for replay later" | 530 experts × JSON payloads per query = rapid DB bloat on SQLite (Railway volume). Full result storage is not needed for the Gap dashboard — only result count and expert IDs that appeared. | Store: `query_text`, `result_count`, `result_expert_ids` (array of IDs, stored as JSON string), `filters_applied` (JSON), `timestamp`. Expert ID list allows exposure calculation without storing names/titles. |
| Real-time gap dashboard (WebSocket / polling) | "Show live activity in the Gaps tab" | The gap analysis is inherently retrospective — it shows patterns over time, not live queries. Real-time updates would require WebSocket infrastructure not in the stack and add complexity with no UX benefit. Admin checks the Gaps tab periodically, not continuously. | Simple HTTP GET endpoint that aggregates the events table on request. Cache the aggregation for 60 seconds. No streaming. |
| Tracking individual anonymous user sessions | "We want to know what each user does across their whole session" | Anonymous session stitching requires either cookies (consent friction) or fingerprinting (privacy risk, inaccurate). The platform already gates profiles via newsletter — that email is the natural user identifier. Cross-session tracking of anonymous users adds complexity with low analytical value given the existing newsletter gate. | Track events with `session_id` (random UUID generated on page load, stored in sessionStorage). This gives per-session context without cross-session stitching. Session ID is reset on each new tab/visit, which is appropriate for anonymous analytics. |
| Third-party analytics SDK (Segment, Mixpanel, Heap) | "Use a proper analytics platform instead of rolling our own" | Adds an external dependency with its own pricing, data residency concerns, and integration complexity. The four v2.3 event types (card clicks, Sage queries, filter usage, exposure) are well-defined and can be stored in the existing SQLite DB with three new tables. A third-party SDK is justified at scale (>10K daily events); at 530 experts and current traffic, it's overengineering. | Custom event tables in SQLite. Design the schema to mirror GA4's `event_name + event_params` pattern so migration to a proper analytics platform later is straightforward (no schema redesign needed). |
| Sage sending expert results AND updating filters simultaneously | "Do both — search and also apply filters so the grid reflects it" | If `search_experts` also calls `apply_filters`, the filter sidebar state diverges from the Sage search state — the sidebar might show filters that weren't user-set, confusing users who then try to adjust them. | Keep the operations separate. `search_experts` dispatches results directly to `resultsSlice` bypassing the filter pipeline. `apply_filters` updates `filterSlice` and re-fetches. User-visible filter chips only reflect user-initiated or `apply_filters`-initiated filter changes, not Sage search results. |

---

## Feature Dependencies

```
[Sage `search_experts` function]
    └──requires──> [Gemini function schema updated with new function definition]
    └──requires──> [Backend `/api/explore` already live — no new endpoint needed]
    └──requires──> [resultsSlice.setResults dispatcher (already in Zustand store)]
    └──side-effect──> [Grid sync (same dispatch mechanism as normal explore flow)]
    └──enables──> [Sage proactive empty-state nudge]
    └──enables──> [Sage result exposure tracking]

[Sage proactive empty-state nudge]
    └──requires──> [Sage `search_experts` OR `apply_filters` can produce zero results]
    └──requires──> [FAB pulse animation (FAB animated reactions)]
    └──requires──> [Sage panel can inject system-generated messages into pilot history]
    └──independent of──> [Event tracking tables]

[FAB animated reactions (pulse/glow)]
    └──requires──> [Framer Motion `animate` prop on FAB (already installed)]
    └──triggers from──> [Sage proactive nudge OR new message received]
    └──independent of──> [Event tracking, admin Gaps tab]

[Sage warmer personality + clarifying questions]
    └──requires──> [System prompt change only — no infra changes]
    └──independent of──> [All other v2.3 features]
    └──note: ship first — lowest risk, establishes personality baseline before search function changes]

[User behavior event tracking — 3 event types]
    └──requires──> [New SQLite table: `user_events` (event_name, event_params JSON, session_id, timestamp)]
    └──event: expert_card_click requires──> [Expert card onClick handler updated]
    └──event: sage_query requires──> [useSage hook logs after function call resolves]
    └──event: filter_applied requires──> [filterSlice actions log on dispatch]
    └──enables──> [Admin Gaps tab (both unmet demand + exposure analysis)]

[Expert exposure tracking (which experts appear in results)]
    └──requires──> [Event tracking layer live]
    └──requires──> [Search handler logs result expert IDs as part of sage_query event]
    └──requires──> [Explore API handler logs result expert IDs as part of filter_applied event]
    └──enables──> [Admin Gaps tab exposure distribution table]

[Admin Gaps & Exposure tab]
    └──requires──> [user_events table populated with sage_query + filter_applied events]
    └──requires──> [result_expert_ids stored per event for exposure calculation]
    └──independent of──> [Sage personality, FAB animations]
    └──note: build last — depends on tracking layer being live and populated]
```

### Dependency Notes

- **Sage personality rewrite is independent and lowest-risk:** Ship it first in v2.3 — a system prompt change with zero infrastructure dependencies. Establishes the new tone before any of the function calling or tracking changes land.
- **`search_experts` requires no new backend endpoint:** The existing `/api/explore` already accepts `query`, `tags`, `rate_min`, `rate_max`. The function just needs to call it with the right params and dispatch results to `resultsSlice`. This is a frontend-only change for the core feature.
- **Event tracking must precede the Gaps tab:** The Admin Gaps tab aggregates data from the `user_events` table. If tracking ships in Phase X, the Gaps tab can ship in Phase X+1 after events have had time to accumulate. Do not ship the Gaps tab before tracking — an empty dashboard creates a confusing admin experience.
- **Exposure tracking requires search events to include result IDs:** This is a slightly heavier event payload than simple click tracking. The `sage_query` and `filter_applied` events must include `result_expert_ids: string[]` in their params JSON. Design the event schema to include this from the start, not as a later addition.
- **Zustand `resultsSlice` is the sync mechanism:** Both `search_experts` and `apply_filters` must write to the same `resultsSlice.setResults` to keep the grid and panel in sync. This is already how `apply_filters` works — `search_experts` follows the exact same dispatch pattern.

---

## v2.3 Phase Definition

### Phase A — Sage Personality & Clarifying Questions (lowest risk, ship first)

- [ ] System prompt rewrite: warmer voice, contractions, result summary format
- [ ] Clarifying question behavior: instruct Gemini to ask one question when intent is ambiguous (missing domain, budget, or experience level)
- [ ] Quick-reply chip rendering for clarifying questions in Sage panel (optional: plain text fallback acceptable for MVP)

### Phase B — Sage Active Search (`search_experts` function)

- [ ] Add `search_experts` function to Gemini function schema (params: `query`, `tags`, `rate_min`, `rate_max`)
- [ ] Handle `search_experts` function call in `useSage` hook: call `/api/explore`, dispatch results to `resultsSlice`
- [ ] Render compact expert result list inside Sage panel chat bubble (name, title, rate — 3 fields, no full bento card)
- [ ] Turn 2 prompt instructs Gemini to summarize results found (count, domain, notable characteristics)
- [ ] Handle zero-result case in Turn 2 context

### Phase C — Sage FAB Animated Reactions + Proactive Nudge

- [ ] FAB `pulse` animation: Framer Motion keyframe on zero-results state (subscribe to `resultsSlice.results.length === 0`)
- [ ] FAB `glow` animation: aurora box-shadow intensification when Sage receives a response
- [ ] Proactive nudge: inject system message into pilot history when grid hits zero results and panel is closed

### Phase D — User Behavior Event Tracking

- [ ] SQLite `user_events` table: `id`, `event_name`, `event_params` (TEXT/JSON), `session_id`, `created_at`
- [ ] `POST /api/events` endpoint: accepts `{event_name, event_params}` — no auth required, no response body needed
- [ ] Session ID generation: random UUID in sessionStorage on page load, attached to all events
- [ ] Track `expert_card_click`: `{expert_id, expert_name, context: 'grid'|'sage_panel', session_id}`
- [ ] Track `sage_query`: `{query_text, function_called: 'search_experts'|'apply_filters'|'none', result_count, result_expert_ids: string[]}`
- [ ] Track `filter_applied`: `{filters: {tags, rate_min, rate_max, text_query}, result_count, result_expert_ids: string[]}`
- [ ] All tracking calls fire-and-forget (no await, no error surfacing)

### Phase E — Admin Gaps & Exposure Tab

- [ ] Admin Gaps tab route and nav item in existing admin panel
- [ ] Unmet Demand section: top zero-result queries (`result_count = 0`), grouped and sorted by frequency
- [ ] Low Engagement section: queries with results but zero clicks (impressions without interaction)
- [ ] Expert Exposure section: ranked table of experts by appearance count + click count + CTR
- [ ] "Least visible" experts: sorted ascending by appearance count — identifies experts who need findability review
- [ ] Date range filter on Gaps tab (last 7d / 30d / all time)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Phase | Priority |
|---------|------------|---------------------|-------|----------|
| Sage warmer personality + clarifying questions | HIGH (trust + engagement) | LOW (system prompt only) | A | P1 |
| Sage `search_experts` function + grid sync | HIGH (core Sage capability) | MEDIUM (frontend function call + dispatch) | B | P1 |
| Compact expert results in Sage panel | HIGH (makes search results visible) | MEDIUM (new panel component) | B | P1 |
| Sage zero-result graceful handling | HIGH (avoids dead-end UX) | LOW (Turn 2 prompt + condition) | B | P1 |
| `user_events` table + POST endpoint | HIGH (enables all analytics) | LOW (2 new DB columns, 1 endpoint) | D | P1 |
| Track `expert_card_click` event | HIGH (core marketplace intelligence) | LOW (onClick handler) | D | P1 |
| Track `sage_query` event (with result IDs) | HIGH (enables gap analysis + exposure) | LOW (hook instrumentation) | D | P1 |
| Track `filter_applied` event (with result IDs) | MEDIUM (filter usage patterns) | LOW (store dispatch instrumentation) | D | P2 |
| Admin Gaps tab — unmet demand section | HIGH (admin intelligence) | MEDIUM (SQL aggregation + table UI) | E | P1 |
| Admin Gaps tab — expert exposure section | HIGH (supply-side intelligence) | MEDIUM (SQL aggregation + ranked table) | E | P1 |
| FAB pulse on zero results | MEDIUM (engagement, nudge) | LOW (Framer Motion animate) | C | P2 |
| Sage proactive empty-state nudge | MEDIUM (reduces dead-end abandonment) | MEDIUM (store subscription + message injection) | C | P2 |
| FAB glow on message received | LOW (delight) | LOW (CSS animation) | C | P3 |
| Date range filter on Gaps tab | MEDIUM (admin usability) | LOW (SQL WHERE clause + date picker) | E | P2 |
| Quick-reply chips for clarifying questions | LOW (polish) | MEDIUM (new component) | A | P3 |

**Priority key:**
- P1: Ships in v2.3 core — milestone incomplete without these
- P2: Ships in v2.3 — adds significant value, low regression risk
- P3: Ship if P1/P2 complete, or defer to v2.4

---

## Detailed Pattern Notes by Feature Area

### 1. Sage Dual-Function UX (Filter vs Search)

**The core UX distinction (MEDIUM confidence — 2025 AI UX research, Microsoft Copilot patterns):**

The fundamental question Sage must resolve per turn: does the user want to *constrain browsing* (apply_filters) or *get direct results* (search_experts)?

| Signal | Intent | Function |
|--------|--------|----------|
| "Only show me..." / "Filter to..." / "Hide..." | Constrain browsing | `apply_filters` |
| "Show me experts in X" / "Find me someone who..." / "Who can help with..." | Direct retrieval | `search_experts` |
| "What's your rate?" / "Can you do X?" (clarification) | Ambiguous | Ask clarifying question first |
| "Thanks" / "That's helpful" / non-action statement | No function | Plain text response |

The LLM resolves this disambiguation natively given clear function descriptions. Write the function schema descriptions to encode this intent distinction explicitly:

```python
search_experts_schema = {
    "name": "search_experts",
    "description": "Perform a semantic search to find and display matching experts. Use this when the user wants to SEE results — when they ask 'show me', 'find me', or describe a problem to solve. This will update both the Sage panel results AND the main expert grid.",
    "parameters": { ... }
}

apply_filters_schema = {
    "name": "apply_filters",
    "description": "Adjust the browse filters without performing a new search. Use this when the user wants to CONSTRAIN what's visible — 'only show', 'filter to', 'hide results above'. This adjusts the sidebar filters and refreshes the grid.",
    "parameters": { ... }
}
```

**Grid sync mechanism:** Both functions must ultimately write to `resultsSlice` via the same dispatch. For `search_experts`, call `useExplorerStore.getState().setResults(results)` directly after receiving the API response. For `apply_filters`, the existing flow already triggers a grid refresh via `filterSlice` → `useExplore` hook refetch. Do not merge these code paths — keep them separate with the same end state.

**Compact result cards in Sage panel (MEDIUM confidence — derived from Microsoft Copilot chat result pattern):**

Inside the Sage panel chat bubble, render a compact list — not full bento cards. Maximum 5 results displayed. Each item:
```
[Name] — [Job Title]
[Rate badge] [Primary tag]
```
Clicking an item in the panel should: (1) close the Sage panel, (2) scroll the main grid to that expert's card, (3) highlight it briefly (pulse animation). This "show me in the grid" action is more useful than trying to open the profile gate from within the panel.

---

### 2. Sage Clarifying Questions

**When to ask vs when to act (MEDIUM confidence — Haptik research, 2026 Medium article on agentic AI):**

Research finding: inserting ONE clarifying question reduces error rates by 27% and retries from 4.1 to 1.3 per session. The key word is ONE. Sage should never ask two questions in a row.

**Trigger condition for clarifying question:**
- Domain is completely unspecified ("I need some help" / "looking for experts")
- Budget is not mentioned AND rate range covers the full spectrum (no implicit signal)
- "Level of expertise" is ambiguous when it materially affects the result set

**Do NOT ask when:**
- The user has already given one of the three signals (domain, budget, seniority)
- The user's previous message already answered a prior clarifying question
- The query is clear enough to search with reasonable confidence

**Implementation in system prompt (LOW complexity):**

Add to Sage system prompt:
> "If a user's request is ambiguous and lacks domain, budget, or experience level, ask ONE focused question before searching. Keep the question short and offer 2-3 concrete options where possible. Example: 'Are you looking for a technical expert, a business strategist, or something else?' Never ask more than one clarifying question per turn."

---

### 3. Event Tracking Schema

**Schema design (HIGH confidence — mirrors GA4 event schema industry standard):**

```sql
CREATE TABLE user_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_name  TEXT NOT NULL,          -- 'expert_card_click' | 'sage_query' | 'filter_applied'
    event_params TEXT NOT NULL,         -- JSON string
    session_id  TEXT NOT NULL,          -- UUID from sessionStorage
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_events_name ON user_events(event_name);
CREATE INDEX idx_user_events_created ON user_events(created_at);
```

**Event schemas (HIGH confidence — standard product analytics event design):**

```json
// expert_card_click
{
  "expert_id": "usr_abc123",
  "expert_name": "Jane Smith",
  "context": "grid"  // or "sage_panel"
}

// sage_query
{
  "query_text": "fintech compliance expert under $150/hr",
  "function_called": "search_experts",  // or "apply_filters" or "none"
  "result_count": 8,
  "result_expert_ids": ["usr_abc", "usr_def", "usr_ghi"]
}

// filter_applied
{
  "filters": {
    "tags": ["fintech", "compliance"],
    "rate_min": 0,
    "rate_max": 150,
    "text_query": ""
  },
  "result_count": 12,
  "result_expert_ids": ["usr_abc", "usr_def", "usr_ghi", ...]
}
```

**Frontend tracking utility (fire-and-forget pattern):**

```typescript
// src/lib/track.ts
const SESSION_ID = (() => {
  let id = sessionStorage.getItem('tcs_session_id');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('tcs_session_id', id);
  }
  return id;
})();

export function track(eventName: string, params: Record<string, unknown>): void {
  // Fire-and-forget — never await this
  fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_name: eventName, event_params: params, session_id: SESSION_ID }),
  }).catch(() => {}); // Swallow errors silently
}
```

**No auth on the events endpoint:** The `/api/events` endpoint should NOT require `X-Admin-Key`. It's a write-only append endpoint that accepts any payload. Abuse is low-risk (worst case: junk rows in SQLite). Adding auth would require passing the session key through the frontend tracking call, which creates complexity and fragility.

---

### 4. Admin Gaps & Exposure Dashboard

**What the dashboard answers (MEDIUM confidence — Algolia analytics patterns, marketplace intelligence literature):**

Two distinct questions answered by one tab:

**Demand side (Unmet Demand):**
> "What are users looking for that we don't have well-covered?"

- Zero-result queries: search terms + filter combos that returned 0 experts
- Low-engagement queries: returned results but zero clicks (results shown were irrelevant)
- These are the highest-signal marketplace gaps — they represent real user intent that the supply side fails to meet

**Supply side (Expert Exposure):**
> "Which of our 530 experts are effectively invisible?"

- Appearance frequency: how often each expert's ID appears in search result sets
- Click rate: appearances vs actual card clicks
- Low-CTR experts: appear in results but are never clicked (findability score or card content issue)
- Near-zero appearance experts: essentially invisible regardless of query (embedding quality issue)

**SQL queries for the Gaps tab backend:**

```sql
-- Unmet Demand: zero-result queries, ranked by frequency
SELECT
    json_extract(event_params, '$.query_text') as query_text,
    COUNT(*) as occurrences,
    MAX(created_at) as last_seen
FROM user_events
WHERE event_name = 'sage_query'
  AND json_extract(event_params, '$.result_count') = 0
GROUP BY query_text
ORDER BY occurrences DESC
LIMIT 50;

-- Expert Exposure: appearances in result sets (requires JSON array expansion)
-- Note: SQLite JSON functions available since 3.38 (Railway should have this)
SELECT
    expert_id,
    COUNT(*) as appearances,
    SUM(CASE WHEN event_name = 'expert_card_click' THEN 1 ELSE 0 END) as clicks
FROM (
    SELECT json_each.value as expert_id, event_name
    FROM user_events, json_each(json_extract(event_params, '$.result_expert_ids'))
    WHERE event_name IN ('sage_query', 'filter_applied')
    UNION ALL
    SELECT json_extract(event_params, '$.expert_id'), event_name
    FROM user_events
    WHERE event_name = 'expert_card_click'
)
GROUP BY expert_id
ORDER BY appearances ASC; -- ASC = least visible first
```

**Dashboard UI layout (MEDIUM confidence — derived from Algolia Analytics dashboard pattern):**

```
Admin → Gaps & Exposure tab
├── Date Range Selector (Last 7d | 30d | All time)
│
├── Section: Unmet Demand
│   ├── Stat card: "X zero-result queries in period"
│   ├── Stat card: "Y low-engagement queries in period"
│   └── Table: Query Text | Occurrences | Last Seen | Action (→ test in search)
│
└── Section: Expert Exposure
    ├── Stat card: "N experts with 0 appearances"
    ├── Stat card: "Average appearances per expert: X"
    └── Table: Expert Name | Appearances | Clicks | CTR% | Findability Score
        (sortable; default sort: least exposed first)
```

**Recommendation: no charts for MVP.** Tables are more actionable than bar charts for this data. An admin looking at the Gaps tab wants to take action on specific queries or specific experts — a table with copy-able query text and clickable expert names is more useful than a distribution chart. Add charts in v2.4 if needed.

---

## Sources

**AI assistant dual-function / active search UX:**
- [5 UX Patterns for Better Generative AI Search — Medium/Bootcamp](https://medium.com/design-bootcamp/5-ux-patterns-for-better-generative-ai-search-6fecb37142a1) — MEDIUM confidence
- [Generative UI — CopilotKit](https://www.copilotkit.ai/generative-ui) — MEDIUM confidence
- [Creating a dynamic UX for generative AI applications — Microsoft Learn](https://learn.microsoft.com/en-us/microsoft-cloud/dev/copilot/isv/ux-guidance) — MEDIUM confidence
- [UX for AI Chatbots — parallelhq.com](https://www.parallelhq.com/blog/ux-ai-chatbots) — LOW confidence (single source)

**Clarifying questions in conversational AI:**
- [Probing For Clarification — Haptik AI](https://www.haptik.ai/tech/probing-clarification-skill-ai-assistant) — MEDIUM confidence (specific data: 27% error reduction, 4.1→1.3 retries)
- [When agents learn to ask: Active questioning in agentic AI — Medium](https://medium.com/@milesk_33/when-agents-learn-to-ask-active-questioning-in-agentic-ai-f9088e249cf7) — MEDIUM confidence
- [Conversational AI Assistant Design — TELUS Digital / WillowTree](https://www.willowtreeapps.com/insights/willowtrees-7-ux-ui-rules-for-designing-a-conversational-ai-assistant) — MEDIUM confidence

**AI nudges + empty states:**
- [AI UX Patterns — Nudges — ShapeOfAI.com](https://www.shapeof.ai/patterns/nudges) — MEDIUM confidence
- [Empty State UI Pattern — Mobbin](https://mobbin.com/glossary/empty-state) — MEDIUM confidence

**Event tracking in SPAs:**
- [Best practices for tracking user interactions in SPAs — Zigpoll](https://www.zigpoll.com/content/what-are-the-best-practices-for-tracking-user-interaction-data-on-singlepage-applications-to-optimize-frontend-performance-and-enhance-user-experience) — MEDIUM confidence
- [Measure single-page applications — Google Analytics for Developers](https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications) — HIGH confidence (official Google docs)
- [Event Analytics: Ultimate Guide — UXcam](https://uxcam.com/blog/event-analytics/) — MEDIUM confidence
- [The Complete Guide to Events Tracking — Countly](https://countly.com/blog/event-tracking-digital-analytics) — MEDIUM confidence

**Zero-result analytics:**
- [Track Zero Search Results In Google Analytics — Cludo](https://www.cludo.com/blog/track-zero-search-results-in-google-analytics) — MEDIUM confidence
- [Zero-Result Searches — Lucidworks (Never Null)](https://lucidworks.com/blog/learn-from-zero-results-searches-with-never-null/) — MEDIUM confidence
- [Where can I see searches without results? — Algolia](https://support.algolia.com/hc/en-us/articles/13079831222033-Where-can-I-see-searches-without-results) — HIGH confidence (official Algolia docs)
- [Null Results Optimization — Algolia Ecommerce Playbook](https://www.algolia.com/ecommerce-merchandising-playbook/null-results-optimization) — HIGH confidence

**FAB animation patterns:**
- [FAB: UX Design Win — Google Design](https://design.google/library/absolutely-fab-button) — HIGH confidence (Google Design, authoritative)
- [The Usability of the Animated FAB — Cinnamon Agency](https://www.cinnamon.agency/blog/post/the_usability_of_the_animated_fab_part_1_2) — MEDIUM confidence
- [Floating Action Button in UX Design — Icons8](https://blog.icons8.com/articles/floating-action-button-ux-design/) — LOW confidence

---

*Feature research for: TCS v2.3 Sage Evolution & Marketplace Intelligence*
*Researched: 2026-02-22*
