import type { GapRow } from '../types'

interface GapsTableProps {
  data: GapRow[]
  onResolved: () => void  // refetch callback after resolve action
}

export default function GapsTable({ data, onResolved }: GapsTableProps) {
  const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY ?? ''
  const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

  async function handleResolve(gap: GapRow) {
    try {
      await fetch(`${API_URL}/api/admin/gaps/${encodeURIComponent(gap.query)}/resolve`, {
        method: 'POST',
        headers: { 'X-Admin-Key': ADMIN_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: true }),
      })
      onResolved()
    } catch (e) {
      console.error('Resolve failed:', e)
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {['Query', 'Occurrences', 'Best Score', 'Status', ''].map(h => (
              <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-400">
                No gaps detected.
              </td>
            </tr>
          ) : (
            data.map((gap, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-6 py-3 max-w-xs">
                  <span className="block truncate text-sm text-gray-900" title={gap.query}>{gap.query}</span>
                </td>
                <td className="px-6 py-3 text-sm text-gray-700">{gap.frequency}</td>
                <td className="px-6 py-3 text-sm text-gray-700">
                  {gap.best_score != null ? gap.best_score.toFixed(3) : '—'}
                </td>
                <td className="px-6 py-3">
                  {gap.resolved ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Resolved</span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Open</span>
                  )}
                </td>
                <td className="px-6 py-3 text-right">
                  {!gap.resolved && (
                    <button
                      onClick={() => handleResolve(gap)}
                      className="text-xs font-medium text-brand-purple hover:underline"
                    >
                      Mark Resolved
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
