import { useCallback, useEffect, useRef } from 'react'
import { useExplorerStore } from '../store'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export function useExplore() {
  // Individual selectors — NOT useShallow — to avoid the tags array identity pitfall
  // (Pitfall 4: tags via useShallow returns new object ref each render → infinite loop)
  const query = useExplorerStore((s) => s.query)
  const rateMin = useExplorerStore((s) => s.rateMin)
  const rateMax = useExplorerStore((s) => s.rateMax)
  const tags = useExplorerStore((s) => s.tags)
  const sortBy = useExplorerStore((s) => s.sortBy)
  const sageMode = useExplorerStore((s) => s.sageMode)
  const retryTrigger = useExplorerStore((s) => s.retryTrigger)

  // Zustand actions are referentially stable — safe in dep array without useCallback
  const setLoading = useExplorerStore((s) => s.setLoading)
  const setResults = useExplorerStore((s) => s.setResults)
  const setError = useExplorerStore((s) => s.setError)
  const resetResults = useExplorerStore((s) => s.resetResults)

  // Infinite scroll state + actions — individual selectors (Phase 16 pattern)
  const cursor = useExplorerStore((s) => s.cursor)
  const loading = useExplorerStore((s) => s.loading)
  const isFetchingMore = useExplorerStore((s) => s.isFetchingMore)
  const appendResults = useExplorerStore((s) => s.appendResults)
  const setFetchingMore = useExplorerStore((s) => s.setFetchingMore)

  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Sage mode guard — abort any in-flight explore request and yield control to useSage.
    // Must come FIRST (before setLoading) to avoid loading flash.
    // Aborting here ensures a mid-flight /api/explore response cannot overwrite sage results.
    if (sageMode) {
      if (controllerRef.current) {
        controllerRef.current.abort()
        controllerRef.current = null
      }
      return
    }

    // Abort any in-flight request from the previous effect run
    if (controllerRef.current) {
      controllerRef.current.abort()
    }

    const controller = new AbortController()
    controllerRef.current = controller

    const params = new URLSearchParams({
      query,
      rate_min: String(rateMin),
      rate_max: String(rateMax),
      tags: tags.join(','),
      limit: '20',
      cursor: '0',
    })

    setLoading(true)
    setError(null)

    fetch(`${API_BASE}/api/explore?${params}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        setResults(data.experts, data.total, data.cursor)
        setLoading(false)
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') {
          // Silently return — cancelled request is not an error
          // Do NOT call setLoading(false) here; the next fetch will manage loading state
          return
        }
        setError(err.message ?? 'Fetch failed')
        resetResults()
        setLoading(false)
      })

    return () => {
      controller.abort()
    }
    // sortBy is in dep array even though /api/explore doesn't currently use it —
    // ensures re-fetch when sort is added later; avoids stale-closure bug
  }, [query, rateMin, rateMax, tags, sortBy, sageMode, retryTrigger, setLoading, setResults, setError, resetResults])

  // loadNextPage — passed to VirtuosoGrid endReached prop
  // Guard: don't fetch if no more pages (cursor null), already fetching more, or initial load in progress
  const loadNextPage = useCallback(async () => {
    if (cursor === null || isFetchingMore || loading) return
    setFetchingMore(true)
    try {
      const params = new URLSearchParams()
      if (query) params.set('query', query)
      params.set('rate_min', String(rateMin))
      params.set('rate_max', String(rateMax))
      tags.forEach((t) => params.append('tags', t))
      params.set('cursor', String(cursor))
      const res = await fetch(`${API_BASE}/api/explore?${params}`)
      if (!res.ok) return
      const data = await res.json()
      appendResults(data.experts, data.cursor ?? null)
    } catch {
      // silent — VirtuosoGrid will retry on next endReached trigger
    } finally {
      setFetchingMore(false)
    }
  }, [cursor, isFetchingMore, loading, query, rateMin, rateMax, tags, appendResults, setFetchingMore])

  return { loadNextPage }
}
