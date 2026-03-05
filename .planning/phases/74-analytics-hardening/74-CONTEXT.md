# Phase 74: Analytics Hardening - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Maximize GA4 event delivery under ad-blocker and mobile conditions, silence offline errors, and document the `send_page_view` configuration to prevent accidental double-counting. Covers ANLT-01 through ANLT-04.

</domain>

<decisions>
## Implementation Decisions

### Offline behavior
- Silently drop events when `navigator.onLine === false` — no queue, no retry
- Online check lives inside `trackEvent()` only — page views handled by gtag itself
- Only check `navigator.onLine`; no special handling for flaky connections (online but request fails)

### iOS Safari / sendBeacon fallback
- Use `navigator.sendBeacon` fallback on `beforeunload` only (not `visibilitychange`)
- Apply sendBeacon universally across all browsers — no UA sniffing for Safari-only
- Only flush pending/queued events on unload — don't generate new session-end events
- If sendBeacon also fails, silently accept data loss — no fallback chains

### Ad-blocker resilience
- If GA4 script is blocked, fail silently — no proxy workarounds, accept untracked users
- Guard with `typeof gtag !== 'undefined'` check before calling — clean no-op if blocked
- Set `transport_type: 'beacon'` in gtag config (ANLT-01) for better delivery on page transitions
- No attempt to measure or track ad-blocker rate

### Error handling
- All analytics errors completely silent in production — analytics must never break the app
- Filter out analytics-related errors from Sentry entirely (GA4, gtag, beacon errors)
- `send_page_view: false` gets a brief inline comment: `// SPA: Router handles page_view events — do not set to true`
- No runtime double-fire detection — verify via GA4 DebugView during manual QA

### Claude's Discretion
- Dev-mode logging approach when events are dropped offline (console.debug or fully silent)
- Exact Sentry `beforeSend` filter patterns for analytics errors

</decisions>

<specifics>
## Specific Ideas

- The overall philosophy is "analytics is best-effort" — never let tracking code affect user experience or app stability
- Keep the implementation minimal and defensive — guards and no-ops, not complex retry/queue logic

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 74-analytics-hardening*
*Context gathered: 2026-03-05*
