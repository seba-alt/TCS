# Feature Landscape

**Domain:** AI Expert Marketplace — v3.0 Netflix Browse & Agentic Navigation
**Milestone:** v3.0 (adding to existing v2.3 codebase)
**Researched:** 2026-02-24
**Overall confidence:** MEDIUM — Netflix browse UX patterns MEDIUM (well-documented in UX literature but adapted from entertainment to professional marketplace); AI cross-page navigation LOW-MEDIUM (emerging pattern, limited authoritative sources); photo serving HIGH (standard CDN/URL pattern, grounded in existing Tinrate data audit); page transitions HIGH (React Router v7 View Transitions API confirmed stable)

---

## Context: What Already Exists (do NOT re-implement)

| Existing Feature | Status | Notes |
|-----------------|--------|-------|
| `/marketplace` route — aurora background, glassmorphic header, bento cards, VirtuosoGrid | Live | Single page: sidebar + expert grid |
| Sage FAB + slide-in panel (380px) with `search_experts` + `apply_filters` | Live | Persists on `/marketplace` only today |
| `sageMode` state machine in `resultsSlice` | Live | `setSageMode(true)` on direct FAISS injection |
| Zustand `useExplorerStore` (filter + results + pilot slices) | Live | In-memory; no route persistence built in |
| `resultsSlice.setResults()` for direct FAISS injection | Live | Powers Sage grid injection |
| Behavior tracking (card clicks, Sage queries, filter changes) | Live | `/api/events` endpoint, fire-and-forget |
| Admin Marketplace page (demand + exposure + daily Sage trend) | Live | `/admin/data` consolidated |
| `/chat` route (legacy v1.0 chat interface) | Live | Separate page; rarely visited |
| Newsletter gate on "View Full Profile" | Live | `nltrStore.ts` |
| `SkeletonGrid` component (animate-pulse, 9 cards) | Live | Used on initial load |

All v3.0 features extend this foundation without replacing any of the above. The existing `/marketplace` page becomes the Browse page with enhanced layout.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that make the Browse experience feel like a real product. Missing these makes v3.0 feel like a grid with a new name.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Billboard hero section** with featured expert | Browse pages in every discovery product (Netflix, Spotify, Product Hunt, Airbnb Experiences) have a full-width hero that anchors the page. Without it, the page looks like a filter sidebar was prepended to an existing grid — no editorial presence. | MEDIUM | Full-width panel above the main grid. Displays 1 featured expert: name, job title, short bio snippet (2–3 lines), rate badge, primary tag. One CTA: "Learn More" that triggers the NewsletterGateModal. Static editorial selection (admin-curated or highest findability_score expert as fallback). Do NOT auto-rotate — Netflix's billboard is static until user acts. |
| **Horizontal category rows** with scroll | Netflix's row pattern is now the industry-standard for discovery UX. Any "browse" label without horizontal rows signals the feature is half-built. Users expect to be able to scan categories without vertical scrolling through a single undifferentiated grid. | HIGH | 4–6 rows, each named by domain category (e.g., "Strategy & Consulting", "Tech & Engineering", "Marketing & Growth"). Each row shows 4–5 visible cards, scrollable horizontally. "See All →" link filters the main grid to that category. Row card count: show 4 on desktop (peek at 5th signals scrollability), 2 on mobile (peek at 3rd). |
| **Expert photo cards in browse context** | The existing ExpertCard has no photo. In a browse context (not filtered search), photo-first cards are expected — Upwork, Clarity.fm, and every expert marketplace uses headshots as the primary visual. In a browse-mode grid, text-first cards with no photo look like a data table, not a marketplace. | HIGH | Requires: (1) photo URL availability (see PITFALLS.md — photos may not be in the data source), (2) photo-first card layout with name/title overlay on hover. Default state: square or 4:5 aspect ratio photo with name + rate badge below. Hover state: overlay with job title + primary tag. Fallback: monogram initials avatar with brand-purple background. |
| **"See All" filter integration** | Clicking "See All →" on a category row must actually filter the grid to that category and show the user where they are. If "See All" opens a broken filter state or does nothing, users immediately lose trust in the navigation. | LOW | Dispatch `store.setTags([category_tag])` and scroll to the main grid. Matches the existing `toggleTag` mechanism in `filterSlice`. The URL should update via `useUrlSync` so the filtered view is shareable. |
| **Page transition that doesn't break Sage panel** | If Sage is open during a route change (e.g., between `/browse` and future detail pages), users expect the conversation to persist — not reset. Abrupt hard-transition destroys the "co-pilot" mental model. | MEDIUM | Sage panel component must live outside the route outlet so it persists across route changes. In React Router v7, this means mounting SageFAB/SagePanel at the root layout level (above `<Outlet />`), not inside `MarketplacePage`. The Zustand pilot state already persists; only the component mounting point needs to move. |
| **Skeleton loading on row data fetch** | Category rows fetching asynchronously must show skeleton placeholders, not a blank row area. Blank-then-populate is the most noticeable jank in browse-style UIs. | LOW | Extend existing `SkeletonGrid` logic: per-row skeleton of 5 card-sized horizontal skeletons. Same `animate-pulse` CSS pattern already in `SkeletonGrid.tsx`. |
| **Redirects from old routes preserved** | Users with bookmarked `/marketplace` must still land correctly after route reorganization. Breaking existing routes for a new layout is a p0 regression. | LOW | `main.tsx` already has `{ path: '/', element: <Navigate to="/marketplace" replace /> }`. Any renamed routes must keep redirect chains. The `/chat` legacy route must redirect cleanly. |

