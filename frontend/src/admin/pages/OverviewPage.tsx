import { useEffect, useState } from 'react'
import { useAdminStats } from '../hooks/useAdminData'

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

export default function OverviewPage() {
  const { stats, loading, error } = useAdminStats()
  const { status: healthStatus, latency } = useHealthCheck()

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
    <div className="p-8 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Overview</h1>
          <p className="text-slate-500 text-sm mt-1">Platform analytics at a glance</p>
        </div>
        {/* System health gauge */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl px-6 py-4 flex flex-col items-center gap-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">System</p>
          <Speedometer status={healthStatus} latency={latency} />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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

      {/* Top queries + top feedback */}
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
