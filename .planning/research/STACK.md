# Stack Research

**Domain:** Expert Marketplace — v3.0 Netflix Browse & Agentic Navigation additions only
**Researched:** 2026-02-24
**Research Mode:** Ecosystem (Subsequent Milestone — stack additions only)
**Confidence:** HIGH for all items below — verified against current package.json, requirements.txt, and official documentation

---

## Scope of This Document

Covers ONLY the stack additions and changes needed for v3.0. The existing production stack is fully validated and must not change:

- **Backend:** FastAPI 0.129.* + SQLAlchemy + SQLite + faiss-cpu 1.13.* + google-genai 1.64.* + tenacity 8.4.* + httpx 0.28.* (already in requirements.txt as dev dep)
- **Frontend:** React 19.2 + Vite 7.3 + Tailwind v3.4 + React Router v7 (react-router-dom 7.13)
- **Animation:** motion (motion/react) v12.34 — AnimatePresence, motion.div, boxShadow glow already in use
- **State:** Zustand v5.0.11 with persist middleware (3 slices: filter, results, pilot)
- **Grid:** react-virtuoso 4.18 for VirtuosoGrid (infinite scroll bento cards — NOT used for Browse rows)
- **Routing:** createBrowserRouter with RouterProvider, current routes: `/marketplace`, `/chat`, `/admin`

Eight specific questions were investigated. Each section below gives a direct answer.

---

## 1. Horizontal Scroll Rows — CSS + Tailwind Only

### Recommendation

**No new package.** Use Tailwind v3 built-in scroll-snap utilities + one tiny Tailwind plugin for scrollbar hiding.

Tailwind v3.4 ships all scroll-snap primitives natively: `snap-x`, `snap-mandatory`, `snap-start`, `snap-center`, `scroll-smooth`. The only gap is hiding the scrollbar (Tailwind has no built-in for this). Use `tailwind-scrollbar-hide` — a single-file plugin with 42k weekly downloads, Tailwind v3 compatible, zero runtime JS.

### Installation

```bash
npm install -D tailwind-scrollbar-hide
```

```js
// tailwind.config.js
import scrollbarHide from 'tailwind-scrollbar-hide'
export default {
  plugins: [scrollbarHide],
}
```

### Usage Pattern (Browse Row)

```tsx
// No react-virtuoso here — small fixed-count rows (12-20 cards max), native scroll is fine
<div className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide scroll-smooth px-6">
  {experts.map(expert => (
    <div key={expert.id} className="snap-start flex-shrink-0 w-64">
      <BrowseExpertCard expert={expert} />
    </div>
  ))}
</div>
```

**Why not react-virtuoso for rows?** react-virtuoso's VirtuosoGrid is designed for large infinite-scroll grids. For 12-20 card horizontal rows, it adds complexity with no benefit. CSS scroll-snap is GPU-accelerated and zero-JS.

**Why not react-snap-carousel?** Adds 3.5 kB for what Tailwind + CSS already handle. No advantage for this use case.

