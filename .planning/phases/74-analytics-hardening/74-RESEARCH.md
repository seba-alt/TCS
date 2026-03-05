# Phase 74: Analytics Hardening - Research

**Researched:** 2026-03-05
**Domain:** GA4 event delivery, offline resilience, beacon transport, SPA analytics
**Confidence:** HIGH

## Summary

Phase 74 hardens the existing GA4 analytics setup by addressing four specific gaps: beacon transport for reliable page-exit delivery, offline event silencing, sendBeacon fallback for iOS Safari, and defensive documentation of the `send_page_view: false` SPA pattern.

The codebase already has a well-structured analytics layer: `analytics.tsx` handles SPA page_view events via React Router, `tracking.ts` manages custom event batching with a beforeunload flush, and `instrument.ts` initializes Sentry. The GA4 script tag in `index.html` already sets `send_page_view: false`. Changes are surgical — add `transport_type: 'beacon'` to the gtag config, add a `navigator.onLine` guard in `trackEvent()`, add a `sendBeacon` fallback in `flush()`, add a `beforeSend` filter in Sentry, and add an inline comment.

**Primary recommendation:** Make all changes in existing files (`index.html`, `tracking.ts`, `instrument.ts`) — no new modules needed. Keep changes minimal and defensive.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Silently drop events when `navigator.onLine === false` — no queue, no retry
- Online check lives inside `trackEvent()` only — page views handled by gtag itself
- Only check `navigator.onLine`; no special handling for flaky connections (online but request fails)
- Use `navigator.sendBeacon` fallback on `beforeunload` only (not `visibilitychange`)
- Apply sendBeacon universally across all browsers — no UA sniffing for Safari-only
- Only flush pending/queued events on unload — don't generate new session-end events
- If sendBeacon also fails, silently accept data loss — no fallback chains
- If GA4 script is blocked, fail silently — no proxy workarounds, accept untracked users
- Guard with `typeof gtag !== 'undefined'` check before calling — clean no-op if blocked
- Set `transport_type: 'beacon'` in gtag config (ANLT-01) for better delivery on page transitions
- No attempt to measure or track ad-blocker rate
- All analytics errors completely silent in production — analytics must never break the app
- Filter out analytics-related errors from Sentry entirely (GA4, gtag, beacon errors)
- `send_page_view: false` gets a brief inline comment: `// SPA: Router handles page_view events — do not set to true`
- No runtime double-fire detection — verify via GA4 DebugView during manual QA

### Claude's Discretion
- Dev-mode logging approach when events are dropped offline (console.debug or fully silent)
- Exact Sentry `beforeSend` filter patterns for analytics errors

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ANLT-01 | GA4 transport_type set to beacon in gtag config | Add `transport_type: 'beacon'` to the existing `gtag('config', ...)` call in index.html |
| ANLT-02 | navigator.onLine guard in trackEvent() prevents offline error noise | Add early return in `trackEvent()` when `navigator.onLine === false`; optionally `console.debug` in dev |
| ANLT-03 | navigator.sendBeacon fallback in trackEvent() for iOS Safari keepalive edge case | Modify `flush()` to try `navigator.sendBeacon` when `fetch` with `keepalive` may fail (beforeunload context) |
| ANLT-04 | Defensive inline comment on send_page_view: false in index.html | Add `// SPA: Router handles page_view events — do not set to true` comment inline |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| GA4 (gtag.js) | current | Google Analytics 4 event collection | Already loaded in index.html; `transport_type: 'beacon'` is the standard config for SPA delivery |
| @sentry/react | installed | Error monitoring | Already configured in instrument.ts; `beforeSend` filter is the standard pattern for suppressing noise |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| navigator.sendBeacon | Web API | Reliable page-exit data transmission | Built into all modern browsers; fallback for fetch+keepalive failures on iOS Safari |
| navigator.onLine | Web API | Network status detection | Simple boolean check; no library needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| navigator.sendBeacon | fetch with keepalive | fetch+keepalive is already used but fails on iOS Safari beforeunload; sendBeacon is more reliable for unload context |
| navigator.onLine | Network Information API | navigator.onLine is universally supported; Network Information API has limited browser support and is overkill for this use case |

