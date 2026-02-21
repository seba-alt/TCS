# Pitfalls Research

**Project:** Tinrate Expert Marketplace — v2.0 Extreme Semantic Explorer
**Domain:** Adding hybrid search, Zustand, react-virtuoso, Framer Motion, Gemini function calling to existing production FastAPI + React app (brownfield, not greenfield)
**Researched:** 2026-02-21
**Confidence:** HIGH for FAISS, SQLite FTS5, and Zustand (official docs and GitHub issues verified); MEDIUM for react-virtuoso/Framer Motion integration (community issue trackers); MEDIUM for Gemini function calling security (official guidance exists but frontend-specific risks are community-sourced)

---

## Critical Pitfalls

Mistakes that cause rewrites, production downtime, silent data corruption, or security regressions when adding these features to a live system.

---

### Pitfall 1: IDSelectorBatch With IndexFlatIP Confuses Search-Time Pre-filtering With Destructive remove_ids

**What goes wrong:**
Developers conflate two entirely different FAISS operations that both involve `IDSelectorBatch`: (a) using it as a search-time filter via `SearchParameters(sel=selector)` — which is safe and non-destructive — and (b) calling `index.remove_ids(selector)` — which permanently mutates the index in place and **shifts the sequential IDs of every vector above the removed ones**. If `remove_ids` is accidentally called (e.g., copied from a deletion example in a StackOverflow answer), the FAISS vector-to-expert ID mapping silently breaks. Searches return wrong experts for every query, with no error raised.

**Why it happens:**
The FAISS wiki and most code examples use `IDSelectorBatch` in the context of `remove_ids` (the only operation the wiki documents for it). Developers building pre-filtered search find `IDSelectorBatch`, read the surrounding documentation, and copy the `remove_ids` pattern when they actually want search-time filtering. The search-time pattern uses a different API: `faiss.SearchParameters(sel=selector)`.

The additional ID-shift behavior compounds the risk: `IndexFlatIP` uses sequential integer IDs (0, 1, 2, ...). After removing vector at position 100, vector 101 becomes 100, 102 becomes 101, and so on. Any metadata mapping (`expert_row_id → faiss_vector_index`) built before removal is now wrong for every expert after the removed one.

**How to avoid:**
Never call `remove_ids` on the production FAISS index. Use `IDSelectorBatch` exclusively for search-time pre-filtering:

```python
import faiss
import numpy as np

# Safe pattern — search-time pre-filtering only, does NOT mutate the index
allowed_ids = np.array(filtered_expert_ids, dtype=np.int64)
selector = faiss.IDSelectorBatch(allowed_ids)
search_params = faiss.SearchParameters(sel=selector)

distances, indices = index.search(query_vector, k=top_k, params=search_params)
```

Add a guard comment at the top of any FAISS utility module:

```python
# FAISS INDEX IS READ-ONLY AT RUNTIME.
# Do not call index.remove_ids() — it mutates the index and shifts all sequential IDs.
# Pre-filtering uses SearchParameters(sel=IDSelectorBatch(ids)) — see search_experts().
```

For the hybrid search route: SQLAlchemy pre-filters to a list of matching expert row IDs → those IDs are passed as `allowed_ids` to `IDSelectorBatch` → FAISS searches only that subset.

**Warning signs:**
- Search results return different experts than before a "cleanup" or "filter" operation on the index
- `index.ntotal` decreases over time (it should always be 1,558 at v2.0)
- The mapping between `faiss_index_position` and `expert_id` is off by a constant value for some experts

**Phase to address:** Phase 1 (hybrid search backend) — document the search-time vs. destructive distinction before writing any FAISS code. Add a unit test that asserts `index.ntotal == 1558` after every code path that touches the FAISS index.

---

### Pitfall 2: FTS5 External Content Table Loses Sync With experts Table on UPDATE — AFTER Trigger Is Wrong

**What goes wrong:**
When creating an FTS5 external content table pointing at the existing `experts` table, the synchronization triggers are written with `AFTER UPDATE` for all operations. This silently corrupts the FTS index for updated rows. The FTS extension handles an UPDATE by: (1) fetching the pre-update values to delete the old tokens, then (2) inserting the new tokens. If the trigger fires AFTER the update, step (1) fetches the already-modified values instead of the original ones — the old tokens are never removed. Queries for the old value still match the updated row, and queries for the new value also match. Search results become stale and semantically wrong, with no error raised.

**Why it happens:**
The SQLite FTS5 documentation's example trigger code uses `AFTER INSERT`, `AFTER DELETE`, and `AFTER UPDATE`. Developers copy this pattern uniformly. The critical exception is that the DELETE portion of an UPDATE (removing old tokens) must have access to the pre-update state, which is only available in a `BEFORE UPDATE` context. The SQLite community has documented random corruption occurring about 10% of the time with the naive AFTER pattern.

The initial population trap is also common: creating the FTS5 virtual table after the `experts` table already has 1,558 rows means the index starts empty. Triggers only capture changes after they are created; they do not backfill existing rows. FTS searches return zero results until a full rebuild is run.

**How to avoid:**
Use the correct trigger pattern. UPDATE triggers must explicitly capture old values:

