import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  AdminStats,
  SearchesResponse,
  GapsResponse,
  SearchFilters,
  LeadsResponse,
  ExpertsResponse,
  DomainMapResponse,
  IngestStatus,
  IntelligenceStats,
  IntelligenceMetrics,
  AdminSettingsResponse,
  NewsletterSubscribersResponse,
  DemandResponse,
  ExposureResponse,
  MarketplaceTrendResponse,
} from '../types'

const getAdminToken = () => sessionStorage.getItem('admin_token') ?? ''
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export async function adminFetch<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const url = new URL(`${API_URL}/api/admin${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v))
      }
    })
  }
  const res = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${getAdminToken()}` },
  })
  if (res.status === 401) {
    sessionStorage.removeItem('admin_token')
    window.location.href = '/admin/login'
    throw new Error('Session expired')
  }
  if (!res.ok) throw new Error(`Admin API error ${res.status}: ${await res.text()}`)
  return res.json() as Promise<T>
}

export async function adminPost<T>(path: string, body: unknown): Promise<T> {
  const url = new URL(`${API_URL}/api/admin${path}`)
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getAdminToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (res.status === 401) {
    sessionStorage.removeItem('admin_token')
    window.location.href = '/admin/login'
    throw new Error('Session expired')
  }
  if (!res.ok) throw new Error(`Admin API error ${res.status}: ${await res.text()}`)
  return res.json() as Promise<T>
}

export async function adminPostFormData<T>(path: string, formData: FormData): Promise<T> {
  const url = new URL(`${API_URL}/api/admin${path}`)
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${getAdminToken()}` },
    body: formData,
  })
  if (res.status === 401) {
    sessionStorage.removeItem('admin_token')
    window.location.href = '/admin/login'
    throw new Error('Session expired')
  }
  if (!res.ok) throw new Error(`Admin API error ${res.status}: ${await res.text()}`)
  return res.json() as Promise<T>
}

export function useAdminStats() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    adminFetch<AdminStats>('/stats')
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return { stats, loading, error }
}

export function useAdminSearches(filters: SearchFilters = {}) {
  const [data, setData] = useState<SearchesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    adminFetch<SearchesResponse>('/searches', filters as Record<string, string | number | boolean | undefined>)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)])

  useEffect(() => { fetchData() }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

export function useAdminGaps() {
  const [data, setData] = useState<GapsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    adminFetch<GapsResponse>('/gaps')
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

export function useAdminLeads() {
  const [data, setData] = useState<LeadsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    adminFetch<LeadsResponse>('/leads')
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

export function useAdminExperts() {
  const [data, setData] = useState<ExpertsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    adminFetch<ExpertsResponse>('/experts')
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

export function useAdminDomainMap() {
  const [data, setData] = useState<DomainMapResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    adminFetch<DomainMapResponse>('/domain-map')
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading, error, fetchData }
}

export function useIntelligenceStats() {
  const [data, setData] = useState<IntelligenceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    adminFetch<IntelligenceStats>('/intelligence-stats')
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

export function useIntelligenceMetrics() {
  const [data, setData] = useState<IntelligenceMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    adminFetch<IntelligenceMetrics>('/intelligence')
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

export function useIngestStatus() {
  const [ingest, setIngest] = useState<IngestStatus>({
    status: 'idle',
    log: '',
    error: null,
    started_at: null,
    last_rebuild_at: null,          // Phase 24
    expert_count_at_rebuild: null,  // Phase 24 + 25
  })
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const startPolling = useCallback(() => {
    stopPolling()
    pollRef.current = setInterval(() => {
      adminFetch<IngestStatus>('/ingest/status')
        .then(s => {
          setIngest(s)
          if (s.status !== 'running') stopPolling()
        })
        .catch(() => stopPolling())
    }, 3000)
  }, [stopPolling])

  // Clean up on unmount
  useEffect(() => () => stopPolling(), [stopPolling])

  const triggerRun = useCallback(async (path = '/ingest/run') => {
    await adminPost<{ status: string }>(path, {})
    setIngest(prev => ({ ...prev, status: 'running' }))
    startPolling()
  }, [startPolling])

  return { ingest, triggerRun }
}

export function useAdminSettings() {
  const [data, setData] = useState<AdminSettingsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    adminFetch<AdminSettingsResponse>('/settings')
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

export function useNewsletterSubscribers() {
  const [data, setData] = useState<NewsletterSubscribersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    adminFetch<NewsletterSubscribersResponse>('/newsletter-subscribers')
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading, error }
}

export function useEmbeddingMap() {
  const [data, setData] = useState<import('../types').EmbeddingMapResponse | null>(null)
  const [status, setStatus] = useState<'loading' | 'computing' | 'ready' | 'error'>('loading')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/admin/embedding-map`,
        { headers: { 'Authorization': `Bearer ${getAdminToken()}` } }
      )
      if (res.status === 202) {
        setStatus('computing')
        return // keep polling
      }
      if (!res.ok) {
        setStatus('error')
        if (intervalRef.current) clearInterval(intervalRef.current)
        return
      }
      const json = await res.json() as import('../types').EmbeddingMapResponse
      setData(json)
      setStatus('ready')
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    } catch {
      setStatus('error')
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  useEffect(() => {
    poll()
    intervalRef.current = setInterval(poll, 5000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [poll])

  return { data, status }
}

export function useMarketplaceDemand(days: number, page: number) {
  const [data, setData] = useState<DemandResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    adminFetch<DemandResponse>('/events/demand', { days, page, page_size: 25 })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [days, page])

  useEffect(() => { fetchData() }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

export function useMarketplaceExposure(days: number) {
  const [data, setData] = useState<ExposureResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    adminFetch<ExposureResponse>('/events/exposure', { days })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [days])

  useEffect(() => { fetchData() }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

export function useMarketplaceTrend() {
  const [data, setData] = useState<MarketplaceTrendResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    adminFetch<MarketplaceTrendResponse>('/events/trend')
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