---

### Differentiators (Competitive Advantage)

These features make v3.0 more than a layout change. None of these are standard behavior in professional marketplace platforms as of early 2026.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Sage cross-page navigation intent** | Sage can interpret "take me to browse" / "go back to search" / "show me the Strategy row" as navigation commands — not just filter adjustments. No professional marketplace AI co-pilot today both searches experts AND navigates the app. This collapses the distinction between "talking" and "navigating." | HIGH | Requires a new `navigate_to` Gemini function: `{ page: 'browse' | 'chat' | 'filtered_grid', params?: { tags?: string[] } }`. `useSage` calls `useNavigate()` from React Router on function call. The Gemini function description must be mutually exclusive from `apply_filters` and `search_experts`. Intent signals: "browse", "go back", "show me the X section", "home", "explore". |
| **Billboard expert rotation (admin-curated)** | Admin manually selects the featured expert for the billboard via a new admin control — not algorithmic. This gives Tinrate editorial control over which expert is promoted, which is valuable for: new expert onboarding, commercial agreements, category balancing. No small professional marketplace currently offers this. | MEDIUM | Backend: new `GET /api/browse/featured` endpoint returning one expert ID. Admin: toggle in Admin Experts page to mark an expert as `is_featured: bool`. Fallback: highest `findability_score` expert if no expert is marked featured. No rotation needed — editorial manual control is the v3.0 feature; algorithmic rotation is v4.0. |
| **Netflix-style card hover expand with photo** | Existing ExpertCard has a lift+glow CSS hover. The Netflix pattern extends this: on hover, the card scales to 115%, the photo zooms, and an info overlay appears (rate, tags, "Ask Sage about them" CTA). This is the most visually distinctive browse interaction. | HIGH | Implementation: `scale(1.15)` via Framer Motion on the card wrapper, `z-index: 50` to prevent clipping from siblings. Info overlay fades in on `whileHover`. The "Ask Sage about them" CTA populates the Sage panel with the expert's name pre-filled ("Tell me about [Name]"). This connects the browse and AI surfaces in one gesture. |
| **Sage "tell me about this expert" shortcut** | From any expert card (billboard or browse row), users can ask Sage about that specific expert without typing. The Sage panel opens pre-populated with a query. This is a "one-click AI insight" pattern — users who don't know what to ask get a starting point. | MEDIUM | On card click (not profile gate): set a `pendingQuery` in `pilotSlice`, open the Sage panel (`setOpen(true)`), and auto-submit the query via `handleSend`. The query format: "Tell me about [First Name] [Last Name] — [Job Title]". No new backend endpoint needed; uses existing `/api/pilot` function calling. |
| **"Continue Browsing" breadcrumb on filtered views** | When a user clicks "See All →" from a category row and lands on a filtered grid, a breadcrumb appears: "← Browse all experts". This is a light navigation affordance that surfaces when the user is in a sub-context (filtered category view) and wants to return to the full browse experience. | LOW | Render a breadcrumb row above the ExpertGrid when `tags.length > 0` and the tags match a known category. Text: "← Browse all [Category]" or "← Back to Browse". On click: `store.resetFilters()` and smooth scroll to top. This is not a traditional breadcrumb (no hierarchy path) — it's a single-level context reset affordance. |
| **Aurora-consistent browse row section headers** | Category row headers styled with the existing aurora aesthetic (gradient text, glassmorphic background, or subtle aurora glow on the row label). Matching the visual language of the existing marketplace signals these rows are native to the product, not bolted-on. | LOW | CSS-only. Use `bg-gradient-to-r from-brand-purple to-blue-500 bg-clip-text text-transparent` for row headers. The existing aurora gradient color palette is defined in Tailwind config. No new dependencies. |

---

