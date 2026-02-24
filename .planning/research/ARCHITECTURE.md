# Architecture Patterns: v3.0 Netflix Browse & Agentic Navigation

**Project:** Tinrate AI Concierge — v3.0 milestone
**Researched:** 2026-02-24
**Confidence:** HIGH — all findings from direct codebase inspection of v2.3 source
**Scope:** Integration points for new features only. Existing v2.3 system is ground truth — only deltas documented.

---

## Context: v2.3 Ground Truth (verified by file inspection)

```
ROUTES  (frontend/src/main.tsx)
  /             -> Navigate to /marketplace (CURRENT)
  /marketplace  -> MarketplacePage          (CURRENT — becomes /explore)
  /chat         -> App (legacy)
  /admin/*      -> AdminApp (protected)

FILE PATHS (corrected from prompt context)
  Marketplace page:   frontend/src/pages/MarketplacePage.tsx
  Sage hook:          frontend/src/hooks/useSage.ts          (NOT in marketplace/hooks/)
  SageFAB:            frontend/src/components/pilot/SageFAB.tsx
  SagePanel:          frontend/src/components/pilot/SagePanel.tsx
  Store entry:        frontend/src/store/index.ts
  ExpertCard (grid):  frontend/src/components/marketplace/ExpertCard.tsx
  ExploreGrid:        frontend/src/components/marketplace/ExpertGrid.tsx

ZUSTAND (useExplorerStore — frontend/src/store/index.ts)
  filterSlice:    query, rateMin, rateMax, tags, sortBy, sortOrder  — persisted to localStorage
  resultsSlice:   experts[], total, cursor, loading, error,
                  isFetchingMore, sageMode                          — ephemeral (not persisted)
  pilotSlice:     messages[], isOpen, isStreaming, sessionId        — ephemeral (not persisted)
  persist key:    'explorer-filters' (localStorage)
  partialize:     query, rateMin, rateMax, tags, sortBy, sortOrder (never actions, results, or pilot)

Expert TypeScript interface (frontend/src/store/resultsSlice.ts — CURRENT fields)
  username, first_name, last_name, job_title, company,
  hourly_rate, currency, profile_url,
  tags: string[], findability_score: number | null, match_reason: string | null
  NOTE: NO photo_url, NO category, NO faiss/bm25/final_score fields in TS type yet

Expert Python model (app/models.py — CURRENT fields)
  id, username, email, first_name, last_name, job_title, company, bio,
  hourly_rate, currency, profile_url, profile_url_utm,
  category, tags, findability_score, created_at
  NOTE: NO photo_url column yet

ExpertCard Pydantic schema (app/services/explorer.py — CURRENT fields)
  username, first_name, last_name, job_title, company, hourly_rate, currency,
  profile_url, tags, findability_score, category,
  faiss_score, bm25_score, final_score, match_reason
  NOTE: category, faiss_score, bm25_score, final_score exist in Python but NOT in TS Expert type

SAGE DATA FLOW (current)
  useSage.handleSend() -> POST /api/pilot
  -> { filters, message, search_performed, total, experts }
  search_experts path: store.setResults(experts, total, null) + store.setSageMode(true)
  apply_filters path:  validateAndApplyFilters(filters) (store mutation -> useExplore refetch)
  Navigation:          NONE — useSage has no useLocation/useNavigate
  Location:            NO React Router imports in useSage.ts currently

SAGE CONVERSATION RESET RISK (CRITICAL — found by code inspection)
  MarketplacePage.tsx line 34-36:
    const resetPilot = useExplorerStore((s) => s.resetPilot)
    useEffect(() => { resetPilot() }, [resetPilot])
  This useEffect has [resetPilot] as dep — resetPilot is a Zustand action (stable ref).
  It runs ONCE on mount. This CLEARS all messages when MarketplacePage mounts.
  For cross-page conversation preservation, this resetPilot() call must be removed or gated.

SAGE GUARD in useExplore.ts
  Lines 31-41: if (sageMode) { abort any in-flight fetch; return }
  This guard is intact and must remain — it is what prevents useExplore from overwriting
  Sage-injected results when MarketplacePage mounts with pendingSageResults + sageMode:true.

BACKEND ROUTES (app/main.py — registered routers)
  /api/health, /api/chat, /api/email, /api/newsletter/*,
  /api/feedback, /api/events, /api/admin/*, /api/explore,
  /api/pilot, /api/suggest
  No /api/browse or /api/photos/* yet.
```

---

## Question 1: Route Reorganization

### Current State

```typescript
// frontend/src/main.tsx (current)
{ path: '/',           element: <Navigate to="/marketplace" replace /> },
{ path: '/marketplace', element: <MarketplacePage /> },
{ path: '/chat',        element: <App /> },
{ path: '/admin/login', element: <LoginPage /> },
{ path: '/admin',       element: <RequireAuth />, children: [...] },
```

### Target State

```typescript
// frontend/src/main.tsx (v3.0)
// Root layout: wraps BrowsePage + MarketplacePage with AnimatedOutlet for aurora transition.
// Admin routes are NOT children of the layout — admin has its own styling, no aurora background.
{
  path: '/',
  element: <RootLayout />,      // NEW: renders <AnimatedOutlet /> (see Feature 6)
  children: [
    { index: true, element: <BrowsePage /> },        // NEW page at /
    { path: 'explore', element: <MarketplacePage /> }, // MOVED from /marketplace
  ],
},
{ path: '/marketplace', element: <Navigate to="/explore" replace /> }, // backward compat
{ path: '/chat',        element: <App /> },          // unchanged
{ path: '/admin/login', element: <LoginPage /> },    // unchanged
{ path: '/admin',       element: <RequireAuth />, children: [...] }, // unchanged
```

