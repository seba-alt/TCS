import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// --- Test infrastructure ---

// Mock fetch globally
const fetchMock = vi.fn(() => Promise.resolve(new Response()))
vi.stubGlobal('fetch', fetchMock)

// Mock crypto.randomUUID
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-1234' })

// localStorage mock with real store behavior
let store: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value }),
  removeItem: vi.fn((key: string) => { delete store[key] }),
  clear: vi.fn(() => { store = {} }),
  get length() { return Object.keys(store).length },
  key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
}
vi.stubGlobal('localStorage', localStorageMock)

// Mock window.addEventListener for beforeunload
const addEventListenerMock = vi.fn()
vi.stubGlobal('window', { addEventListener: addEventListenerMock })

// Mock navigator with onLine and sendBeacon (Phase 74)
const sendBeaconMock = vi.fn(() => true)
vi.stubGlobal('navigator', { onLine: true, sendBeacon: sendBeaconMock })

beforeEach(() => {
  store = {}
  fetchMock.mockClear()
  localStorageMock.getItem.mockClear()
  localStorageMock.setItem.mockClear()
  addEventListenerMock.mockClear()
  sendBeaconMock.mockClear()
  // Reset navigator.onLine to true (default for most tests)
  Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  // Reset module cache so each test gets fresh imports
  vi.resetModules()
})

// --- Tests ---

