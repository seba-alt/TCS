/**
 * tracking.ts — Fire-and-forget user behavior tracking.
 *
 * trackEvent() is a module function (NOT a React hook).
 * Always call as: void trackEvent(...)   — NEVER await.
 * Uses fetch + keepalive: true so events survive page navigation.
 *
 * Phase 63: Enriches events with subscriber email from Zustand persist store.
 * Email is read from the tinrate-newsletter-v1 localStorage key (set by nltrStore).
 * Pre-gate events send email: null. Post-gate events include the subscriber's email.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const SESSION_KEY = 'tcs_session_id'

function getSessionId(): string {
  let sid = localStorage.getItem(SESSION_KEY)
  if (!sid) {
    sid = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, sid)
  }
  return sid
}

/**
 * Read subscriber email from the Zustand persist store (tinrate-newsletter-v1).
 * Returns null if the user hasn't subscribed yet, localStorage is empty,
 * or the stored JSON is malformed.
 */
function getSubscriberEmail(): string | null {
  try {
    const raw = localStorage.getItem('tinrate-newsletter-v1')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.state?.email || null
  } catch {
    return null
  }
}

type EventType = 'card_click' | 'filter_change' | 'search_query' | 'save'

interface TrackPayload {
  [key: string]: unknown
}

export function trackEvent(event_type: EventType, payload: TrackPayload = {}): void {
  const session_id = getSessionId()
  const email = getSubscriberEmail()
  void fetch(`${API_BASE}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ session_id, event_type, payload, email }),
  })
}
