import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { useAdminStats, adminFetch, useMarketplaceTrend, useAnalyticsSummary } from '../hooks/useAdminData'
import type { DemandResponse, LeadsResponse, SearchesResponse, RecentSearchEntry, RecentClickEntry } from '../types'

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

function Speedometer({ status, latency }: { status: HealthStatus; latency: number | null }) {
  // SVG semicircle gauge: r=36, cx=50, cy=50
  const r = 36
  const arc = Math.PI * r  // half-circle length ≈ 113.1
  const fill = status === 'up' ? arc : status === 'down' ? 0 : arc * 0.5
  const color = status === 'up' ? '#22c55e' : status === 'down' ? '#ef4444' : '#6366f1'
  const label = status === 'up' ? 'Operational' : status === 'down' ? 'Offline' : 'Checking…'

  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 100 56" className="w-28 h-16">
        {/* Track */}
        <path
          d="M 14 50 A 36 36 0 0 1 86 50"
          fill="none" stroke="#1e293b" strokeWidth="9" strokeLinecap="round"
        />
        {/* Fill */}
        <path
          d="M 14 50 A 36 36 0 0 1 86 50"
          fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${arc}`}
          strokeDashoffset={`${arc - fill}`}
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }}
        />
        {/* Center dot */}
        <circle cx="50" cy="50" r="4" fill={color} style={{ transition: 'fill 0.4s ease' }} />
      </svg>
      <p className={`text-sm font-semibold ${
        status === 'up' ? 'text-emerald-400' : status === 'down' ? 'text-red-400' : 'text-indigo-400'
      }`}>
        {label}
      </p>
      {latency !== null && status === 'up' && (
        <p className="text-xs text-slate-500">{latency} ms</p>
      )}
    </div>
  )
}

function TrendStatCard({ label, value, delta, deltaLabel }: {
  label: string; value: number | string; delta: number; deltaLabel: string
}) {
  const isUp = delta > 0
  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{label}</p>
      <p className="text-3xl font-bold text-white">{typeof value === 'string' && value.length > 20 ? <span className="text-lg">{value}</span> : value}</p>
      <div className="flex items-center gap-1 mt-1">
        {delta !== 0 && (
          <span className={`text-xs font-medium ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
            {isUp ? '\u2191' : '\u2193'} {Math.abs(delta)}
          </span>
        )}
        <span className="text-xs text-slate-500">{deltaLabel}</span>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
}) {
  return (
    <div
      className={`bg-slate-800/60 border rounded-xl p-5 ${
        accent
          ? 'border-purple-500/40 ring-1 ring-purple-500/20'
          : 'border-slate-700/60'
      }`}
    >
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-3xl font-bold ${accent ? 'text-purple-400' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

function TopZeroResultsCard() {
  const [data, setData] = useState<DemandResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminFetch<DemandResponse>('/events/demand', { days: 30, page: 0, page_size: 5 })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const rows = data?.demand ?? []

  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">Top Zero-Result Queries</h2>
        <Link to="/admin/gaps" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
          See all →
        </Link>
      </div>
      {loading ? (
        <p className="text-slate-500 text-sm animate-pulse">Loading…</p>
      ) : data?.data_since === null ? (
        <p className="text-slate-500 text-sm">No tracking data yet — insights appear after ~50 page views</p>
      ) : rows.length === 0 ? (
        <p className="text-slate-500 text-sm">No zero-result queries in the last 30 days</p>
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 5).map((row, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-sm text-slate-300 truncate max-w-[75%]" title={row.query_text}>
                {row.query_text}
              </span>
              <span className="text-xs text-red-400 font-mono ml-2 flex-shrink-0">{row.frequency}×</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SageSparklineCard() {
  const { data, loading } = useMarketplaceTrend()
  const last7 = (data?.daily ?? []).slice(-7)

  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-white mb-1">Sage Volume</h2>
      <p className="text-xs text-slate-500 mb-4">Last 7 days</p>
      {loading ? (
        <div className="h-16 flex items-center">
          <p className="text-slate-500 text-sm animate-pulse">Loading…</p>
        </div>
      ) : data?.data_since === null ? (
        <div className="h-16 flex items-center">
          <p className="text-slate-500 text-sm">No tracking data yet</p>
        </div>
      ) : (
        <>
          <div className="text-2xl font-bold text-white mb-3">
            {data?.kpis?.total_queries ?? 0}
            <span className="text-sm font-normal text-slate-500 ml-1.5">queries / 14d</span>
          </div>
          <ResponsiveContainer width="100%" height={56}>
            <LineChart data={last7}>
              <Line type="monotone" dataKey="total" stroke="#22d3ee" strokeWidth={2} dot={{ r: 3, fill: '#22d3ee', strokeWidth: 0 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #22d3ee40',
                  borderRadius: '6px',
                  fontSize: '11px',
                }}
                labelStyle={{ color: '#94a3b8' }}
                itemStyle={{ color: '#22d3ee' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  )
}

function RecentLeadsCard() {
  const [data, setData] = useState<LeadsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminFetch<LeadsResponse>('/leads')
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const rows = (data?.leads ?? [])
    .filter(l => l.last_search_at)
    .sort((a, b) => new Date(b.last_search_at!).getTime() - new Date(a.last_search_at!).getTime())
    .slice(0, 5)

  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">Recent Leads</h2>
        <Link to="/admin/leads" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
          View all →
        </Link>
      </div>
      {loading ? (
        <p className="text-slate-500 text-sm animate-pulse">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-slate-500 text-sm">No leads yet</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.email} className="flex items-center justify-between">
              <span className="text-sm text-slate-300 truncate max-w-[60%]" title={row.email}>{row.email}</span>
              <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                <span className="text-xs text-slate-500">{row.total_searches} searches</span>
                <span className="text-xs text-slate-500">{timeAgo(row.last_search_at!)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RecentSearchesCard() {
  const [data, setData] = useState<SearchesResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminFetch<SearchesResponse>('/searches', { page: 0, page_size: 5 })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const rows = data?.rows ?? []

  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">Recent Searches</h2>
        <Link to="/admin/data" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
          View all →
        </Link>
      </div>
      {loading ? (
        <p className="text-slate-500 text-sm animate-pulse">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-slate-500 text-sm">No searches yet</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between">
              <span className="text-sm text-slate-300 truncate max-w-[60%]" title={row.query}>{row.query}</span>
              <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  row.source === 'sage' ? 'bg-cyan-900/50 text-cyan-400' : 'bg-indigo-900/50 text-indigo-400'
                }`}>{row.source}</span>
                <span className="text-xs text-slate-500">{timeAgo(row.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RecentExploreSearchesCard({ searches, loading }: { searches: RecentSearchEntry[]; loading: boolean }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">Recent Explore Searches</h2>
        <span className="text-xs text-slate-500">from marketplace search bar</span>
      </div>
      {loading ? (
        <p className="text-slate-500 text-sm animate-pulse">Loading...</p>
      ) : searches.length === 0 ? (
        <p className="text-slate-500 text-sm">No explore searches tracked yet -- data appears after users search the marketplace</p>
      ) : (
        <div className="space-y-2">
          {searches.map((row, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-sm text-slate-300 truncate max-w-[55%]" title={row.query_text}>
                {row.query_text}
              </span>
              <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-400 font-medium">
                  {row.result_count} results
                </span>
                <span className="text-xs text-slate-500">{timeAgo(row.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RecentCardClicksCard({ clicks, loading }: { clicks: RecentClickEntry[]; loading: boolean }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">Recent Card Clicks</h2>
        <Link to="/admin/marketplace" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
          Exposure details -&gt;
        </Link>
      </div>
      {loading ? (
        <p className="text-slate-500 text-sm animate-pulse">Loading...</p>
      ) : clicks.length === 0 ? (
        <p className="text-slate-500 text-sm">No card clicks tracked yet -- data appears after users click expert cards</p>
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
    </div>
  )
}

export default function OverviewPage() {
  const { stats, loading, error } = useAdminStats()
  const { status: healthStatus, latency } = useHealthCheck()
  const { data: analytics, loading: analyticsLoading } = useAnalyticsSummary()

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-slate-500 text-sm animate-pulse">Loading stats…</div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="p-8">
        <div className="text-red-400 text-sm">Error: {error}</div>
      </div>
    )
  }
  if (!stats) return null

  const maxQueryCount = stats.top_queries[0]?.count ?? 1

  return (
    <div className="p-8 space-y-6">
      {/* Section 0: Key overview stat cards with 7-day trends */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <TrendStatCard
          label="Total Leads"
          value={stats.total_leads ?? 0}
          delta={(stats.leads_7d ?? 0) - (stats.leads_prior_7d ?? 0)}
          deltaLabel="vs prev 7d"
        />
        <TrendStatCard
          label="Expert Pool"
          value={stats.expert_pool ?? 0}
          delta={stats.expert_pool_7d ?? 0}
          deltaLabel="new this week"
        />
        <TrendStatCard
          label="Top Searches"
          value={stats.top_queries?.slice(0, 3).map(q => q.query).join(', ') || 'None yet'}
          delta={0}
          deltaLabel=""
        />
        <TrendStatCard
          label="Lead Rate"
          value={`${((stats.lead_rate ?? 0) * 100).toFixed(1)}%`}
          delta={0}
          deltaLabel="searches \u2192 leads"
        />
      </div>

      {/* Section 1: Health strip — Speedometer left-aligned, KPI cards right */}
      <div className="flex items-start gap-6">
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl px-6 py-4 flex flex-col items-center gap-1 flex-shrink-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">System</p>
          <Speedometer status={healthStatus} latency={latency} />
        </div>
        <div className="flex-1 grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Total Searches" value={stats.total_searches} />
          <StatCard
            label="Matches"
            value={stats.match_count}
            sub={`${(stats.match_rate * 100).toFixed(1)}% match rate`}
            accent
          />
          <StatCard label="Match Rate" value={`${(stats.match_rate * 100).toFixed(1)}%`} />
          <StatCard label="Gaps" value={stats.gap_count} sub="queries needing improvement" />
        </div>
      </div>

      {/* Section 1.5: Marketplace Analytics Counters */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard
          label="Expert Card Clicks"
          value={analyticsLoading ? '...' : (analytics?.total_card_clicks ?? 0)}
          sub="all-time marketplace clicks"
        />
        <StatCard
          label="Explore Searches"
          value={analyticsLoading ? '...' : (analytics?.total_search_queries ?? 0)}
          sub="marketplace search queries"
        />
        <StatCard
          label="Lead Clicks"
          value={analyticsLoading ? '...' : (analytics?.total_lead_clicks ?? 0)}
          sub="clicks by identified leads"
          accent
        />
      </div>

      {/* Section 2: Two-column insight cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <TopZeroResultsCard />
        <SageSparklineCard />
      </div>

      {/* Section 2.5: Recent activity — leads + searches */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <RecentLeadsCard />
        <RecentSearchesCard />
      </div>

      {/* Section 2.7: Marketplace analytics — explore searches + card clicks */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <RecentExploreSearchesCard
          searches={analytics?.recent_searches ?? []}
          loading={analyticsLoading}
        />
        <RecentCardClicksCard
          clicks={analytics?.recent_clicks ?? []}
          loading={analyticsLoading}
        />
      </div>

      {/* Section 3: Top Queries + Top Feedback */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top Queries */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Top Searched Queries</h2>
          {stats.top_queries.length === 0 ? (
            <p className="text-slate-500 text-sm">No data yet</p>
          ) : (
            <div className="space-y-3">
              {stats.top_queries.map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-slate-300 truncate max-w-[75%]" title={item.query}>
                      {item.query}
                    </span>
                    <span className="text-xs text-slate-500 ml-2 flex-shrink-0">{item.count}×</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full"
                      style={{ width: `${(item.count / maxQueryCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Feedback */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Top Feedback</h2>
          {stats.top_feedback.length === 0 ? (
            <p className="text-slate-500 text-sm">No feedback recorded yet</p>
          ) : (
            <div className="space-y-2">
              {stats.top_feedback.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0"
                >
                  <span className="text-sm text-slate-300 truncate max-w-[70%]" title={item.query}>
                    {item.query}
                  </span>
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        item.vote === 'up'
                          ? 'bg-emerald-900/50 text-emerald-400'
                          : 'bg-red-900/50 text-red-400'
                      }`}
                    >
                      {item.vote === 'up' ? '👍' : '👎'} {item.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
