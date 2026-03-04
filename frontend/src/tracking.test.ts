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

beforeEach(() => {
  store = {}
  fetchMock.mockClear()
  localStorageMock.getItem.mockClear()
  localStorageMock.setItem.mockClear()
})

afterEach(() => {
  // Reset module cache so each test gets fresh imports
  vi.resetModules()
})

// --- Tests ---

describe('trackEvent', () => {
  it('sends email: null when no newsletter store in localStorage', async () => {
    const { trackEvent } = await import('./tracking')
    trackEvent('card_click', { expert: 'test' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toContain('/api/events')
    const body = JSON.parse(options?.body as string)
    expect(body.email).toBeNull()
    expect(body.session_id).toBeDefined()
    expect(body.event_type).toBe('card_click')
    expect(body.payload).toEqual({ expert: 'test' })
  })

  it('includes email when newsletter store has email', async () => {
    store['tinrate-newsletter-v1'] = JSON.stringify({
      state: { subscribed: true, email: 'lead@example.com' },
      version: 0,
    })

    const { trackEvent } = await import('./tracking')
    trackEvent('search_query', { query: 'react' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
    expect(body.email).toBe('lead@example.com')
    expect(body.event_type).toBe('search_query')
  })

  it('sends email: null when localStorage has invalid JSON', async () => {
    store['tinrate-newsletter-v1'] = 'not-valid-json'

    const { trackEvent } = await import('./tracking')
    trackEvent('filter_change', {})

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
    expect(body.email).toBeNull()
  })

  it('sends email: null when newsletter store has no email field', async () => {
    store['tinrate-newsletter-v1'] = JSON.stringify({
      state: { subscribed: false },
      version: 0,
    })

    const { trackEvent } = await import('./tracking')
    trackEvent('card_click', {})

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
    expect(body.email).toBeNull()
  })

  it('sends email: null when newsletter store email is empty string', async () => {
    store['tinrate-newsletter-v1'] = JSON.stringify({
      state: { subscribed: false, email: '' },
      version: 0,
    })

    const { trackEvent } = await import('./tracking')
    trackEvent('card_click', {})

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
    expect(body.email).toBeNull()
  })

  it('uses keepalive: true for page navigation survival', async () => {
    const { trackEvent } = await import('./tracking')
    trackEvent('card_click', {})

    const options = fetchMock.mock.calls[0][1]
    expect(options?.keepalive).toBe(true)
  })

  it('generates and persists session_id on first call', async () => {
    const { trackEvent } = await import('./tracking')
    trackEvent('card_click', {})

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
    expect(body.session_id).toBe('test-uuid-1234')
    expect(localStorageMock.setItem).toHaveBeenCalledWith('tcs_session_id', 'test-uuid-1234')
  })

  it('reuses existing session_id', async () => {
    store['tcs_session_id'] = 'existing-session-id'

    const { trackEvent } = await import('./tracking')
    trackEvent('card_click', {})

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
    expect(body.session_id).toBe('existing-session-id')
  })
})