**Installation:** No new packages needed. All changes use existing libraries and browser APIs.

## Architecture Patterns

### Current Architecture
```
index.html
├── GA4 gtag.js script (send_page_view: false)
└── gtag config

frontend/src/
├── analytics.tsx        # React component: SPA page_view via useLocation()
├── tracking.ts          # Module: custom event batching (trackEvent, flush)
├── instrument.ts        # Sentry init
└── layouts/RootLayout.tsx  # Mounts <Analytics />
```

### Pattern 1: Beacon Transport in gtag Config
**What:** Add `transport_type: 'beacon'` to the `gtag('config', ...)` call
**When to use:** SPA applications where page transitions may interrupt standard XHR delivery
**Example:**
```javascript
// In index.html — GA4 config
gtag('config', 'G-0T526W3E1Z', {
  send_page_view: false,  // SPA: Router handles page_view events — do not set to true
  transport_type: 'beacon'
});
```
**Confidence:** HIGH — `transport_type: 'beacon'` is a documented GA4 gtag.js configuration option that instructs the library to prefer `navigator.sendBeacon` for all event delivery.

### Pattern 2: Offline Guard in trackEvent
**What:** Early return when browser is offline
**When to use:** Any fire-and-forget analytics function
**Example:**
```typescript
export function trackEvent(event_type: EventType, payload: TrackPayload = {}): void {
  if (!navigator.onLine) {
    if (import.meta.env.DEV) console.debug('[analytics] offline — event dropped:', event_type)
    return
  }
  // ... existing queue logic
}
```

### Pattern 3: sendBeacon Fallback in flush()
**What:** Use `navigator.sendBeacon` as primary transport during page unload, fall back to fetch for normal flushes
**When to use:** The `flush()` function needs to handle two contexts: normal timer/batch flush (where fetch+keepalive works) and beforeunload flush (where sendBeacon is more reliable)
**Example:**
```typescript
export function flush(useBeacon = false): void {
  if (timer) { clearTimeout(timer); timer = null }
  if (queue.length === 0) return

  const batch = queue.splice(0)
  const body = JSON.stringify({ events: batch })
  const url = `${API_BASE}/api/events/batch`

  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
  } else {
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body,
    })
  }
}

// Update beforeunload listener
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => flush(true))
}
```
**Note:** The `useBeacon` parameter differentiates unload context (sendBeacon preferred) from normal flush (fetch+keepalive is fine). This avoids always using sendBeacon, which has a 64KB payload limit and returns no response status.

### Pattern 4: Sentry beforeSend Filter
**What:** Filter analytics-related errors from Sentry reports
**When to use:** Prevent analytics failures (blocked GA4, failed beacons) from polluting error monitoring
**Example:**
```typescript
Sentry.init({
  // ... existing config
  beforeSend(event) {
    const msg = event.exception?.values?.[0]?.value ?? ''
    const frames = event.exception?.values?.[0]?.stacktrace?.frames ?? []
    // Drop errors from GA4/gtag/analytics scripts
    if (
      /gtag|google.*analytics|googletagmanager|beacon/i.test(msg) ||
      frames.some(f => /gtag|googletagmanager|analytics/i.test(f.filename ?? ''))
    ) {
      return null
    }
    return event
  },
});
```