```sql
-- Create FTS5 external content table
CREATE VIRTUAL TABLE experts_fts USING fts5(
    first_name, last_name, job_title, bio, tags,
    content='experts',
    content_rowid='id'
);

-- Initial population (REQUIRED for existing data — triggers don't backfill)
INSERT INTO experts_fts(experts_fts) VALUES('rebuild');

-- INSERT trigger
CREATE TRIGGER experts_fts_ai AFTER INSERT ON experts BEGIN
    INSERT INTO experts_fts(rowid, first_name, last_name, job_title, bio, tags)
    VALUES (new.id, new.first_name, new.last_name, new.job_title, new.bio, new.tags);
END;

-- DELETE trigger
CREATE TRIGGER experts_fts_ad AFTER DELETE ON experts BEGIN
    INSERT INTO experts_fts(experts_fts, rowid, first_name, last_name, job_title, bio, tags)
    VALUES ('delete', old.id, old.first_name, old.last_name, old.job_title, old.bio, old.tags);
END;

-- UPDATE trigger — uses OLD values to delete, NEW values to insert
CREATE TRIGGER experts_fts_au AFTER UPDATE ON experts BEGIN
    INSERT INTO experts_fts(experts_fts, rowid, first_name, last_name, job_title, bio, tags)
    VALUES ('delete', old.id, old.first_name, old.last_name, old.job_title, old.bio, old.tags);
    INSERT INTO experts_fts(rowid, first_name, last_name, job_title, bio, tags)
    VALUES (new.id, new.first_name, new.last_name, new.job_title, new.bio, new.tags);
END;
```

After creating the triggers, always run `INSERT INTO experts_fts(experts_fts) VALUES('rebuild')` once to populate from existing data.

Verify the index after migration:
```sql
SELECT COUNT(*) FROM experts_fts;  -- Must equal 1558
SELECT * FROM experts_fts WHERE experts_fts MATCH 'marketing' LIMIT 5;  -- Must return results
```

**Warning signs:**
- FTS search returns zero results after migration
- Searching for an expert by job title that you know exists returns nothing
- Updating an expert's bio in the admin panel and then searching for the old bio terms still finds that expert

**Phase to address:** Phase 1 (hybrid search backend) — run FTS5 migration in a local SQLite copy before touching the Railway production DB. Include rebuild and verification SQL in the migration script, not as a manual step.

---

### Pitfall 3: Zustand Store Introduced Alongside Existing useState Creates Double Source of Truth

**What goes wrong:**
The existing chat page and admin components manage state entirely with local `useState`. When Zustand is introduced for the new marketplace (`searchParams`, `results`, `isPilotOpen`), developers incrementally migrate by adding the Zustand store for new code while leaving old components on `useState`. The result is two competing representations of the same data: the URL search params, the Zustand store, and scattered component-level `useState` all influence what the UI renders. Filters applied in the Zustand store do not propagate to components still reading from `useState`. The back button clears Zustand state but leaves stale `useState` data. Filter state appears correct in one component and stale in another.

**Why it happens:**
Incremental migration feels safe: "I'll add Zustand for the new marketplace and leave existing components alone." But data that multiple components need to agree on (filter values, search results, email gate status) must have exactly one owner. Splitting ownership between Zustand and `useState` across components that render simultaneously means React's reconciliation cannot guarantee consistency.

**How to avoid:**
Decide ownership before writing any Zustand code. For v2.0, the rule is:

- **Zustand owns:** `searchParams` (rate range, tag filters, text query), `results` (current expert list), `isPilotOpen`, `emailGated` (previously localStorage only)
- **Component-level `useState` owns:** form input buffer state (text being typed before submit), UI toggle state local to one component (accordion open/close)
- **Never split:** if two components read the same value, it must be in Zustand, not `useState` in a parent

For the email gate specifically: the existing `localStorage` flag must be migrated into the Zustand store (with persist middleware) so all v2.0 components read from one place. Do not keep the old `useState` initializer pattern alongside a Zustand selector for the same flag.

Zustand's pattern of using per-slice selectors prevents unnecessary re-renders and makes ownership explicit:

```typescript
// Good — one source of truth
const searchParams = useSearchStore((s) => s.searchParams);

// Bad — parallel useState that shadows the store
const [localSearchParams, setLocalSearchParams] = useState(/* ...from somewhere */ );
```

**Warning signs:**
- Filter state in the sidebar does not match what the results grid is displaying
- Clearing filters in one component does not clear them in another
- The email gate modal re-appears for users who already gated, on some pages but not others

**Phase to address:** Phase 2 (Zustand integration) — write a state ownership table (who owns what) before writing any store code. Do a grep for every `useState` that holds filter, result, or gate data and migrate each one before the phase is considered done.

---

### Pitfall 4: Zustand Persist Middleware Rehydrates Stale or Incompatible State on Deploy

**What goes wrong:**
Persist middleware serializes the Zustand store to localStorage on every change and rehydrates it on page load. When v2.0 deploys, users returning to the site have stale v1.x state in their localStorage: old filter shapes, result arrays from the previous chat UI, or `emailGated` flags that were structured differently. Zustand rehydrates this stale state, the store's TypeScript types don't match, and components crash or silently render wrong data. In the worst case, the entire app breaks for returning users until they manually clear their localStorage — which they don't know to do.

A related risk: persisting large arrays. If `results` (the full 1,558-expert response array) is included in the persisted state, localStorage fills up quickly. localStorage has a 5–10 MB limit per origin (varies by browser), and exceeding it causes `QuotaExceededError` which silently fails in some browsers.

**Why it happens:**
Developers add `persist(...)` wrapping the entire store without thinking about what should survive across sessions vs. what should reset. Everything goes in because it's easier than deciding. Version numbers are omitted because "we'll add them later." Large arrays (results, expert objects with bio strings) are persisted without measuring their serialized size.

