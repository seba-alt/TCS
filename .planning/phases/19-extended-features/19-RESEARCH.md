# Phase 19: Extended Features — Research

**Phase:** 19 — Extended Features
**Requirements:** LEAD-01, LEAD-02, LEAD-04, ROBUST-01, ROBUST-02, ROBUST-03
**LEAD-03 explicitly deferred** per CONTEXT.md — no AI match report in this phase.

---

## 1. Email Gate Modal (LEAD-01, LEAD-02, LEAD-04)

### What Exists (v1.0 reusable)

The v1.0 chat interface already has a working email gate:
- `frontend/src/hooks/useEmailGate.ts` — localStorage-backed gate with `isUnlocked`, `email`, `submitEmail`
- `frontend/src/components/EmailGate.tsx` — full form UI with validation, loading state, error handling
- `STORAGE_KEY = 'tcs_gate_email'` — stable localStorage key; reuse this exact key to unify v1 and v2 email state
- Backend: `POST /api/email-capture` already exists and accepts `{ email: string }`

### What Phase 19 Needs

**LEAD-01:** Users browse freely — no modal until they try to view a profile. The existing `useEmailGate.isUnlocked` lazy initializer (reads localStorage synchronously) prevents flash.

**LEAD-02:** Modal triggered by clicking "View Full Profile" on `ExpertCard`. Per CONTEXT.md:
- Hard gate — no bypass without submitting email
- Dismiss: modal closes cleanly, re-appears on next profile click attempt
- Modal framing: "Unlock full profile" (access-focused, not value-framing)
- No "Download Match Report" modal — that feature is removed

**LEAD-04:** Returning visitors: `useEmailGate.isUnlocked` checks localStorage on init. If email exists, profile clicks go straight through without showing modal. Reusing the existing `STORAGE_KEY` ensures v1 email submitters are already unlocked.

### Implementation Pattern

```
ExpertCard adds "View Full Profile" button.
On click:
  if isUnlocked → open profile_url in new tab
  else → setShowModal(true) in parent or local state
Modal: renders EmailGate component (reused from v1.0), adapted for modal overlay
On submitEmail → isUnlocked becomes true → auto-opens the profile tab that was blocked
```

**Key architectural question:** Where does modal state live?
- Option A: Local state in ExpertCard — each card manages its own modal
- Option B: Global state in Zustand pilotSlice or new leadSlice — overkill for a simple modal
- **Recommendation: Local state in ExpertCard** — modal is tied to a specific card click, local `useState` is sufficient. After unlock, re-trigger the navigation. No Zustand needed.

**The `profile_url` on ExpertCard:** `ExpertCard` already receives `expert.profile_url`. No backend changes needed. The existing `ExpertCard` just needs a "View Full Profile" button and email gate modal overlay.

### Modal UX Pattern

```tsx
// ExpertCard gets a button:
<button onClick={handleViewProfile}>View Full Profile</button>

// Local state:
const [showGate, setShowGate] = useState(false)
const { isUnlocked, submitEmail } = useEmailGate()

function handleViewProfile() {
  if (isUnlocked) {
    window.open(expert.profile_url, '_blank', 'noopener')
  } else {
    setShowGate(true)
  }
}

async function handleEmailSubmit(email: string) {
  await submitEmail(email)
  setShowGate(false)
  window.open(expert.profile_url, '_blank', 'noopener')  // auto-open after unlock
}
```

**Modal overlay:** Fixed overlay with backdrop blur, centered card. Use `AnimatePresence` from `motion/react` for enter/exit animation (consistent with existing modal patterns). The reusable `EmailGate` component renders inside the modal.

**Pitfall: ExpertCard height constraint.** ExpertCard uses `h-[180px]` with `overflow-hidden` for VirtuosoGrid. The modal must be rendered at a DOM level above the card — use React Portal (`createPortal`) or render the modal at the MarketplacePage level.

**Best approach: Modal at MarketplacePage level.** Store `pendingProfileUrl: string | null` in local MarketplacePage state. ExpertCard calls a callback `onViewProfile(url)` when clicked. MarketplacePage shows the modal when `pendingProfileUrl !== null`.

```tsx
// MarketplacePage:
const [pendingProfileUrl, setPendingProfileUrl] = useState<string | null>(null)
const { isUnlocked, submitEmail } = useEmailGate()

// ExpertCard gets:
onViewProfile={(url) => {
  if (isUnlocked) window.open(url, '_blank', 'noopener')
  else setPendingProfileUrl(url)
}}

// After submit:
async function handleEmailSubmit(email: string) {
  await submitEmail(email)
  if (pendingProfileUrl) {
    window.open(pendingProfileUrl, '_blank', 'noopener')
    setPendingProfileUrl(null)
  }
}
```

