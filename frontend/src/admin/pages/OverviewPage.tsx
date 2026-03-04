import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { TrendingUp, Search, AlertCircle, CheckCircle } from 'lucide-react'
import { useAdminStats, adminFetch, useAnalyticsSummary } from '../hooks/useAdminData'
import { AdminCard } from '../components/AdminCard'
import type { DemandResponse, ExposureResponse, TopQueriesResponse, NewsletterSubscribersResponse, RecentSearchEntry, RecentClickEntry } from '../types'

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

type HealthStatus = 'checking' | 'up' | 'down'

function useHealthCheck() {
  const [status, setStatus] = useState<HealthStatus>('checking')
  const [latency, setLatency] = useState<number | null>(null)

  useEffect(() => {
    const check = async () => {
      const t0 = performance.now()
      try {
        const res = await fetch(`${API_URL}/api/health`, { cache: 'no-store' })
        const ms = Math.round(performance.now() - t0)
        setLatency(ms)
        setStatus(res.ok ? 'up' : 'down')
      } catch {
        setStatus('down')
        setLatency(null)
      }
    }
    check()
    const id = setInterval(check, 30_000)
    return () => clearInterval(id)
  }, [])

  return { status, latency }
}

// ─── Period toggle ──────────────────────────────────────────────────────────

const PERIODS = [
  { label: 'Today', days: 1 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: 'All', days: 0 },
]

// ─── Compact stat card ──────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent = false,
  onClick,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
  onClick?: () => void
}) {
  return (
    <AdminCard
      className={`p-5 ${
        accent ? 'border-purple-500/40 ring-1 ring-purple-500/20' : ''
      }${onClick ? ' cursor-pointer hover:border-purple-500/40 hover:bg-slate-800/80 transition-all' : ''}`}
      onClick={onClick}
    >
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-3xl font-bold ${accent ? 'text-purple-400' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </AdminCard>
  )
}

// ─── Section cards ──────────────────────────────────────────────────────────

function ZeroResultQueriesCard({ days }: { days: number }) {
  const [data, setData] = useState<DemandResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    adminFetch<DemandResponse>('/events/demand', { days, page: 0, page_size: 5 })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [days])

  const rows = data?.demand ?? []

  return (
    <AdminCard className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-white">Zero-Result Queries</h2>
        </div>
        <Link to="/admin/gaps" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
          See all &rarr;
        </Link>
      </div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-5 bg-slate-700/50 rounded animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <CheckCircle className="w-4 h-4" />
          <span>All searches returned results</span>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={row.query_text} className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-4 flex-shrink-0">{i + 1}.</span>
              <span className="text-sm text-slate-300 truncate flex-1" title={row.query_text}>{row.query_text}</span>
              <span className="text-xs text-slate-500 font-mono flex-shrink-0">{row.frequency} searches</span>
            </div>
          ))}
        </div>
      )}
    </AdminCard>
  )
}