**How to avoid:**
Use `partialize` to persist only user-preference state, never computed/fetched results:

```typescript
persist(
  (set, get) => ({ ...storeDefinition }),
  {
    name: 'tinrate-marketplace-v2',
    version: 1,
    // Only persist preferences, not results or transient UI state
    partialize: (state) => ({
      emailGated: state.emailGated,
      // Do NOT persist: results, isLoading, isPilotOpen, searchParams
    }),
    migrate: (persistedState: unknown, version: number) => {
      // Handle v1.x → v2.0 shape change
      if (version === 0) {
        return { emailGated: false }; // reset incompatible old state
      }
      return persistedState as StoreState;
    },
  }
)
```

Rules for what NOT to persist:
- `results` — large array, always re-fetchable, goes stale immediately
- `isLoading` / `error` — transient UI state, meaningless across sessions
- `isPilotOpen` — acceptable to reset on each visit
- `searchParams` — debatable; only persist if the UX explicitly says "your last search is saved"
- Any field that references IDs or data that the server can delete or change

Measure the serialized size of any persisted field: `JSON.stringify(state.emailGated).length` must be negligible. If a field's serialized size approaches 100KB, do not persist it.

**Warning signs:**
- Console error `QuotaExceededError` in storage operations (only visible in devtools, not to users)
- Returning users see stale filter values or an incorrectly gated/ungated state
- TypeScript runtime errors like `Cannot read property X of undefined` on first render for returning users, but not for new users
- `zustand-persist` hydration concurrency bug (affects Zustand < v5.0.10): concurrent hydration calls produce inconsistent state — upgrade to v5.0.10+

**Phase to address:** Phase 2 (Zustand integration) — define `partialize` and `version` before the store is used in any component. Bump `version` on every deploy that changes the persisted state shape.

---

### Pitfall 5: react-virtuoso VirtuosoGrid Jitters With CSS Grid and Variable-Height Cards

**What goes wrong:**
The expert grid is built with `VirtuosoGrid` using a CSS `grid` layout (`grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`). Expert cards have variable height because some bios are longer than others, some experts have more tags, and card expansion (on hover or click) changes card height dynamically. This triggers a known and documented bug in `VirtuosoGrid`: when the grid container's height is close to the height of items, or when the scrollbar appears and reduces the container's effective width (causing item width to change, which changes item height), the grid jitters and flickers on scroll. The issue is tracked as GitHub issue #479 and #1086 and has been reported since 2021 — it is not fixed as of 2025.

The CSS `margin` trap is a separate issue: applying `margin` to card elements instead of `padding` confuses Virtuoso's item measuring mechanism. The scroll height is miscalculated and users cannot scroll all the way to the bottom of the list. This is documented on the Virtuoso troubleshooting page.

**Why it happens:**
`VirtuosoGrid` measures item heights to calculate scroll position. When item height changes (due to variable content, width changes from scrollbar appearance, or CSS animations), the measuring function is called repeatedly, triggering rapid DOM updates, which causes visible jitter. CSS margins are outside the measured element boundary, so they are not included in Virtuoso's height calculations.

**How to avoid:**
- Use `padding` on card elements, never `margin`. Replace `gap` on the grid with `padding` on individual cards if needed.
- Fix card heights. The most reliable fix for `VirtuosoGrid` is uniform card height. Give all cards the same height (e.g., 320px), use `overflow: hidden` or `line-clamp` for variable-length bio text, and show the full bio in a side panel or modal, not in the card itself. This eliminates variable-height jitter entirely.
- If cards must have variable height, use `Virtuoso` (the list component) with a single-column layout on mobile and a CSS column approach for desktop — not `VirtuosoGrid`. `Virtuoso` handles variable heights more robustly than `VirtuosoGrid`.
- Set `overscan` to a higher value (`overscan={800}`) to reduce the frequency of remeasuring near the visible boundary.
- Do not use Framer Motion layout animations on cards inside `VirtuosoGrid` — layout recalculations trigger Virtuoso remeasuring, compounding jitter.

**Warning signs:**
- Grid flickers or cards jump vertically when the user scrolls to the bottom of the list
- The scrollbar appears and the entire grid layout shifts horizontally for a frame
- Users report they "can't scroll to the bottom" — they reach a point where the scroll stops before the last item

**Phase to address:** Phase 3 (marketplace grid) — prototype the grid with both uniform-height and variable-height cards in a local sandbox before integrating. If variable height is required, validate the chosen approach handles 1,558 items with zero jitter before considering the phase done.

---

### Pitfall 6: Framer Motion AnimatePresence and Virtualization Are Incompatible — Exit Animations Never Fire

**What goes wrong:**
`AnimatePresence` is added around expert cards to animate them in on mount and out on unmount. Inside `VirtuosoGrid`, cards are unmounted by the virtualizer when they scroll out of the viewport. When a card scrolls out, Virtuoso removes it from the DOM immediately. `AnimatePresence` never gets the chance to run the exit animation because the DOM node is gone before the animation can execute. The user sees cards disappear instantly instead of animating out. If `AnimatePresence` tries to block unmounting until the exit animation completes, it conflicts with Virtuoso's DOM management and causes layout corruption.

A secondary issue: animating all 1,558 card mount animations simultaneously (e.g., on initial load or after a filter change) causes a large performance spike. Each `motion` element adds a ResizeObserver, style calculation, and RAF task. At 20–30 visible items, this is acceptable. At 100+ items rendered simultaneously (e.g., when virtualization is briefly disabled), it causes frame drops.