ExpertGrid passes `onViewProfile` down to each ExpertCard via props. ExpertCard gets new `onViewProfile: (url: string) => void` prop.

---

## 2. Shareable Filter URLs (ROBUST-01)

### What Phase 19 Needs

URL query params encoding active filters. Per CONTEXT.md: encode whatever makes shared URLs most useful. All active filters: `q`, `rate_min`, `rate_max`, `tags[]`. Example: `?q=marketing&rate_max=100&tags=seo&tags=growth`.

### URL Sync Strategy: React Router v7 + useSearchParams

The app uses `react-router-dom` v7 (confirmed in `main.tsx` with `createBrowserRouter`). The correct approach is:

```typescript
import { useSearchParams } from 'react-router-dom'

// Read filters FROM URL on mount (one-time initialization)
// Write filters TO URL whenever store filter state changes
```

**Pattern: `useUrlSync` hook**

```typescript
export function useUrlSync() {
  const [searchParams, setSearchParams] = useSearchParams()

  // Sync store → URL (reactive, fires when filters change)
  const query = useExplorerStore(s => s.query)
  const rateMin = useExplorerStore(s => s.rateMin)
  const rateMax = useExplorerStore(s => s.rateMax)
  const tags = useExplorerStore(s => s.tags)

  useEffect(() => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (rateMin > 0) params.set('rate_min', String(rateMin))
    if (rateMax < 5000) params.set('rate_max', String(rateMax))
    tags.forEach(t => params.append('tags', t))
    setSearchParams(params, { replace: true })  // replace not push — no history spam
  }, [query, rateMin, rateMax, tags, setSearchParams])

  // Sync URL → store (one-time on mount, before first fetch)
  const setQuery = useExplorerStore(s => s.setQuery)
  const setRateRange = useExplorerStore(s => s.setRateRange)
  const setTags = useExplorerStore(s => s.setTags)

  const initialized = useRef(false)
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const q = searchParams.get('q') ?? ''
    const rateMin = Number(searchParams.get('rate_min') ?? 0)
    const rateMax = Number(searchParams.get('rate_max') ?? 5000)
    const tags = searchParams.getAll('tags')

    if (q) setQuery(q)
    if (rateMin || rateMax !== 5000) setRateRange(rateMin, rateMax)
    if (tags.length) setTags(tags)
  }, [])  // empty dep array — runs once on mount
}
```

**Pitfall: Conflict with localStorage persist.** Zustand persists filters to localStorage. If someone shares a URL and the recipient already has filters in localStorage, the localStorage-persisted state will WIN because Zustand rehydrates before the component mounts.

**Resolution:** The URL sync hook must run with higher priority. Use Zustand's `onRehydrateStorage` hook — after rehydration completes, apply URL params. Or simply check searchParams AFTER rehydration. Since Zustand rehydration is synchronous (localStorage), and `useEffect` fires after render, the URL sync effect runs after Zustand has rehydrated. Use `useEffect` with `replace: true` — the URL write happens after rehydration. For the read direction (URL → store), read immediately in `useEffect` and `replace` the localStorage state.

**Simpler approach:** Just always trust URL params if present. Run URL-read on mount — this overwrites whatever Zustand rehydrated if URL params exist. This is the correct UX for shared links.

### Copy Link Button

Per CONTEXT.md: explicit "Copy link" button in the sidebar or filter bar. Clicking copies the current URL to clipboard.

```tsx
<button onClick={() => navigator.clipboard.writeText(window.location.href)}>
  Copy link
</button>
```

Add to `FilterSidebar.tsx` at the bottom of the sidebar, or to `FilterChips.tsx` when chips are visible.

### URL Param Naming Convention

- `q` — text query (short and standard)
- `rate_min` — minimum rate
- `rate_max` — maximum rate
- `tags` — repeated params (`?tags=seo&tags=marketing`) — use `searchParams.getAll('tags')`

---

## 3. Search Suggestions Dropdown (ROBUST-02)

### What Phase 19 Needs

Live suggestions below the search bar. Per CONTEXT.md: starts at 2+ characters, no debounce gate, clicking a suggestion applies it as the search query.

### Backend: FTS5 Prefix Matching