### Confidence: HIGH
Source: [Tailwind CSS scroll-snap-type docs](https://v3.tailwindcss.com/docs/scroll-snap-type), [tailwind-scrollbar-hide npm](https://www.npmjs.com/package/tailwind-scrollbar-hide)

---

## 2. Billboard Hero — No New Package

### Recommendation

**No new package.** Build with existing Tailwind + motion/react. The Billboard Hero is a full-width `div` with a background image URL (or `<img>` with `object-cover`), gradient overlay, and expert metadata overlaid using absolute positioning.

The "algorithmic featured expert" selection is a backend concern (scoring logic), not a frontend library question. Frontend receives a single expert object and renders it.

### Pattern

```tsx
// BillboardHero.tsx
import { motion } from 'motion/react'

interface BillboardHeroProps {
  expert: Expert  // highest-scoring expert from /api/browse/featured
  onExplore: () => void
}

export function BillboardHero({ expert, onExplore }: BillboardHeroProps) {
  return (
    <div className="relative w-full h-[56vh] min-h-[400px] overflow-hidden">
      {/* Large photo */}
      <img
        src={expert.photo_url}
        alt=""
        className="absolute inset-0 w-full h-full object-cover object-top"
        loading="eager"
      />
      {/* Gradient overlay — bottom-up, brand purple tint */}
      <div className="absolute inset-0 bg-gradient-to-t from-[oklch(10%_0.12_279)] via-transparent to-transparent" />
      {/* Text overlay */}
      <motion.div
        className="absolute bottom-8 left-8 max-w-lg"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <h1 className="text-4xl font-bold text-white">{expert.name}</h1>
        <p className="text-white/70 mt-2">{expert.title}</p>
        <button onClick={onExplore} className="mt-4 ...">Explore Experts</button>
      </motion.div>
    </div>
  )
}
```

**Backend endpoint needed:** `GET /api/browse/featured` — returns 1 expert (highest findability_score or curated pick). Uses existing SQLAlchemy + metadata.json. No new backend library.

### Confidence: HIGH
All tools already in stack.

---

## 3. Expert Photo Serving — httpx Backend Proxy

### Recommendation

**No new package.** Use `httpx` — already in `requirements.txt` (line 23: `httpx==0.28.*`) as a dev/test dependency. Promote it to production use for the photo proxy endpoint.

### Decision: Proxy vs. Direct Serve

**Use proxy, not direct URL pass-through to frontend.** Reasons:
1. Photo URLs in the new CSV may be from inconsistent or third-party hosts (LinkedIn CDNs, Cloudinary, etc.) — a proxy normalises them behind your domain.
2. CORS: third-party image hosts may block browser direct requests.
3. Railway environment can cache proxied images in memory (response-level caching with a simple dict or `functools.lru_cache` on URL hash).
4. Fallback: if photo fetch fails, proxy returns a generated initials avatar (SVG) — no broken image icons.

### Backend Pattern

```python
# app/routers/photos.py
import hashlib
import httpx
from fastapi import APIRouter, Response
from fastapi.responses import StreamingResponse

router = APIRouter()
_cache: dict[str, bytes] = {}  # simple in-process cache, ~1 MB per 100 photos

@router.get("/api/photos/{username}")
async def get_photo(username: str) -> Response:
    """
    Proxies the expert's photo from their CSV photo_url.
    Falls back to an SVG initials avatar if fetch fails.
    """
    photo_url = _get_photo_url_for_username(username)  # lookup in metadata
    if not photo_url:
        return _initials_avatar(username)

    cache_key = hashlib.md5(photo_url.encode()).hexdigest()
    if cache_key in _cache:
        return Response(content=_cache[cache_key], media_type="image/jpeg")

    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            r = await client.get(photo_url, follow_redirects=True)
            r.raise_for_status()
            _cache[cache_key] = r.content
            return Response(content=r.content, media_type=r.headers.get("content-type", "image/jpeg"))
        except (httpx.HTTPError, httpx.TimeoutException):
            return _initials_avatar(username)
```

**httpx version note:** `httpx==0.28.*` is currently pinned as a dev dep. FastAPI 0.129 depends on httpx internally (for test client). Promoting to production use at 0.28.* is safe — no version change needed.

**Alternative considered (direct URL):** Pass `photo_url` directly from API to frontend, let `<img src={url}>` load it. Rejected because CORS and broken-image risk are real at scale with 530 experts across varied CDNs.

### Confidence: HIGH
httpx already in requirements.txt. FastAPI StreamingResponse is well-established.

---

## 4. Cross-Page Sage Navigation — Zustand + useNavigate State

### Recommendation

**No new package.** Use two existing mechanisms in combination:

1. **Zustand pilot slice** (already exists) — holds conversation history, is NOT persisted to localStorage (intentionally, from v2.0 research). For cross-page navigation this is correct: Sage state lives in memory and survives client-side navigation (Zustand store is not reset on route change, only on full page refresh).

2. **React Router v7 `useNavigate` with state** — pass a shallow signal on navigate, not the full conversation (avoid duplicating large state in history API).

### Pattern

```typescript
// In BrowsePage — when Sage triggers a search and user navigates to Explorer:
const navigate = useNavigate()

function handleSageNavigateToExplorer() {
  // Zustand already holds pilot conversation + filter results
  // Just navigate — store survives the route change
  navigate('/explore', {
    state: { fromBrowse: true, sageActive: true }
  })
}
```

```typescript
// In MarketplacePage (renamed /explore) — read navigation signal:
const location = useLocation()
const fromBrowse = location.state?.fromBrowse === true

// If fromBrowse, show "Continue Browsing" breadcrumb and keep Sage open
useEffect(() => {
  if (fromBrowse) setOpen(true)  // open Sage panel from Zustand pilot slice
}, [fromBrowse, setOpen])
```

**Why not pass full conversation via `location.state`?** React Router serializes state to the History API (browser sessionStorage). Large conversation objects (with expert arrays) would bloat it. Zustand in-memory is the right source of truth for conversation; `location.state` carries only the navigation signal.

**Why not URL params for Sage state?** URL params are for filter state (already handled by `useUrlSync`). Conversation history is ephemeral UI state — wrong layer for URLs.

### Confidence: HIGH
Pattern confirmed against React Router v7 official docs and existing Zustand store architecture.

---

## 5. Aurora "Loading Mesh" Page Transition — motion/react Already Installed

### Recommendation

**No new package.** `motion` (motion/react) v12.34 is already installed. Use `AnimatePresence` (already imported in MarketplacePage) with `mode="wait"` and a layout wrapper that receives `location.pathname` as its key.

The existing `AuroraBackground` component is a CSS-only animation (`@keyframes aurora-drift` in `index.css`). The page transition effect is a separate, complementary `AnimatePresence` wrapper — the aurora mesh background stays fixed; only the page content fades/slides.

### Integration Pattern with createBrowserRouter

The challenge with `createBrowserRouter` is that `AnimatePresence` must see direct children with changing keys. The cleanest solution with the existing router structure is a shared layout route:

```tsx
// src/layouts/AnimatedLayout.tsx
import { useLocation, Outlet } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'

export function AnimatedLayout() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, filter: 'blur(8px)' }}
        animate={{ opacity: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, filter: 'blur(8px)' }}
        transition={{ duration: 0.35, ease: 'easeInOut' }}
        className="min-h-screen"
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  )
}
```

```tsx
// main.tsx — wrap public routes in AnimatedLayout
const router = createBrowserRouter([
  {
    path: '/',
    element: <AnimatedLayout />,
    children: [
      { index: true, element: <BrowsePage /> },          // was: Navigate to /marketplace
      { path: 'explore', element: <MarketplacePage /> }, // was: /marketplace
      { path: 'chat', element: <App /> },
    ],
  },
  // Admin routes unchanged (no transition needed)
  { path: '/admin/login', element: <LoginPage /> },
  { path: '/admin', element: <RequireAuth />, children: [...] },
])
```

**Aurora "Loading Mesh" specifics:** The aurora CSS background is `position: fixed` — it stays in place during transitions. The blur filter on `motion.div` creates the "mesh dissolve" effect where content blurs out and the aurora bleeds through momentarily. This is a pure motion/react + CSS effect, no new library needed.

**`mode="wait"` is critical** — without it, both pages render simultaneously during transition, causing z-index conflicts with the FAB and Sage panel.

### Confidence: HIGH
AnimatePresence already imported in MarketplacePage. Pattern verified against motion.dev official docs.

---

## 6. Route Reorganization — React Router Config Only

### Recommendation

**No new package.** Pure configuration change in `main.tsx`.

| Current Route | v3.0 Route | Notes |
|--------------|-----------|-------|
| `/` | redirect → `/marketplace` | Change to serve `<BrowsePage />` directly |
| `/marketplace` | `/explore` | Rename, add redirect from old URL |
| `/chat` | `/chat` | Unchanged |
| `/admin/*` | `/admin/*` | Unchanged |

### Migration

```tsx
// main.tsx changes
{
  path: '/',
  element: <AnimatedLayout />,
  children: [
    { index: true, element: <BrowsePage /> },          // NEW: Browse is landing
    { path: 'explore', element: <MarketplacePage /> }, // RENAMED from /marketplace
    { path: 'marketplace', element: <Navigate to="/explore" replace /> }, // backward compat
    { path: 'chat', element: <App /> },
  ],
},
```

**SEO / sharing concern:** `/explore` is a public-facing URL. Vercel serves the SPA from `vercel.json` with a catch-all rewrite — no Vercel config change needed for the route rename.

### Confidence: HIGH
Direct modification of existing `main.tsx` routing config.

---

## 7. "Continue Browsing" Breadcrumb — React Router + Zustand Only

### Recommendation

**No new package.** A simple conditional component reading from `location.state` (React Router) and Zustand.

```tsx
// src/components/marketplace/BrowseBreadcrumb.tsx
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export function BrowseBreadcrumb() {
  const location = useLocation()
  const navigate = useNavigate()

  if (!location.state?.fromBrowse) return null

  return (
    <button
      onClick={() => navigate('/', { replace: true })}
      className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors mb-4"
    >
      <ArrowLeft size={14} />
      Back to Browse
    </button>
  )
}
```

Lucide React is already installed (`lucide-react ^0.575.0`). No new dependency.

### Confidence: HIGH

---

## 8. Glassmorphic Browse Cards (Large Photo) — Tailwind + motion/react Only

### Recommendation

**No new package.** The Browse page cards are visually distinct from the VirtuosoGrid bento cards in MarketplacePage but use the same underlying Tailwind + motion/react tools.

The VirtuosoGrid bento cards are compact grid tiles. Browse cards are taller portrait cards (like Netflix tiles) with:
- Large photo (full card height, `object-cover`)
- Glassmorphism overlay panel at bottom (backdrop-blur, semi-transparent)
- Hover scale + glow (already established pattern with motion/react)

```tsx
// src/components/browse/BrowseExpertCard.tsx
import { motion } from 'motion/react'

export function BrowseExpertCard({ expert }: { expert: Expert }) {
  return (
    <motion.div
      className="relative flex-shrink-0 w-52 h-72 rounded-2xl overflow-hidden cursor-pointer"
      whileHover={{ scale: 1.04 }}
      transition={{ duration: 0.2 }}
    >
      {/* Full-height photo */}
      <img
        src={`/api/photos/${expert.username}`}  // via proxy endpoint
        alt={expert.name}
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
      />
      {/* Glassmorphic name panel */}
      <div className="absolute bottom-0 inset-x-0 p-3 backdrop-blur-md bg-black/30 border-t border-white/10">
        <p className="text-white text-sm font-semibold truncate">{expert.name}</p>
        <p className="text-white/60 text-xs truncate">{expert.title}</p>
        <p className="text-brand-purple text-xs mt-0.5">€{expert.rate}/hr</p>
      </div>
    </motion.div>
  )
}
```

**Why separate from ExpertCard (VirtuosoGrid)?** The bento card layout is horizontal-info-panel-beside-avatar. Browse cards are portrait tiles. Different aspect ratios, different photo sizing requirements. Separate component avoids prop-drilling a `variant` prop into the existing card.

### Confidence: HIGH

---

## Summary: Net-New Packages

| Package | Location | Version | Purpose | Status |
|---------|----------|---------|---------|--------|
| `tailwind-scrollbar-hide` | frontend devDep | `^1.3.1` | Hide scrollbar on snap rows without CSS hack | NEW — install |
| (none) | backend | — | httpx already in requirements.txt | No change |

**Everything else is already installed.** All 8 features are built with:
- Tailwind v3.4 scroll-snap utilities (native)
- motion/react v12.34 AnimatePresence + motion.div (already installed)
- React Router v7 useNavigate + useLocation (already installed)
- Zustand v5.0.11 pilot slice (already in store)
- httpx 0.28.* (already in requirements.txt)
- lucide-react 0.575 (already installed)

---

## Installation

```bash
# Frontend — one new devDep only
npm install -D tailwind-scrollbar-hide

# Backend — no changes to requirements.txt
```

---

## What NOT to Add

| Rejected Package | Reason |
|-----------------|--------|
| `react-snap-carousel` | Tailwind scroll-snap handles it; 3.5 kB overhead for zero benefit |
| `swiper` | Heavy (20+ kB), no advantage over CSS scroll-snap for 12-20 cards |
| `react-slick` | Legacy, jQuery-era patterns, conflicts with motion/react |
| `@tanstack/react-virtual` (for rows) | Overkill for small fixed-count rows; react-virtuoso already handles large grids |
| `aiohttp` | httpx already in requirements.txt; adding a second async HTTP client is unnecessary |
| `pillow` (image processing) | No server-side image resizing needed; proxy passthrough is sufficient |
| `fastapi-proxy-lib` | Adds a full reverse-proxy framework for what 15 lines of httpx code handles |
| Any WebGL/canvas library | Aurora effect is already CSS-only in index.css; page transitions are motion/react blur filter; no GPU shader needed |

---

## Sources

- [Tailwind v3 scroll-snap-type](https://v3.tailwindcss.com/docs/scroll-snap-type)
- [tailwind-scrollbar-hide npm](https://www.npmjs.com/package/tailwind-scrollbar-hide)
- [motion/react AnimatePresence](https://motion.dev/docs/react-animate-presence)
- [motion/react useAnimate](https://motion.dev/docs/react-use-animate)
- [React Router v7 useNavigate](https://reactrouter.com/api/hooks/useNavigate)
- [React Router v7 State Management explanation](https://reactrouter.com/explanation/state-management)
- [httpx Async Support](https://www.python-httpx.org/async/)
- [FastAPI StreamingResponse patterns](https://johal.in/fastapi-streamingresponses-generators-async-iterators-2025/)
- Current `frontend/package.json` and `requirements.txt` verified directly
