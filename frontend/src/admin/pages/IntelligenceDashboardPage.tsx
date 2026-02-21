import { useIntelligenceStats } from '../hooks/useAdminData'
import type { IntelligenceDailyRow } from '../types'

function FlagPill({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
      enabled
        ? 'bg-purple-900/30 border-purple-700/50 text-purple-300'
        : 'bg-slate-800/60 border-slate-700/50 text-slate-500'
    }`}>
      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${enabled ? 'bg-purple-400 shadow-[0_0_6px_rgba(168,85,247,0.8)]' : 'bg-slate-600'}`} />
      <div className="min-w-0">
        <p className="text-xs font-mono truncate">{label}</p>
        <p className={`text-xs font-semibold mt-0.5 ${enabled ? 'text-purple-200' : 'text-slate-600'}`}>
          {enabled ? 'ENABLED' : 'DISABLED'}
        </p>
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub, accent }: {
  label: string
  value: string
  sub?: string
  accent?: 'purple' | 'green' | 'yellow' | 'red'
}) {
  const colors = {
    purple: 'text-purple-400',
    green: 'text-emerald-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
  }
  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-3xl font-bold ${accent ? colors[accent] : 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-600 mt-1">{sub}</p>}
    </div>
  )
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-400 w-6 text-right">{value}</span>
    </div>
  )
}

function DailyTable({ rows }: { rows: IntelligenceDailyRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-slate-600 text-sm text-center py-8">
        No data yet — conversations will appear here once users start querying.
      </p>
    )
  }

  const maxConv = Math.max(...rows.map(r => r.conversations), 1)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-700/50">
            <th className="text-left pb-3 pr-4">Date</th>
            <th className="text-right pb-3 px-4">Queries</th>
            <th className="pb-3 px-4 text-left">Volume</th>
            <th className="text-right pb-3 px-4">HyDE</th>
            <th className="text-right pb-3 px-4">Feedback</th>
            <th className="text-right pb-3 px-4">Gaps</th>
            <th className="text-right pb-3 pl-4">Avg Score</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/30">
          {[...rows].reverse().map(r => {
            const hydeRate = r.conversations > 0 ? r.hyde_triggered / r.conversations : 0
            const gapRate = r.conversations > 0 ? r.gaps / r.conversations : 0
            return (
              <tr key={r.date} className="hover:bg-slate-700/20 transition-colors">
                <td className="py-2.5 pr-4 text-slate-400 font-mono text-xs whitespace-nowrap">
                  {r.date}
                </td>
                <td className="py-2.5 px-4 text-right text-white font-medium">
                  {r.conversations}
                </td>
                <td className="py-2.5 px-4 min-w-[100px]">
                  <MiniBar value={r.conversations} max={maxConv} color="bg-slate-500" />
                </td>
                <td className="py-2.5 px-4 text-right">
                  {r.hyde_triggered > 0 ? (
                    <span className="text-purple-400 font-medium">
                      {r.hyde_triggered}
                      <span className="text-slate-600 font-normal text-xs ml-1">
                        ({Math.round(hydeRate * 100)}%)
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="py-2.5 px-4 text-right">
                  {r.feedback_applied > 0 ? (
                    <span className="text-blue-400 font-medium">{r.feedback_applied}</span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="py-2.5 px-4 text-right">
                  {r.gaps > 0 ? (
                    <span className={gapRate > 0.3 ? 'text-red-400 font-medium' : 'text-yellow-400'}>
                      {r.gaps}
                      <span className="text-slate-600 font-normal text-xs ml-1">
                        ({Math.round(gapRate * 100)}%)
                      </span>
                    </span>
                  ) : (
                    <span className="text-emerald-400 text-xs">0</span>
                  )}
                </td>
                <td className="py-2.5 pl-4 text-right font-mono text-xs">
                  {r.avg_score !== null ? (
                    <span className={
                      r.avg_score >= 0.8 ? 'text-emerald-400' :
                      r.avg_score >= 0.6 ? 'text-yellow-400' : 'text-red-400'
                    }>
                      {r.avg_score.toFixed(3)}
                    </span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function IntelligenceDashboardPage() {
  const { data, loading, error } = useIntelligenceStats()

  return (
    <div className="p-8 space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Search Intelligence</h1>
        <p className="text-slate-500 text-sm mt-1">
          Track HyDE query expansion and feedback re-ranking performance over time.
        </p>
      </div>

      {loading && (
        <p className="text-slate-500 text-sm animate-pulse">Loading…</p>
      )}

      {error && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-xl px-5 py-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Flag status */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Feature Flags (Railway env vars)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FlagPill enabled={data.flags.hyde_enabled} label="QUERY_EXPANSION_ENABLED" />
              <FlagPill enabled={data.flags.feedback_enabled} label="FEEDBACK_LEARNING_ENABLED" />
            </div>
            {(!data.flags.hyde_enabled || !data.flags.feedback_enabled) && (
              <p className="text-xs text-slate-600 mt-2">
                Flags are off by default. Enable in Railway → Variables when ready.
              </p>
            )}
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard
              label="Total queries"
              value={data.totals.conversations.toLocaleString()}
              sub="all time"
            />
            <MetricCard
              label="HyDE trigger rate"
              value={`${Math.round(data.totals.hyde_rate * 100)}%`}
              sub={`${data.totals.hyde_triggered} of ${data.totals.conversations}`}
              accent="purple"
            />
            <MetricCard
              label="Gap rate"
              value={`${Math.round(data.totals.gap_rate * 100)}%`}
              sub={`${data.totals.gaps} unresolved`}
              accent={data.totals.gap_rate > 0.3 ? 'red' : data.totals.gap_rate > 0.15 ? 'yellow' : 'green'}
            />
            <MetricCard
              label="Avg similarity score"
              value={data.totals.avg_score !== null ? data.totals.avg_score.toFixed(3) : '—'}
              sub="across all matches"
              accent={
                data.totals.avg_score === null ? undefined :
                data.totals.avg_score >= 0.75 ? 'green' :
                data.totals.avg_score >= 0.6 ? 'yellow' : 'red'
              }
            />
          </div>

          {/* Feedback re-ranking note if enabled */}
          {data.totals.feedback_applied > 0 && (
            <div className="bg-blue-950/30 border border-blue-800/40 rounded-xl px-5 py-3 text-sm text-blue-300">
              Feedback re-ranking applied to <strong>{data.totals.feedback_applied}</strong> queries
              ({Math.round(data.totals.feedback_rate * 100)}% of total).
            </div>
          )}

          {/* Daily trend */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-5">
              Daily Trend — Last 30 Days
            </h2>
            <DailyTable rows={data.daily} />
          </div>

          {/* How to read this */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-500">
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
              <p className="text-slate-400 font-semibold mb-1">HyDE trigger rate</p>
              <p>Queries where FAISS returned fewer than 3 results above 0.60 similarity — HyDE generated a hypothetical bio and re-searched. Higher rate = more weak queries.</p>
            </div>
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
              <p className="text-slate-400 font-semibold mb-1">Gap rate</p>
              <p>Queries where no expert exceeded the 0.60 similarity threshold, or the AI asked a clarification. Lower is better. Track this over time to measure retrieval improvement.</p>
            </div>
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
              <p className="text-slate-400 font-semibold mb-1">Avg score</p>
              <p>Mean similarity score across all matched conversations. Should trend upward as the expert pool and FAISS index improve. Above 0.75 is healthy.</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
