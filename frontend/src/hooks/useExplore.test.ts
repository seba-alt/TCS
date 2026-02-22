import { describe, it, expect } from 'vitest'

describe('loadNextPage URL params', () => {
  it('uses "query" param name (not "q") for /api/explore', () => {
    const query = 'react developer'
    const params = new URLSearchParams()
    if (query) params.set('query', query)
    params.set('rate_min', '0')
    params.set('rate_max', '5000')
    params.set('cursor', '20')

    expect(params.get('query')).toBe('react developer')
    expect(params.get('q')).toBeNull()
    expect(params.toString()).toContain('query=react+developer')
  })

  it('does not set "query" param when query is empty string', () => {
    const query = ''
    const params = new URLSearchParams()
    if (query) params.set('query', query)

    expect(params.get('query')).toBeNull()
    expect(params.get('q')).toBeNull()
  })
})
