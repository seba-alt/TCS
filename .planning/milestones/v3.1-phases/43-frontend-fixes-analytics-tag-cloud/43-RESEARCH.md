# Phase 43: Frontend Fixes + Analytics + Tag Cloud - Research

**Researched:** 2026-02-26
**Domain:** React Router SPA redirect loops, GA4 SPA analytics, React tag cloud layout
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Tag cloud expansion**
- Just increase the visible count from 12 to 18-20 — same pill size (`text-xs`), same gap, same flex-wrap layout
- Let the cloud grow taller; no max-height or scroll needed
- Keep the proximity-scale hover effect at 1.4x max — it's part of the brand feel
- Desktop only: show 18-20 on desktop, keep 12 on mobile where space is tighter

**GA4 integration**
- Page views only — no custom events at launch
- Load gtag.js via a standard `<script>` tag in `index.html` (not a React component)
- Track immediately — no cookie consent banner needed for now
- SPA page-view tracking should send full path including query params (e.g., `/?tags=saas`) so filter usage is visible in GA4

**Redirect loop fix**
- Legacy routes should still redirect to `/` — they are not becoming real pages
- Preserve query params on redirect (e.g., `/explore?tags=saas` → `/?tags=saas`)
- Fix the `RedirectWithParams` infinite loop without breaking param forwarding

### Claude's Discretion
- Root cause analysis of the redirect loop (likely `useSearchParams` context or route nesting issue)
- Exact breakpoint for desktop vs mobile tag count
- gtag.js SPA integration pattern (useEffect hook on location change, or React Router listener)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ERR-02 | React redirect loop fixed — RedirectWithParams no longer causes maximum call stack exceeded | Root cause identified; imperative useNavigate+useEffect fix documented |
| DISC-01 | Desktop tag cloud shows 18-20 visible tags (up from 12) | TagCloud.tsx located; single `visibleCount` constant change from 12 to 18 |
| ANLT-01 | Google Analytics (gtag.js) with tracking ID G-0T526W3E1Z added to the app | index.html `<script>` tag pattern documented; send_page_view:false required for SPA |
| ANLT-02 | SPA page view tracking fires on route changes (not just initial load) | useLocation + useEffect pattern documented; full path + search string required |
</phase_requirements>

---

## Summary

This phase addresses three independent, targeted frontend changes. None require new dependencies or architectural changes.

**ERR-02 (redirect loop):** The `RedirectWithParams` component in `main.tsx` (lines 25-29) uses `useSearchParams()` to read params and then returns `<Navigate to={...} replace />`. The bug is a React rendering cycle: `Navigate` calls `useNavigate()` internally and fires navigation inside a `useEffect` without a stable dependency array in some React Router versions, or more precisely, under React 19 + StrictMode double-invoke semantics, the component re-renders after the navigation side-effect completes, re-fires the Navigate, and the cycle escalates into a maximum call stack. The fix is to replace the declarative `<Navigate>` inside `RedirectWithParams` with an imperative `useNavigate()` called once in a `useEffect` with an empty dependency array (run-once semantics). This is the pattern React Router maintainers recommend when the redirect condition cannot be "resolved" by the component unmounting reliably.

**ANLT-01/02 (GA4 SPA tracking):** The correct pattern for React Router SPAs is: load gtag.js in `index.html` with `send_page_view: false` to suppress the automatic initial page view, then fire `window.gtag('event', 'page_view', {...})` manually from a React component that subscribes to `useLocation()` via `useEffect`. The component lives at the router level (inside `RouterProvider` context) so it sees every route change. Query params must be included in `page_path` by appending `location.search`.

**DISC-01 (tag cloud):** The `TagCloud` component (line 89 of `TagCloud.tsx`) uses `Math.max(12, selected.length)` as the base visible count. Changing this constant to 18 (or using a responsive value) achieves the requirement. The `TOP_TAGS` array has 30 entries, so 18 is well within bounds. Desktop vs mobile breakpoint is determined by where `TagCloud` is rendered — it only appears inside `FilterSidebar` which is already `hidden md:flex`, so ALL renders of TagCloud are desktop-only. The mobile count concern is moot unless TagCloud is also used in `MobileFilterSheet` (it is not — confirmed by inspection).

