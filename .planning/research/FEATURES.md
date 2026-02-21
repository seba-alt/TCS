# Feature Research

**Domain:** Expert Marketplace with Floating AI Co-Pilot — Tinrate / TCS v2.0
**Milestone:** v2.0 Extreme Semantic Explorer
**Researched:** 2026-02-21
**Confidence:** MEDIUM-HIGH — faceted search, card UI, lead capture, and marketplace UX are well-researched domains with strong 2025 consensus; AI co-pilot anchoring patterns are emerging (6-12 months old, less settled); hybrid search result display in marketplaces is underexplored in public sources (LOW confidence, flagged).

---

## Context: What Already Exists (v1.0–v1.2)

This milestone rearchitects, not rebuilds. The following capabilities are live and must be preserved or migrated — not re-researched.

| Existing Feature | Status | v2.0 Fate |
|-----------------|--------|-----------|
| AI chat with 3-expert recommendations | Live | Replaced by AI co-pilot panel (floating) |
| Email gate lead capture (localStorage) | Live | Retained, extended with new gate triggers |
| Thumbs up/down feedback | Live | Retained, feeds co-pilot re-ranking |
| HyDE query expansion | Live | Retained in `/api/explore` hybrid path |
| Feedback re-ranking | Live | Retained in `/api/explore` hybrid path |
| Admin dashboard (analytics, leads, experts, steering, A/B lab) | Live | Unchanged |
| 1,558 experts: AI-tagged, FAISS-indexed, findability-scored | Live | Powers grid and hybrid search |

All v2.0 features build on this foundation.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that users of any professional marketplace expect to exist. Missing these makes the product feel broken or amateurish — users leave without articulating why.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Left sidebar with faceted filters | Every marketplace (Upwork, Toptal, LinkedIn, Behance) uses left-sidebar filtering as the default mental model for browsing a professional directory | MEDIUM | Stick to left sidebar on desktop. Top-bar filter strips are viable on mobile only. Non-negotiable position. |
| Rate range slider with dual handles | Any marketplace with hourly pricing must expose rate filtering as a range (min/max), not a dropdown. A dropdown of rate brackets forces arbitrary decisions on the user. | LOW | Dual-handle slider. Show current values as live labels while dragging ("$50 – $200/hr"). Snap to nearest $10 or $25. Depends on existing `Hourly Rate` field in expert SQLite table. |
| Tag/domain filter as multi-select checkbox or pill group | Users expect to filter by domain (e.g., "legal", "blockchain", "tax") by selecting multiple tags, not by typing. | LOW | Checkbox list or scrollable pill group. Show count per tag in parentheses. Allow multi-select (OR logic within a facet). Uses AI-assigned tags from v1.1. |
| Active filter chips ("applied filters" row) | When filters are active, users must see a persistent summary of what's applied and be able to remove individual filters with one click. Without this, users lose track of their filter state and abandon. | LOW | Row of pill chips below the search bar or above the grid. Each chip: "[Tag] x". One-click removes. "Clear all" at right. This is the most consistent pattern across every studied marketplace (LinkedIn, Toptal, Upwork, Airbnb). |
| Text search bar with immediate grid response | Users expect to type a keyword or name and see results narrow in real time (or on Enter). A search bar that requires form submission or page reload feels dated. | MEDIUM | Debounced input (300ms) triggers `/api/explore` call. Clear button inside the field. Results update in grid. Depends on `/api/explore` endpoint with text search capability. |
| Expert count displayed ("Showing X of 1,558 experts") | Users need to understand what the filter did. Without a count, they cannot tell if "20 results" is filtered or the full set. | LOW | Text label above grid, updates on every filter change. Essential for trust. |
| Scrollable grid that doesn't require pagination | Infinite scroll or virtualized list is expected in 2025. Hard pagination with numbered pages feels like 2012. | MEDIUM | react-virtuoso virtualized list (already scoped in PROJECT.md). Append on scroll. No "load more" button — automatic. |
| Expert card with name, title, rate, and one CTA | Cards must show the minimum identification info at a glance: who this is, what they do, what it costs. A card that requires a click to reveal this information fails the scan test. | LOW | Name (bold), Job Title (muted), Hourly Rate (prominent, right-aligned or badge), domain tags (2-3 pills max on card face), and a single CTA button. |
| Mobile-responsive layout | A marketplace that breaks on phone is unusable. Professional buyers increasingly browse on mobile before committing on desktop. | HIGH | Sidebar collapses to bottom sheet on mobile. Grid goes single-column. Co-pilot panel adapts to full-screen overlay or bottom drawer. This is a significant layout change, not a small CSS tweak. |
| Loading skeleton while results fetch | Users need feedback that something is happening during the 200ms+ fetch. A blank grid or spinner alone increases perceived latency. | LOW | Skeleton card placeholders (shimmering gray rectangles) in grid during fetch. Do not use a full-page spinner — it blocks the visible context. |