**Why it happens:**
`AnimatePresence` assumes it controls the mount/unmount lifecycle of its children. Virtualization libraries also control mount/unmount based on scroll position. These two control mechanisms conflict. The mount animation works fine (Virtuoso mounts → motion animates in). The unmount animation fails (Virtuoso unmounts instantly → motion never fires exit).

**How to avoid:**
- Do not use `AnimatePresence` with exit animations on items inside `Virtuoso` or `VirtuosoGrid`. Exit animations will not work reliably.
- Use `animate` (mount animation) without `exit` for cards: fade-in and scale-in on mount is safe. Simply do not define an `exit` prop.
- Use `LazyMotion` with `domAnimation` (not `domMax`) to minimize the bundle contribution from Framer Motion to ~15KB:
  ```tsx
  import { LazyMotion, domAnimation, m } from 'framer-motion';
  // Use <m.div> instead of <motion.div>
  // Wrap app in <LazyMotion features={domAnimation}>
  ```
- Limit animation to the card's initial appearance. After the first render, do not re-animate cards that re-enter the viewport on scroll — Virtuoso remounts cards as the user scrolls back up, which would re-trigger entry animations and look wrong. Use a `hasAnimated` ref or `initial={false}` after first mount.
- Reserve `AnimatePresence` for components outside the virtualizer: the AI co-pilot sidebar, filter sidebar slide-in/out, modal dialogs, the bottom sheet on mobile. These work correctly with `AnimatePresence` because their lifecycle is controlled by React state, not by a virtualizer.

**Warning signs:**
- Cards do not animate out when the user scrolls, but do animate in when scrolling back up
- Performance profiler shows 50+ ResizeObserver callbacks per scroll tick
- Bundle size analysis shows `framer-motion` contributing more than 35KB to the initial JS bundle

**Phase to address:** Phase 3 (marketplace grid) and Phase 4 (AI co-pilot). Establish the animation contract — "cards animate in only, sidebar/modal use AnimatePresence" — before writing any motion component code.

---

### Pitfall 7: Gemini Function Calling Response Parsed Directly on the Frontend With No Schema Validation

**What goes wrong:**
The AI co-pilot sends a user query to the backend, which calls Gemini with a `apply_filters` function definition. Gemini returns a function call response. The frontend JavaScript parses this response and applies the filter values directly to the Zustand store: `setSearchParams(geminiResponse.args)`. There is no validation between Gemini's output and the Zustand store. Gemini can (and does) return:

- Filter values outside valid ranges (e.g., `hourlyRate: -50` or `hourlyRate: 999999`)
- Field names that don't exist in `searchParams` (Gemini hallucinates field names)
- Null or undefined for required fields
- Malformed function calls that partially match the schema but have extra keys

Any of these cause silent store corruption, unexpected UI states, or JavaScript errors that crash the co-pilot panel.

A security concern specific to this architecture: the function schema is defined on the backend, but the execution happens on the frontend. If the frontend trusts Gemini's output without validation, a crafted user prompt could potentially manipulate Gemini into calling `apply_filters` with values that expose unintended UI states (e.g., setting `emailGated: false` if that field is accidentally in scope). This is a form of prompt injection — the user's input influences Gemini's function call arguments.

**Why it happens:**
Developers trust that Gemini's structured output (with `response_schema`) guarantees correctness. It guarantees syntactic validity (the JSON matches the schema shape) but does not guarantee semantic correctness (the values are within valid business ranges). The official guidance states: "structured output guarantees syntactically correct JSON, it does not guarantee the values are semantically correct."

**How to avoid:**
Validate every Gemini function call response before applying it to the store. Write a strict `validateFilterArgs` function:

```typescript
interface FilterArgs {
  minRate?: number;
  maxRate?: number;
  tags?: string[];
  query?: string;
}

const VALID_TAGS = new Set(ALL_KNOWN_TAGS); // loaded from the API or config

function validateFilterArgs(raw: unknown): FilterArgs {
  if (typeof raw !== 'object' || raw === null) throw new Error('Invalid args');
  const args = raw as Record<string, unknown>;

  const validated: FilterArgs = {};

  if ('minRate' in args) {
    const v = Number(args.minRate);
    if (isFinite(v) && v >= 0 && v <= 10000) validated.minRate = v;
  }
  if ('maxRate' in args) {
    const v = Number(args.maxRate);
    if (isFinite(v) && v >= 0 && v <= 10000) validated.maxRate = v;
  }
  if ('tags' in args && Array.isArray(args.tags)) {
    validated.tags = args.tags.filter(
      (t): t is string => typeof t === 'string' && VALID_TAGS.has(t)
    );
  }
  if ('query' in args && typeof args.query === 'string') {
    validated.query = args.query.slice(0, 500); // length limit
  }

  return validated;
}
```

The function schema given to Gemini must contain only filter-related fields. Do not include `emailGated`, `adminKey`, or any state not meant for user manipulation in scope. Prompt injection risk is proportional to the surface area of the function schema.

**Warning signs:**
- Co-pilot sets a filter value to a number like `-1` or `NaN`, which breaks the range slider component
- Co-pilot applies a tag that does not exist in the known tag list, causing zero results (the backend returns nothing for an unknown tag)
- A cleverly crafted user message causes Gemini to call `apply_filters` with unexpected keys that appear in the Zustand store

