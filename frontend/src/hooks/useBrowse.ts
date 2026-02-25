import { useState, useEffect } from 'react'
import { useExplorerStore } from '../store'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

/** 5-minute TTL for browse data cache */
const CACHE_TTL_MS = 5 * 60 * 1000

export interface BrowseCard {
  username: string
  first_name: string
  last_name: string
  job_title: string
  company: string
  hourly_rate: number
  category: string | null
  tags: string[]
  photo_url: string | null // "/api/photos/{username}" or null
  profile_url: string
}

export interface BrowseRow {
  title: string
  slug: string
  experts: BrowseCard[]
  total: number
}

export interface BrowseData {
  featured: BrowseCard[]
  rows: BrowseRow[]
}

export function useBrowse() {
  const cached = useExplorerStore((s) => s.browseData)
  const setCached = useExplorerStore((s) => s.setBrowseData)

  // Check freshness at render time so useState initializers get the right value
  const isFresh = cached != null && (Date.now() - cached.cachedAt < CACHE_TTL_MS)

  const [data, setData] = useState<BrowseData | null>(isFresh ? cached.data : null)
  const [loading, setLoading] = useState(!isFresh)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isFresh) return // use cached data — skip fetch

    const controller = new AbortController()

    fetch(`${API_BASE}/api/browse?per_row=10`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((d: BrowseData) => {
        setData(d)
        setCached(d)
        setLoading(false)
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return
        setError(err.message ?? 'Fetch failed')
        setLoading(false)
      })

    return () => controller.abort()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error }
}
