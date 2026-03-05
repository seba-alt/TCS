/**
 * tracking.ts — Batched user behavior tracking.
 *
 * trackEvent() is a module function (NOT a React hook).
 * Always call as: void trackEvent(...)   — NEVER await.
 *
 * Phase 72: Events accumulate in a module-level queue and flush as a single
 * batch POST to /api/events/batch. Flush triggers: 10 items, 3-second timer,
 * or beforeunload (page exit). This replaces the per-event individual POST.
 *
 * Phase 63: Enriches events with subscriber email from Zustand persist store.
 * Email is read from the tinrate-newsletter-v1 localStorage key (set by nltrStore).
 * Pre-gate events send email: null. Post-gate events include the subscriber's email.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const SESSION_KEY = 'tcs_session_id'

/** Batch queue constants */
const BATCH_SIZE = 10
const FLUSH_INTERVAL_MS = 3000

/** Module-level queue — survives SPA navigation */
interface QueueItem {
  session_id: string
  event_type: string
  payload: Record<string, unknown>
  email: string | null
}

const queue: QueueItem[] = []
let timer: ReturnType<typeof setTimeout> | null = null

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

/**
 * Flush the event queue — sends all queued events as a single batch POST.
 * Silently drops on network error (Phase 74 handles retry/offline).
 */
export function flush(): void {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (queue.length === 0) return

  const batch = queue.splice(0)
  void fetch(`${API_BASE}/api/events/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ events: batch }),
  })
}

export function trackEvent(event_type: EventType, payload: TrackPayload = {}): void {
  const session_id = getSessionId()
  const email = getSubscriberEmail()

  queue.push({ session_id, event_type, payload, email })

  if (queue.length >= BATCH_SIZE) {
    flush()
  } else if (!timer) {
    timer = setTimeout(flush, FLUSH_INTERVAL_MS)
  }
}

// Flush remaining events on page exit
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flush)
}