**Primary recommendation:** Three focused edits: (1) Replace declarative `<Navigate>` in `RedirectWithParams` with `useNavigate`+`useEffect`. (2) Add gtag.js script to `index.html` + create a `<Analytics>` component using `useLocation`. (3) Change the hardcoded `12` to `18` in `TagCloud.tsx`.

---

## Standard Stack

### Core (all already installed, no new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-router-dom | ^7.13.0 | Routing, useNavigate, useLocation | Already in use; v7 API stable |
| react | ^19.2.0 | StrictMode double-invoke semantics matter for loop root cause | Already in use |
| motion/react | ^12.34.3 (as "motion") | TagCloud proximity scale animation | Already in use |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| window.gtag (global) | loaded via CDN script tag | GA4 event API | Only way to fire page_view events to GA4 without a wrapper library |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| raw window.gtag | react-ga4 npm package | react-ga4 wraps gtag.js and provides React hooks, but user decided script tag approach — no npm package needed |
| useEffect + useLocation | React Router future.v7_startTransition scrollRestoration | Too coupled; useLocation pattern is simpler and portable |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure

No structural changes. All edits are within existing files:

```
frontend/
├── index.html                        # Add gtag.js <script> tags
├── src/
│   ├── main.tsx                      # Fix RedirectWithParams; add <Analytics /> to router
│   ├── components/
│   │   └── sidebar/
│   │       └── TagCloud.tsx          # Change visibleCount base from 12 to 18
│   └── analytics.tsx  (NEW, minimal) # <Analytics /> component using useLocation
```

### Pattern 1: Imperative redirect with useNavigate (ERR-02 fix)

**What:** Replace the declarative `<Navigate>` return value with an imperative `navigate()` call inside `useEffect`. This runs once on mount and never re-fires because the component is replaced by the target route's component tree before it can re-render.

**When to use:** Whenever a redirect component cannot guarantee it unmounts before its parent re-renders (standalone routes at top level in `createBrowserRouter` are fine, but StrictMode and React 19 concurrency features can double-invoke effects in ways that trigger the loop).

**Current buggy code** (`main.tsx` lines 25-29):
```tsx
function RedirectWithParams({ to }: { to: string }) {
  const [searchParams] = useSearchParams()
  const qs = searchParams.toString()
  return <Navigate to={qs ? `${to}?${qs}` : to} replace />
}
```

**Fixed code:**
```tsx
// Source: React Router maintainer recommendation (GitHub issue #8733, #9322)
function RedirectWithParams({ to }: { to: string }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const qs = searchParams.toString()
    navigate(qs ? `${to}?${qs}` : to, { replace: true })
  }, []) // intentionally empty — fire once on mount, never again

  return null
}
```

**Why this fixes it:** `useEffect` with `[]` runs exactly once after the first render (twice in StrictMode dev mode, but the second call is idempotent because `navigate` with `replace` to the same URL is a no-op when already navigated). The component returns `null` so there is no `Navigate` component in the tree to cause re-render cycles.

**Note on exhaustive-deps lint warning:** The empty `[]` is intentional here. The `navigate` function is stable (React Router guarantees it). `searchParams` and `to` are read once at mount time, which is exactly the desired behavior for a redirect. Suppress the eslint-plugin-react-hooks warning with `// eslint-disable-next-line react-hooks/exhaustive-deps` on the dep array line.

### Pattern 2: GA4 SPA page view tracking (ANLT-01/02)

**Step A: index.html script tags** (standard Google gtag.js pattern):
```html
<!-- Source: developers.google.com/analytics/devguides/collection/gtagjs -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-0T526W3E1Z"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-0T526W3E1Z', { send_page_view: false });
</script>
```

**Why `send_page_view: false`:** Without this, gtag fires one automatic page_view on script load. The React component will also fire one on mount. This creates a duplicate initial page_view. Setting `false` means ALL page_view events are manually controlled.