---

### Differentiators (Competitive Advantage)

Features that distinguish this marketplace from a static directory or a generic Upwork clone. These are where the product earns its value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Floating AI co-pilot panel | No comparable expert marketplace has an embedded AI that can converse about the visible results AND update the filters through function calling. This is genuinely novel as of 2026. | HIGH | Bottom-right FAB (Floating Action Button) triggers slide-in panel. Panel occupies right 380px of viewport on desktop, full-screen on mobile. AI is context-aware: it can see which experts are currently in the grid. Gemini function calling: `apply_filters({"rate_min": 100, "tags": ["blockchain"]})` directly updates Zustand filter state. Depends on Gemini function calling, Zustand slices, existing HyDE + feedback re-ranking logic. |
| Hybrid search that returns semantically relevant results, not just keyword matches | Users who search "someone to help untangle my cap table" do not get zero results or unrelated hits — they get the right experts. This is the core technical differentiator already built in v1.x; v2.0 makes it visible as a UI experience. | HIGH | `/api/explore` endpoint: pre-filter (SQLAlchemy for rate/tags) → IDSelectorBatch into FAISS → FTS5 keyword match → weighted score fusion. Users experience fast, relevant results. The differentiation is in the experience, not the label. |
| "Match reason" snippet on card | Showing why an expert matched ("Strong match: blockchain law, cap table structuring") converts better than nameless similarity scores. Users trust results they can explain to themselves. | MEDIUM | Generated by co-pilot or by a lightweight Gemini call at retrieval time. Shown as a single line below the expert's title on the card. Toggleable (on by default when AI co-pilot is active). Depends on co-pilot being open or a dedicated "explain match" endpoint. |
| Value-driven lead capture gates | Gating "View Full Profile" and "Download Match Report" converts better than gating search access, because the user has already seen value and now wants more. This is the proven SaaS pattern of "earn trust, then capture". | MEDIUM | Two gate triggers: (1) clicking "View Full Profile" on any card → email modal; (2) clicking "Download Match Report" → email modal with preview of report content shown. Existing email gate and localStorage logic (v1.0) provides the infrastructure; this extends it with two new trigger points. |
| Fuzzy search / "Did you mean?" in search bar | A user typing "blockchainn" or "VC foundin" gets a soft correction or fuzzy match rather than zero results. This is now an expected UX quality signal — its absence reads as broken. | MEDIUM | FTS5 in SQLite supports basic fuzzy matching (prefix search). For spelling correction, a simple Levenshtein distance check over domain tag vocabulary is sufficient (no external library needed). Show "Showing results for: blockchain" in a muted callout when correction is applied. |
| "Download Match Report" lead magnet | A personalized PDF or structured summary of the top N matched experts (with their AI match reasons) gives users a tangible deliverable that justifies the email exchange. Personalized reports convert at 6.2% vs. 3.8% for static PDFs — nearly 2x. | MEDIUM | Generated server-side as a styled HTML-to-PDF (WeasyPrint or Playwright headless) or as a JSON-to-formatted-email. Content: query, top 5 matched experts, match reason per expert, rate, profile URL. The email gate captures the lead; the report is the value exchange. |
| Zustand global state with URL-synced filters | Shareable filter states (user can copy URL and send it to a colleague who sees the same filtered grid) is a professional-grade UX expectation for B2B tools. | MEDIUM | Zustand with `persist` middleware for localStorage. Additionally: sync filter state to URL query params so sharing works. `?tags=blockchain,legal&rate_min=100&rate_max=300`. On load, hydrate Zustand from URL params. |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem like good ideas but introduce friction, complexity, or misalignment with the product's purpose.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| User accounts / saved searches | "Users want to come back and see their saved results" | Introduces auth infrastructure (sessions, passwords, forgot-password flow), which is explicitly out of scope per PROJECT.md. The anonymous session model is a deliberate constraint. The conversion path ends at Tinrate profile click — saved searches extend the loop beyond the product's remit. | localStorage-persisted filter state via Zustand persist covers the "resume where I left off" use case without accounts. URL-synced filters cover sharing. |
| Star ratings / user reviews on expert cards | "Show social proof" | Tinrate already has ratings on their main platform. Duplicating ratings in this tool without access to Tinrate's data creates false precision, and scraping or syncing that data is a significant backend dependency. Stale or absent ratings are worse than no ratings. | Use "findability score" as a data-quality signal (already exists). Match reason snippet provides a better form of contextual credibility. |
| Real-time availability / calendar integration | "Users want to know if the expert is available now" | Not in the expert CSV data. Requires live API integration with Tinrate's booking system (undefined scope, external dependency, likely unavailable). Creates a promise the system cannot fulfill. | CTA leads to Tinrate profile where booking happens. That boundary is already set in PROJECT.md. |
| Full-text expert bio rendered in card | "Show more info per card" | Cards with full bio text (200-400 words) destroy scan-ability. Eye-tracking studies on marketplace UIs consistently show users scan 6-10 cards per second at the grid level — they read the detail view, not the card. High information density on cards actually reduces clickthrough. | Truncated bio (120 chars max) on card face. Full bio visible in a slide-in detail panel or on Tinrate profile. |
| Aggressive lead gate (gate search access entirely) | "Capture email before they see anything" | Companies that gate early-stage research lose up to 57% of potential leads in the early exploration phase (Brixon Group, 2025). Users who haven't seen value will not exchange their email. | Gate at the moment of value extraction: "View Full Profile" and "Download Match Report" are the correct trigger points. Users who click those have seen results and decided they want more — they convert. |
| Auto-play video or animated expert profiles | "Make expert cards more dynamic" | Videos autoplay causing jarring layout shifts, blocking keyboard navigation, and failing WCAG 2.1 accessibility standards. In a dense virtualized grid, video elements cause severe performance regression. | Static avatar or initials avatar (letter + background color derived from name hash). Profile URL links to video content on Tinrate if available. |
| Sorting by too many dimensions simultaneously | "Let users sort by rate, rating, findability, response time, etc." | Marketplaces that expose 5+ sort options see users paralyzed by choice and defaulting to the first option. Sort proliferation also implies that all those signals are meaningful — they are not (response time doesn't exist in the data). | Expose two sort options: "Best match" (default, semantic relevance score) and "Hourly rate: low to high / high to low". The AI co-pilot handles nuanced ordering through conversation. |
| Infinite filter combinatorics (20+ filter dimensions) | "More filters = more control" | Combinatorial explosion of filter states creates empty result sets, which are the #1 conversion killer in marketplace UX. An empty result state with no escape path loses the user permanently. | Limit to 3 filter dimensions: rate range, domain tags, text search. The co-pilot handles natural-language refinements beyond that. Show "No results — try asking the AI co-pilot for suggestions" on empty states rather than a dead end. |
| Explicit semantic match score displayed to users | "Show users the similarity score (0.95 = 93% match)" | Cosine similarity scores are meaningless to non-technical users. "0.87" next to an expert's name creates confusion, not trust. In studies of search result display, unexplained scores reduce trust rather than increase it. | Show "match reason" snippet in plain language. Reserve numeric scores for the admin Search Lab and internal debugging. |

---

## Feature Dependencies

```
[/api/explore hybrid endpoint]
    └──prerequisite──> [Expert grid with results display]
    └──prerequisite──> [Faceted sidebar (filter params sent to endpoint)]
    └──prerequisite──> [Floating AI co-pilot (context = current results)]
    └──prerequisite──> [Download Match Report (content = explore results)]

[Zustand global state (filters + results + isPilotOpen slices)]
    └──prerequisite──> [Faceted sidebar (reads/writes filter slice)]
    └──prerequisite──> [Expert grid (reads results slice)]
    └──prerequisite──> [Floating AI co-pilot (reads/writes all slices via function calling)]
    └──prerequisite──> [URL filter sync (serializes filter slice to query params)]

[Floating AI co-pilot]
    └──requires──> [Gemini function calling (apply_filters)]
    └──requires──> [Zustand filter slice (to mutate)]
    └──requires──> [/api/explore results in state (to summarize context for user)]
    └──enhances──> [Faceted sidebar (AI updates filters, sidebar reflects state)]

[Email gate (v1.0, existing localStorage logic)]
    └──extends to──> ["View Full Profile" gate trigger]
    └──extends to──> ["Download Match Report" gate trigger]
    (gate mechanism already built; v2.0 adds new trigger points and gate content)

[AI-assigned domain tags (v1.1, existing SQLite field)]
    └──powers──> [Tag/domain filter in sidebar]
    └──powers──> [Match reason snippet generation]
    └──powers──> [Download Match Report content]

[HyDE + feedback re-ranking (v1.1–v1.2, existing)]
    └──integrated into──> [/api/explore hybrid endpoint]
    └──toggleable via──> [Admin steering panel (unchanged)]

[react-virtuoso virtualized list]
    └──requires──> [Expert grid component refactor]
    └──requires──> [Variable-height card design finalized before virtualization]
    (Virtuoso requires known or estimated item heights; design must be settled first)

[Mobile bottom sheet (sidebar)]
    └──requires──> [Desktop sidebar complete and tested]
    └──conflicts with──> [Floating co-pilot full-screen on mobile]
    (both compete for screen real estate on mobile; co-pilot modal must close before bottom sheet opens, and vice versa)

[Download Match Report]
    └──requires──> [Email gate capture (user must be identified)]
    └──requires──> [/api/explore results (report content = current filtered results)]
    └──independent of──> [Floating AI co-pilot]
    (report can be generated from filter state without co-pilot being active)

[Fuzzy search / "Did you mean?"]
    └──requires──> [Text search bar]
    └──requires──> [FTS5 on SQLite experts table OR tag vocabulary Levenshtein check]
    └──enhances──> [/api/explore (soft-corrected query passed to endpoint)]
```

### Dependency Notes

- **Zustand is the load-bearing middleware:** The sidebar, grid, and co-pilot are three independent React components that must share state. Without Zustand (or equivalent), these components cannot communicate without prop-drilling through a common ancestor — which requires a full component tree redesign. Zustand must be implemented first, before any of the three main UI components.
- **Variable-height cards must be designed before virtualization:** react-virtuoso handles variable heights, but requires finalized card content to avoid layout thrash. Do not implement Virtuoso with placeholder cards.
- **Mobile conflicts require intentional resolution:** The bottom-sheet sidebar and the co-pilot full-screen panel both want the bottom of the screen on mobile. The state machine must prevent both from being open simultaneously. Design this interaction before building either.
- **Lead gate extension is low-risk:** The existing localStorage + email gate infrastructure from v1.0 is the correct foundation. v2.0 adds trigger points, not a new gate system. No backend changes required for the gate mechanism itself.

---

## MVP Definition (for v2.0 Milestone)

### Launch With (v2.0 core — the rearchitected marketplace)

These features constitute the minimum for "Expert Marketplace" to be true — without them, the product is still a chat app with a nicer layout.

- [ ] **Zustand global state** — filter, results, isPilotOpen slices with persist. Every other component depends on this.
- [ ] **/api/explore hybrid endpoint** — pre-filter + FAISS IDSelectorBatch + FTS5 + weighted scoring. The new search backbone.
- [ ] **Faceted sidebar** — rate range slider, domain tag multi-select, text search, active filter chips, clear all.
- [ ] **Expert grid with virtualized cards** — react-virtuoso, variable-height cards, name/title/rate/tags/CTA.
- [ ] **Floating AI co-pilot (basic)** — FAB → slide-in panel, Gemini conversation, context-aware of current results.
- [ ] **Gemini function calling: apply_filters** — AI can update Zustand filter state from conversation.
- [ ] **Email gate extended to "View Full Profile"** — existing gate mechanism, new trigger point.
- [ ] **Loading skeletons + empty state with co-pilot CTA** — feedback during fetch and on zero results.

### Add After Core Works (v2.0 extended)

These add significant value but do not change the core architecture once the above is working.

- [ ] **"Download Match Report" lead magnet** — triggered after email capture; requires server-side report generation. Add when email gate flow is stable.
- [ ] **URL filter sync** — serialize Zustand filter slice to query params for sharing. Add after Zustand is stable.
- [ ] **Fuzzy search / "Did you mean?"** — FTS5 prefix search + tag vocabulary Levenshtein. Add after `/api/explore` is working.
- [ ] **Match reason snippet on card** — Gemini-generated plain-language explanation per result. Add after co-pilot is live (reuse Gemini call).
- [ ] **Mobile bottom sheet sidebar** — requires desktop sidebar complete. Add in second pass of mobile work.

### Future Consideration (v2.1+)

- [ ] **Saved filter presets** — localStorage-stored named filter sets ("My blockchain search"). Not in v2.0 scope — users haven't proven they need it.
- [ ] **Co-pilot follow-up question suggestions** — chip-style suggested questions below co-pilot input ("Try: Who has the most blockchain experience?"). Nice-to-have once conversation patterns are understood.
- [ ] **Expert card detail panel (slide-in drawer)** — expanded view without leaving the grid. Currently, full profile click goes to Tinrate. A slide-in preview with "go to full profile" CTA is a conversion improvement worth testing post-v2.0.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Zustand global state | HIGH (unblocks everything) | LOW | P1 |
| /api/explore hybrid endpoint | HIGH (core search quality) | HIGH | P1 |
| Faceted sidebar | HIGH (table stakes) | MEDIUM | P1 |
| Expert grid (virtualized) | HIGH (table stakes) | MEDIUM | P1 |
| Active filter chips + clear all | HIGH (UX completeness) | LOW | P1 |
| Floating AI co-pilot (basic) | HIGH (differentiator) | HIGH | P1 |
| Gemini function calling apply_filters | HIGH (makes co-pilot useful) | HIGH | P1 |
| Email gate on "View Full Profile" | HIGH (conversion) | LOW | P1 |
| Loading skeletons | MEDIUM (polish) | LOW | P1 |
| Empty state with co-pilot CTA | MEDIUM (no dead ends) | LOW | P1 |
| URL filter sync | MEDIUM (shareability) | LOW | P2 |
| Fuzzy search / Did you mean? | MEDIUM (trust signal) | MEDIUM | P2 |
| Match reason snippet on card | MEDIUM (conversion) | MEDIUM | P2 |
| Download Match Report | MEDIUM (lead magnet) | HIGH | P2 |
| Mobile bottom sheet | HIGH (mobile UX) | HIGH | P2 |
| Expert card detail drawer | MEDIUM (conversion) | HIGH | P3 |
| Saved filter presets | LOW (unvalidated need) | MEDIUM | P3 |
| Co-pilot suggested questions | LOW (nice-to-have) | MEDIUM | P3 |

**Priority key:**
- P1: Ships in v2.0 core — marketplace is incomplete without these
- P2: Ships in v2.0 extended — adds value once core works, before milestone close
- P3: Deferred to v2.1 or later

---

## Detailed UX Pattern Notes by Feature Area

### 1. Faceted Search Sidebar

**Layout convention (HIGH confidence — industry consensus):** Left sidebar is the universal pattern for desktop expert/professional marketplaces. Left placement means facets get consistent attention in left-to-right reading cultures. Top-bar filter strips are acceptable for mobile only. Do not experiment with right sidebar — it conflicts with the co-pilot panel placement.

**Filter ordering (MEDIUM confidence — Algolia, LogRocket sources):** Place the most general/high-use filters at top (text search, then rate range, then tags). More specific or rarely-used filters go below. The text search bar should live at the very top of the sidebar, not in a separate top nav, because it is part of the filter set, not a global navigation element.

**Rate range slider specifics:** Dual-handle slider. Show live dollar labels while dragging. Consider $10 snap increments below $100/hr and $25 increments above. Do not use a text input pair as a rate filter — it's slower and feels like a form. Show the distribution of expert counts at each rate point as a mini histogram above the slider (low complexity, high trust signal — used by Airbnb, Booking.com).

**Tag filter specifics:** Show at most 10-15 tags by default in the sidebar with a "Show more" expander. Sort by count (most experts first). Multi-select is OR logic within tags ("blockchain OR legal"), AND logic across facet types ("rate $100-200 AND tag: blockchain"). Each tag shows count: "Blockchain (47)". Do not show tags with 0 results for current other-filter state — this avoids dead-end selections (progressive disclosure, confirmed by Baymard Institute research).

**Active filter chips:** Sticky row immediately above the grid (or at top of sidebar on mobile). One chip per active filter. Format: label + x icon. "Clear all" link at right. On removal of a chip, the corresponding filter control in the sidebar resets visually. This chip row is the most reliable way to let users understand their filter state without requiring them to scroll back up the sidebar.

**Reset behavior:** "Clear all" resets Zustand filter slice to defaults and triggers a new `/api/explore` call. Individual chip removal adjusts that filter only. The sidebar controls must reflect the Zustand state — they are controlled components, not uncontrolled.

### 2. Expert Card Design

**Information density hierarchy (MEDIUM confidence — marketplace UX sources, UX pattern libraries):** Users scan expert cards at 6-10 cards per second at the grid level. The card must communicate three things in under 300ms: identity (name), positioning (job title), and cost (rate). Everything else is secondary.

**Card face contents (ordered by visual priority):**
1. Avatar / initials block (left) — letter-based avatar with background color derived from name hash. No generic silhouette icons.
2. Name (bold, 16px) — directly beside or below avatar
3. Job Title (muted, 14px) — one line max, truncate with ellipsis
4. Domain tag pills — 2-3 max on card face. "+N more" badge if expert has more tags. Uses existing AI-assigned tags from v1.1.
5. Hourly Rate (prominent, right-aligned or in a colored badge) — this is the primary filtering signal; make it visually distinct
6. Match reason snippet (1 line, italic or muted) — shown when co-pilot is active or on hover. "Strong match: startup legal, cap table"
7. CTA: "View Profile" button — single primary action, never two competing CTAs on card face

**What to exclude from card face:** Full bio text, rating stars, response time, location, full tag list, detailed work history. These belong in a detail view.

**Card height:** Aim for fixed-height cards (120-140px) to simplify virtualization. Variable-height cards work with react-virtuoso but require measuring. Fixed height with truncation is strongly preferred for the initial build.

**Hover state:** Subtle elevation (box-shadow increase). Do not animate the card into a flipped state or expand it dramatically — this breaks scan flow in a dense grid.

**Click target:** Entire card is clickable (routes to Tinrate profile, behind email gate). The "View Profile" button is redundant but expected — keep it as it provides a clear affordance.

### 3. Floating AI Co-Pilot Panel

**Anchor position (MEDIUM confidence — Microsoft Copilot, CopilotKit patterns, emerging 2025 consensus):** Bottom-right corner FAB (56px diameter, brand color, AI sparkle icon). Click toggles the panel. This is the universal pattern for floating assistants (Intercom, Zendesk, Microsoft Copilot, GitHub Copilot chat).

**Panel dimensions (desktop):** Slide in from right edge. Width: 380px. Height: full viewport height. Does not push the grid — it overlays (z-index above grid, below modals). On small desktop (<1280px viewport), the grid remains scrollable behind the panel.

**Panel structure (top to bottom):**
1. Header bar: "AI Co-Pilot" label + close button (X)
2. Context strip (collapsible): "Showing 47 blockchain experts, $100-200/hr" — summarizes current filter state so the AI can reference it
3. Conversation area (scrollable): chat bubbles, user + AI turns
4. Input bar (sticky bottom): text input + send button. Placeholder: "Ask me to refine these results..."

**AI function calling flow (HIGH confidence — Gemini function calling documentation):** User says "Show me only crypto lawyers under $150/hr" → Gemini calls `apply_filters({"tags": ["crypto", "legal"], "rate_max": 150})` → frontend intercepts tool call → updates Zustand filter slice → grid re-fetches → AI responds "Done — showing 12 experts matching crypto/legal at under $150/hr." The user never leaves the conversation; the grid updates silently in the background.

**Context awareness:** Before each AI message, prepend system context: the current filter state, the count of visible experts, and the top 3 expert names/titles. This allows the AI to say "Based on your current results, Sarah Chen (IP Lawyer, $120/hr) looks like a strong match because..." without the user having to describe what they see.

**Mobile co-pilot (HIGH complexity):** Full-screen overlay on mobile. FAB stays visible. Tap FAB → panel slides up over the entire viewport. Conversation + context strip + input. A "Back to results" button at top. When the AI updates filters, the panel closes and the grid updates. Do not try to show grid + panel simultaneously on mobile — the viewport is too small.

**Co-pilot open/closed state:** Stored in Zustand `isPilotOpen` slice (already scoped in PROJECT.md). Persist to localStorage so the panel state survives page refresh. Default: closed.

### 4. Lead Capture Modal

**Gate trigger points and timing (HIGH confidence — conversion research consensus):** Do NOT gate at page load or after a time delay. Gate at the moment of value extraction:
- Trigger 1: "View Full Profile" button click on any expert card
- Trigger 2: "Download Match Report" button click
These are intent signals — the user has seen results and wants more. This is the "earn trust, then capture" pattern that outperforms upfront gating by retaining 43% more top-of-funnel visitors.

**Form fields (HIGH confidence — VWO, Brixon, form conversion data):** Single field: email address. No name, no phone, no company. Each additional field reduces conversion by 4.1% on average. Reducing from 4 fields to 1 field can increase conversion by 120%. The email is sufficient for the lead capture use case (existing pattern from v1.0).

**Modal structure:**
1. Context headline (personalizes to trigger): "Unlock [Expert Name]'s full profile" or "Get your personalized expert report"
2. One-sentence value statement: "Tinrate experts are vetted professionals. Your email unlocks their full contact details."
3. Email input (autofocus on open)
4. Submit CTA: "View Profile" or "Get Report" (match the trigger that opened it — don't say "Submit")
5. Microcopy below: "No spam. Unsubscribe anytime." (reduces anxiety, proven to improve conversion)
6. Close button (X) — always allow escape; trapped modals damage trust

**Returning visitor behavior (existing from v1.0):** localStorage check on load. If email already captured, gate is bypassed silently. Do not show the modal to returning users — it damages trust and is operationally useless (email already captured).

**Post-capture behavior:** On email submit → close modal → proceed to the original action (open profile URL in new tab, or trigger report download). Do not show a confirmation screen — the action itself is the confirmation.

### 5. Hybrid Search Result Display

**What to show users about search method (MEDIUM confidence — limited direct research on this specific pattern):** Do NOT expose the technical mechanism ("FAISS semantic search" or "hybrid BM25+vector"). Users do not know what these mean and it creates confusion, not trust.

**Recommended signals to show instead:**
- Result count + query echo: "47 experts matching 'blockchain legal counsel'" — shows the system understood the query
- Match reason snippet per card: "Strong match: blockchain, IP law, startup experience" — plain language, derived from tags and job title
- "Did you mean?" callout when fuzzy correction was applied: "Showing results for: blockchain (corrected from 'blockchainn')"
- Filter echo in active chips: the applied filters tell users what shaped their results

**What to avoid:** Numeric similarity scores on user-facing cards (e.g., "Match: 0.87"). Cosine similarity is meaningless to users and reduces trust rather than increasing it. Showing "Semantic match" vs "Keyword match" labels per result adds cognitive load with no user benefit. Reserve these signals for the admin Search Lab.

**Empty state pattern (HIGH importance):** When filters produce zero results, do not show a generic "No results found." Show: "No experts matched [applied filters]. Try widening your rate range, removing a tag filter, or asking the AI co-pilot for suggestions." Include a "Clear filters" CTA and a "Ask co-pilot" CTA. An empty state with no escape path is a conversion dead-end.

### 6. Download Match Report Lead Magnet

**Report content (MEDIUM confidence — B2B lead magnet research):** Personalized, not generic. The report must contain information specific to the user's search query and filters — not a boilerplate brochure. Contents:
1. User's search query (echo back)
2. Applied filters (rate range, tags)
3. Top 5 matched experts: name, job title, hourly rate, domain tags, match reason snippet, Tinrate profile URL
4. A brief framing: "These experts were matched using AI-powered semantic search across Tinrate's vetted professional network."

**Format:** Styled HTML-to-PDF (WeasyPrint on Railway backend) or formatted email sent to the captured address. A downloadable PDF is the standard expectation for "download report." An email version is easier to build but feels less premium.

**Conversion rationale (HIGH confidence — Brixon Group, amraandelma.com 2025 data):** Personalized interactive/structured reports convert at 6.2% vs. 3.8% for static PDFs. The key is personalization — the user's specific query and results make the report feel bespoke, not templated.

**Gate as value exchange, not friction:** The modal headline should emphasize the report's value: "Your personalized expert shortlist is ready — enter your email to download." The user has already seen the experts; the report packages them in a shareable format. This positions the email as unlocking a product, not submitting to marketing.

**When to trigger:** The "Download Match Report" button should appear only when the user has active search results (at least 3 experts visible with current filters). Do not show the button on the initial empty state or on a search with 0 results.

### 7. Anti-Features to Avoid (Expert Marketplace Specific)

**Friction that kills conversion in professional service marketplaces:**

1. **Registration before browsing:** Requiring account creation before any expert browsing loses 25%+ of users at the gate (documented marketplace dropout rate). The anonymous browsing model (gate at value extraction) is the correct pattern for this product.

2. **Too many sort options:** More than 2-3 sort dimensions creates choice paralysis. Users default to the first option regardless. The AI co-pilot is the better interface for nuanced ordering.

3. **Empty filter states with no escape:** When a filter combination produces 0 results, a dead-end screen loses the user permanently. Always offer: clear filters, loosen a specific filter, or ask the AI.

4. **Rate displayed in wrong unit:** If the expert dataset has hourly rates but the user is thinking in project budgets, rate display creates friction. Keep it hourly (matches the data) and ensure the unit is always visible ("$150/hr", not "$150").

5. **Generic search experience:** Users who type a natural language description ("startup lawyer who understands tech M&A") and get zero results — or worse, irrelevant results — immediately lose trust in the platform. The hybrid search endpoint and HyDE expansion are the technical solution to this; the UX must surface the result quality through match reason snippets.

6. **Card actions that compete:** Two equally prominent CTAs on an expert card ("View Profile" AND "Save to List" AND "Contact") create decision paralysis. One primary CTA per card. Secondary actions in a detail view.

7. **Invisible filter state:** If the user applied filters but can't see what's active (no chips, no count update), they cannot understand why they see 12 results instead of 1,558. Always surface active filter state.

---

## Competitor Feature Analysis

| Feature | Upwork | Toptal | Clarity.fm | TCS v2.0 Approach |
|---------|--------|--------|------------|-------------------|
| Faceted sidebar | Yes (rate, category, skills, location, job success, hourly type) | Yes (skills, rate, availability) | Minimal (topic tags only) | Rate + domain tags + text search — deliberately minimal to avoid filter overload |
| Expert card density | Medium — avatar, name, rate, skills, job success %, description | Medium — avatar, name, title, skills, response time | Low — avatar, name, title, rate only | High-scan: avatar, name, title, rate, 2-3 tags, match reason |
| AI-assisted search | Upwork's AI pre-fills project description (rated "clumsy") | None | None | AI co-pilot with function calling — bidirectional conversation + filter control |
| Lead gate | Registration required to contact | Registration + vetting required | Call booking (no gate) | Email gate at "View Full Profile" — minimal friction, single field |
| Download/report | None | None | None | Personalized match report — genuine differentiator |
| Mobile | Functional but not optimized | Functional | Minimal | Bottom sheet sidebar + full-screen co-pilot — mobile-first design |
| Semantic search | Keyword + relevance ranking | Keyword + manual vetting | Keyword tags only | Hybrid: FAISS semantic + FTS5 keyword + weighted scoring |

---

## Sources

- [Faceted search best practices — Algolia UX Blog](https://www.algolia.com/blog/ux/faceted-search-and-navigation) — MEDIUM confidence
- [Faceted filtering for ecommerce — LogRocket](https://blog.logrocket.com/ux-design/faceted-filtering-better-ecommerce-experiences/) — MEDIUM confidence
- [Filter UI patterns — Bricxlabs 2025](https://bricxlabs.com/blogs/universal-search-and-filters-ui) — MEDIUM confidence
- [Mobile filter UX patterns — Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-mobile-filters) — MEDIUM confidence
- [Marketplace UX design — Rigby Blog](https://www.rigbyjs.com/blog/marketplace-ux) — MEDIUM confidence
- [Marketplace UX best practices — Excited Agency](https://excited.agency/blog/marketplace-ux-design) — MEDIUM confidence
- [Marketplace UX design — Aspirity](https://aspirity.com/blog/marketplace-ux-design) — MEDIUM confidence
- [Card UI design best practices — Eleken](https://www.eleken.co/blog-posts/card-ui-examples-and-best-practices-for-product-owners) — MEDIUM confidence
- [AI Copilot design patterns — Rehance](https://rehance.ai/blog/ai-copilot-design) — MEDIUM confidence
- [Microsoft Bing floating Copilot — Windows Forum](https://windowsforum.com/threads/microsoft-bings-new-ai-features-floating-copilot-box-source-transparency-chat-driven-results.371429/) — LOW confidence (forum source)
- [Generative UI — CopilotKit](https://www.copilotkit.ai/generative-ui) — MEDIUM confidence
- [AI interface design guidance — Microsoft Learn](https://learn.microsoft.com/en-us/microsoft-cloud/dev/copilot/isv/ux-guidance) — HIGH confidence
- [Lead capture form design — VWO](https://vwo.com/blog/lead-generation-forms/) — MEDIUM confidence
- [B2B lead magnets: gated PDF vs interactive tool — Brixon Group](https://brixongroup.com/en/b2b-lead-magnets-compared-gated-pdf-vs-interactive-tool-which-strategy-will-deliver-better-results-in/) — MEDIUM confidence
- [Lead magnet conversion statistics 2025 — amraandelma.com](https://www.amraandelma.com/lead-magnet-conversion-statistics/) — MEDIUM confidence
- [Content gating strategies 2025 — Brixon Group](https://brixongroup.com/en/content-gating-strategies-when-b2b-content-should-be-freely-accessible-the-data-driven-guide/) — MEDIUM confidence
- [Hybrid search overview — Elastic](https://www.elastic.co/what-is/hybrid-search) — HIGH confidence
- [Search UX best practices 2026 — Design Monks](https://www.designmonks.co/blog/search-ux-best-practices) — MEDIUM confidence
- [Marketplace registration friction — Purrweb](https://www.purrweb.com/blog/marketplace-ux-ui-design/) — MEDIUM confidence
- [AI function calling UX — Smashing Magazine](https://www.smashingmagazine.com/2025/07/design-patterns-ai-interfaces/) — MEDIUM confidence
- Training data (August 2025 cutoff): react-virtuoso API, Zustand patterns, Gemini function calling structure, FAB anchor conventions

---

*Feature research for: TCS v2.0 Expert Marketplace with Floating AI Co-Pilot*
*Researched: 2026-02-21*