### Modified File
- `frontend/src/main.tsx` — add BrowsePage import, add RootLayout/AnimatedOutlet, restructure two routes

### What Stays the Same
- Admin routes: unchanged, outside AnimatedOutlet
- `/chat` route: unchanged
- All `/admin/*` child routes: unchanged

---

## Question 2: BrowsePage Component Tree

### Component Hierarchy

```
BrowsePage (NEW: frontend/src/pages/BrowsePage.tsx)
  AuroraBackground (EXISTING: reused as-is)
    BrowseHeader (NEW: frontend/src/components/browse/BrowseHeader.tsx)
    BillboardHero (NEW: frontend/src/components/browse/BillboardHero.tsx)
    CategoryRows (NEW: frontend/src/components/browse/CategoryRows.tsx)
      CategoryRow x4 (NEW: frontend/src/components/browse/CategoryRow.tsx)
        BrowseExpertCard x12 (NEW: frontend/src/components/browse/BrowseExpertCard.tsx)
    SageFAB (EXISTING: frontend/src/components/pilot/SageFAB.tsx — reused as-is)
    SagePanel (EXISTING: frontend/src/components/pilot/SagePanel.tsx — reused as-is)
```

### Component Specifications

#### BrowsePage (frontend/src/pages/BrowsePage.tsx) — NEW
```typescript
// Props: none (page-level component)
// Imports:
//   useBrowse (new hook)
//   AuroraBackground, BrowseHeader, BillboardHero, CategoryRows (new components)
//   SageFAB, SagePanel (existing pilot components — no changes needed)
//   AnimatePresence (motion/react — same pattern as MarketplacePage)
//   useExplorerStore (for isOpen, setOpen — same Sage panel pattern)
// Responsibilities:
//   - call useBrowse() to fetch /api/browse
//   - render loading skeleton or full page content
//   - render SageFAB/SagePanel (same AnimatePresence pattern as MarketplacePage)
//   - manage newsletter gate (same handleViewProfile/handleSubscribe pattern)
```

#### BrowseHeader (frontend/src/components/browse/BrowseHeader.tsx) — NEW
```typescript
// Props: none
// Imports: Link (react-router-dom)
// Renders:
//   - Tinrate logo (left)
//   - "Explore All Experts" Link to="/explore" (right) — glassmorphic button
//   - NO search bar (Browse is visual discovery, not search-driven)
// Styling: glassmorphic, similar to existing Header but without search/filter controls
```

#### BillboardHero (frontend/src/components/browse/BillboardHero.tsx) — NEW
```typescript
// Props: { expert: BrowseFeaturedExpert }  (from /api/browse response)
// Imports: expertPhotoUrl (new utility), useNavigate (react-router-dom)
// Renders:
//   - Full-width ~60vh height container
//   - Blurred expert photo as CSS background-image (background-size: cover)
//   - Glassmorphic panel (left-aligned): name, job_title, company, hourly_rate
//   - Holographic badge: findability_score >= 88 → "Top Expert" | >= 75 → "Highly Rated"
//   - "Start Discovery" button: navigate('/explore', { state: { from: 'browse' } })
//   - Initials fallback (no external dependencies — pure CSS)
```

#### CategoryRows (frontend/src/components/browse/CategoryRows.tsx) — NEW
```typescript
// Props: { rows: BrowseRow[] }
// Imports: CategoryRow
// Renders: maps rows to CategoryRow instances
// Simple pass-through container — no state, no logic
```

#### CategoryRow (frontend/src/components/browse/CategoryRow.tsx) — NEW
```typescript
// Props: { label: string, experts: BrowseFeaturedExpert[], onViewProfile: (url: string) => void }
// Imports: BrowseExpertCard, useRef (React)
// Renders:
//   - Row label (h2)
//   - Horizontal scroll container: flex + overflow-x-auto + scroll-snap-x mandatory
//   - Prev/next scroll buttons: useRef + scrollBy({left: ±240, behavior: 'smooth'})
//   - BrowseExpertCard x N (max 12 per row from API)
// No VirtuosoGrid — max 12 items, CSS scroll is sufficient
```

#### BrowseExpertCard (frontend/src/components/browse/BrowseExpertCard.tsx) — NEW
```typescript
// Props: { expert: BrowseFeaturedExpert, onViewProfile: (url: string) => void }
// Imports: expertPhotoUrl, trackEvent
// Size: w-[200px] h-[280px] — taller than ExpertGrid cards (photo-first layout)
// Layout:
//   - Photo zone (h-[160px]): <img src={expertPhotoUrl(username)} onError={showInitials} />
//   - Overlay gradient (bottom 40%): linear-gradient(transparent, rgba(0,0,0,0.7))
//   - Name + rate: absolute bottom-2 left-2, text-white
//   - Hover reveal: tag pills animate up (CSS transition), "View Profile" CTA
// Interaction:
//   - click → onViewProfile(expert.profile_url)
//   - trackEvent('card_click', { expert_id: username, context: 'browse', rank: index })
// Photo fallback:
//   img onError → e.currentTarget.style.display = 'none' + CSS sibling shows initials div
```