function RecentLeadsCard() {
  const [data, setData] = useState<NewsletterSubscribersResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminFetch<NewsletterSubscribersResponse>('/newsletter-subscribers')
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const rows = (data?.subscribers ?? []).slice(0, 5)

  return (
    <AdminCard className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">Leads</h2>
        <Link to="/admin/leads" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
          View all &rarr;
        </Link>
      </div>
      {loading ? (
        <p className="text-slate-500 text-sm animate-pulse">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-slate-500 text-sm">No leads yet</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.email} className="flex items-center justify-between">
              <span className="text-sm text-slate-300 truncate max-w-[60%]" title={row.email}>{row.email}</span>
              <span className="text-xs text-slate-500 flex-shrink-0 ml-2">{timeAgo(row.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </AdminCard>
  )
}

function RecentExploreSearchesCard({ searches, loading }: { searches: RecentSearchEntry[]; loading: boolean }) {
  return (
    <AdminCard className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">Recent Searches</h2>
        <Link to="/admin/data" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
          View all &rarr;
        </Link>
      </div>
      {loading ? (
        <p className="text-slate-500 text-sm animate-pulse">Loading...</p>
      ) : searches.length === 0 ? (
        <p className="text-slate-500 text-sm">No searches in this period</p>
      ) : (
        <div className="space-y-2">
          {searches.map((row, i) => {
            const isTagSearch = !row.query_text && (row.active_tags ?? []).length > 0
            const isBrowse = !row.query_text && (row.active_tags ?? []).length === 0
            return (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 max-w-[55%]">
                  {isTagSearch ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">tags</span>
                      {(row.active_tags ?? []).map((tag, ti) => (
                        <span key={ti} className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-700/80 border border-slate-600/50 text-xs text-slate-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : isBrowse ? (
                    <span className="text-sm text-slate-500 italic">Browse (no filter)</span>
                  ) : (
                    <span className="text-sm text-slate-300 truncate" title={row.query_text}>
                      {row.query_text}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-400 font-medium">
                    {row.result_count} results
                  </span>
                  <span className="text-xs text-slate-500">{timeAgo(row.created_at)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </AdminCard>
  )
}

function RecentCardClicksCard({ clicks, loading }: { clicks: RecentClickEntry[]; loading: boolean }) {
  return (
    <AdminCard className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">Recent Clicks</h2>
        <Link to="/admin/data" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
          Exposure details &rarr;
        </Link>
      </div>
      {loading ? (
        <p className="text-slate-500 text-sm animate-pulse">Loading...</p>
      ) : clicks.length === 0 ? (
        <p className="text-slate-500 text-sm">No click activity in this period</p>
      ) : (
        <div className="space-y-2">
          {clicks.map((row, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-sm text-slate-300 truncate max-w-[55%]" title={row.expert_name ?? row.expert_id}>
                {row.expert_name ?? row.expert_id}
              </span>
              <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  row.source === 'sage' ? 'bg-cyan-900/50 text-cyan-400' : 'bg-indigo-900/50 text-indigo-400'
                }`}>
                  {row.source}
                </span>
                <span className="text-xs text-slate-500">{timeAgo(row.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminCard>
  )
}

// ─── Ranked insight cards (Phase 62) ────────────────────────────────────────

function TopExpertsCard({ days }: { days: number }) {
  const [data, setData] = useState<ExposureResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    adminFetch<ExposureResponse>('/events/exposure', { days })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [days])

  const rows = (data?.exposure ?? []).slice(0, 5)

  return (
    <AdminCard className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-purple-400" />
        <h2 className="text-sm font-semibold text-white">Top Clicks</h2>
      </div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-5 bg-slate-700/50 rounded animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">No click activity yet</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={row.expert_id} className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-4 flex-shrink-0">{i + 1}.</span>
              <Link
                to={`/admin/experts`}
                className="text-sm text-slate-300 hover:text-purple-400 transition-colors truncate flex-1"
                title={row.expert_name ?? row.expert_id}
              >
                {row.expert_name ?? row.expert_id}
              </Link>
              <span className="text-xs text-slate-500 font-mono flex-shrink-0">{row.total_clicks} clicks</span>
            </div>
          ))}
        </div>
      )}
    </AdminCard>
  )
}

function TopQueriesCard({ days }: { days: number }) {
  const [data, setData] = useState<TopQueriesResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    adminFetch<TopQueriesResponse>('/analytics/top-queries', { days, limit: 5 })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [days])

  const rows = data?.queries ?? []

  return (
    <AdminCard className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Search className="w-4 h-4 text-blue-400" />
        <h2 className="text-sm font-semibold text-white">Top Searches</h2>
      </div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-5 bg-slate-700/50 rounded animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">No search activity yet</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={row.query_text} className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-4 flex-shrink-0">{i + 1}.</span>
              <span className="text-sm text-slate-300 truncate flex-1" title={row.query_text}>{row.query_text}</span>
              <span className="text-xs text-slate-500 font-mono flex-shrink-0">{row.frequency} searches</span>
            </div>
          ))}
        </div>
      )}
    </AdminCard>
  )
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const [days, setDays] = useState(7)
  const { stats, loading, error } = useAdminStats(days)
  const { status: healthStatus, latency } = useHealthCheck()
  const { data: analytics, loading: analyticsLoading } = useAnalyticsSummary(days)
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="p-4 lg:p-8">
        <div className="text-slate-500 text-sm animate-pulse">Loading stats...</div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="p-4 lg:p-8">
        <div className="text-red-400 text-sm">Error: {error}</div>
      </div>
    )
  }
  if (!stats) return null

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header with period toggle and health indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Overview</h1>
            <p className="text-slate-500 text-sm mt-1">Dashboard</p>
          </div>
          {/* Health indicator */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
            healthStatus === 'up'
              ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30'
              : healthStatus === 'down'
              ? 'bg-red-900/30 text-red-400 border border-red-500/30'
              : 'bg-slate-800 text-slate-400 border border-slate-700'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              healthStatus === 'up' ? 'bg-emerald-400' : healthStatus === 'down' ? 'bg-red-400' : 'bg-slate-400 animate-pulse'
            }`} />
            {healthStatus === 'up' ? `${latency}ms` : healthStatus === 'down' ? 'Offline' : 'Checking'}
          </div>
        </div>
        {/* Period toggle */}
        <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
          {PERIODS.map(p => (
            <button
              key={p.days}
              onClick={() => setDays(p.days)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                days === p.days
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Searches"
          value={analyticsLoading ? '...' : (analytics?.total_search_queries ?? 0)}
          onClick={() => navigate('/admin/data')}
        />
        <StatCard
          label="Zero-Result Queries"
          value={stats.gap_count}
          sub="queries needing improvement"
          onClick={() => navigate('/admin/gaps')}
        />
        <StatCard
          label="New Leads"
          value={stats.total_leads ?? 0}
          accent
          onClick={() => navigate('/admin/leads')}
        />
        <StatCard
          label="Expert Card Clicks"
          value={analyticsLoading ? '...' : (analytics?.total_card_clicks ?? 0)}
          sub={`${analyticsLoading ? '...' : (analytics?.total_lead_clicks ?? 0)} lead clicks`}
          onClick={() => navigate('/admin/data')}
        />
      </div>

      {/* All detail cards — single unified grid, ordered by visibility */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <TopExpertsCard days={days} />
        <TopQueriesCard days={days} />
        <ZeroResultQueriesCard days={days} />
        <RecentExploreSearchesCard
          searches={analytics?.recent_searches ?? []}
          loading={analyticsLoading}
        />
        <RecentCardClicksCard
          clicks={analytics?.recent_clicks ?? []}
          loading={analyticsLoading}
        />
        <RecentLeadsCard />
      </div>

    </div>
  )
}