describe('trackEvent batch queue', () => {
  it('queues events instead of sending immediately', async () => {
    const { trackEvent } = await import('./tracking')
    trackEvent('card_click', { expert: 'test' })

    // Should NOT have called fetch yet (queued, not sent)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('flush sends batch POST to /api/events/batch', async () => {
    const { trackEvent, flush } = await import('./tracking')
    trackEvent('card_click', { expert: 'test' })
    flush()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toContain('/api/events/batch')
    const body = JSON.parse(options?.body as string)
    expect(body.events).toHaveLength(1)
    expect(body.events[0].event_type).toBe('card_click')
    expect(body.events[0].payload).toEqual({ expert: 'test' })
  })

  it('auto-flushes at BATCH_SIZE (10) items', async () => {
    const { trackEvent } = await import('./tracking')
    for (let i = 0; i < 10; i++) {
      trackEvent('card_click', { index: i })
    }

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
    expect(body.events).toHaveLength(10)
  })

  it('timer-based flush after 3 seconds', async () => {
    const { trackEvent } = await import('./tracking')
    trackEvent('card_click', { expert: 'test' })

    expect(fetchMock).not.toHaveBeenCalled()

    vi.advanceTimersByTime(3000)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
    expect(body.events).toHaveLength(1)
  })

  it('flush drains the queue — second flush is no-op', async () => {
    const { trackEvent, flush } = await import('./tracking')
    trackEvent('card_click', { a: 1 })
    trackEvent('filter_change', { b: 2 })
    trackEvent('search_query', { c: 3 })

    flush()
    flush() // second flush should be no-op

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
    expect(body.events).toHaveLength(3)
  })

  it('includes email from newsletter store in batch payload', async () => {
    store['tinrate-newsletter-v1'] = JSON.stringify({
      state: { subscribed: true, email: 'lead@example.com' },
      version: 0,
    })

    const { trackEvent, flush } = await import('./tracking')
    trackEvent('search_query', { query: 'react' })
    flush()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
    expect(body.events[0].email).toBe('lead@example.com')
  })

  it('sends email: null when no newsletter store', async () => {
    const { trackEvent, flush } = await import('./tracking')
    trackEvent('card_click', {})
    flush()

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
    expect(body.events[0].email).toBeNull()
  })

  it('sends email: null when localStorage has invalid JSON', async () => {
    store['tinrate-newsletter-v1'] = 'not-valid-json'

    const { trackEvent, flush } = await import('./tracking')
    trackEvent('filter_change', {})
    flush()

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
    expect(body.events[0].email).toBeNull()
  })

  it('uses keepalive: true on batch request', async () => {
    const { trackEvent, flush } = await import('./tracking')
    trackEvent('card_click', {})
    flush()

    const options = fetchMock.mock.calls[0][1]
    expect(options?.keepalive).toBe(true)
  })

  it('generates and persists session_id on first call', async () => {
    const { trackEvent, flush } = await import('./tracking')
    trackEvent('card_click', {})
    flush()

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
    expect(body.events[0].session_id).toBe('test-uuid-1234')
    expect(localStorageMock.setItem).toHaveBeenCalledWith('tcs_session_id', 'test-uuid-1234')
  })

  it('reuses existing session_id', async () => {
    store['tcs_session_id'] = 'existing-session-id'

    const { trackEvent, flush } = await import('./tracking')
    trackEvent('card_click', {})
    flush()

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
    expect(body.events[0].session_id).toBe('existing-session-id')
  })

  it('registers beforeunload listener on module load', async () => {
    await import('./tracking')

    expect(addEventListenerMock).toHaveBeenCalledWith('beforeunload', expect.any(Function))
  })

  it('does not flush before timer expires', async () => {
    const { trackEvent } = await import('./tracking')
    trackEvent('card_click', {})

    vi.advanceTimersByTime(2999)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('batches multiple event types correctly', async () => {
    const { trackEvent, flush } = await import('./tracking')
    trackEvent('card_click', { expert: 'john' })
    trackEvent('filter_change', { filter: 'rate' })
    trackEvent('save', { expert_id: 'jane', action: 'save' })
    flush()

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
    expect(body.events).toHaveLength(3)
    expect(body.events[0].event_type).toBe('card_click')
    expect(body.events[1].event_type).toBe('filter_change')
    expect(body.events[2].event_type).toBe('save')
  })
})

// --- Phase 74: Analytics Hardening tests ---

describe('ANLT-02: offline guard', () => {
  it('drops events silently when navigator.onLine is false', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    const { trackEvent, flush } = await import('./tracking')
    trackEvent('card_click', { test: true })
    flush()

    // Event was dropped before queuing — neither fetch nor sendBeacon called
    expect(fetchMock).not.toHaveBeenCalled()
    expect(sendBeaconMock).not.toHaveBeenCalled()
  })

  it('queues events normally when navigator.onLine is true', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })

    const { trackEvent, flush } = await import('./tracking')
    trackEvent('card_click', { test: true })
    flush()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('ANLT-03: sendBeacon fallback', () => {
  it('uses sendBeacon when flush(true) is called', async () => {
    const { trackEvent, flush } = await import('./tracking')
    trackEvent('card_click', { test: true })
    flush(true)

    expect(sendBeaconMock).toHaveBeenCalledTimes(1)
    const [url, blob] = sendBeaconMock.mock.calls[0]
    expect(url).toContain('/api/events/batch')
    expect(blob).toBeInstanceOf(Blob)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back to fetch when flush(false) is called', async () => {
    const { trackEvent, flush } = await import('./tracking')
    trackEvent('card_click', { test: true })
    flush(false)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(sendBeaconMock).not.toHaveBeenCalled()
  })

  it('uses fetch when sendBeacon is not available and flush(true) is called', async () => {
    // Temporarily remove sendBeacon
    const original = navigator.sendBeacon
    Object.defineProperty(navigator, 'sendBeacon', { value: undefined, configurable: true })

    const { trackEvent, flush } = await import('./tracking')
    trackEvent('card_click', { test: true })
    flush(true)

    // Falls back to fetch gracefully
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Restore sendBeacon
    Object.defineProperty(navigator, 'sendBeacon', { value: original, configurable: true })
  })

  it('sendBeacon sends Blob with application/json content type', async () => {
    const { trackEvent, flush } = await import('./tracking')
    trackEvent('card_click', { test: true })
    flush(true)

    expect(sendBeaconMock).toHaveBeenCalledTimes(1)
    const blob = sendBeaconMock.mock.calls[0][1] as Blob
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/json')
  })

  it('default flush() uses fetch, not sendBeacon', async () => {
    const { trackEvent, flush } = await import('./tracking')
    trackEvent('card_click', { test: true })
    flush()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(sendBeaconMock).not.toHaveBeenCalled()
  })
})