### BrowseFeaturedExpert Type
```typescript
// frontend/src/types/browse.ts — NEW (or co-locate in useBrowse.ts)
export interface BrowseFeaturedExpert {
  username: string
  first_name: string
  last_name: string
  job_title: string
  company: string
  hourly_rate: number
  currency: string
  profile_url: string
  tags: string[]
  findability_score: number | null
  bio?: string  // only present on featured expert, not row cards
}

export interface BrowseRow {
  id: string         // 'trending' | 'recently_joined' | 'top_findability' | 'highest_rate'
  label: string
  experts: BrowseFeaturedExpert[]
}

export interface BrowseResponse {
  featured: BrowseFeaturedExpert | null
  rows: BrowseRow[]
}
```

---

## Question 3: New Backend Endpoint GET /api/browse

### Why a Dedicated Endpoint (not 4x /api/explore calls)

`/api/explore` is designed for paginated filtered search with FAISS + FTS5 pipeline. For Browse we need:
- Named category rows with different sort criteria
- All rows in one network round-trip (4 parallel fetches would be a race condition risk)
- No text query embedding (no Gemini call, no FAISS, pure DB queries)
- Cold-start guard (trending falls back gracefully when user_events is empty)

### New Files

```
app/routers/browse.py          — FastAPI router, GET /api/browse
app/services/browse_service.py — assembles rows from DB queries
```

### API Contract

```python
# GET /api/browse
# Response body:
{
  "featured": {
    "username": "...", "first_name": "...", "last_name": "...",
    "job_title": "...", "company": "...", "hourly_rate": 150.0,
    "currency": "EUR", "profile_url": "...", "tags": ["..."],
    "findability_score": 92.0, "bio": "...",
  } | null,
  "rows": [
    { "id": "trending",         "label": "Trending This Week",  "experts": [...] },
    { "id": "recently_joined",  "label": "Recently Joined",     "experts": [...] },
    { "id": "top_findability",  "label": "Top Rated Experts",   "experts": [...] },
    { "id": "highest_rate",     "label": "Premium Experts",     "experts": [...] },
  ]
}
# Max 12 experts per row. featured expert bio field included; row experts bio omitted.
```

### Row Data Sources (all use existing Expert + UserEvent models — no new tables)

| Row | Query | Cold-Start Fallback |
|-----|-------|---------------------|
| `trending` | JOIN user_events WHERE event_type='card_click', GROUP BY expert_id, ORDER BY count DESC, LIMIT 12 | Falls back to top_findability row if user_events is empty |
| `recently_joined` | SELECT FROM experts ORDER BY created_at DESC LIMIT 12 | None needed — always has data |
| `top_findability` | SELECT FROM experts WHERE findability_score IS NOT NULL ORDER BY findability_score DESC LIMIT 12 | None needed |
| `highest_rate` | SELECT FROM experts ORDER BY hourly_rate DESC LIMIT 12 | None needed |
| `featured` | Index 0 of top_findability row + bio field | null if no experts exist |

### Backend Implementation

```python
# app/routers/browse.py — NEW
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.browse_service import build_browse_response, BrowseResponseSchema

router = APIRouter()

@router.get("/api/browse", response_model=BrowseResponseSchema)
async def browse(db: Session = Depends(get_db)):
    import asyncio
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: build_browse_response(db))
```

```python
# app/services/browse_service.py — NEW
# build_browse_response(db) executes 4 SQLAlchemy queries
# Returns BrowseResponseSchema Pydantic model
# Trending query uses:
#   SELECT json_extract(payload, '$.expert_id') as expert_id, COUNT(*) as cnt
#   FROM user_events WHERE event_type = 'card_click'
#   GROUP BY expert_id ORDER BY cnt DESC LIMIT 12
# Trending cold-start: if no card_click events, fall back to top_findability query
```

### Registration in app/main.py

```python
# app/main.py — MODIFIED (additive only)
from app.routers import browse  # add to import line
app.include_router(browse.router)  # add after suggest.router
```

---

## Question 4: Photo Serving

### Data Situation

Current `Expert` SQLite model has NO `photo_url` column. Photos come from a new CSV. Two decisions required: (a) where to store photo URLs, (b) how to serve photos to the frontend.

### Recommended Approach: Proxy Endpoint

Why proxy (`GET /api/photos/{username}`) over direct `<img src={externalUrl}>`:
- Tinrate photo URLs may have CORS restrictions on `<img>` tags from a different origin
- Proxy adds `Cache-Control: public, max-age=86400` — 48 Browse card photos cached 24h on first load
- If photo storage moves (S3, CDN), only backend proxy changes — frontend unchanged
- One stable URL pattern (`/api/photos/{username}`) regardless of where photos actually live

### Backend Changes

#### 1. Expert model: add photo_url column (app/models.py — MODIFIED)
```python
class Expert(Base):
    # ... existing fields ...
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Add AFTER findability_score, BEFORE created_at
```

#### 2. Migration in lifespan (app/main.py — MODIFIED)
Add to the Phase 8 column migration block:
```python
"ALTER TABLE experts ADD COLUMN photo_url TEXT",
```
Safe: SQLite OperationalError if column exists → caught and ignored (existing pattern, lines 209-218).

#### 3. Photo proxy endpoint (app/routers/photos.py — NEW)
```python
import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Expert

router = APIRouter()

@router.get("/api/photos/{username}")
async def get_photo(username: str, db: Session = Depends(get_db)):
    """
    Proxy expert profile photo by username.
    Returns photo bytes with Content-Type from upstream.
    404 when expert not found or photo_url is null/empty.
    Cache-Control: public, max-age=86400 (24-hour browser cache).
    """
    expert = db.query(Expert).filter(Expert.username == username).first()
    if not expert or not expert.photo_url:
        raise HTTPException(status_code=404, detail="No photo")
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(expert.photo_url, follow_redirects=True)
        if resp.status_code != 200:
            raise HTTPException(status_code=404, detail="Photo unavailable")
    content_type = resp.headers.get("content-type", "image/jpeg")
    return Response(
        content=resp.content,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )
```
Verify `httpx` is in `requirements.txt` — it is a FastAPI transitive dep but must be declared explicitly.