### Anti-Patterns to Avoid
- **Queuing offline events for later retry:** User decided against this — silently drop, no queue
- **UA sniffing for Safari:** User decided sendBeacon applies universally, not Safari-only
- **visibilitychange listener:** User locked to beforeunload only
- **Custom analytics proxy:** User decided to accept untracked ad-blocker users
- **Runtime double-fire detection:** User decided manual GA4 DebugView verification

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Beacon transport | Custom beacon wrapper | `transport_type: 'beacon'` in gtag config | GA4's built-in beacon transport handles all the edge cases |
| Offline detection | Custom network monitoring | `navigator.onLine` property | Simple boolean; no event listeners needed for this use case |
| Page-exit delivery | Complex unload handler | `navigator.sendBeacon` API | Designed specifically for reliable data delivery during page unload |
| Error filtering | Custom error boundary for analytics | Sentry `beforeSend` hook | Standard Sentry pattern; runs before any event is sent |

**Key insight:** Every change uses existing browser APIs or library configuration options. No custom abstractions needed.

## Common Pitfalls

### Pitfall 1: sendBeacon 64KB Payload Limit
**What goes wrong:** `navigator.sendBeacon` silently fails if the payload exceeds ~64KB
**Why it happens:** The batch queue could theoretically accumulate many events
**How to avoid:** Current BATCH_SIZE of 10 with typical event payloads (~200 bytes each) stays well under 64KB. The existing flush-on-10 mechanism prevents accumulation.
**Warning signs:** sendBeacon returning `false`

### Pitfall 2: navigator.onLine False Positives
**What goes wrong:** `navigator.onLine` returns `true` even when the network is unreachable (connected to router but no internet)
**Why it happens:** The property only detects physical disconnection, not internet availability
**How to avoid:** Per user decision, only guard against `navigator.onLine === false` — do not handle flaky connections. This is the correct minimal approach.
**Warning signs:** None — accepted behavior per user decision

### Pitfall 3: Content-Type Header with sendBeacon
**What goes wrong:** `navigator.sendBeacon(url, stringBody)` sends as `text/plain`, not `application/json`
**Why it happens:** sendBeacon with a plain string defaults to text/plain Content-Type
**How to avoid:** Wrap the body in a `Blob` with explicit type: `new Blob([body], { type: 'application/json' })`
**Warning signs:** Backend returns 415 or silently ignores the body

### Pitfall 4: Sentry beforeSend Over-Filtering
**What goes wrong:** Filtering too aggressively drops real application errors
**Why it happens:** Regex patterns match too broadly (e.g., "analytics" could match app code)
**How to avoid:** Filter on both error message AND stack trace filename. Only suppress errors originating from known analytics scripts (googletagmanager, gtag) or containing analytics-specific keywords.
**Warning signs:** Missing real errors in Sentry dashboard

### Pitfall 5: gtag Guard in analytics.tsx
**What goes wrong:** The current `analytics.tsx` already guards with `typeof window.gtag !== 'function'` but the guard should also be present in the gtag config for robustness
**Why it happens:** If the GA4 script is ad-blocked, `window.gtag` may not exist
**How to avoid:** The existing guard in analytics.tsx is sufficient. The inline gtag config in index.html defines `function gtag()` directly, so it's always available even if the async script fails to load. No change needed here.
**Warning signs:** None — current pattern is correct

## Code Examples

### Complete tracking.ts Changes
```typescript
export function trackEvent(event_type: EventType, payload: TrackPayload = {}): void {
  // ANLT-02: Silently drop events when offline
  if (!navigator.onLine) {
    if (import.meta.env.DEV) console.debug('[analytics] offline — event dropped:', event_type)
    return
  }

  const session_id = getSessionId()
  const email = getSubscriberEmail()
  queue.push({ session_id, event_type, payload, email })

  if (queue.length >= BATCH_SIZE) {
    flush()
  } else if (!timer) {
    timer = setTimeout(flush, FLUSH_INTERVAL_MS)
  }
}

// ANLT-03: sendBeacon fallback for page unload
export function flush(useBeacon = false): void {
  if (timer) { clearTimeout(timer); timer = null }
  if (queue.length === 0) return

  const batch = queue.splice(0)
  const body = JSON.stringify({ events: batch })
  const url = `${API_BASE}/api/events/batch`

  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
  } else {
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body,
    })
  }
}

// Flush remaining events on page exit — use sendBeacon for reliability
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => flush(true))
}
```

