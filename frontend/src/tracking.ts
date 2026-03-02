/**
 * tracking.ts — Fire-and-forget user behavior tracking.
 *
 * trackEvent() is a module function (NOT a React hook).
 * Always call as: void trackEvent(...)   — NEVER await.
 * Uses fetch + keepalive: true so events survive page navigation.
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

type EventType = 'card_click' | 'sage_query' | 'filter_change' | 'search_query'

interface TrackPayload {
  [key: string]: unknown
}

export function trackEvent(event_type: EventType, payload: TrackPayload = {}): void {
  const session_id = getSessionId()
  void fetch(`${API_BASE}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ session_id, event_type, payload }),
  })
}