**Phase to address:** Phase 4 (AI co-pilot) — write `validateFilterArgs` before wiring Gemini output to any Zustand action. Treat Gemini output as untrusted user input, not trusted structured data.

---

### Pitfall 8: React Router v7 Route Replacement Breaks Lazy Loading When Loader and Component Are in the Same File

**What goes wrong:**
The current app uses React Router v7 in SPA mode. The homepage (`/`) currently renders the chat UI. For v2.0, the homepage is replaced with the marketplace. The new marketplace route is lazily imported using `React.lazy()` with a dynamic import that references the same file as the route's `loader` function. React Router v7 has a documented incompatibility: when both the component and the loader are exported from the same file and that file is lazily imported, React Router pulls the loader into the main bundle even though the component is lazy. This defeats the point of code splitting for the heaviest route in the app (the marketplace, which includes Zustand, react-virtuoso, and Framer Motion).

A separate issue in SPA mode: React Router v7 SPA mode generates a single `index.html` and only the root route runs at build time. Loaders on child routes do not run during pre-rendering. If the marketplace route uses a `loader` to pre-fetch experts from the backend, that loader only runs in the browser, not at build time — which is fine for this app but must be understood so developers don't accidentally try to use pre-rendered data.

**Why it happens:**
Developers place the route loader next to the component for co-location convenience. React Router's module graph analysis pulls both into the same chunk when the file is dynamically imported. The official documentation for v7 notes this explicitly: "to get lazy loading to work while fetching in parallel, you need to separate your loader function from the file that has the component."

**How to avoid:**
Separate loader and component into different files:

```
src/
  marketplace/
    MarketplacePage.tsx      ← component only
    marketplace.loader.ts    ← loader function only
```

Route definition:
```typescript
{
  path: '/',
  lazy: () => import('./marketplace/MarketplacePage'),
  loader: () => import('./marketplace/marketplace.loader').then(m => m.loader),
}
```

The chat route (`/chat` or wherever the existing chat UI moves to) must also be updated if its path was `/`. A redirect from `/` to `/chat` for existing bookmarks is needed if the chat UI is preserved at all.

For the `react-router-dom` → `react-router` package rename: v7 consolidates both packages. If any existing imports reference `react-router-dom`, update them to `react-router`. This is a mechanical change, but grep the entire codebase to catch all occurrences.

**Warning signs:**
- Bundle analysis shows `framer-motion` or `react-virtuoso` in the initial JS bundle even though the marketplace is lazy-loaded
- Navigating from the old chat URL to `/` shows a blank page without a redirect
- `loader` data is `undefined` on the first render of the marketplace route in SPA mode (this is normal — the loader runs asynchronously; handle the loading state)

**Phase to address:** Phase 2 (routing restructure) — before refactoring routes, run bundle analysis on the current app as a baseline. Re-run after routing changes and verify the marketplace chunk is not in the initial bundle.

---

### Pitfall 9: OKLCH Colors in Tailwind v3 Are Not Natively Supported — They Pass Through Without Processing

**What goes wrong:**
The v2.0 design uses OKLCH color values (e.g., `oklch(70% 0.15 250)`) for the marketplace's color palette. In Tailwind CSS v3 (the current version in this project), OKLCH is not part of the default color palette and is not processed by the Tailwind build pipeline. If OKLCH values are added to `tailwind.config.js` as custom colors, they are passed through to the CSS output as-is. This works in modern browsers (Chrome 111+, Firefox 113+, Safari 15.4+), but fails silently in older browsers with no fallback. Approximately 7% of global browser sessions (per browser compatibility data) do not support OKLCH.

The temptation to "just use Tailwind v4" is not a straightforward fix: Tailwind v4 is a complete rewrite with a new config format, no `tailwind.config.js`, CSS-native configuration, and breaking changes to almost every plugin. Upgrading from v3 to v4 mid-milestone while also adding Zustand, react-virtuoso, and Framer Motion is a recipe for a tangled diff that's impossible to debug.

**Why it happens:**
OKLCH was introduced as a first-class feature in Tailwind v4 (which ships the entire default palette in OKLCH). Developers see OKLCH used in Tailwind v4 examples and assume it also works the same way in v3. It does not — v3 simply passes the raw value to CSS without transformation or fallback generation.