FTS5 supports prefix queries with the `*` operator: `SELECT DISTINCT job_title FROM experts_fts WHERE experts_fts MATCH 'marke*' LIMIT 8`.

However, the current `_safe_fts_query` in `explorer.py` strips the `*` character. A new, separate suggestions endpoint is needed.

**New endpoint: `GET /api/suggest?q=marke`**

```python
@router.get("/api/suggest")
async def suggest(q: str = Query(default="", max_length=100)) -> list[str]:
    if len(q) < 2:
        return []
    # FTS5 prefix query — returns distinct job_title and company matches
    # The * must be added by the service, not the user
    ...
```

**What to suggest:** Expert names + job titles. FTS5 prefix search on `job_title` and `first_name last_name` fields gives relevant completions.

```sql
SELECT DISTINCT job_title FROM experts_fts
WHERE experts_fts MATCH :prefix_query
ORDER BY rank
LIMIT 8
```

Where `prefix_query = f"{safe_words}*"` — append `*` after sanitized words.

**Alternative approach:** Client-side suggestions from the hardcoded TOP_TAGS list. This avoids a new endpoint but only suggests tags, not queries.

**Recommendation:** Backend endpoint (`GET /api/suggest`) querying FTS5. Returns up to 8 suggestions. Fast — FTS5 prefix is sub-10ms. No embeddings needed.

### Frontend: Suggestions Dropdown

Modify `SearchInput.tsx` to show a dropdown `<ul>` below the input when suggestions are fetched:

```tsx
// Local state inside SearchInput:
const [suggestions, setSuggestions] = useState<string[]>([])
const [showSuggestions, setShowSuggestions] = useState(false)

// On input change: fetch suggestions (no debounce per CONTEXT.md)
async function fetchSuggestions(value: string) {
  if (value.length < 2) { setSuggestions([]); return }
  const res = await fetch(`${API_BASE}/api/suggest?q=${encodeURIComponent(value)}`)
  if (res.ok) setSuggestions(await res.json())
}
```

**Pitfall: Race condition.** If user types fast, responses arrive out of order. Use `AbortController` per request, same pattern as `useExplore`.

**Dropdown close:** Close on click-outside (blur event) or on suggestion click. Use `onBlur` with 150ms delay to allow the click to register before blur fires.

---

## 4. No-Results State with Tag Suggestions (ROBUST-03)

### What Phase 19 Needs

When `experts.length === 0 && !loading`: show nearby tag suggestions + Sage CTA. Per CONTEXT.md:
- Nearby tags: related to active filter set first, fall back to most popular overall
- Clicking a suggested tag: **replaces** current tag filter (not additive) — calls `setTags([tag])`
- "Clear all filters" CTA: secondary, below suggestions
- Sage CTA: prominent — "Not finding what you need? Try describing it to Sage."

### Current EmptyState

`frontend/src/components/marketplace/EmptyState.tsx` already exists with a Sage CTA (wired in Phase 18). It needs tag suggestions added.

### Tag Suggestion Logic

For "nearby tags" with no backend call needed:
- Active filter tags: suggest tags from TOP_TAGS that are "related" — simple string similarity or just show TOP_TAGS excluding the active ones
- Since we have no semantic similarity between tags, the practical implementation: show the top N tags from TOP_TAGS that are NOT currently active
- Phase 19 CONTEXT.md says "related to active filter set" — without a tag co-occurrence API, approximate with: tags that share a word with the active tag, or just TOP_TAGS minus active ones

**Simplest correct implementation:**
1. If active tags exist: show TOP_TAGS filtered to exclude active tags (limit 5-6)
2. If no active tags: show first 5-6 from TOP_TAGS
3. Clicking replaces current tags: `setTags([tag])` then `setQuery('')` to focus the tag filter

**Updated EmptyState:**
```tsx
const tags = useExplorerStore(s => s.tags)
const setTags = useExplorerStore(s => s.setTags)
const setQuery = useExplorerStore(s => s.setQuery)

const suggestions = TOP_TAGS.filter(t => !tags.includes(t)).slice(0, 6)

// Clicking a suggestion:
function handleTagSuggestion(tag: string) {
  setTags([tag])  // replace, not additive
  // Don't clear the text query — let the user see what happens with the new tag
}
```

---

## 5. Dependency Map & Wave Structure

### Wave Breakdown

**Wave 1 (parallel):**
- 19-01: Backend `GET /api/suggest` endpoint (FTS5 prefix search)