### Anti-Features (Explicitly Avoid)

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| **Auto-playing video preview on card hover** | "Netflix does it" | Netflix can reliably stream video to subscribers. TCS has no video assets for any of the 530 experts, no video CDN, and no video upload flow. Adding video is a 3-sprint feature on its own. | Photo with hover overlay reveal. The visual surprise of the info overlay appearing is 80% of the engagement value at 5% of the implementation cost. |
| **Algorithmic featured expert selection** | "Netflix personalizes the billboard per user" | Netflix has behavioral data on millions of users. TCS has no per-user identity before the newsletter gate. Pre-gate, there is no user model. Post-gate, there is an email but no click history that would be meaningful for a billboard selection algorithm. Algorithmic selection without data creates the illusion of personalization while actually being random — worse than editorial curation. | Admin-curated featured expert with `is_featured` flag. Fallback to highest `findability_score`. This is honest editorial curation with a clear fallback. |
| **Infinite horizontal scroll in category rows** | "Show all experts in the row, user can keep scrolling" | Rows with 100+ experts scrolled horizontally are not browsable — they become a horizontal version of the same overwhelming grid problem the Browse page is supposed to solve. "See All" is the correct escape valve. | Show 5–8 cards per row (4 visible + 1–2 peek). "See All →" links to the filtered grid view. This creates a deliberate content budget per row that forces good curation. |
| **Deep-linking to a specific card from URL** | "Users should be able to share a direct link to an expert card" | The expert profile already lives on `tinrate.com/u/[username]`. Deep-linking to a card in the TCS browse grid is a secondary experience — the canonical expert URL is on the Tinrate platform. Building a TCS-native deep link duplicates the Tinrate profile URL, creates two canonical pages for the same expert, and complicates the newsletter gate flow. | The existing "View Full Profile →" button in each card already links to the Tinrate profile URL. That IS the shareable deep link. |
| **Fully separate `/browse` route from `/marketplace`** | "Browse and marketplace should be separate pages" | The existing `/marketplace` page already has a filter sidebar, expert grid, Sage panel, and URL sync. Creating a fully separate `/browse` route requires duplicating all of these features or abstracting shared state into a higher-level provider — a large refactor for no user-facing benefit. The browse layout change (adding hero + rows) can happen within the existing `/marketplace` route as a new "browse mode" that sits above the filtered grid. | `/marketplace` route gains a "Browse" section at the top (hero + rows), with the existing filter sidebar + VirtuosoGrid below it as the "All Experts" section. Route stays the same; DOM layout gains new sections. |
| **Category row cards as a new card component** | "Browse cards should be a completely different component from ExpertCards" | Building a separate card component doubles the maintenance surface. The existing `ExpertCard` already handles name, title, rate, tags. The browse-mode difference is: (1) photo at top, (2) hover expand behavior. | Add `variant="browse"` prop to `ExpertCard`. Browse variant shows the photo zone at top, hides match_reason, adds the hover overlay behavior. Same component, same props contract, new rendering branch. This is how React component APIs should be extended. |
| **Sage reads from photo CDN / manages photos** | "Sage should be able to mention the expert's photo in its response" | Sage already responds with natural language about experts. Mentioning photos in chat adds no actionable value and conflates the visual browse surface with the conversational AI surface. | Sage responds about skills, rate, and fit. Photos exist in the browse card. These are separate interaction surfaces — keep them separate. |

---

## Feature Dependencies