#### 4. Photo ingest admin endpoint (app/routers/admin.py — MODIFIED)
```python
# New endpoint: POST /api/admin/experts/photos
# Accepts multipart CSV upload: columns username, photo_url
# Bulk UPDATE experts SET photo_url = ? WHERE username = ?
# Returns { updated: N, not_found: M }
# Admin-only (requires X-Admin-Key header, uses _require_admin dependency)
```
Separate from `_seed_experts_from_csv()` — seed runs at every startup and must stay atomic.

#### 5. Register new router (app/main.py — MODIFIED)
```python
from app.routers import photos  # add to import
app.include_router(photos.router)  # add alongside browse
```

### Frontend Changes

#### Photo URL utility (frontend/src/constants/photos.ts — NEW)
```typescript
const API_BASE = import.meta.env.VITE_API_URL ?? ''

export function expertPhotoUrl(username: string): string {
  return `${API_BASE}/api/photos/${username}`
}
```

#### Expert TypeScript interface (frontend/src/store/resultsSlice.ts — MODIFIED)
```typescript
export interface Expert {
  // ... existing fields ...
  photo_url: string | null  // ADD — backwards-compatible optional (API returns null when absent)
}
```

#### ExpertCard Pydantic schema (app/services/explorer.py — MODIFIED)
```python
class ExpertCard(BaseModel):
    # ... existing fields ...
    photo_url: str | None = None  # ADD — optional, defaults None
```
And populate in `_build_card()`:
```python
return ExpertCard(
    # ... existing fields ...
    photo_url=expert.photo_url,  # ADD
)
```

---

## Question 5: Cross-Page Sage Navigation

### Problem

`useSage.ts` currently has no routing awareness. On BrowsePage, `useExplore` is NOT mounted — calling `store.setResults()` writes to the store but there is no grid to render it. Users also need to navigate to `/explore` to see the results.

### Critical Complication: resetPilot on MarketplacePage Mount

`MarketplacePage.tsx` lines 33-36 call `resetPilot()` on every mount:
```typescript
const resetPilot = useExplorerStore((s) => s.resetPilot)
useEffect(() => { resetPilot() }, [resetPilot])
```
`resetPilot` clears `messages: [], isOpen: false, isStreaming: false, sessionId: null`.
This means Browse-to-Explore navigation currently DESTROYS the Sage conversation history.
This `resetPilot()` call must be removed or gated for conversation preservation to work.

### Solution: navigationSlice + useSage modification + resetPilot gate

#### Step 1: New navigationSlice (frontend/src/store/navigationSlice.ts — NEW)

```typescript
import type { StateCreator } from 'zustand'
import type { ExplorerStore } from './index'
import type { Expert } from './resultsSlice'

export interface PendingSageResults {
  experts: Expert[]
  total: number
  message: string
}

export interface NavigationSlice {
  pendingSageResults: PendingSageResults | null
  setPendingSageResults: (r: PendingSageResults) => void
  clearPendingSageResults: () => void
}

export const createNavigationSlice: StateCreator<
  ExplorerStore,
  [['zustand/persist', unknown]],
  [],
  NavigationSlice
> = (set) => ({
  pendingSageResults: null,
  setPendingSageResults: (r) => set({ pendingSageResults: r }),
  clearPendingSageResults: () => set({ pendingSageResults: null }),
})
```

#### Step 2: Add slice to store (frontend/src/store/index.ts — MODIFIED)

```typescript
import { createNavigationSlice } from './navigationSlice'
import type { NavigationSlice } from './navigationSlice'

export type ExplorerStore = FilterSlice & ResultsSlice & PilotSlice & NavigationSlice

// In combined store:
(...a) => ({
  ...createFilterSlice(...a),
  ...createResultsSlice(...a),
  ...createPilotSlice(...a),
  ...createNavigationSlice(...a),  // ADD
})

// partialize: DO NOT add pendingSageResults — must not survive page refresh
```

#### Step 3: Modify useSage.ts (frontend/src/hooks/useSage.ts — MODIFIED)

```typescript
// ADD these imports at top of file:
import { useLocation, useNavigate } from 'react-router-dom'

// ADD inside useSage():
const location = useLocation()
const navigate = useNavigate()
const isOnBrowsePage = location.pathname === '/'

// MODIFY the search_performed branch inside handleSend:
if (data.search_performed === true) {
  const store = useExplorerStore.getState()
  const experts = data.experts ?? []
  const total = data.total ?? 0

  if (isOnBrowsePage) {
    // NAVIGATE mode: write pending results, then navigate to Explorer
    store.setPendingSageResults({ experts, total, message: data.message })
    navigate('/explore')
    // Do NOT call store.setResults() here — MarketplacePage will apply on mount
  } else {
    // DIRECT mode: existing v2.3 behavior — inject into grid immediately
    store.setLoading(false)
    store.setResults(experts, total, null)
    store.setSageMode(true)
  }
}

// ADD: apply_filters from Browse also navigates to Explorer
// (filterSlice writes happen immediately; useExplore will refetch when page mounts)
if (!data.search_performed && data.filters && typeof data.filters === 'object' && isOnBrowsePage) {
  validateAndApplyFilters(data.filters as Record<string, unknown>)
  navigate('/explore')
}

// Add isOnBrowsePage to useCallback dep array:
// [isStreaming, addMessage, setStreaming, triggerSpin, isOnBrowsePage, navigate]
```