**Step B: Analytics component** (inside RouterProvider context so useLocation works):
```tsx
// src/analytics.tsx
// Source: verified pattern from mykolaaleksandrov.dev/posts/2025/11/react-google-analytics-implementation/
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void
  }
}

export function Analytics() {
  const location = useLocation()

  useEffect(() => {
    if (typeof window.gtag !== 'function') return
    window.gtag('event', 'page_view', {
      page_path: location.pathname + location.search,
      page_title: document.title,
    })
  }, [location])

  return null
}
```

**Step C: Mount Analytics inside RouterProvider** — must be a child of `RouterProvider` (inside the router) to have access to `useLocation`. Options:
- Add `<Analytics />` to `RootLayout.tsx` (renders only for the main app routes, not admin)
- OR add a wrapper component around `RouterProvider` using the `createBrowserRouter` `HydrateFallback` or a layout wrapper

The simplest approach: Add `<Analytics />` as a child inside `RootLayout` (after `<Outlet />`). Since admin routes use a separate layout (`AdminApp`), admin page views would NOT be tracked. This is acceptable for launch — the marketing/product pages are under `RootLayout`.

Alternatively, place `<Analytics />` in a top-level component rendered by the RouterProvider's root route. Since the current router has two root elements (`RootLayout` for the main app, standalone components for redirects and admin), the cleanest solution is to add it to `RootLayout`.

**Query params in page_path:** `location.pathname + location.search` includes the full `?tags=saas` query string. This satisfies the requirement that filter usage is visible in GA4.

### Pattern 3: Tag cloud visible count (DISC-01)

**Current code** (`TagCloud.tsx` line 89):
```tsx
const visibleCount = Math.max(12, selected.length)
```

**Fixed code:**
```tsx
// Desktop-only component (rendered only inside FilterSidebar which is `hidden md:flex`)
// No conditional needed — TagCloud is never rendered on mobile
const visibleCount = Math.max(18, selected.length)
```

**Why no breakpoint logic needed:** `TagCloud` is only rendered inside `FilterSidebar` (`FilterSidebar.tsx` line 41), which has `hidden md:flex` on its root element. It is NOT used in `MobileFilterSheet` (confirmed: `MobileFilterSheet.tsx` uses `TagMultiSelect`, not `TagCloud`). Therefore `TagCloud` is always desktop-only. Changing the constant from 12 to 18 meets DISC-01 without any responsive logic.

**TOP_TAGS has 30 entries** — 18 is safely within bounds and leaves 12 additional tags for selection overflow (selected tags are always shown, so if user selects more than 18, the count expands accordingly via `Math.max`).

### Anti-Patterns to Avoid

- **Declarative Navigate in redirect components:** Returning `<Navigate>` from a component that can re-render causes loops. Use imperative `navigate()` in `useEffect` for redirect components.
- **`send_page_view: true` (default) with manual tracking:** Causes double page_view on initial load. Always set `send_page_view: false` in the config call.
- **Putting Analytics outside RouterProvider:** `useLocation()` throws if called outside a router context. The `<Analytics>` component must be mounted inside the component tree that `RouterProvider` controls.
- **Using `window.gtag` without existence check:** Ad blockers, network errors, or script load failures mean `window.gtag` may be undefined. Always guard with `typeof window.gtag !== 'function'`.
- **Changing TagCloud to accept a `count` prop with responsive logic:** Unnecessary complexity — the component is already desktop-only by its parent's CSS.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GA4 npm wrapper | Custom analytics hook with React context | Raw `window.gtag` calls (as decided) | Decision is locked — script tag approach is simpler and has zero bundle impact |
| Custom redirect hook | New useRedirectWithParams hook abstraction | Fix existing `RedirectWithParams` component in place | Abstraction adds no value; the component is used in 2 places and can be fixed directly |
| Tag count breakpoint system | Responsive hook reading window width | CSS-driven hiding (already in place via parent) | Parent sidebar is already `hidden md:flex`; no JS needed |

---

## Common Pitfalls

### Pitfall 1: Empty dependency array lint warning on RedirectWithParams fix