```
[Billboard Hero Section]
    └──requires──> [Featured expert API endpoint GET /api/browse/featured OR findability_score sort]
    └──requires──> [Expert photo display (or graceful monogram fallback)]
    └──requires──> [Admin is_featured flag on Expert model (or use findability_score fallback only)]
    └──enables──> [Sage "tell me about this expert" CTA on the billboard]
    └──independent of──> [Horizontal category rows]

[Horizontal Category Rows]
    └──requires──> [Backend category endpoint: GET /api/browse/categories returning {category, experts[]}]
    └──requires──> [Expert model has category field (already in metadata.json: "category" key)]
    └──requires──> [Per-row skeleton loading (SkeletonGrid variant)]
    └──enables──> ["See All" filter integration (toggleTag dispatch)]
    └──enables──> ["Continue Browsing" breadcrumb (knows current category context)]
    └──note: Category data already exists in metadata.json but category field is null for most experts]

[Expert Photo Cards]
    └──requires──> [Photo URL per expert — THIS IS THE CRITICAL UNKNOWN. Tinrate profile pages]
    └──            [are SPA-loaded, photo URLs are not in current metadata.json or experts.csv]
    └──fallback──> [Monogram initials avatar (CSS only, zero data dependency)]
    └──enables──> [Netflix-style card hover expand with photo]
    └──blocks if photo unavailable──> [photo-first browse variant — fall back to info-first with enhanced styling]

[Sage Cross-Page Navigation Intent]
    └──requires──> [navigate_to Gemini function declaration added to pilot_service.py]
    └──requires──> [useSage hook calls useNavigate() on navigate_to function call]
    └──requires──> [Sage panel mounted at root layout level (not inside MarketplacePage)]
    └──requires──> [Zustand pilot state already persists — only mounting point needs to move]
    └──enables──> [Sage "tell me about this expert" shortcut (opens panel + pre-fills query)]
    └──note: MEDIUM complexity — the navigate_to function must be mutually exclusive from]
    └──      [apply_filters and search_experts in Gemini descriptions]

[Page Transition Animations]
    └──requires──> [Sage panel mounted at root layout level (shared dependency with cross-page nav)]
    └──uses──> [React Router v7 viewTransition prop on Link/useNavigate (confirmed stable in v7)]
    └──uses──> [AnimatePresence with location.key on route outlet (existing pattern)]
    └──note: View Transition API now Baseline (Chrome 111+, Firefox 144+, Safari 18+)]
    └──      [Framer Motion AnimatePresence is the safe fallback for all browsers]

[Route Reorganization]
    └──requires──> [Reading main.tsx (already done — route config confirmed)]
    └──requires──> [Preserve existing redirect: / → /marketplace]
    └──requires──> [Chat page: / → /marketplace, /chat redirect to /marketplace]
    └──note: /chat is the legacy v1.0 chatbot. It should redirect to /marketplace.]
    └──      [The aurora marketplace IS the product now — chat is vestigial]

["Continue Browsing" Breadcrumb]
    └──requires──> [Horizontal category rows exist (to know which category triggered "See All")]
    └──requires──> [filterSlice.tags to detect filtered state]
    └──independent of──> [Photo display, billboard hero]
    └──note: LOW complexity — conditional render above ExpertGrid when tags.length > 0]

[Admin Billboard Control]
    └──requires──> [Expert model: is_featured bool column (new)]
    └──requires──> [GET /api/browse/featured endpoint]
    └──requires──> [Admin Experts page: toggle to mark/unmark featured expert]
    └──note: If admin control is deferred, use findability_score fallback only — zero new backend needed]
```

---

## Detailed Pattern Notes by Feature Area

### 1. Billboard Hero Section

**Layout (MEDIUM confidence — derived from Netflix, Airbnb Experiences, and Spotify editorial patterns):**

The billboard is a full-width panel at the top of the `/marketplace` page, above the category rows and the existing filter sidebar+grid. It is NOT a modal, NOT a carousel, and NOT an auto-rotating slider. Static editorial selection is the correct pattern for a small professional marketplace where the admin controls the featured expert.

**Recommended layout:**
```
[Full width — min-height: 280px, max-height: 360px]
┌─────────────────────────────────────────────────────┐
│  [Expert Photo — left 30%]  │  [Expert Info — right 70%]  │
│  Square / 1:1 aspect ratio  │  Name (large, bold)          │
│  or monogram fallback       │  Job Title (medium, muted)   │
│                             │  Bio snippet (2-3 lines)     │
│                             │  Rate badge                  │
│                             │  Primary tag pill(s)         │
│                             │  [Learn More →] [Ask Sage ↗] │
└─────────────────────────────────────────────────────┘
```

**CTAs — 2 maximum:**
- "Learn More →" — triggers `NewsletterGateModal` (existing gate flow, same as "View Full Profile")
- "Ask Sage ↗" — opens Sage panel pre-populated with "Tell me about [First Name] [Last Name]"

**Featured expert selection (fallback-first approach):**
1. Admin has set `is_featured: true` on exactly one expert → use that expert
2. No expert is flagged → use the expert with the highest `findability_score` (already in `Expert` model)
3. `findability_score` is null for all → use expert at index 0 (alphabetical fallback)

This three-tier fallback means the billboard works immediately with zero new backend work (fallback 2 uses existing data). Admin control (fallback 1) can be built later.

**What NOT to do:**
- Do not use a carousel/slider with autoplay — Netflix's billboard is intentionally static until user action
- Do not show multiple experts in the billboard simultaneously
- Do not animate the billboard on page load — the aurora mesh background already provides motion; adding billboard animation creates visual noise

---

### 2. Horizontal Category Rows

**Row count and card count (MEDIUM confidence — derived from Netflix, App Store, Google Play patterns):**

- **4–6 rows** on the browse section. Fewer than 4 feels sparse; more than 6 overwhelms before the user reaches the full grid section.
- **4 fully visible cards + 1 peeking** on desktop (signals horizontal scrollability without a visible scrollbar)
- **2 fully visible cards + half peeking** on mobile
- Each row has a category label and a "See All →" link that filters the main grid

