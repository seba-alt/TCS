import { useAdminStats } from '../hooks/useAdminData'

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
      <div>
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        <p className="text-slate-500 text-sm mt-1">Platform analytics at a glance</p>
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
