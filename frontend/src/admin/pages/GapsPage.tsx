import { useState } from 'react'
import { useMarketplaceDemand } from '../hooks/useAdminData'
import { AdminPageHeader } from '../components/AdminPageHeader'
import { AdminCard } from '../components/AdminCard'

export default function GapsPage() {
  const [page, setPage] = useState(1)
  const { data, loading, error } = useMarketplaceDemand(0, page) // days=0 for all time

  const total = data?.total ?? 0
  const pageSize = data?.page_size ?? 25
  const currentPage = data?.page ?? 1
  const totalPages = Math.ceil(total / pageSize)
  const rowStart = (currentPage - 1) * pageSize + 1
  const rowEnd = Math.min(currentPage * pageSize, total)

  return (
    <div className="p-8 space-y-6">
      <AdminPageHeader
        title="Zero-Result Queries"
        subtitle="Searches that returned no results — ranked by frequency"
      />

      {loading && <p className="text-slate-500 text-sm animate-pulse">Loading...</p>}
      {error && <p className="text-red-400 text-sm">Error: {error}</p>}

      {data && (
        <AdminCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/60">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Query</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Frequency</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Seen</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Unique Users</th>
                </tr>
              </thead>
              <tbody>
                {(data.demand ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-slate-500">
                      No zero-result queries found
                    </td>
                  </tr>
                ) : (
                  (data.demand ?? []).map((row, i) => (
                    <tr key={i} className="border-b border-slate-700/40 hover:bg-slate-700/20 transition-colors">
                      <td className="px-5 py-3 text-white max-w-xs truncate" title={row.query_text}>{row.query_text}</td>
                      <td className="px-5 py-3 text-right font-mono text-slate-300">{row.frequency}</td>
                      <td className="px-5 py-3 text-right text-slate-400 text-xs">
                        {new Date(row.last_seen).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-slate-300">{row.unique_users}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {total > pageSize && (
            <div className="px-5 py-3 border-t border-slate-700/60 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Showing {rowStart}–{rowEnd} of {total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </AdminCard>
      )}
    </div>
  )
}