**Row naming for TCS expert categories (derived from existing metadata.json `tags` distribution):**

The `category` field in metadata.json is `null` for all current experts. Categories must come from the existing `tags` arrays. Recommended approach: group common tags into 5–6 high-level buckets for row display. Example rows:
- "Strategy & Consulting" — tags matching: strategy, business development, management consulting
- "Tech & Engineering" — tags matching: software, engineering, AI, data
- "Marketing & Growth" — tags matching: marketing, SEO, growth, social media
- "Finance & Legal" — tags matching: finance, accounting, legal, compliance
- "Featured New Experts" — experts sorted by `created_at` DESC (recency row)
- "Top Rated" — experts sorted by `findability_score` DESC

**Backend endpoint recommendation:**
`GET /api/browse/rows` returns:
```json
[
  { "id": "strategy", "label": "Strategy & Consulting", "tags": ["strategy", "management"], "experts": [...5 experts...] },
  { "id": "tech", "label": "Tech & Engineering", "tags": ["software", "engineering"], "experts": [...5 experts...] }
]
```

Each `experts` array: 8 items max (4 visible + 4 scroll). Row uses existing `/api/explore` query with `tags` param — no new retrieval logic needed.

**"See All →" behavior:**
- Dispatches `store.setTags(row.tags)` to filterSlice
- Smooth scroll to the existing `FilterSidebar + ExpertGrid` section below the browse rows
- URL updates via `useUrlSync` (existing hook) — the filtered view becomes shareable

---

### 3. Expert Photo Cards in Browse Context

**The critical unknown — photo availability (LOW-MEDIUM confidence):**

The current data source (`metadata.json`, `experts.csv`) contains NO photo URLs. The `Expert` SQLAlchemy model has no photo field. The Tinrate platform profile pages load as a JavaScript SPA (confirmed by fetch attempt — returns a loading screen), so photo URLs cannot be extracted by simple scraping.

**Three realistic scenarios, in probability order:**

**Scenario A (Most likely): Tinrate has photo URLs at a predictable path**
Many platforms store profile photos at a predictable CDN URL: `https://cdn.tinrate.com/photos/[username].jpg` or `https://app.tinrate.com/storage/[username]/avatar.jpg`. If Tinrate follows this pattern, the URL can be constructed from `username` (already in the data) without any scraping. This should be the first thing verified during implementation.

**Scenario B (Likely fallback): Monogram avatar**
If photo URLs are not predictable or not publicly accessible, each expert card shows a monogram avatar: first letter of first name, first letter of last name, on a brand-purple circle background. This is the correct production-ready fallback. Examples: "J S" for "Jane Smith". CSS-only, zero data dependency.

**Scenario C (Avoid): Scraping Tinrate profile pages**
Do not scrape Tinrate's frontend to extract photo URLs. This creates a fragile, unmaintainable dependency on Tinrate's JS bundle structure. It's also legally ambiguous.

**Photo card layout in browse rows (MEDIUM confidence — derived from Baymard hover research and Netflix card pattern):**

Default (unhovered) state:
- Photo fills the card top section (square or 4:5 aspect ratio, `object-fit: cover`)
- Name + rate badge below the photo
- Minimal text — scannable, visual-first

Hover state (desktop only):
- Card scales to ~110–115% (`transform: scale(1.1)`, `z-index: 50`)
- Photo dims slightly (overlay `bg-black/30`)
- Overlay shows: job title, primary tag pill(s), "View Profile" and "Ask Sage" CTAs
- Transition: 200ms ease-out (matches existing `.expert-card` transition timing)

Mobile (no hover state):
- Photo-first card, tap goes directly to `NewsletterGateModal`
- No hover overlay on mobile — touch targets are the whole card

**Aspect ratio recommendation:**
- `1:1` (square) for row cards — simpler to implement, more consistent layout when photo dimensions vary
- `4:5` for the billboard hero (portrait orientation suits headshots better for the large format)

**`object-fit: cover` and `object-position: top`:**
For headshots, `object-position: top` ensures the face is never cropped. This is the standard approach for professional headshots in marketplace UIs.

---

### 4. Sage Cross-Page Navigation Intent

**The pattern (LOW-MEDIUM confidence — emerging, no established authoritative source):**

Adding a third Gemini function `navigate_to` that allows Sage to trigger programmatic navigation via React Router's `useNavigate`. This closes the interaction gap between "I'm browsing in the grid" and "I want Sage to take me somewhere."

**Intent signals for `navigate_to` (derived from chatbot intent classification research):**

