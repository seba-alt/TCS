# Phase 73: Resilience & SEO — Research

**Researched:** 2026-03-05
**Phase Goal:** The Explorer is protected by error boundaries so a JS crash shows a retry UI instead of a blank screen, and every page has correct meta tags and crawler directives before launch traffic arrives
**Requirements:** RSIL-01, RSIL-02, SEO-01, SEO-02, SEO-03

## Current State Analysis

### Error Handling Today
- **No React error boundaries exist** anywhere in the frontend (grep confirms zero `ErrorBoundary` usage)
- Sentry is initialized in `instrument.ts` with `browserTracingIntegration()` — captures errors but does NOT prevent blank screens
- ExpertGrid already has an inline error state for API fetch failures (`error && experts.length === 0`) — this handles network errors, NOT render crashes
- The app uses React 19.2.0 — class-based `componentDidCatch` still works, but `react-error-boundary` library (already researched in prior phases, noted in STATE.md as approved dep `react-error-boundary@6.1.1`) provides a cleaner hook-based API

### SEO Today
- `index.html` has OG meta tags (`og:description`) but **no standard `<meta name="description">`** tag
- No `robots.txt` file exists in `frontend/public/`
- No `sitemap.xml` file exists in `frontend/public/`
- Vercel rewrites ALL paths to `/index.html` (SPA catch-all) — static files in `public/` are served before the rewrite rule fires, so `robots.txt` and `sitemap.xml` placed in `public/` will be served correctly
- The site URL is `https://tcs-three-sigma.vercel.app` (from OG tags)

### Deployment Architecture
- Frontend: Vite SPA on Vercel with `vercel.json` rewrites
- Build: `tsc -b && vite build` — static files from `public/` are copied to `dist/` by Vite
- No SSR — all meta tags must be in `index.html` (static) or injected at build time

## Technical Approach

### RSIL-01: React Error Boundaries

**Recommended: `react-error-boundary` library (already approved in STATE.md)**

The `react-error-boundary@6.1.1` package is already approved as a new dependency. It provides:
- `<ErrorBoundary>` component with `fallbackRender` prop for custom UI
- `resetKeys` for auto-reset when navigation changes
- `onError` callback for Sentry reporting
- `useErrorBoundary()` hook for imperative error throwing from event handlers

**Boundary Placement Strategy:**
1. **App-level boundary** in `main.tsx` wrapping `<RouterProvider>` — catches catastrophic crashes
2. **Explorer-level boundary** wrapping `<MarketplacePage>` content inside `RootLayout` or around MarketplacePage in the route config — catches page-specific render errors
3. **ExpertGrid-level boundary** wrapping `<ExpertGrid>` inside `MarketplacePage` — most granular, catches card render errors without losing the whole page

Per CONTEXT.md: "Whether to wrap ExplorerPage and ExpertGrid separately or with a shared boundary" is left to discretion. **Recommendation:** Two boundaries — one around the MarketplacePage content (catches filter/header errors too) and one around ExpertGrid specifically (so a card render error only loses the grid, not the filters). The app-level boundary is a safety net.

**Fallback UI Design:**
- Use Tailwind classes consistent with existing error states (see ExpertGrid's API error state for reference)
- Include: error icon, friendly message, "Try again" button
- The retry button should call `resetErrorBoundary()` from `react-error-boundary`
- Match existing style: `lucide-react` icons, `bg-brand-purple` buttons, gray text tones

**Sentry Integration:**
- Use `onError` prop → `Sentry.captureException(error)` to report boundary catches
- Sentry is already initialized, no additional config needed

### RSIL-02: Global Unhandled Rejection Handler

**Approach: `window.addEventListener('unhandledrejection', ...)` in `main.tsx`**

This catches async errors from `useEffect` hooks that aren't caught by error boundaries (error boundaries only catch render-time errors, not async code).

**Implementation:**
```typescript
window.addEventListener('unhandledrejection', (event) => {
  // Sentry already captures these via its integration, but we prevent blank screens
  console.error('Unhandled promise rejection:', event.reason)
  // Do NOT call event.preventDefault() — let Sentry see it too
})
```

Key consideration: React error boundaries do NOT catch:
- Event handlers (already handled by try/catch)
- Async code (`setTimeout`, `fetch`, promises)
- The global handler is a safety net — it logs but doesn't crash the page

The requirement says "does not produce a silent blank screen" — the unhandled rejection handler ensures the console logs the error. Combined with error boundaries catching render errors, the app stays interactive.

**Placement:** Early in `main.tsx`, before `createRoot()`.

### SEO-01: Meta Description Tag

**Add to `index.html` `<head>`:**
```html
<meta name="description" content="Describe any problem and instantly get matched with the right expert. No searching, no guesswork." />
```

Reuse the existing OG description copy for consistency. This is the standard meta description that search engines use for SERP snippets.

### SEO-02: robots.txt

**Create `frontend/public/robots.txt`:**
```
User-agent: *
Allow: /
Disallow: /admin

Sitemap: https://tcs-three-sigma.vercel.app/sitemap.xml
```

- Vercel serves static files from `public/` before the SPA rewrite, so `/robots.txt` will be served correctly
- `Disallow: /admin` blocks crawlers from admin routes (per requirements)
- Include `Sitemap` directive to help crawlers find the sitemap

### SEO-03: sitemap.xml

**Create `frontend/public/sitemap.xml`:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://tcs-three-sigma.vercel.app/</loc>
    <lastmod>2026-03-05</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

- Single-page SPA, so only one URL entry needed (the root)
- `lastmod` should be set to the deployment date — can be hardcoded for now (requirement just says "with a lastmod date")
- Future: could be dynamically generated, but that's deferred to SEOA-* requirements

## File Impact Analysis

| File | Change Type | Notes |
|------|-------------|-------|
| `frontend/package.json` | Modify | Add `react-error-boundary` dependency |
| `frontend/src/main.tsx` | Modify | Add global unhandledrejection handler, app-level error boundary |
| `frontend/src/pages/MarketplacePage.tsx` | Modify | Wrap content in error boundary |
| `frontend/src/components/ErrorFallback.tsx` | Create | Shared fallback UI component |
| `frontend/index.html` | Modify | Add `<meta name="description">` tag |
| `frontend/public/robots.txt` | Create | Crawler directives |
| `frontend/public/sitemap.xml` | Create | Sitemap for crawlers |

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Error boundary catches too much (swallows dev errors) | Low | Only active in production; dev mode shows full error overlay |
| robots.txt blocked by Vercel SPA rewrite | Low | Vercel serves static files first, confirmed by vercel.json config |
| sitemap.xml hardcoded lastmod gets stale | Low | Acceptable for launch; dynamic generation deferred to SEOA-* |
| `react-error-boundary` version compatibility with React 19 | Low | v6.x supports React 18+; already approved in STATE.md |

## Dependencies

- `react-error-boundary@6.1.1` — npm install required (approved in STATE.md decisions)
- No backend changes needed — all changes are frontend-only
- No Vite config changes needed — `public/` files are auto-copied to `dist/`

## Plan Split Recommendation

The roadmap already suggests two plans:
1. **73-01**: Error boundaries (RSIL-01, RSIL-02) — React components + handler
2. **73-02**: SEO tags (SEO-01, SEO-02, SEO-03) — static files + HTML meta tag

These are independent and can run in parallel (Wave 1). No cross-dependencies.

## RESEARCH COMPLETE