### Complete index.html GA4 Config Changes
```html
<!-- Google Analytics (GA4) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-0T526W3E1Z"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-0T526W3E1Z', {
    send_page_view: false, // SPA: Router handles page_view events — do not set to true
    transport_type: 'beacon'
  });
</script>
```

### Complete instrument.ts beforeSend Filter
```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.1,
  environment: "production",
  enabled: import.meta.env.PROD,
  beforeSend(event) {
    const msg = event.exception?.values?.[0]?.value ?? ''
    const frames = event.exception?.values?.[0]?.stacktrace?.frames ?? []
    if (
      /gtag|google.*analytics|googletagmanager|beacon/i.test(msg) ||
      frames.some(f => /gtag|googletagmanager|analytics/i.test(f.filename ?? ''))
    ) {
      return null
    }
    return event
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Universal Analytics (ga.js) | GA4 (gtag.js) | 2023 | GA4 is the only option; UA was sunset July 2023 |
| XHR for analytics | navigator.sendBeacon | Widely supported since 2015+ | Reliable delivery during page unload; non-blocking |
| `transport_type: 'image'` | `transport_type: 'beacon'` | GA4 default | Beacon is preferred for SPAs; falls back internally if unavailable |

**Deprecated/outdated:**
- Universal Analytics: Fully sunset, cannot be used
- `transport_type: 'image'`: Legacy GA fallback; beacon is preferred

## Open Questions

1. **Backend JSON Content-Type for sendBeacon**
   - What we know: The `/api/events/batch` endpoint expects `application/json`. sendBeacon with a Blob and explicit Content-Type should work.
   - What's unclear: Whether FastAPI/Starlette parses the request body correctly when sent via sendBeacon (it should, but worth verifying)
   - Recommendation: Test during QA; the Blob with type `application/json` approach is standard and widely documented

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via vite.config.ts) |
| Config file | frontend/vite.config.ts (test section) |
| Quick run command | `cd frontend && npx vitest run src/tracking.test.ts` |
| Full suite command | `cd frontend && npm test` |
| Estimated runtime | ~5 seconds |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ANLT-01 | transport_type: beacon in gtag config | manual-only | N/A — HTML config, verified via GA4 DebugView | N/A (HTML) |
| ANLT-02 | navigator.onLine guard drops events when offline | unit | `cd frontend && npx vitest run src/tracking.test.ts` | Needs new tests in existing file |
| ANLT-03 | sendBeacon fallback on beforeunload | unit | `cd frontend && npx vitest run src/tracking.test.ts` | Needs new tests in existing file |
| ANLT-04 | Defensive comment on send_page_view: false | manual-only | N/A — HTML comment, visual inspection | N/A (HTML) |

### Nyquist Sampling Rate
- **Minimum sample interval:** After every committed task -> run: `cd frontend && npx vitest run src/tracking.test.ts`
- **Full suite trigger:** Before merging final task of any plan wave
- **Phase-complete gate:** Full suite green before verification runs
- **Estimated feedback latency per task:** ~5 seconds

### Wave 0 Gaps (must be created before implementation)
None — existing test infrastructure (`tracking.test.ts` + Vitest) covers all phase requirements. New test cases will be added to the existing test file as part of implementation tasks.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `frontend/index.html`, `frontend/src/tracking.ts`, `frontend/src/analytics.tsx`, `frontend/src/instrument.ts`
- MDN Web Docs: navigator.sendBeacon API, navigator.onLine property
- GA4 gtag.js documentation: transport_type configuration

### Secondary (MEDIUM confidence)
- Sentry documentation: beforeSend event filtering pattern
- Blob constructor with type parameter for sendBeacon Content-Type

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed, browser APIs are well-documented
- Architecture: HIGH - changes are surgical modifications to existing files
- Pitfalls: HIGH - well-known issues (sendBeacon payload limit, Content-Type, onLine limitations)

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable domain, no fast-moving APIs)