#### Step 4: Modify MarketplacePage.tsx (frontend/src/pages/MarketplacePage.tsx — MODIFIED)

```typescript
// ADD import:
import { useLocation } from 'react-router-dom'

// ADD selectors:
const pendingSageResults = useExplorerStore((s) => s.pendingSageResults)
const clearPendingSageResults = useExplorerStore((s) => s.clearPendingSageResults)
const location = useLocation()

// REPLACE the current resetPilot useEffect with this gated version:
// OLD (remove this):
//   useEffect(() => { resetPilot() }, [resetPilot])
//
// NEW: only reset pilot when NOT arriving from Browse with pending results
useEffect(() => {
  if (pendingSageResults) return  // preserve Browse conversation history
  resetPilot()
}, []) // intentional empty dep — runs once on mount only

// ADD: consume pending Sage results on mount (BEFORE resetPilot effect — order matters)
useEffect(() => {
  if (!pendingSageResults) return
  const store = useExplorerStore.getState()  // snapshot pattern — async-safe
  store.setLoading(false)
  store.setResults(pendingSageResults.experts, pendingSageResults.total, null)
  store.setSageMode(true)
  clearPendingSageResults()
}, [])  // intentional empty dep — runs once on mount only

// ADD: "Continue Browsing" breadcrumb based on navigation state
const { state: navState } = useLocation()
```

### Sage Conversation History: How It Works

`pilotSlice.messages` lives in in-memory Zustand (not persisted to localStorage). The store instance is a module-level singleton — it survives SPA navigation. When BrowsePage unmounts and MarketplacePage mounts, `messages[]` is intact. The gate on `resetPilot()` (Step 4) prevents it from being wiped. The SagePanel on `/explore` shows the full Browse conversation. No additional work required.

---

## Question 6: Aurora Page Transition

### Approach: AnimatedOutlet with location-keyed PageTransition

The aurora canvas (`AuroraBackground`) is `position: fixed` — it persists across route changes without re-animating. Only page content div needs to animate.

#### PageTransition component (frontend/src/components/PageTransition.tsx — NEW)
```typescript
import { motion } from 'motion/react'

interface PageTransitionProps {
  children: React.ReactNode
}

export function PageTransition({ children }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, filter: 'blur(8px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(8px)' }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      style={{ minHeight: '100dvh' }}
    >
      {children}
    </motion.div>
  )
}
```

#### AnimatedOutlet (frontend/src/components/AnimatedOutlet.tsx — NEW)
```typescript
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'motion/react'
import { PageTransition } from './PageTransition'

export function AnimatedOutlet() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <PageTransition key={location.pathname}>
        <Outlet />
      </PageTransition>
    </AnimatePresence>
  )
}
```

#### RootLayout (frontend/src/components/RootLayout.tsx — NEW, or inline in main.tsx)
```typescript
// Thin wrapper that renders AnimatedOutlet
// Admin routes are NOT children of RootLayout — admin has no aurora background
import { AnimatedOutlet } from './AnimatedOutlet'

export function RootLayout() {
  return <AnimatedOutlet />
}
```

#### Route structure in main.tsx (for AnimatedOutlet to work)
```typescript
{
  path: '/',
  element: <RootLayout />,
  children: [
    { index: true, element: <BrowsePage /> },
    { path: 'explore', element: <MarketplacePage /> },
  ],
},
```
`AnimatePresence mode="wait"` ensures exit animation completes before next route mounts — prevents both pages being visible simultaneously.

### AuroraBackground Note

`BrowsePage` and `MarketplacePage` both render `<AuroraBackground>` internally. When using the AnimatedOutlet pattern, each page's `AuroraBackground` mounts/unmounts with the route. This is acceptable: the PageTransition blur/fade wraps the entire page including its AuroraBackground, so the transition is seamless. If flicker is observed, hoist AuroraBackground to RootLayout and remove it from individual pages.

---

## Question 7: "Continue Browsing" Breadcrumb

### Implementation

BrowsePage navigates to `/explore` with location state:
```typescript
// In BillboardHero.tsx "Start Discovery" button:
navigate('/explore', { state: { from: 'browse' } })

// In useSage.ts (navigate mode):
navigate('/explore')
// Note: Sage navigation does NOT pass state: { from: 'browse' } here — the SagePanel
// is open and visible on Explorer, so user has contextual awareness. The breadcrumb
// is for the BillboardHero CTA path only (user clicked "Start Discovery" without Sage).
// Optionally, Sage navigation can also pass { state: { from: 'browse' } } — design call.
```

In `MarketplacePage.tsx`:
```typescript
import { useLocation, Link } from 'react-router-dom'
const { state: navState } = useLocation()

// Render above FilterChips, in the main content area top bar:
{navState?.from === 'browse' && (
  <div className="px-4 py-2 text-sm">
    <Link
      to="/"
      className="text-brand-purple hover:text-purple-700 flex items-center gap-1"
    >
      <ChevronLeft size={14} />
      Back to Browse
    </Link>
  </div>
)}
```

Location: rendered between `<FilterChips />` and the results area `<div>`, visible on desktop and mobile (no conditional `md:hidden`). `navState?.from` is only set when arriving from BrowsePage — the breadcrumb disappears if user refreshes or navigates directly to `/explore`.