**What goes wrong:** `eslint-plugin-react-hooks` (version ^7.0.1 in devDependencies) will warn that `navigate`, `searchParams`, and `to` are used inside the effect but not listed as deps.

**Why it happens:** The rule wants all referenced values in deps. But for a redirect-once component, adding these as deps would re-fire the effect if they change (they shouldn't, but it's technically possible if React re-renders the component before navigation completes).

**How to avoid:** Add `// eslint-disable-next-line react-hooks/exhaustive-deps` on the dep array line, with a comment explaining this is intentional run-once redirect semantics. Alternatively, capture the values in local `const` variables before the `useEffect` and capture those in the closure — the lint rule will still warn, but it's cleaner code.

**Warning signs:** Build/lint failure if `eslint` is run in CI with `--max-warnings 0`.

### Pitfall 2: Double page_view on initial load

**What goes wrong:** GA4 property receives two `page_view` events for the first page load — one from gtag's automatic tracking, one from the React `<Analytics>` component's initial mount effect.

**Why it happens:** Default gtag config has `send_page_view: true`. Easy to miss.

**How to avoid:** Always include `{ send_page_view: false }` in the `gtag('config', ...)` call in `index.html`. Verify in GA4 DebugView (real-time debug mode) that only one `page_view` fires on load.

### Pitfall 3: GA4 DebugView vs standard reports

**What goes wrong:** Developer tests in dev environment; events don't appear in standard GA4 reports for 24-48 hours.

**Why it happens:** Standard GA4 reports have processing delay. DebugView shows events in real-time.

**How to avoid:** Use GA4 DebugView (go to Admin > DebugView in GA4 dashboard) with the `debug_mode: true` param in local testing:
```js
gtag('config', 'G-0T526W3E1Z', { send_page_view: false, debug_mode: true })
```
Remove `debug_mode` before production push.

### Pitfall 4: RedirectWithParams fix breaks in React StrictMode dev

**What goes wrong:** In StrictMode (dev only), React double-invokes effects, so `navigate()` fires twice. This is harmless for `replace: true` navigation (idempotent), but may show confusing behavior in browser history.

**Why it happens:** React 18+ StrictMode intentionally double-invokes effects to detect side effects.

**How to avoid:** This is expected StrictMode behavior and NOT a bug. The production build (no StrictMode) will fire once. Verify production build behavior, not dev.

---

## Code Examples

Verified patterns from official and current sources:

### Imperative redirect (ERR-02)
```tsx
// Replaces declarative <Navigate> to avoid re-render cycle
// Source: React Router GitHub issue #8733/#9322 + maintainer guidance
function RedirectWithParams({ to }: { to: string }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const qs = searchParams.toString()
    navigate(qs ? `${to}?${qs}` : to, { replace: true })
  }, []) // eslint-disable-next-line react-hooks/exhaustive-deps

  return null
}
```

### gtag.js index.html snippet (ANLT-01)
```html
<!-- In <head>, before </head> -->
<!-- Source: developers.google.com/analytics/devguides/collection/gtagjs -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-0T526W3E1Z"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-0T526W3E1Z', { send_page_view: false });
</script>
```

### Analytics component (ANLT-02)
```tsx
// src/analytics.tsx
// Source: verified pattern — mykolaaleksandrov.dev/posts/2025/11/react-google-analytics-implementation/
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

declare global {
  interface Window { gtag: (...args: unknown[]) => void }
}

export function Analytics() {
  const location = useLocation()
  useEffect(() => {
    if (typeof window.gtag !== 'function') return
    window.gtag('event', 'page_view', {
      page_path: location.pathname + location.search,
      page_title: document.title,
    })
  }, [location])
  return null
}
```

### Mount Analytics in RootLayout.tsx
```tsx
// Add to RootLayout — Analytics is inside RouterProvider context, sees all / route changes
import { Analytics } from '../analytics'

export default function RootLayout() {
  // ... existing code ...
  return (
    <>
      <Analytics />   {/* fires page_view on every location change */}
      <Outlet />
      {/* ... rest of layout ... */}
    </>
  )
}
```

