import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

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
  const [data, setData] = useState<BrowseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    fetch(`${API_BASE}/api/browse?per_row=10`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((d: BrowseData) => {
        setData(d)
        setLoading(false)
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return
        setError(err.message ?? 'Fetch failed')
        setLoading(false)
      })

    return () => controller.abort()
  }, [])

  return { data, loading, error }
}