**Wave 2 (parallel, depends on 19-01):**
- 19-02: URL sync hook (`useUrlSync`) + "Copy link" button in FilterSidebar
- 19-03: Email gate modal — `ExpertCard` "View Full Profile" button + `MarketplacePage` modal handling + `useEmailGate` reuse

**Wave 3 (depends on 19-02 for URL sync being wired):**
- 19-04: Search suggestions dropdown in `SearchInput.tsx` (calls `/api/suggest`)
- 19-05: Enhanced `EmptyState` with tag suggestions + Sage CTA + "clear all"

**Wave 4 (human verify checkpoint):**
- 19-06: Human verify — all 5 features tested

### Actually: Waves can be simplified

19-02 (URL sync) and 19-03 (email gate) are truly independent of each other. 19-04 (suggestions) depends only on 19-01 (backend endpoint). 19-05 (EmptyState) has no backend dependency. Simplest wave grouping:

| Wave | Plans | Dependencies |
|------|-------|-------------|
| 1 | 19-01 | Backend suggest endpoint |
| 2 | 19-02, 19-03, 19-05 | URL sync + email gate + EmptyState (all independent) |
| 3 | 19-04 | Depends on 19-01 (suggest endpoint) |
| 4 (CP) | 19-06 | Human verify |

---

## 6. Key Technical Pitfalls

### Email Gate
- **ExpertCard `h-[180px] overflow-hidden` breaks modal:** Never render modal inside ExpertCard. Use `pendingProfileUrl` state in `MarketplacePage` instead.
- **Window popup blocker:** `window.open()` called from async context (after `await submitEmail`) may be blocked. Use `window.open()` synchronously in the click handler with a token, then re-trigger after unlock. Or store `pendingProfileUrl` and open from the `useEffect` that fires when `isUnlocked` becomes `true`.
- **`useEmailGate` STORAGE_KEY collision:** Reuse the EXACT SAME key `'tcs_gate_email'` from v1.0 so existing users are already unlocked.

### URL Sync
- **History spam with `setSearchParams`:** Always use `{ replace: true }` — every filter change should replace the current history entry, not push a new one.
- **Conflict between localStorage and URL:** On mount, URL params WIN over localStorage-rehydrated state. Apply URL params in a `useEffect` that runs once — this overwrites Zustand's rehydrated state.
- **Empty param cleanup:** Don't encode default values in URL. If `rateMin === 0`, omit `rate_min`. If `query === ''`, omit `q`. Keeps URLs clean for sharing.

### Suggestions Dropdown
- **FTS5 `*` not in `_safe_fts_query`:** Create a separate `_safe_prefix_query()` function that preserves (or appends) `*` for prefix matching. Don't modify `_safe_fts_query` — it's used in the main explore pipeline.
- **Window popup blocker:** Same as email gate — handle in onClick not in async callback.
- **Blur/click race:** Dropdown hides on blur, but click fires before blur. Use 150ms delay on blur before hiding dropdown.

### EmptyState Tag Suggestions
- **`setTags([tag])` replaces all tags:** Per CONTEXT.md this is correct behavior — suggestions are redirects not additions.
- **Don't import TOP_TAGS from TagMultiSelect:** Extract TOP_TAGS to a shared constant file (e.g., `frontend/src/constants/tags.ts`) so both `TagMultiSelect` and `EmptyState` can import it without circular deps.

---

## 7. Files to Modify/Create

### Backend
- `app/routers/suggest.py` — new, `GET /api/suggest` endpoint
- `app/main.py` — register suggest.router

### Frontend (new)
- `frontend/src/hooks/useUrlSync.ts` — URL ↔ Zustand bidirectional sync
- `frontend/src/constants/tags.ts` — extracted TOP_TAGS constant
- `frontend/src/components/marketplace/ProfileGateModal.tsx` — email gate modal overlay

### Frontend (modified)
- `frontend/src/components/marketplace/ExpertCard.tsx` — add "View Full Profile" button + `onViewProfile` prop
- `frontend/src/components/marketplace/ExpertGrid.tsx` — pass `onViewProfile` callback through
- `frontend/src/components/marketplace/EmptyState.tsx` — add tag suggestions + Sage CTA + clear all
- `frontend/src/components/sidebar/SearchInput.tsx` — add suggestions dropdown
- `frontend/src/components/sidebar/FilterSidebar.tsx` — add "Copy link" button
- `frontend/src/pages/MarketplacePage.tsx` — wire `pendingProfileUrl` modal state + `useUrlSync`

---

## RESEARCH COMPLETE