| User Says | Intent | Navigation |
|-----------|--------|------------|
| "Take me to Strategy experts" | Browse category | `navigate_to({ page: 'filtered_grid', params: { tags: ['strategy'] } })` |
| "Browse all experts" / "Show me everything" | Browse browse | `navigate_to({ page: 'browse' })` → resets filters |
| "Go back to chat" | Legacy chat | `navigate_to({ page: 'chat' })` — deprecated, redirect to /marketplace |
| "Home" / "Start over" | Browse root | `store.resetFilters()` + scroll to top — may not need navigate_to |

**Implementation approach:**

`navigate_to` is NOT a React Router `useNavigate` call inside `useSage` (hooks can't call other hooks in callbacks). The correct pattern:
1. Backend returns `{ navigate_to: { page: string, params?: object } }` in `PilotResponse`
2. `useSage` detects this field and returns it to the calling component
3. `SagePanel` (or root component) calls `useNavigate()` reactively when `navigate_to` is set

This keeps the hook boundary clean. `useNavigate` is called in the component, not in the async callback.

**Key constraint: Gemini function descriptions must be mutually exclusive:**
- `apply_filters`: "Adjust what's visible in the current expert grid. Use for 'only show X', 'filter to Y', 'hide above $Z'."
- `search_experts`: "Search for specific experts by skills or description. Use for 'find me someone who', 'show me experts in X'."
- `navigate_to`: "Navigate to a different section or page. Use for 'take me to', 'go back to', 'browse', 'home', 'start over'."

The three-function schema must be tested against at least 15 real queries from the `conversations` table before shipping, same as the two-function schema required testing in v2.3.

**Conversation continuity on navigation (MEDIUM confidence):**

When Sage triggers navigation, the conversation must NOT reset. Zustand `pilotSlice` state already persists across route changes because Zustand state is in-memory (not tied to component lifecycle). The only requirement is that `SageFAB` and `SagePanel` are mounted OUTSIDE the route outlet — above `<Outlet />` in the root layout — so they don't unmount on route change.

Current architecture: `SageFAB` and `SagePanel` are mounted inside `MarketplacePage`. This means they unmount when the user navigates away. For cross-page navigation, move these to the root layout component that wraps all user-facing routes.

---

### 5. Page Transition Animations

**Recommended approach (HIGH confidence — React Router v7 View Transitions API confirmed stable):**

React Router v7's `viewTransition: true` option wraps navigation in `document.startViewTransition()`, providing native cross-fade between route renders. This is now Baseline (Chrome 111+, Firefox 144+, Safari 18+, Edge 111+). Firefox added support in version 144 (October 2025).

**Implementation:**
```tsx
// On Link components
<Link to="/marketplace" viewTransition>Browse</Link>

// On programmatic navigation
navigate('/marketplace', { viewTransition: true })
```

For aurora-consistent transitions, use `view-transition-name` on the AuroraBackground:
```css
.aurora-background {
  view-transition-name: aurora;
}
```
This causes the aurora to cross-fade between routes rather than hard-cut, preserving the visual continuity of the aesthetic.

**Framer Motion AnimatePresence (fallback and supplement):**
For browsers that don't support View Transitions, use `AnimatePresence` with `location.key` as the key prop on the route wrapper. This is the existing v2.x approach and remains valid as a fallback.

**Loading states — skeleton-first approach:**
- Route change: AuroraBackground persists (mounted at root level), route content fades in with `initial={{ opacity: 0 }} animate={{ opacity: 1 }}` (150ms)
- Data loading within a route: existing `SkeletonGrid` for the main expert grid
- Category row loading: per-row horizontal skeleton (new — 5 card-sized pulse placeholders in a horizontal scroll container)

**What NOT to animate:**
- The Sage FAB: never animate it during route transitions — it must appear stationary (it's the persistent co-pilot anchor)
- The glassmorphic header: already has backdrop-blur; adding transition animation on route change adds visual noise

---

### 6. Route Reorganization UX

**Current routes (from `main.tsx` audit):**

| Route | Current Behavior | v3.0 Action |
|-------|-----------------|-------------|
| `/` | Redirect → `/marketplace` | Keep as-is |
| `/marketplace` | MarketplacePage (aurora grid) | Enhanced: gains Browse Hero + Category Rows at top |
| `/chat` | App.tsx (legacy v1.0 chatbot) | Redirect → `/marketplace` (the marketplace IS the chat via Sage now) |
| `/admin/login` | Admin login | Unchanged |
| `/admin/*` | Admin app | Unchanged |

**The `/chat` route decision:**
The legacy `/chat` route (`App.tsx`) is the original v1.0 SSE chatbot. It is now functionally superseded by the Sage co-pilot on `/marketplace`. Keeping two chat interfaces is confusing. Recommendation: redirect `/chat` to `/marketplace`. The component (`App.tsx`) can stay in the codebase but should not be user-accessible.

**Back button behavior (MEDIUM confidence — React Router SPA standard):**

React Router's `createBrowserRouter` uses the History API. The browser back button works correctly within the SPA without any special handling. The one exception is the "See All →" category row click: this dispatches a `setTags` filter action but does NOT push a new route — it just updates URL params via `useUrlSync`. The back button will restore the previous URL params (the pre-filter URL), which is correct behavior.

**Scroll restoration:**
React Router v7 handles scroll restoration automatically. When "See All →" scrolls the user to the filter grid, the back button should restore scroll position. For the filter dispatch case (no route change), manual scroll restoration is not needed — the DOM position is preserved.

---

### 7. "Continue Browsing" Breadcrumb

**The pattern (MEDIUM confidence — e-commerce breadcrumb research, Pencilandpaper.io, Smart Interface Design Patterns):**

The "Continue Browsing" breadcrumb is NOT a traditional hierarchical breadcrumb (Home > Category > Subcategory). It is a single-level context reset affordance that appears when the user is in a sub-state (filtered by category) and surfaces the path back to the unfiltered browse view.

**Trigger condition:**
- `filterSlice.tags.length > 0` AND the active tags match a known category row (not user-typed tags)
- OR: a `fromBrowseCategory: string | null` field in the filter state that is set when "See All →" is clicked and cleared when the user manually changes filters

**Placement and text:**
```
[← Browse all experts] or [← Back to Browse]
```
Position: above the FilterChips row, below the Command Center header. This positions it as a secondary navigation hint rather than a primary nav element.

**Behavior:**
- Click: `store.resetFilters()` + smooth scroll to the top browse hero section
- The breadcrumb disappears immediately on filter reset (reactive to `filterSlice.tags.length`)
- On mobile: same position, slightly smaller text. Still one line.

**What to avoid:**
- Do not make it a full-width banner — it should feel like a quiet navigation hint, not a primary navigation element
- Do not show it when users manually select tags in the sidebar (only when tags come from "See All →")
- Do not animate it on appearance/disappearance with anything more than a simple `opacity` fade

---

## MVP Prioritization for v3.0

**P1 — Ship in v3.0 core (milestone incomplete without these):**
1. Billboard hero section (featured expert, monogram fallback, 2 CTAs)
2. Horizontal category rows (4–6 rows, "See All →" integration, skeleton loading)
3. Route reorganization: `/chat` → redirect `/marketplace`; Sage panel mounted at root layout level
4. Page transition with View Transitions API + AnimatePresence fallback

**P2 — Ship in v3.0 (high value, contained scope):**
5. Expert photo cards in browse rows (with monogram fallback — do NOT block on photo URL discovery)
6. "Continue Browsing" breadcrumb (low complexity, high UX value)
7. "Ask Sage about this expert" CTA on cards and billboard

**P3 — Ship if P1/P2 complete, otherwise defer to v3.1:**
8. Sage cross-page navigation intent (`navigate_to` function) — HIGH complexity, needs testing
9. Netflix-style card hover expand (scale + overlay) — MEDIUM complexity, polish
10. Admin billboard control (is_featured flag) — needs backend + admin UI work

**Defer to v3.1+:**
- Algorithmic billboard personalization (no user data model before newsletter gate)
- Video preview on card hover (no video assets exist)
- Infinite horizontal scroll in rows (anti-feature, see above)
- TCS-native deep link to expert cards (canonical URL is on Tinrate platform)

---

## Dependency Summary for Roadmap

```
Phase A: Route Reorganization + Sage Root Mount
    → /chat redirect, Sage panel moves to root layout
    → Enables: all cross-page features, page transitions

Phase B: Billboard Hero
    → Featured expert API (or findability_score fallback)
    → Photo display with monogram fallback
    → "Ask Sage" CTA (requires Phase A — Sage at root level)

Phase C: Category Rows + "See All"
    → /api/browse/rows endpoint (tags-based grouping)
    → Horizontal scroll row component
    → "Continue Browsing" breadcrumb (low dependency, bundle with Phase C)

Phase D: Photo Cards + Hover States (if photo URLs are available)
    → ExpertCard variant="browse" prop
    → Hover expand animation (Framer Motion)
    → Requires photo URL investigation as Phase 0 prerequisite

Phase E: Sage Navigation Intent (defer if complexity blocks earlier phases)
    → navigate_to Gemini function
    → 15-query validation test (same protocol as v2.3 dual-function test)
```

**Critical prerequisite (Phase 0 — before any implementation):**
Investigate whether Tinrate profile photos are accessible at a predictable URL from `username`. This single question determines whether photo cards are possible in v3.0 or degrade to monogram-only. Check: `https://api.tinrate.com/users/[username]/avatar`, `https://cdn.tinrate.com/[username].jpg`, or inspect the Tinrate app's network requests when a profile page loads. If no photo URL pattern is found within 30 minutes of investigation, commit to monogram fallback and move on.

---

## Sources

**Netflix browse UX patterns:**
- [Netflix Design: A Deep Dive into UX Strategy — CreateBytes](https://createbytes.com/insights/netflix-design-analysis-ui-ux-review) — MEDIUM confidence
- [How Netflix's Personalize Recommendation Algorithm Works — Attract Group](https://attractgroup.com/blog/how-netflixs-personalize-recommendation-algorithm-works/) — MEDIUM confidence
- [Breaking down the new Netflix TV UI — Matthijs Langendijk / Medium](https://mlangendijk.medium.com/breaking-down-the-new-netflix-tv-ui-d651aff8bbee) — MEDIUM confidence
- [Netflix UX Case Study — Pixel Plasma / Medium](https://medium.com/@pixelplasmadesigns/netflix-ux-case-study-the-psychology-design-and-experience-afecb135470f) — MEDIUM confidence

**Billboard and editorial vs algorithmic curation:**
- [A Brief History of Netflix Personalization — Gibson Biddle / Medium](https://gibsonbiddle.medium.com/a-brief-history-of-netflix-personalization-1f2debf010a1) — MEDIUM confidence
- [Curated Marketplaces — AVC](https://avc.com/2013/10/curated-marketplaces/) — MEDIUM confidence (older but foundational)

**Horizontal scroll row UX patterns:**
- [Horizontal Scrolling Lists in Mobile — Suleiman Shakir / UX Collective](https://uxdesign.cc/best-practices-for-horizontal-lists-in-mobile-21480b9b73e5) — MEDIUM confidence
- [Beware Horizontal Scrolling and Mimicking Swipe on Desktop — Nielsen Norman Group](https://www.nngroup.com/articles/horizontal-scrolling/) — HIGH confidence (NN/G authoritative)

**Card hover states and photo-first marketplace UX:**
- [Product Lists & Search Results Thumbnail Best Practices — Baymard Institute](https://baymard.com/blog/secondary-hover-information) — HIGH confidence (authoritative UX research)
- [How to Re-Create a Nifty Netflix Animation in CSS — CSS-Tricks](https://css-tricks.com/how-to-re-create-a-nifty-netflix-animation-in-css/) — MEDIUM confidence

**Page transitions and View Transitions API:**
- [View Transitions | React Router Official Docs](https://reactrouter.com/how-to/view-transitions) — HIGH confidence (official docs)
- [What's new in view transitions (2025 update) — Chrome for Developers](https://developer.chrome.com/blog/view-transitions-in-2025) — HIGH confidence (official Chrome docs)
- [Framer Motion + React Router: The Page Transition Strategy — Medium](https://medium.com/@genildocs/framer-motion-react-router-the-page-transition-strategy-that-made-my-spa-feel-native-6813aefcef7f) — MEDIUM confidence

**Breadcrumb and back navigation patterns:**
- [Designing Better Breadcrumbs UX — Smart Interface Design Patterns](https://smart-interface-design-patterns.com/articles/breadcrumbs-ux/) — MEDIUM confidence
- [Breadcrumbs UX Navigation — Pencil & Paper](https://www.pencilandpaper.io/articles/breadcrumbs-ux) — MEDIUM confidence

**AI navigation intent and chatbot routing:**
- [AI Agent-Driven UIs: Revolutionizing App Navigation & Design — AppInventiv](https://appinventiv.com/blog/ai-ui-replacing-apps-and-buttons/) — LOW confidence (emerging pattern, single source)
- [Automated intent recognition in 2025 — eesel AI](https://www.eesel.ai/blog/automated-intent-recognition) — LOW confidence (non-authoritative)

**Direct codebase inspection (HIGH confidence):**
- `frontend/src/main.tsx` — current route config confirmed
- `frontend/src/hooks/useSage.ts` — current Sage function architecture confirmed
- `frontend/src/components/marketplace/ExpertCard.tsx` — card structure and hover behavior confirmed
- `frontend/src/store/resultsSlice.ts` — sageMode, setResults, setSageMode confirmed
- `frontend/src/components/marketplace/SkeletonGrid.tsx` — existing skeleton pattern confirmed
- `data/metadata.json` — field names confirmed; NO photo URL field present

---

*Feature research for: TCS v3.0 Netflix Browse & Agentic Navigation*
*Researched: 2026-02-24*