**How to avoid:**
Stay on Tailwind v3 for v2.0. Use OKLCH in `tailwind.config.js` custom colors if the target browsers are acceptable (modern desktop/mobile):

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        // OKLCH values pass through in v3 — no Tailwind processing
        // These work in Chrome 111+, Firefox 113+, Safari 15.4+
        brand: {
          500: 'oklch(65% 0.18 250)',
          600: 'oklch(55% 0.18 250)',
        }
      }
    }
  }
}
```

If older browser support is required, add the `tailwindcss-oklch` plugin or use `@csstools/postcss-oklab-function` PostCSS plugin to generate sRGB fallbacks. If the Tinrate user base is primarily professionals on modern browsers, the risk is low and no plugin is needed.

Do NOT upgrade to Tailwind v4 during v2.0. Schedule it as a separate cleanup milestone after v2.0 ships.

**Warning signs:**
- Colors appear correct in Chrome devtools but are missing/wrong in a browser compatibility test
- Safari 15.3 or older renders the marketplace with missing accent colors (no visible error)
- A Tailwind v4 migration attempt mid-milestone causes the entire `tailwind.config.js` to stop working (v4 removed the config file format entirely)

**Phase to address:** Phase 2 (UI scaffolding) — decide whether OKLCH colors require fallbacks based on the expected user base. Document the decision. If using OKLCH in v3 without a plugin, add a browser support note to the design tokens file.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Persist entire Zustand store (no partialize) | No decisions needed | Stale results in localStorage, QuotaExceededError risk, returning user state breaks on every deploy | Never — always use partialize |
| Skip `version` + `migrate` in persist middleware | Faster setup | Returning users get corrupted state on every schema change | Never — add version: 1 from day one |
| Put loader and component in the same file and use lazy() | Co-location is convenient | Heavy dependencies (Framer Motion, Zustand) end up in the initial bundle | Never for heavy routes |
| Use `AnimatePresence` with exit animations inside VirtuosoGrid | Consistent animation API | Exit animations never fire; possible layout corruption | Never — AnimatePresence only outside the virtualizer |
| Apply Gemini function call args directly to Zustand with no validation | Simpler code | Silent store corruption, prompt injection surface | Never — validate every field before applying |
| Use `margin` on VirtuosoGrid card items instead of `padding` | Standard CSS mental model | Scroll height miscalculated, users can't reach bottom items | Never inside a Virtuoso container |
| Keep email gate state in localStorage only (not Zustand) | No migration needed | Multiple components re-implement gate logic independently | Acceptable only if no other component reads it — migrate to Zustand for v2.0 |
| Call `index.remove_ids()` to "filter" FAISS search | Intuitive name suggests filtering | Permanently mutates index, shifts all sequential IDs | Never — use SearchParameters(sel=IDSelectorBatch) |

---

## Integration Gotchas

Common mistakes when connecting the new v2.0 components to the existing system.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| FAISS IDSelectorBatch + SQLAlchemy pre-filter | Pre-filtering with `remove_ids` instead of `SearchParameters` | Use `faiss.SearchParameters(sel=faiss.IDSelectorBatch(ids))` — index is never mutated |
| FTS5 + existing experts table | Creating FTS5 table without running `rebuild` — existing rows not indexed | Always run `INSERT INTO experts_fts(experts_fts) VALUES('rebuild')` after creating the virtual table |
| Zustand + existing email gate (localStorage) | Leaving localStorage reads in `useState` initializer while Zustand also tracks `emailGated` | Migrate gate state fully into Zustand persist; remove the old `useState` initializer pattern |
| react-virtuoso + Framer Motion | Wrapping cards in `AnimatePresence` with `exit` animation | Use `animate` (mount only) on cards; reserve `AnimatePresence` for sidebar/modal outside Virtuoso |
| Gemini function calling + Zustand store | Direct `setSearchParams(geminiResponse.args)` without validation | Validate every field in `geminiResponse.args` against known-valid ranges and tag lists before applying |
| React Router v7 + lazy marketplace | Co-locating loader and component in the same file | Separate `MarketplacePage.tsx` (component) from `marketplace.loader.ts` (loader) for true code splitting |
| Tailwind v3 + OKLCH colors | Assuming v3 processes OKLCH like v4 does | OKLCH passes through as raw CSS in v3 — works in modern browsers only; add PostCSS plugin if fallbacks needed |

---

## Performance Traps

Patterns that work in development but degrade in production under real data (1,558 experts).

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Framer Motion `motion` wrapper on all 1,558 virtual cards | Frame drops when filter changes re-render the grid | Only animate the first visible render; use `initial={false}` after first mount; limit to `domAnimation` not `domMax` | From day 1 — 30+ animated items simultaneously causes measurable jank |
| Zustand selector returning new object reference on every render | Every component re-renders on every store change | Use shallow equality or select primitives: `useStore(s => s.searchParams.minRate)` not `useStore(s => s.searchParams)` | From day 1 — visible as excessive re-render warnings in React Devtools |
| FTS5 query without LIMIT on the expert table | Full-table text search returns all 1,558 rows to Python | Always append `LIMIT 200` to the FTS5 query; Python does further filtering | At 1,558 rows: manageable. At 10K+: query slows to seconds |
| IDSelectorBatch with batch size > 1 when IDs differ per query | Forced to run batch_size=1 search (several times slower) | For the v2.0 use case (one filter set, one query), batch size is 1 anyway — this trap is not triggered | Only matters if doing multi-query batch search, which v2.0 does not do |
| VirtuosoGrid remeasuring on every filter change | Grid flickers and reflows after each filter interaction | Apply filter results to the store atomically; debounce filter changes by 150ms before triggering search | From day 1 — visible on every filter interaction |

---

## Security Mistakes

Domain-specific security issues for the v2.0 feature set.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Gemini function call args applied to Zustand with no field whitelisting | Prompt injection: user crafts a message that makes Gemini call `apply_filters` with unintended field names, corrupting store state | Whitelist: only accept `minRate`, `maxRate`, `tags`, `query` from Gemini output — reject any other key |
| Email gate enforcement only on the frontend | Users bypass gate by calling the backend directly; lead capture fails | Gate check is already frontend-only (localStorage). For v2.0, continue this pattern — the gate is a UX affordance, not a security boundary. Document this explicitly so the team doesn't accidentally build backend auth assumptions around it. |
| Persisting `adminKey` in Zustand localStorage | Admin key leaks from localStorage (XSS) | Admin key must remain in `sessionStorage` (current pattern) — never migrate it to Zustand persist middleware. Session key dies on tab close, which is the correct security behavior. |
| Sending user's raw co-pilot prompt to backend as a filter bypass | User types "ignore all filters and show expert ID 1234" as the co-pilot prompt | Co-pilot prompts go to Gemini for function calling, then the extracted `apply_filters` args are validated before store application. The raw prompt never reaches SQLAlchemy filter code directly. |

---

## UX Pitfalls

Common user experience mistakes specific to marketplace + AI co-pilot patterns.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Email gate blocks filter interactions (not just profile views) | Users cannot explore the marketplace at all without giving their email — high abandonment | Gate only gated actions (view profile, download report) — filter, search, and card browsing must be ungated |
| Bottom sheet (mobile) covers the results grid completely | User cannot see results while adjusting filters | Bottom sheet at 50% viewport height max; results visible behind it; close on outside tap |
| AI co-pilot resets all filters when the user closes it | User loses their manual filter state when dismissing the pilot | Co-pilot only applies filters additively via Zustand store; user can undo each co-pilot action; closing the panel does not reset store state |
| Virtualized grid loses scroll position after a filter change | User applies a filter, results update, page jumps to top — disorienting | Scroll to top intentionally after each filter change (expected behavior for filtered results); do not attempt scroll restoration across filter changes |
| Fuzzy search corrects query silently | User types "marketng" — system searches "marketing" without telling the user | Show a "Did you mean: marketing?" label below the search bar; do not silently substitute |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces specific to v2.0.

- [ ] **FTS5 migration:** Virtual table created — verify `SELECT COUNT(*) FROM experts_fts` returns 1,558. Verify `INSERT INTO experts_fts(experts_fts) VALUES('rebuild')` was run. Test three known-good search terms.
- [ ] **FAISS IDSelectorBatch:** Search returns pre-filtered results — verify `index.ntotal == 1558` (index was not mutated by `remove_ids`). Test that searching with an empty `allowed_ids` list returns zero results, not all results.
- [ ] **Zustand persist:** Store hydrates on page reload — verify returning users keep `emailGated` state. Verify `results` and `isLoading` are NOT in localStorage (open devtools → Application → localStorage → `tinrate-marketplace-v2`).
- [ ] **react-virtuoso grid:** Grid renders 1,558 experts — verify scrolling to the last expert works without jitter. Verify CSS uses `padding` not `margin` on card elements.
- [ ] **Framer Motion lazy loading:** Bundle analysis shows `framer-motion` is NOT in the initial JS bundle. Use `LazyMotion` + `domAnimation` feature set.
- [ ] **Gemini function calling:** Co-pilot applies filters — verify that sending a rate value of `-999` via a crafted prompt results in the filter NOT being applied (validation rejects it). Verify `adminKey` is NOT in scope of the function schema.
- [ ] **Email gate v2.0:** Gate works on profile-view and report-download actions — verify that filter and search interactions work without triggering the gate for ungated users.
- [ ] **React Router routes:** Homepage replaced by marketplace — verify that `/` loads the marketplace, old chat is accessible at its new path, and there is a redirect for any bookmarked old URL. Verify marketplace bundle is NOT in the initial chunk.
- [ ] **OKLCH colors:** Confirm color decision (with or without PostCSS plugin) — open the deployed app in a browser that does not support OKLCH and verify the page does not look broken (or confirm that the user base does not include those browsers).

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| `remove_ids` accidentally called on FAISS index | HIGH | Restart Railway container — in-memory index is reloaded from `faiss.index` file on startup. If the file was also overwritten: restore from the most recent Railway volume backup, or re-run `scripts/reindex_experts.py` |
| FTS5 index out of sync with experts table | MEDIUM | Run `INSERT INTO experts_fts(experts_fts) VALUES('rebuild')` via a `/api/admin/maintenance` endpoint or Railway shell. Verify count afterward. |
| Zustand persist rehydrates corrupted state for all returning users | LOW | Increment `version` in persist config and deploy. On next page load, Zustand detects version mismatch, runs `migrate` function, and resets to default state. Users lose saved preferences but app recovers automatically. |
| VirtuosoGrid jitter ships to production | MEDIUM | Switch to uniform-height cards (add `min-h-[320px]` and `overflow-hidden` to cards); deploy. This is a one-line CSS fix once the cause is identified. |
| AnimatePresence exit animations not working | LOW | Remove `exit` prop from all card motion components; keep `animate` for entry only. No user-facing regression — cards simply disappear instantly on unmount (acceptable). |
| Gemini co-pilot applies invalid filter values | LOW | Validation function prevents bad values from reaching the store. If validation itself has a bug: clear the Zustand store with `useStore.getState().resetFilters()` triggered by a "clear all" button that always exists in the UI. |
| OKLCH colors invisible in user's browser | LOW | Add `@csstools/postcss-oklab-function` PostCSS plugin; rebuild and deploy. The fix is additive and requires no component changes. |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| FAISS IDSelectorBatch misused as remove_ids | Phase 1: hybrid search backend | Unit test asserts `index.ntotal == 1558` after every search; code review checks for any `remove_ids` call |
| FTS5 external content table not rebuilt after creation | Phase 1: hybrid search backend | Migration script includes `rebuild` command; post-migration SQL count check |
| FTS5 UPDATE trigger bug (AFTER vs correct old/new pattern) | Phase 1: hybrid search backend | Integration test: update an expert's bio, then FTS search for old bio term — must not match |
| Zustand double source of truth with existing useState | Phase 2: Zustand + state ownership | State ownership table reviewed; grep for any `useState` holding filter/result/gate data |
| Zustand persist rehydrating stale state | Phase 2: Zustand + state ownership | Check localStorage after deploy: `results` must not appear; `emailGated` must persist correctly across reload |
| React Router lazy loading puts heavy deps in initial bundle | Phase 2: routing restructure | Bundle analysis after routing refactor; marketplace chunk must not appear in initial load |
| OKLCH browser support decision | Phase 2: UI scaffolding | Document browser support decision; test with a v3 browser if needed |
| react-virtuoso grid jitter with variable-height cards | Phase 3: marketplace grid | Manual scroll test with 1,558 experts; no jitter to bottom of list |
| Framer Motion AnimatePresence incompatible with Virtuoso | Phase 3: marketplace grid | Verify exit animations are not used on card elements; bundle size check |
| Gemini function calling output not validated | Phase 4: AI co-pilot | Test with crafted out-of-range values; unit test for `validateFilterArgs` with invalid inputs |
| Email gate blocking filter interactions | Phase 4: email gate v2.0 | Manual test: ungated user can filter and search; gate only appears on profile-view action |

---

## Sources

- FAISS IDSelectorBatch search-time usage (SearchParameters): https://github.com/facebookresearch/faiss/wiki/Setting-search-parameters-for-one-query
- FAISS IDSelectorBatch struct documentation: https://faiss.ai/cpp_api/struct/structfaiss_1_1IDSelectorBatch.html
- FAISS remove_ids shifts sequential IDs on IndexFlat (issue #883): https://github.com/facebookresearch/faiss/issues/883
- FAISS IDSelectorBatch inconsistent retrievals (issue #3112): https://github.com/facebookresearch/faiss/issues/3112
- FAISS ACCESS VIOLATION with IDSelectorArray (issue #3156): https://github.com/facebookresearch/faiss/issues/3156
- SQLite FTS5 official documentation (external content tables, triggers, rebuild): https://sqlite.org/fts5.html
- SQLite forum: corrupt FTS5 table with wrong trigger order: https://sqlite.org/forum/info/da59bf102d7a7951740bd01c4942b1119512a86bfa1b11d4f762056c8eb7fc4e
- SQLite forum: FTS5 external content update trigger bug: https://sqlite.org/forum/info/dc4aef55640218ba81f158100e3f02cc216ccaa20adbe633a2d83986093c56bf
- Zustand persist middleware documentation: https://zustand.docs.pmnd.rs/middlewares/persist
- Zustand persist middleware hydration race condition fix (v5.0.10): https://github.com/pmndrs/zustand/discussions/2556
- Zustand persist version mismatch and migration: https://github.com/pmndrs/zustand/discussions/1717
- react-virtuoso VirtuosoGrid CSS grid jitter (issue #479): https://github.com/petyosi/react-virtuoso/issues/479
- react-virtuoso VirtuosoGrid jittering/flickering (issue #1086): https://github.com/petyosi/react-virtuoso/issues/1086
- react-virtuoso troubleshooting — margin vs padding: https://virtuoso.dev/react-virtuoso/troubleshooting/
- react-virtuoso scroll restoration delay (issue #1116): https://github.com/petyosi/react-virtuoso/issues/1116
- Framer Motion LazyMotion bundle size optimization: https://motion.dev/docs/react-reduce-bundle-size
- Framer Motion large list performance (issue #1715): https://github.com/motiondivision/motion/issues/1715
- Framer Motion AnimatePresence exit animation bugs: https://github.com/framer/motion/issues/1682
- Gemini function calling documentation: https://ai.google.dev/gemini-api/docs/function-calling
- Gemini structured output — syntax vs. semantic correctness: https://ai.google.dev/gemini-api/docs/structured-output
- Gemini additionalProperties schema support (November 2025): https://github.com/googleapis/python-genai/issues/1815
- React Router v7 lazy loading — loader/component separation: https://reacttraining.com/blog/spa-lazy-loading-pitfalls
- React Router v7 SPA mode documentation: https://reactrouter.com/how-to/spa
- React Router v6 → v7 upgrade guide: https://reactrouter.com/upgrading/v6
- Tailwind CSS v3 custom colors documentation: https://tailwindcss.com/docs/customizing-colors
- Tailwind v4 OKLCH default palette announcement: https://tailwindcss.com/blog/tailwindcss-v4
- tailwindcss-oklch plugin for v3: https://github.com/MartijnCuppens/tailwindcss-oklch
- OKLCH browser compatibility issue in Tailwind v4 (issue #16351): https://github.com/tailwindlabs/tailwindcss/issues/16351

**Confidence assessment by area:**
- FAISS IDSelectorBatch pitfalls: HIGH — verified against official FAISS wiki and multiple GitHub issues
- SQLite FTS5 trigger order bug: HIGH — documented in official SQLite forum by SQLite contributors
- Zustand persist rehydration and partialize: HIGH — verified against official Zustand docs and confirmed race condition bug fix in v5.0.10
- react-virtuoso VirtuosoGrid jitter: HIGH — confirmed open GitHub issues; workaround (uniform height) verified
- Framer Motion + Virtuoso incompatibility: MEDIUM — confirmed via GitHub issues; specific behavior depends on Virtuoso version
- Gemini function calling validation: MEDIUM — official guidance on semantic correctness; prompt injection risk is community-informed, not officially documented
- React Router v7 lazy loading: HIGH — documented in official React Training blog by React Router core team
- Tailwind v3 OKLCH: HIGH — confirmed against official Tailwind v3 and v4 documentation

---
*Pitfalls research for: v2.0 Expert Marketplace (brownfield additions to existing production system)*
*Researched: 2026-02-21*