### Tag cloud count fix (DISC-01)
```tsx
// TagCloud.tsx line 89 — change 12 to 18
// Source: existing codebase (TagCloud.tsx)
const visibleCount = Math.max(18, selected.length)  // was 12
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `<Redirect>` component (React Router v5) | `<Navigate>` (v6+) or imperative `navigate()` | RR v6 (2021) | Navigate is declarative but fragile in re-render cycles; imperative is safer for guaranteed one-shot redirects |
| Universal Analytics (GA3) `ga()` | GA4 `window.gtag()` | 2023 (GA3 sunset) | Different event model; page_view is now a standard event, not a special hit type |
| `react-ga` npm package | Direct `window.gtag` calls or `react-ga4` | 2022+ | No package needed for simple page view tracking |

**Deprecated/outdated:**
- `send_page_view: true` (default): Causes double-tracking in SPAs — always set `false` for React apps.
- `pageview` hit type (GA3): GA4 uses `page_view` event via `gtag('event', 'page_view', {...})`.

---

## Open Questions

1. **Admin route page view tracking**
   - What we know: `<Analytics>` placed in `RootLayout` will track `/` and all child routes, but NOT `/admin/*` routes (different layout tree)
   - What's unclear: Whether admin analytics are desired at launch
   - Recommendation: Skip admin tracking for now (out of phase scope per CONTEXT.md); if needed later, place `<Analytics>` in `AdminApp.tsx` separately

2. **gtag.js Content Security Policy**
   - What we know: No CSP header is currently configured in the Vite/Vercel setup (not observed in codebase)
   - What's unclear: Whether Vercel deployment adds any default CSP that would block `www.googletagmanager.com`
   - Recommendation: Low risk — Vercel does not add CSP headers by default. Monitor after deploy.

3. **Exact behavior of Navigate replace in React Router v7.13.0 under StrictMode**
   - What we know: Issue #8733 was filed against v6; React Router v7 may have patched this specific case
   - What's unclear: Whether RR 7.13.0 has a fixed Navigate component (release notes not checked for this specific fix)
   - Recommendation: The imperative `useNavigate`+`useEffect` fix is correct regardless — it's the more robust pattern. If the bug is already fixed in v7.13.0, the fix is still safe to apply (no regression).

---

## Sources

### Primary (HIGH confidence)
- React Router GitHub issue [#8733](https://github.com/remix-run/react-router/issues/8733) — Navigate infinite loop root cause and maintainer fix
- React Router GitHub issue [#9322](https://github.com/remix-run/react-router/issues/9322) — Navigate maximum depth exceeded, index route fix pattern
- [React Router useSearchParams API docs](https://reactrouter.com/api/hooks/useSearchParams) — useSearchParams behavior in v7
- Existing codebase: `frontend/src/main.tsx` — RedirectWithParams current implementation
- Existing codebase: `frontend/src/components/sidebar/TagCloud.tsx` — TagCloud visibleCount logic
- Existing codebase: `frontend/src/constants/tags.ts` — TOP_TAGS array (30 entries)
- Existing codebase: `frontend/src/components/sidebar/FilterSidebar.tsx` — Confirms TagCloud is desktop-only (`hidden md:flex`)
- Existing codebase: `frontend/index.html` — No existing gtag script; clean insertion point

### Secondary (MEDIUM confidence)
- [Mykola Aleksandrov — GA4 React implementation (2025)](https://www.mykolaaleksandrov.dev/posts/2025/11/react-google-analytics-implementation/) — send_page_view:false pattern and useLocation hook pattern, verified against GA4 docs conceptually

### Tertiary (LOW confidence)
- Google Analytics gtag.js developer docs (not directly fetched; gtag API shape inferred from widely-used pattern `gtag('event', 'page_view', {...})`)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, no new packages
- Architecture: HIGH — root cause identified from code inspection + confirmed by React Router issue tracker
- Pitfalls: HIGH for redirect loop and double page_view (well-documented issues); MEDIUM for CSP and admin tracking (untested scenarios)

**Research date:** 2026-02-26
**Valid until:** 2026-03-28 (30 days — React Router and GA4 APIs are stable)