---

## Question 8: Shared Zustand State — What's New vs Modified

### Summary of Zustand Changes

| Slice | Status | Changes |
|-------|--------|---------|
| `filterSlice` | UNMODIFIED | No changes — filter state is already shared and works across pages |
| `resultsSlice` | MODIFIED | Add `photo_url: string \| null` to `Expert` interface |
| `pilotSlice` | MODIFIED | Remove or gate `resetPilot()` call in MarketplacePage (not slice change — page change) |
| `navigationSlice` | NEW | `pendingSageResults`, `setPendingSageResults`, `clearPendingSageResults` |
| `nltrStore` | UNMODIFIED | Newsletter gate logic unchanged |

### No browseSlice Needed

Browse page data (`featured`, `rows`) is local hook state in `useBrowse` — it does not need to be in the global Zustand store. The global store's job is cross-page shared state; Browse data does not need to survive navigation. `useBrowse` is a simple `useState` + `useEffect` fetch hook.

### persist partialize (store/index.ts)

The `partialize` object must remain unchanged: `{ query, rateMin, rateMax, tags, sortBy, sortOrder }`. Specifically:
- Do NOT add `pendingSageResults` — pending results must not survive page refresh (ephemeral cross-page handoff)
- Do NOT add `messages` — conversation history is session-only
- Do NOT add any browse data — all ephemeral

---

## Component Inventory: New vs Modified

### New Files

| File | Type | Key Imports | Depends On |
|------|------|-------------|------------|
| `frontend/src/pages/BrowsePage.tsx` | Page | useBrowse, AuroraBackground, SageFAB, SagePanel | useBrowse, all browse components |
| `frontend/src/components/browse/BrowseHeader.tsx` | Component | Link | react-router-dom |
| `frontend/src/components/browse/BillboardHero.tsx` | Component | useNavigate, expertPhotoUrl | react-router-dom, photos util |
| `frontend/src/components/browse/CategoryRows.tsx` | Component | CategoryRow | CategoryRow |
| `frontend/src/components/browse/CategoryRow.tsx` | Component | BrowseExpertCard, useRef | BrowseExpertCard |
| `frontend/src/components/browse/BrowseExpertCard.tsx` | Component | expertPhotoUrl, trackEvent | photos util, tracking |
| `frontend/src/components/PageTransition.tsx` | Component | motion | motion/react |
| `frontend/src/components/AnimatedOutlet.tsx` | Component | Outlet, useLocation, AnimatePresence, PageTransition | react-router-dom, motion/react |
| `frontend/src/components/RootLayout.tsx` | Component | AnimatedOutlet | AnimatedOutlet |
| `frontend/src/hooks/useBrowse.ts` | Hook | BrowseResponse type | VITE_API_URL, BrowseResponse |
| `frontend/src/store/navigationSlice.ts` | Zustand slice | StateCreator, ExplorerStore, Expert | store/index |
| `frontend/src/constants/photos.ts` | Utility | — | VITE_API_URL env |
| `frontend/src/types/browse.ts` | Types | — | — |
| `app/routers/browse.py` | Backend router | browse_service, FastAPI | browse_service |
| `app/routers/photos.py` | Backend router | Expert model, httpx | models, database |
| `app/services/browse_service.py` | Backend service | Expert, UserEvent, Session | models |

### Modified Files

| File | What Changes | Risk |
|------|-------------|------|
| `frontend/src/main.tsx` | Add BrowsePage, RootLayout imports; restructure route table (BrowsePage at `/`, MarketplacePage at `/explore`, AnimatedOutlet layout) | LOW — additive restructure |
| `frontend/src/hooks/useSage.ts` | Add `useLocation`, `useNavigate`; add `isOnBrowsePage` branch; add `setPendingSageResults` + `navigate` call; add isOnBrowsePage to useCallback deps | MEDIUM — modifies critical hook; test both Browse and Explorer paths |
| `frontend/src/pages/MarketplacePage.tsx` | Replace `resetPilot` useEffect with gated version; add `pendingSageResults` consumer useEffect; add breadcrumb via `useLocation().state` | MEDIUM — resetPilot gate is subtle; test conversation preservation |
| `frontend/src/store/index.ts` | Add `NavigationSlice` to `ExplorerStore` type; spread `createNavigationSlice`; keep `partialize` unchanged | LOW — additive slice, no persist change |
| `frontend/src/store/resultsSlice.ts` | Add `photo_url: string \| null` to `Expert` interface | LOW — backwards-compatible; existing components ignore unknown fields |
| `app/main.py` | Add `browse` and `photos` router imports + `app.include_router()` calls; add `"ALTER TABLE experts ADD COLUMN photo_url TEXT"` to Phase 8 migration block | LOW — additive; migration is idempotent |
| `app/models.py` | Add `photo_url: Mapped[str \| None]` to `Expert` class | LOW — nullable, no impact on existing rows |
| `app/services/explorer.py` | Add `photo_url: str \| None = None` to `ExpertCard` Pydantic model; populate in `_build_card()` | LOW — optional field, default None |
| `app/routers/admin.py` | Add `POST /api/admin/experts/photos` endpoint | LOW — new admin-only endpoint, no existing behavior changes |

---

## Data Flow Diagrams

### Browse Page Load

