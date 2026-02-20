import StatCard from '../components/StatCard'
import { useAdminStats } from '../hooks/useAdminData'

export default function OverviewPage() {
  const { stats, loading, error } = useAdminStats()

  if (loading) return <div className="text-gray-400 text-sm">Loading stats...</div>
  if (error) return <div className="text-red-500 text-sm">Error: {error}</div>
  if (!stats) return null

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Overview</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Searches" value={stats.total_searches} />
        <StatCard label="Matches" value={stats.match_count} sub={`${(stats.match_rate * 100).toFixed(1)}% match rate`} highlight />
        <StatCard label="Match Rate" value={`${(stats.match_rate * 100).toFixed(1)}%`} />
        <StatCard label="Gaps" value={stats.gap_count} sub="queries needing improvement" />
      </div>
    </div>
  )
}
