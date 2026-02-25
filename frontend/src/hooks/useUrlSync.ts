/**
 * useUrlSync — bidirectional sync between URL query params and Zustand filter store.
 *
 * Store → URL: fires on every filter change, uses replace:true (no history push).
 * URL → Store: fires once on mount, URL params WIN over localStorage-rehydrated state.
 *
 * URL param naming:
 *   q         — text query
 *   rate_min  — minimum hourly rate (omitted if 0)
 *   rate_max  — maximum hourly rate (omitted if 5000)
 *   tags      — repeated param: ?tags=seo&tags=marketing
 *
 * IMPORTANT: Must be used inside a React Router RouterProvider (needs useSearchParams).
 */
import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useExplorerStore } from '../store'

const DEFAULT_RATE_MIN = 0
const DEFAULT_RATE_MAX = 5000

export function useUrlSync() {
  const [searchParams, setSearchParams] = useSearchParams()

  // Stable ref for setSearchParams — React Router v7 returns a new function reference
  // on every render (depends on searchParams), which would cause infinite effect loops
  // if used directly in a dependency array.
  const setSearchParamsRef = useRef(setSearchParams)
  setSearchParamsRef.current = setSearchParams

  // Read filter state for Store → URL direction
  const query = useExplorerStore((s) => s.query)
  const rateMin = useExplorerStore((s) => s.rateMin)
  const rateMax = useExplorerStore((s) => s.rateMax)
  const tags = useExplorerStore((s) => s.tags)

  // Actions for URL → Store direction
  const setQuery = useExplorerStore((s) => s.setQuery)
  const setRateRange = useExplorerStore((s) => s.setRateRange)
  const setTags = useExplorerStore((s) => s.setTags)

  // Step 1: URL → Store (one-time on mount — URL params WIN over localStorage rehydration)
  const initialized = useRef(false)
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const urlQuery = searchParams.get('q') ?? ''
    const urlRateMin = Number(searchParams.get('rate_min') ?? DEFAULT_RATE_MIN)
    const urlRateMax = Number(searchParams.get('rate_max') ?? DEFAULT_RATE_MAX)
    const urlTags = searchParams.getAll('tags')

    // Only override store if URL has meaningful params (not default/empty values)
    if (urlQuery) setQuery(urlQuery)
    if (urlRateMin !== DEFAULT_RATE_MIN || urlRateMax !== DEFAULT_RATE_MAX) {
      setRateRange(urlRateMin, urlRateMax)
    }
    if (urlTags.length > 0) setTags(urlTags)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps — intentionally runs once

  // Step 2: Store → URL (reactive, fires on every filter change)
  // Skip the first render cycle to avoid overwriting URL with localStorage state before
  // the URL → Store effect runs.
  // Uses setSearchParamsRef to avoid infinite loop (setSearchParams is unstable in RR v7).
  const skipFirst = useRef(true)
  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false
      return
    }

    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (rateMin !== DEFAULT_RATE_MIN) params.set('rate_min', String(rateMin))
    if (rateMax !== DEFAULT_RATE_MAX) params.set('rate_max', String(rateMax))
    tags.forEach((t) => params.append('tags', t))

    // replace:true — no history push on every keystroke/filter change
    setSearchParamsRef.current(params, { replace: true })
  }, [query, rateMin, rateMax, tags])
}