```
USER navigates to /  (BrowsePage mounts)
  |
  useBrowse(): GET /api/browse
    |
    browse_service.build_browse_response(db):
      trending:  user_events card_click GROUP BY → cold-start → top_findability
      recently_joined: experts ORDER BY created_at DESC LIMIT 12
      top_findability: experts ORDER BY findability_score DESC LIMIT 12
      highest_rate: experts ORDER BY hourly_rate DESC LIMIT 12
    |
    Response: { featured: ExpertCard+bio, rows: [4 BrowseRow] }
      |
      BillboardHero → <img src="/api/photos/{username}">
        |
        GET /api/photos/{username}
          DB: SELECT photo_url FROM experts WHERE username = ?
          photo_url = null → 404 → img.onError → CSS initials fallback
          photo_url = "https://..." → httpx.get(url, timeout=10s)
          → Response(bytes, Cache-Control: public, max-age=86400)
          → Browser caches 24h
      |
      CategoryRows → 4x CategoryRow → 12x BrowseExpertCard each
        Same /api/photos/{username} pattern per card
        Browser cache hit after BillboardHero loaded first photo (same expert)
```

### Browse → Explorer Sage Navigation

```
USER on BrowsePage (/)
  types "find me a Shopify expert" in SagePanel
    |
    useSage.handleSend(text)
      location.pathname === '/' → isOnBrowsePage = true
      |
      POST /api/pilot → { search_performed: true, experts: [...12], total: 12, message: "Found 12 Shopify experts..." }
      |
      store.setPendingSageResults({ experts, total, message })
      navigate('/explore')

MarketplacePage mounts (/explore)
  useEffect #1 (pendingSageResults consumer — runs first):
    pendingSageResults != null
    store.setLoading(false)
    store.setResults(experts, total, null)
    store.setSageMode(true)
    clearPendingSageResults()
  useEffect #2 (resetPilot gate — runs second):
    pendingSageResults == null (cleared above)
    → would still skip resetPilot? No — pendingSageResults is already null here.
    SOLUTION: Check pendingSageResults BEFORE clearing, or use a ref.
    SAFER: Use location.state instead of pendingSageResults to gate resetPilot:
      const fromBrowseWithSage = location.state?.sageResults === true
      if (!fromBrowseWithSage) resetPilot()
    OR: Simply remove resetPilot() entirely (it was a Phase 15 pattern; Sage state
      is ephemeral and session-based — resetting on every Explorer visit is aggressive)
  |
  useExplore: sageMode === true → guard fires → no /api/explore fetch
  ExpertGrid renders Sage-injected experts immediately
  SagePanel: pilotSlice.messages[] intact (Browse conversation visible)
  Breadcrumb: only shown when navigate('/explore', { state: { from: 'browse' } }) was used
```

### Apply Filters from Browse (no Sage search, just filter refinement)

```
USER on BrowsePage (/)
  types "show me experts under €100/hour" in SagePanel
    |
    POST /api/pilot → { search_performed: false, filters: { rate_max: 100 }, message: "..." }
    |
    validateAndApplyFilters({ rate_max: 100 }) → store.setRateRange(0, 100)
    navigate('/explore')  (no pendingSageResults — useExplore will fetch on mount)

MarketplacePage mounts (/explore)
  pendingSageResults == null → resetPilot() runs
  useExplore: sageMode === false → filter change triggered → GET /api/explore?rate_max=100
  Grid renders filtered results
  SagePanel messages: cleared by resetPilot (acceptable — filter refinement, not discovery)
```

### resetPilot Problem Resolution

The cleanest solution is to **remove the `resetPilot()` useEffect from MarketplacePage entirely**. Evidence for this:
- `pilotSlice.messages` is ephemeral (not persisted) — resets naturally on browser refresh
- There is no user value in clearing messages when navigating between `/` and `/explore`
- The Phase 15 rationale for `resetPilot()` was to clear stale session state when returning to the page — but with cross-page Sage navigation, this is now harmful
- If session isolation is needed in future, use `resetPilot()` only when sessionId is stale (compare sessionId to server session)

---

## Build Order (Dependency-Aware)

### Group 1: Foundation — build in parallel, no mutual dependencies

1. **Route restructure** (`frontend/src/main.tsx`): BrowsePage stub at `/`, MarketplacePage at `/explore`, `/marketplace` redirect. Enables correct routing for all subsequent work. Stub BrowsePage can be a simple `<div>Browse coming soon</div>`.
2. **navigationSlice** (`frontend/src/store/navigationSlice.ts` + `frontend/src/store/index.ts`): Zero UI impact. Enables cross-page Sage navigation.
3. **Expert.photo_url column** (`app/models.py` + `app/main.py` lifespan ALTER TABLE): Zero impact on existing queries.

### Group 2: Backend Endpoints — depends on Group 1 model changes

4. **GET /api/browse** (`app/routers/browse.py` + `app/services/browse_service.py`): 4 DB queries, structured row response.
5. **GET /api/photos/{username}** (`app/routers/photos.py`): httpx proxy. Add `httpx` to `requirements.txt` explicitly.
6. **ExpertCard.photo_url** (`app/services/explorer.py` + `frontend/src/store/resultsSlice.ts`): Pydantic optional field + TypeScript interface field.
7. **POST /api/admin/experts/photos** (`app/routers/admin.py`): Bulk photo URL ingest. Needs `photo_url` column (Group 1) to exist.

### Group 3: Browse UI Components — depends on Group 2 endpoints

