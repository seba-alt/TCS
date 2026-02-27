import { useNavigate } from 'react-router-dom'
import type { GapRow } from '../types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const getAdminToken = () => sessionStorage.getItem('admin_token') ?? ''

interface GapsTableProps {
  data: GapRow[]
  onResolved: () => void
}

export default function GapsTable({ data, onResolved }: GapsTableProps) {
  const navigate = useNavigate()

  async function handleResolve(gap: GapRow) {
    try {
      await fetch(`${API_URL}/api/admin/gaps/${encodeURIComponent(gap.query)}/resolve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getAdminToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: true }),
      })
      onResolved()
    } catch (e) {
      console.error('Resolve failed:', e)
    }
  }

  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/60">
              {['Query', 'Occurrences', 'Best Score', 'Status', 'Actions'].map(h => (
                <th
                  key={h}
                  className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                  No gaps detected.
                </td>
              </tr>
            ) : (
              data.map((gap, i) => (
                <tr key={i} className="border-b border-slate-700/40 hover:bg-slate-700/20 transition-colors">
                  <td className="px-5 py-3 max-w-xs">
                    <span className="block truncate text-white" title={gap.query}>
                      {gap.query}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-300">{gap.frequency}</td>
                  <td className="px-5 py-3 font-mono text-slate-400">
                    {gap.best_score != null ? gap.best_score.toFixed(3) : '—'}
                  </td>
                  <td className="px-5 py-3">
                    {gap.resolved ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-900/50 text-emerald-400 border border-emerald-800/50">
                        Resolved
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-900/50 text-red-400 border border-red-800/50">
                        Open
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => navigate('/admin/searches', { state: { query: gap.query } })}
                        className="text-xs text-blue-400 hover:text-blue-300 hover:underline whitespace-nowrap"
                      >
                        View Searches →
                      </button>
                      {!gap.resolved && (
                        <button
                          onClick={() => handleResolve(gap)}
                          className="text-xs text-purple-400 hover:text-purple-300 hover:underline whitespace-nowrap"
                        >
                          Mark Resolved
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