8. **`frontend/src/constants/photos.ts`** and **`frontend/src/types/browse.ts`**: Utility + types — no dependencies, can be done in Group 1.
9. **BrowseExpertCard**: photo display, hover reveal, trackEvent on click.
10. **CategoryRow**: horizontal scroll, prev/next buttons via useRef.
11. **CategoryRows**: composes CategoryRow instances.
12. **BillboardHero**: featured expert, blurred photo background, "Start Discovery" CTA.
13. **BrowseHeader**: logo, "Explore All Experts" link.
14. **useBrowse hook**: single fetch to /api/browse, returns `{ featured, rows, loading, error }`.
15. **BrowsePage**: assembles all browse components, SageFAB, SagePanel, AuroraBackground.

### Group 4: Sage Navigation — depends on Groups 1 and 3 (BrowsePage must exist)

16. **useSage.ts modification**: add useLocation, useNavigate, isOnBrowsePage, navigate + setPendingSageResults.
17. **MarketplacePage.tsx modification**: remove/gate resetPilot, consume pendingSageResults on mount, add breadcrumb.

### Group 5: Aurora Transition — depends on Group 1 route structure only

18. **PageTransition** component: motion.div blur/opacity.
19. **AnimatedOutlet** + **RootLayout**: location-keyed layout wrapper.
20. **main.tsx layout route**: wrap BrowsePage + MarketplacePage with RootLayout/AnimatedOutlet.

---

## Critical Constraints (Carry Forward from v2.3)

**sageMode guard in useExplore must remain intact.**
`useExplore` line 35: `if (sageMode) { abort(); return }`. When MarketplacePage mounts with pending Sage results and calls `setSageMode(true)`, this guard fires and prevents `/api/explore` from overwriting the Sage-injected results. Do not modify this guard.

**`useExplorerStore.getState()` snapshot pattern in async handlers.**
`useSage.handleSend` uses `useExplorerStore.getState()` at line 84. The new `store.setPendingSageResults()` call must also use `useExplorerStore.getState()` (not reactive selectors) inside the async handler. Confirmed pattern is correct.

**`validateAndApplyFilters` uses `useExplorerStore.getState()` snapshot.**
Already correct — `validateAndApplyFilters` at line 21 calls `useExplorerStore.getState()` directly. No stale closure risk.

**useCallback dep array must include navigation state.**
`handleSend` in useSage.ts uses `useCallback` with a dep array. Adding `useLocation` and `useNavigate` introduces `location.pathname` as a dep. Use `isOnBrowsePage` derived value or `location.pathname` in the dep array. Either is correct; `isOnBrowsePage` is cleaner.

**`pilotSlice.messages` is intentionally NOT persisted.**
Cross-page conversation preservation works via in-memory Zustand state. On browser refresh, messages reset — this is by design (per v2.3 key decisions). Do NOT add `messages` or `pendingSageResults` to `partialize`.

**VirtuosoGrid on MarketplacePage is unaffected.**
Browse uses CSS flex/overflow-x-auto with max 12 items per row. VirtuosoGrid on `/explore` is unchanged.

**filterSlice actions exit sageMode.**
When any sidebar filter interaction fires after Sage navigation, `sageMode` resets to false and `useExplore` resumes normal fetching. This is v2.3 behavior — intentional, unchanged.

**CORS headers: no changes needed.**
`GET /api/browse` and `GET /api/photos/{username}` are GET requests — no new CORS headers required. The existing `CORSMiddleware` with `allow_methods=["GET", "POST"]` covers these endpoints.

**httpx dependency.**
`httpx` is used by the photo proxy. FastAPI/Starlette may bring it transitively, but it must be in `requirements.txt` explicitly to avoid version conflicts on Railway.

---

## Scalability Considerations

| Concern | At 530 Experts (now) | At 5K Experts |
|---------|---------------------|---------------|
| Browse API latency | 4 DB queries < 50ms total | Add DB indexes on `findability_score`, `created_at`, `hourly_rate` |
| Photo proxy on Browse load | ~48 concurrent requests (1 per card across 4 rows) | 24h browser cache eliminates repeats; add CDN in front of Railway if needed |
| Trending row computation | Simple COUNT GROUP BY on user_events | Add `ix_user_events_expert_id` index if trending query slows |
| Sage navigation intent | navigate() is instant, store write synchronous | Same — store is module-level singleton |
| AnimatePresence overhead | Two routes max in animation (300ms) | Same — only ever 2 routes in transition |
| BrowsePage card count | Max 12 per row (design cap from API) | Cap stays at 12 — no virtualization ever needed |

---

## Sources

All findings are HIGH confidence — derived from direct inspection of v2.3 source files:
- `frontend/src/main.tsx` (routing)
- `frontend/src/hooks/useSage.ts` (Sage hook — no routing today)
- `frontend/src/hooks/useExplore.ts` (sageMode guard)
- `frontend/src/pages/MarketplacePage.tsx` (resetPilot pattern)
- `frontend/src/store/index.ts`, `resultsSlice.ts`, `pilotSlice.ts` (Zustand structure)
- `frontend/src/components/pilot/SageFAB.tsx` (Sage FAB — no routing)
- `app/models.py` (Expert model — no photo_url today)
- `app/routers/explore.py` (ExploreResponse contract)
- `app/services/explorer.py` (ExpertCard Pydantic schema)
- `app/main.py` (router registration, lifespan migrations)

Supplementary references (MEDIUM confidence):
- React Router v7 `useNavigate` state passing: https://reactrouter.com/api/hooks/useNavigate
- Framer Motion AnimatePresence `mode="wait"`: https://motion.dev/docs/react-animate-presence
- Zustand cross-route state: module-level store survives SPA navigation (confirmed by zustand docs)
